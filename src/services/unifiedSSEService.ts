/**
 * Unified SSE Service
 *
 * Manages a single SSE connection to /api/sse that handles all event types:
 * - Remote control commands (FORCE_UPDATE, RESTART_APP, etc.)
 * - Emergency alerts (EMERGENCY_ALERT, EMERGENCY_UPDATE, EMERGENCY_CANCEL)
 * - Orientation updates (SCREEN_ORIENTATION)
 *
 * This consolidates what was previously 3 separate SSE connections into one.
 */

import logger from "../utils/logger";
import { DebugEventSource } from "../utils/debugEventSource";
import { getApiBaseUrl } from "../utils/adminUrlUtils";

type EventHandler = (event: MessageEvent) => void;
type ConnectionStatusListener = (status: ConnectionStatus) => void;

export interface ConnectionStatus {
  connected: boolean;
  url: string | null;
  readyState: number | null;
  reconnectAttempts: number;
  lastError?: string;
}

class UnifiedSSEService {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Infinity; // Unlimited attempts for emergency alerts
  private baseReconnectDelay = 1000; // 1 second base delay for exponential backoff
  private maxReconnectDelay = 30000; // 30 seconds maximum delay
  private connectionUrl: string | null = null;
  private baseURL: string | null = null;
  private isInitializing = false;
  private consecutiveFailures = 0; // Track consecutive failures for fallback logic
  private readonly MAX_CONSECUTIVE_FAILURES = 5; // Fallback to polling after 5 consecutive failures
  private lastEventReceived: number | null = null; // Track last SSE event received timestamp (any event indicates connection is alive)
  private readonly HEARTBEAT_TIMEOUT_MS = 30000; // 30 seconds - connection considered stale if no events received

  // Event handlers registered by different services
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private attachedListeners: Map<string, Set<EventHandler>> = new Map(); // Track which listeners are attached to EventSource
  private connectionStatusListeners: Set<ConnectionStatusListener> = new Set();

  /**
   * Initialize the unified SSE connection
   */
  public initialize(baseURL: string): void {
    // Prevent duplicate initialization
    if (this.isInitializing) {
      logger.warn(
        "UnifiedSSEService: Already initializing, skipping duplicate call",
      );
      return;
    }

    // If already connected, don't reinitialize
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      logger.debug(
        "UnifiedSSEService: Already connected, skipping initialization",
      );
      return;
    }

    // If connection is still connecting, wait for it
    if (
      this.eventSource &&
      this.eventSource.readyState === EventSource.CONNECTING
    ) {
      logger.debug(
        "UnifiedSSEService: Connection is still CONNECTING, skipping reinitialization",
      );
      return;
    }

    // CRITICAL: Always cleanup any existing connection (even if CLOSED) to prevent stale connections
    if (this.eventSource) {
      logger.info(
        "UnifiedSSEService: Cleaning up existing connection before reinitializing",
        {
          readyState: this.eventSource.readyState,
        },
      );
      try {
        this.eventSource.close();
      } catch (error) {
        logger.warn("UnifiedSSEService: Error closing existing connection", {
          error,
        });
      }
      this.eventSource = null;
    }

    // Clear any pending reconnection timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isInitializing = true;
    this.baseURL = baseURL;
    logger.info("UnifiedSSEService: Initializing", { baseURL });

    this.connectToEventSource(baseURL);
  }

  /**
   * Explicitly reconnect to the SSE endpoint
   * Used when heartbeat indicates pending events are queued on the backend
   * This method FORCES reconnection regardless of current connection state
   */
  public reconnect(): void {
    const previousState = {
      hasEventSource: !!this.eventSource,
      readyState: this.eventSource?.readyState,
      isInitializing: this.isInitializing,
      reconnectAttempts: this.reconnectAttempts,
      connectionUrl: this.connectionUrl,
    };
    
    logger.info("UnifiedSSEService: Explicit reconnection requested (pending events detected)", previousState);

    // Determine baseURL if not already stored
    let baseURL = this.baseURL;
    if (!baseURL) {
      baseURL = getApiBaseUrl();
      this.baseURL = baseURL;
      logger.info("UnifiedSSEService: Determined baseURL for reconnect", { baseURL });
    }

    // CRITICAL: Force close existing connection regardless of state
    // This ensures we always create a fresh connection, even if the old one appears "open"
    if (this.eventSource) {
      const oldReadyState = this.eventSource.readyState;
      try {
        this.eventSource.close();
        logger.info("UnifiedSSEService: Force-closed existing connection for reconnect", {
          oldReadyState,
        });
      } catch (error) {
        logger.warn("UnifiedSSEService: Error closing existing connection during reconnect", {
          error,
        });
      }
      this.eventSource = null;
    }

    // Clear any pending reconnection timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
      logger.debug("UnifiedSSEService: Cleared pending reconnection timeout");
    }

    // CRITICAL: Clear attached listeners so handlers get re-attached to the new connection
    // Otherwise, attachRegisteredHandlers will think handlers are already attached
    // and skip attaching them to the new EventSource
    const clearedListenerCount = this.attachedListeners.size;
    const clearedHandlerTypes = Array.from(this.attachedListeners.keys());
    this.attachedListeners.clear();
    logger.info("UnifiedSSEService: Cleared attached listeners for reconnection", {
      clearedListenerCount,
      clearedHandlerTypes,
    });

    // Reset reconnection attempt counter for fresh start
    this.reconnectAttempts = 0;

    // CRITICAL: Reset initialization flag to allow reconnection
    // This bypasses any checks that might prevent reconnection
    this.isInitializing = false;

    // Establish new connection with retry logic
    logger.info("UnifiedSSEService: Establishing new SSE connection", { baseURL });
    
    // Attempt initial connection
    this.attemptReconnect(baseURL, 0);
  }

  /**
   * Attempt reconnection with retry logic
   * @param baseURL The base URL to connect to
   * @param attemptNumber The current attempt number (0-indexed)
   */
  private attemptReconnect(baseURL: string, attemptNumber: number): void {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds between retries

    logger.info("UnifiedSSEService: Attempting reconnection", {
      attemptNumber: attemptNumber + 1,
      maxRetries: maxRetries + 1,
      baseURL,
    });

    try {
      // Try to connect
      this.connectToEventSource(baseURL);

      // Verify connection was established after a short delay
      setTimeout(() => {
        const status = this.getConnectionStatus();
        if (!status.connected && attemptNumber < maxRetries) {
          logger.warn("UnifiedSSEService: Reconnection attempt failed, scheduling retry", {
            attemptNumber: attemptNumber + 1,
            status,
          });

          // Schedule retry
          setTimeout(() => {
            this.attemptReconnect(baseURL, attemptNumber + 1);
          }, retryDelay);
        } else if (status.connected) {
          logger.info("UnifiedSSEService: Reconnection successful", {
            attemptNumber: attemptNumber + 1,
            status,
          });
        } else {
          logger.error("UnifiedSSEService: Reconnection failed after all retries", {
            attemptNumber: attemptNumber + 1,
            status,
          });
        }
      }, 1000); // Check after 1 second
    } catch (error) {
      logger.error("UnifiedSSEService: Error during reconnection attempt", {
        error,
        attemptNumber: attemptNumber + 1,
      });

      // Schedule retry if we haven't exceeded max retries
      if (attemptNumber < maxRetries) {
        setTimeout(() => {
          this.attemptReconnect(baseURL, attemptNumber + 1);
        }, retryDelay);
      } else {
        logger.error("UnifiedSSEService: Reconnection failed after all retries", {
          error,
          maxRetries: maxRetries + 1,
        });
      }
    }
  }

  /**
   * Connect to the SSE endpoint
   */
  private connectToEventSource(baseURL: string): void {
    logger.info("UnifiedSSEService: connectToEventSource called", {
      baseURL,
      isOnline: navigator.onLine,
      isInitializing: this.isInitializing,
    });

    try {
      // Don't connect if offline
      if (!navigator.onLine) {
        logger.warn("UnifiedSSEService: Cannot connect - device is offline");
        this.isInitializing = false;
        return;
      }

      // Get credentials for authentication
      const apiKey =
        localStorage.getItem("masjid_api_key") ||
        localStorage.getItem("apiKey");
      const screenId =
        localStorage.getItem("masjid_screen_id") ||
        localStorage.getItem("screenId");

      // Use the SSE endpoint
      const endpoint = "/api/sse";
      let connectionUrl = `${baseURL}${endpoint}`;

      // Build URL with authentication parameters
      if (screenId) {
        const params = new URLSearchParams();
        params.append("screenId", screenId);

        if (apiKey) {
          params.append("apiKey", apiKey);
        }

        connectionUrl = `${connectionUrl}?${params.toString()}`;

        logger.info(
          `UnifiedSSEService: Connecting to SSE with authentication`,
          {
            hasScreenId: !!screenId,
            hasApiKey: !!apiKey,
          },
        );
      } else {
        logger.warn(
          "UnifiedSSEService: No credentials available for SSE connection",
        );
      }

      this.connectionUrl = connectionUrl;

      logger.info(
        `UnifiedSSEService: Connecting to SSE at ${this.connectionUrl}`,
      );

      // Create a new EventSource
      let eventSource: EventSource;
      if (process.env.NODE_ENV === "development") {
        eventSource = new DebugEventSource(this.connectionUrl, {
          withCredentials: true,
        }) as unknown as EventSource;
      } else {
        eventSource = new EventSource(this.connectionUrl, {
          withCredentials: true,
        });
      }

      this.eventSource = eventSource;

      // Setup generic message listener IMMEDIATELY - this handles events without specific types
      logger.debug("UnifiedSSEService: Setting up generic message listener");
      this.setupGenericMessageListener(eventSource);

      // Handle open event
      eventSource.onopen = () => {
        logger.debug("UnifiedSSEService: EventSource onopen callback fired");
        this.handleConnectionOpen();
      };

      // Handle error events
      eventSource.onerror = (error) => {
        logger.error("UnifiedSSEService: SSE connection error", { error });
        this.handleConnectionError(error);
      };

      // Attach any handlers that were already registered before connection was created
      this.attachRegisteredHandlers(eventSource);

      // Log that setup is complete
      logger.info("UnifiedSSEService: EventSource created and listeners attached", {
        connectionUrl: this.connectionUrl,
        readyState: eventSource.readyState,
        registeredEventTypes: Array.from(this.eventHandlers.keys()),
      });
    } catch (error) {
      logger.error("UnifiedSSEService: Error connecting to SSE", {
        error,
        baseURL,
        connectionUrl: this.connectionUrl,
      });
      this.isInitializing = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Set up generic message listener for events without specific types
   * This ONLY handles events that come as generic 'message' events (not typed events)
   */
  private setupGenericMessageListener(eventSource: EventSource): void {
    // Listen to default 'message' event for events without specific type
    // IMPORTANT: This only fires for events that don't have a specific event type
    // If the server sends "event: RESTART_APP", EventSource will fire a 'RESTART_APP' event, not 'message'
    eventSource.addEventListener("message", (event: MessageEvent) => {
      // Track that we received an event (indicates connection is alive)
      // Note: SSE heartbeat comments aren't exposed by EventSource, but any event indicates connection health
      this.lastEventReceived = Date.now();

      logger.debug("UnifiedSSEService: Generic message event received (no specific type)", {
        type: event.type,
        data: event.data,
      });

      // Try to extract event type from data to check if we have specific handlers
      let extractedEventType: string | null = null;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        extractedEventType = data?.type || data?.eventType || null;
      } catch (error) {
        // Not JSON, ignore
      }

      // CRITICAL: If we have specific handlers for this event type AND they're attached,
      // DON'T dispatch through the generic message handler to prevent double-processing
      if (extractedEventType && extractedEventType !== "message") {
        const specificHandlers = this.eventHandlers.get(extractedEventType);
        const specificAttached = this.attachedListeners.get(extractedEventType);

        // If specific handlers exist and are attached, skip generic message handling
        // This prevents double-processing when the same event comes through both channels
        if (
          specificHandlers &&
          specificHandlers.size > 0 &&
          specificAttached &&
          specificAttached.size > 0
        ) {
          logger.debug(
            `UnifiedSSEService: Skipping generic message dispatch for ${extractedEventType} - specific handlers already attached`,
          );
          return;
        }
      }

      // Only dispatch to generic 'message' handlers
      const genericHandlers = this.eventHandlers.get("message");
      if (genericHandlers && genericHandlers.size > 0) {
        logger.debug(
          `UnifiedSSEService: Dispatching to ${genericHandlers.size} generic message handler(s)`,
        );
        genericHandlers.forEach((handler) => {
          try {
            handler(event);
          } catch (error) {
            logger.error(
              "UnifiedSSEService: Error in generic message handler",
              { error },
            );
          }
        });
      } else if (extractedEventType && extractedEventType !== "message") {
        // Fallback: If no generic handlers but we have specific handlers that aren't attached yet,
        // route to them (this handles the case where handlers are registered but connection isn't ready)
        const handlers = this.eventHandlers.get(extractedEventType);
        if (handlers && handlers.size > 0) {
          logger.debug(
            `UnifiedSSEService: Fallback - Dispatching to ${handlers.size} handler(s) for ${extractedEventType}`,
          );
          handlers.forEach((handler) => {
            try {
              handler(event);
            } catch (error) {
              logger.error(
                `UnifiedSSEService: Error in handler for ${extractedEventType}`,
                { error },
              );
            }
          });
        }
      }
    });

    logger.debug("UnifiedSSEService: Generic message listener set up");
  }

  /**
   * Attach all registered handlers to the EventSource
   * Only attaches handlers that haven't been attached yet
   */
  private attachRegisteredHandlers(eventSource: EventSource): void {
    const eventTypeCount = this.eventHandlers.size;
    const totalHandlerCount = Array.from(this.eventHandlers.values()).reduce(
      (sum, handlers) => sum + handlers.size,
      0,
    );
    logger.info("UnifiedSSEService: Attaching registered handlers", {
      eventTypeCount,
      totalHandlerCount,
      eventTypes: Array.from(this.eventHandlers.keys()),
    });

    let attachedCount = 0;
    let skippedCount = 0;

    this.eventHandlers.forEach((handlers, eventType) => {
      handlers.forEach((handler) => {
        // Check if this handler is already attached
        const attached = this.attachedListeners.get(eventType);
        if (attached && attached.has(handler)) {
          skippedCount++;
          logger.debug(
            `UnifiedSSEService: Handler for ${eventType} already attached, skipping`,
          );
          return;
        }

        try {
          // Create a wrapper that dispatches to our handler
          const wrapper = (event: MessageEvent) => {
            // Track that we received an event (indicates connection is alive)
            this.lastEventReceived = Date.now();
            
            logger.debug(`UnifiedSSEService: Processing ${eventType} event`, {
              eventType,
              data: event.data,
              timestamp: new Date().toISOString(),
            });
            handler(event);
          };
          eventSource.addEventListener(eventType, wrapper);

          // Track that this handler is attached
          if (!this.attachedListeners.has(eventType)) {
            this.attachedListeners.set(eventType, new Set());
          }
          this.attachedListeners.get(eventType)!.add(handler);

          attachedCount++;
          logger.debug(`UnifiedSSEService: Attached listener for ${eventType}`);
        } catch (error) {
          logger.error(
            `UnifiedSSEService: Failed to attach listener for ${eventType}`,
            { error },
          );
        }
      });
    });

    logger.info("UnifiedSSEService: Handler attachment complete", {
      attachedCount,
      skippedCount,
      totalHandlers: totalHandlerCount,
    });
  }

  /**
   * Register an event handler for a specific event type
   * @param eventType The event type to listen for (e.g., 'FORCE_UPDATE', 'EMERGENCY_ALERT')
   * @param handler The handler function to call when the event is received
   * @returns A function to unregister the handler
   */
  public addEventListener(
    eventType: string,
    handler: EventHandler,
  ): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler);

    logger.debug(`UnifiedSSEService: Registered handler for ${eventType}`, {
      totalHandlers: this.eventHandlers.get(eventType)!.size,
      readyState: this.eventSource?.readyState,
    });

    // If connection exists and is open or connecting, attach listener immediately
    // But only if it hasn't been attached yet
    if (
      this.eventSource &&
      (this.eventSource.readyState === EventSource.OPEN ||
        this.eventSource.readyState === EventSource.CONNECTING)
    ) {
      // Check if this handler is already attached
      const attached = this.attachedListeners.get(eventType);
      if (attached && attached.has(handler)) {
        logger.debug(
          `UnifiedSSEService: Handler for ${eventType} already attached, skipping`,
        );
      } else {
        try {
          // Create a wrapper that logs and dispatches
          const wrapper = (event: MessageEvent) => {
            // Track that we received an event (indicates connection is alive)
            this.lastEventReceived = Date.now();
            
            logger.debug(`UnifiedSSEService: Event received for ${eventType}`, {
              type: event.type,
              data: event.data,
            });
            handler(event);
          };
          this.eventSource.addEventListener(eventType, wrapper);

          // Track that this handler is attached
          if (!this.attachedListeners.has(eventType)) {
            this.attachedListeners.set(eventType, new Set());
          }
          this.attachedListeners.get(eventType)!.add(handler);

          logger.debug(
            `UnifiedSSEService: Attached listener for ${eventType} to existing connection`,
          );
        } catch (error) {
          logger.error(
            `UnifiedSSEService: Failed to attach listener for ${eventType}`,
            { error },
          );
        }
      }
    } else {
      logger.debug(
        `UnifiedSSEService: Handler for ${eventType} registered but connection not ready yet (will attach when connection opens)`,
      );
    }

    // Return unregister function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }

      // Also remove from attached listeners
      const attached = this.attachedListeners.get(eventType);
      if (attached) {
        attached.delete(handler);
        if (attached.size === 0) {
          this.attachedListeners.delete(eventType);
        }
      }

      logger.debug(`UnifiedSSEService: Unregistered handler for ${eventType}`);
    };
  }

  /**
   * Handle successful connection
   */
  private handleConnectionOpen = (): void => {
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0; // Reset consecutive failures on successful connection
    this.lastEventReceived = Date.now(); // Track connection open time as last event
    const readyState = this.eventSource?.readyState;
    const readyStateText =
      readyState === EventSource.OPEN
        ? "OPEN"
        : readyState === EventSource.CONNECTING
          ? "CONNECTING"
          : readyState === EventSource.CLOSED
            ? "CLOSED"
            : "UNKNOWN";

    logger.info("UnifiedSSEService: SSE connection established", {
      url: this.connectionUrl,
      readyState,
      readyStateText,
      registeredEventTypes: Array.from(this.eventHandlers.keys()),
      handlerCount: Array.from(this.eventHandlers.values()).reduce(
        (sum, handlers) => sum + handlers.size,
        0,
      ),
    });

    // CRITICAL: Attach all registered handlers now that connection is open
    // This ensures events are processed and trigger notifications
    if (this.eventSource) {
      logger.debug("UnifiedSSEService: Connection opened, attaching registered handlers");
      const handlerCount = Array.from(this.eventHandlers.values()).reduce(
        (sum, handlers) => sum + handlers.size,
        0,
      );
      logger.debug(
        `UnifiedSSEService: Attaching ${handlerCount} handler(s) for ${this.eventHandlers.size} event type(s)`,
      );
      
      this.attachRegisteredHandlers(this.eventSource);
      
      // Verify handlers were attached
      const attachedCount = Array.from(this.attachedListeners.values()).reduce(
        (sum, handlers) => sum + handlers.size,
        0,
      );
      
      logger.info("UnifiedSSEService: Handlers attached after connection open", {
        attachedCount,
        eventTypes: Array.from(this.eventHandlers.keys()),
      });
    }

    // Reset initialization flag now that connection is established
    this.isInitializing = false;

    // Notify connection status listeners
    this.notifyConnectionStatusChange();
  };

  /**
   * Handle connection errors
   */
  private handleConnectionError = (error: Event): void => {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown connection error";
    const readyState = this.eventSource?.readyState;

    logger.error("UnifiedSSEService: SSE connection error", {
      error: errorMessage,
      readyState,
      url: this.connectionUrl,
      reconnectAttempts: this.reconnectAttempts,
    });

    // Check for permanent closure
    if (readyState === EventSource.CLOSED) {
      logger.warn(
        "UnifiedSSEService: SSE connection closed - possible authentication error",
      );
      this.isInitializing = false;
    }

    // Clean up existing connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Notify connection status listeners
    this.notifyConnectionStatusChange(errorMessage);

    this.scheduleReconnect();
  };

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Track consecutive failures for fallback logic
    this.consecutiveFailures++;

    // Note: Unlimited reconnection attempts for emergency alerts
    // Exponential backoff ensures we don't overwhelm the server

    // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    logger.info(
      `UnifiedSSEService: Scheduling reconnect in ${delay / 1000}s (attempt ${this.reconnectAttempts + 1}, consecutive failures: ${this.consecutiveFailures})`,
    );

    // If we've had too many consecutive failures, log a warning about fallback
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      logger.warn(
        `UnifiedSSEService: ${this.consecutiveFailures} consecutive failures - consider fallback to heartbeat polling for emergency alerts`,
        {
          consecutiveFailures: this.consecutiveFailures,
          maxFailures: this.MAX_CONSECUTIVE_FAILURES,
        },
      );
      // Note: Fallback to heartbeat polling would be implemented in emergencyAlertService
      // For now, we continue trying to reconnect (unlimited attempts)
    }

    this.reconnectTimeout = setTimeout(() => {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.reconnectAttempts++;

      const baseURL = getApiBaseUrl();

      this.connectToEventSource(baseURL);
    }, delay);
  }

  /**
   * Check if SSE connection is healthy
   * Connection is healthy if it's open AND has received events recently (<30 seconds)
   */
  public isConnectionHealthy(): boolean {
    const isOpen =
      this.eventSource !== null &&
      this.eventSource.readyState === EventSource.OPEN;

    if (!isOpen) {
      return false;
    }

    // If we've never received an event, connection might be stale
    if (this.lastEventReceived === null) {
      return false;
    }

    // Check if last event was received within timeout window
    const timeSinceLastEvent = Date.now() - this.lastEventReceived;
    const isRecent = timeSinceLastEvent < this.HEARTBEAT_TIMEOUT_MS;

    logger.debug("UnifiedSSEService: Connection health check", {
      isOpen,
      lastEventReceived: this.lastEventReceived
        ? new Date(this.lastEventReceived).toISOString()
        : null,
      timeSinceLastEvent: `${Math.round(timeSinceLastEvent / 1000)}s`,
      isRecent,
      isHealthy: isOpen && isRecent,
    });

    return isOpen && isRecent;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return {
      connected:
        this.eventSource !== null &&
        this.eventSource.readyState === EventSource.OPEN,
      url: this.connectionUrl,
      readyState: this.eventSource ? this.eventSource.readyState : null,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Add a listener for connection status changes
   */
  public addConnectionStatusListener(
    callback: ConnectionStatusListener,
  ): () => void {
    this.connectionStatusListeners.add(callback);
    // Immediately call with current status
    callback(this.getConnectionStatus());
    return () => {
      this.connectionStatusListeners.delete(callback);
    };
  }

  /**
   * Notify all connection status listeners of status changes
   */
  private notifyConnectionStatusChange(lastError?: string): void {
    const status = this.getConnectionStatus();
    if (lastError) {
      status.lastError = lastError;
    }

    this.connectionStatusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        logger.error(
          "UnifiedSSEService: Error notifying connection status listener",
          { error },
        );
      }
    });
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info("UnifiedSSEService: Cleaning up");

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.eventHandlers.clear();
    this.attachedListeners.clear();
    this.connectionStatusListeners.clear();
    this.reconnectAttempts = 0;
    this.isInitializing = false;
    this.lastEventReceived = null;
  }
}

// Export singleton instance
const unifiedSSEService = new UnifiedSSEService();
export default unifiedSSEService;
