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

import logger from '../utils/logger';
import { DebugEventSource } from '../utils/debugEventSource';

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
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 5000; // 5 seconds
  private connectionUrl: string | null = null;
  private isInitializing = false;
  
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
      logger.warn('UnifiedSSEService: Already initializing, skipping duplicate call');
      console.warn('🔗 UnifiedSSEService: Already initializing, skipping duplicate call');
      return;
    }
    
    // If already connected, don't reinitialize
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      logger.debug('UnifiedSSEService: Already connected, skipping initialization');
      console.log('🔗 UnifiedSSEService: Already connected, skipping initialization');
      return;
    }
    
    // If connection is still connecting, wait for it
    if (this.eventSource && this.eventSource.readyState === EventSource.CONNECTING) {
      logger.debug('UnifiedSSEService: Connection is still CONNECTING, skipping reinitialization');
      console.log('🔗 UnifiedSSEService: Connection is still CONNECTING, skipping reinitialization');
      return;
    }
    
    // CRITICAL: Always cleanup any existing connection (even if CLOSED) to prevent stale connections
    if (this.eventSource) {
      logger.info('UnifiedSSEService: Cleaning up existing connection before reinitializing', {
        readyState: this.eventSource.readyState,
      });
      console.log('🔗 UnifiedSSEService: Cleaning up existing connection', {
        readyState: this.eventSource.readyState,
      });
      try {
        this.eventSource.close();
      } catch (error) {
        logger.warn('UnifiedSSEService: Error closing existing connection', { error });
      }
      this.eventSource = null;
    }
    
    // Clear any pending reconnection timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.isInitializing = true;
    logger.info('UnifiedSSEService: Initializing', { baseURL });
    console.log('🔗 UnifiedSSEService: Initializing with baseURL:', baseURL);
    
    this.connectToEventSource(baseURL);
  }

  /**
   * Connect to the SSE endpoint
   */
  private connectToEventSource(baseURL: string): void {
    try {
      // Don't connect if offline
      if (!navigator.onLine) {
        logger.warn('UnifiedSSEService: Cannot connect - device is offline');
        this.isInitializing = false;
        return;
      }

      // Get credentials for authentication
      const apiKey = localStorage.getItem('masjid_api_key') || localStorage.getItem('apiKey');
      const screenId = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
      
      // Use the SSE endpoint
      const endpoint = '/api/sse';
      let connectionUrl = `${baseURL}${endpoint}`;
      
      // Build URL with authentication parameters
      if (screenId) {
        const params = new URLSearchParams();
        params.append('screenId', screenId);
        
        if (apiKey) {
          params.append('apiKey', apiKey);
        }
        
        connectionUrl = `${connectionUrl}?${params.toString()}`;
        
        logger.info(`UnifiedSSEService: Connecting to SSE with authentication`, {
          hasScreenId: !!screenId,
          hasApiKey: !!apiKey
        });
        console.log(`🔗 UnifiedSSEService: Connecting to SSE with screenId: ${screenId}`);
      } else {
        logger.warn('UnifiedSSEService: No credentials available for SSE connection');
        console.warn('🔗 UnifiedSSEService: Connecting to SSE without credentials');
      }
      
      this.connectionUrl = connectionUrl;
      
      logger.info(`UnifiedSSEService: Connecting to SSE at ${this.connectionUrl}`);
      console.log(`🔗 UnifiedSSEService: Connecting to SSE at ${this.connectionUrl}`);
      
      // Create a new EventSource
      let eventSource: EventSource;
      if (process.env.NODE_ENV === 'development') {
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
      console.log('🔗 UnifiedSSEService: Setting up generic message listener...');
      this.setupGenericMessageListener(eventSource);
      
      // Handle open event
      eventSource.onopen = () => {
        console.log('🔗 UnifiedSSEService: EventSource onopen callback fired');
        this.handleConnectionOpen();
      };
      
      // Handle error events
      eventSource.onerror = (error) => {
        console.error('🔗 UnifiedSSEService: SSE connection error:', error);
        this.handleConnectionError(error);
      };
      
      // Attach any handlers that were already registered before connection was created
      this.attachRegisteredHandlers(eventSource);
      
      // Log that setup is complete
      console.log('🔗 UnifiedSSEService: EventSource created and listeners attached');
      console.log('🔗 UnifiedSSEService: EventSource readyState:', eventSource.readyState);
    } catch (error) {
      logger.error('UnifiedSSEService: Error connecting to SSE', { error });
      console.error('🔗 UnifiedSSEService: Error connecting to SSE:', error);
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
    eventSource.addEventListener('message', (event: MessageEvent) => {
      console.log('🔗 UnifiedSSEService: Generic message event received (no specific type)', {
        type: event.type,
        data: event.data,
      });
      
      // Try to extract event type from data to check if we have specific handlers
      let extractedEventType: string | null = null;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        extractedEventType = data?.type || data?.eventType || null;
      } catch (error) {
        // Not JSON, ignore
      }
      
      // CRITICAL: If we have specific handlers for this event type AND they're attached,
      // DON'T dispatch through the generic message handler to prevent double-processing
      if (extractedEventType && extractedEventType !== 'message') {
        const specificHandlers = this.eventHandlers.get(extractedEventType);
        const specificAttached = this.attachedListeners.get(extractedEventType);
        
        // If specific handlers exist and are attached, skip generic message handling
        // This prevents double-processing when the same event comes through both channels
        if (specificHandlers && specificHandlers.size > 0 && specificAttached && specificAttached.size > 0) {
          console.log(`🔗 UnifiedSSEService: Skipping generic message dispatch for ${extractedEventType} - specific handlers already attached`);
          return;
        }
      }
      
      // Only dispatch to generic 'message' handlers
      const genericHandlers = this.eventHandlers.get('message');
      if (genericHandlers && genericHandlers.size > 0) {
        console.log(`🔗 UnifiedSSEService: Dispatching to ${genericHandlers.size} generic message handler(s)`);
        genericHandlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            logger.error('UnifiedSSEService: Error in generic message handler', { error });
            console.error('❌ UnifiedSSEService: Error in generic message handler:', error);
          }
        });
      } else if (extractedEventType && extractedEventType !== 'message') {
        // Fallback: If no generic handlers but we have specific handlers that aren't attached yet,
        // route to them (this handles the case where handlers are registered but connection isn't ready)
        const handlers = this.eventHandlers.get(extractedEventType);
        if (handlers && handlers.size > 0) {
          console.log(`🔗 UnifiedSSEService: Fallback - Dispatching to ${handlers.size} handler(s) for ${extractedEventType}`);
          handlers.forEach(handler => {
            try {
              handler(event);
            } catch (error) {
              logger.error(`UnifiedSSEService: Error in handler for ${extractedEventType}`, { error });
              console.error(`❌ UnifiedSSEService: Error in handler for ${extractedEventType}:`, error);
            }
          });
        }
      }
    });
    
    console.log('🔗 UnifiedSSEService: Generic message listener set up');
  }
  
  /**
   * Attach all registered handlers to the EventSource
   * Only attaches handlers that haven't been attached yet
   */
  private attachRegisteredHandlers(eventSource: EventSource): void {
    console.log(`🔗 UnifiedSSEService: Attaching ${this.eventHandlers.size} registered event type(s)...`);
    this.eventHandlers.forEach((handlers, eventType) => {
      handlers.forEach(handler => {
        // Check if this handler is already attached
        const attached = this.attachedListeners.get(eventType);
        if (attached && attached.has(handler)) {
          console.log(`🔗 UnifiedSSEService: Handler for ${eventType} already attached, skipping`);
          return;
        }
        
        try {
          // Create a wrapper that dispatches to our handler
          const wrapper = (event: MessageEvent) => {
            console.log(`🔗 UnifiedSSEService: Event received for ${eventType}`, {
              type: event.type,
              data: event.data,
            });
            handler(event);
          };
          eventSource.addEventListener(eventType, wrapper);
          
          // Track that this handler is attached
          if (!this.attachedListeners.has(eventType)) {
            this.attachedListeners.set(eventType, new Set());
          }
          this.attachedListeners.get(eventType)!.add(handler);
          
          logger.debug(`UnifiedSSEService: Attached listener for ${eventType}`);
          console.log(`✅ UnifiedSSEService: Attached listener for ${eventType}`);
        } catch (error) {
          logger.error(`UnifiedSSEService: Failed to attach listener for ${eventType}`, { error });
          console.error(`❌ UnifiedSSEService: Failed to attach listener for ${eventType}:`, error);
        }
      });
    });
    console.log('🔗 UnifiedSSEService: All registered handlers attached');
  }

  /**
   * Register an event handler for a specific event type
   * @param eventType The event type to listen for (e.g., 'FORCE_UPDATE', 'EMERGENCY_ALERT')
   * @param handler The handler function to call when the event is received
   * @returns A function to unregister the handler
   */
  public addEventListener(eventType: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);
    
    console.log(`🔗 UnifiedSSEService: Registered handler for ${eventType}`, {
      totalHandlers: this.eventHandlers.get(eventType)!.size,
      readyState: this.eventSource?.readyState,
    });
    
    // If connection exists and is open or connecting, attach listener immediately
    // But only if it hasn't been attached yet
    if (this.eventSource && (this.eventSource.readyState === EventSource.OPEN || this.eventSource.readyState === EventSource.CONNECTING)) {
      // Check if this handler is already attached
      const attached = this.attachedListeners.get(eventType);
      if (attached && attached.has(handler)) {
        console.log(`🔗 UnifiedSSEService: Handler for ${eventType} already attached, skipping`);
      } else {
        try {
          // Create a wrapper that logs and dispatches
          const wrapper = (event: MessageEvent) => {
            console.log(`🔗 UnifiedSSEService: Event received for ${eventType}`, {
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
          
          logger.debug(`UnifiedSSEService: Attached listener for ${eventType} to existing connection`);
          console.log(`✅ UnifiedSSEService: Attached listener for ${eventType} to EventSource`);
        } catch (error) {
          logger.error(`UnifiedSSEService: Failed to attach listener for ${eventType}`, { error });
          console.error(`❌ UnifiedSSEService: Failed to attach listener for ${eventType}:`, error);
        }
      }
    } else {
      console.log(`🔗 UnifiedSSEService: Handler for ${eventType} registered but connection not ready yet (will attach when connection opens)`);
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
      
      console.log(`🔗 UnifiedSSEService: Unregistered handler for ${eventType}`);
    };
  }

  /**
   * Handle successful connection
   */
  private handleConnectionOpen = (): void => {
    this.reconnectAttempts = 0;
    const readyState = this.eventSource?.readyState;
    const readyStateText = readyState === EventSource.OPEN ? 'OPEN' : 
                          readyState === EventSource.CONNECTING ? 'CONNECTING' : 
                          readyState === EventSource.CLOSED ? 'CLOSED' : 'UNKNOWN';
    
    logger.info('UnifiedSSEService: SSE connection established', {
      url: this.connectionUrl,
      readyState,
      readyStateText,
      registeredEventTypes: Array.from(this.eventHandlers.keys()),
    });
    
    // Attach all registered handlers now that connection is open
    if (this.eventSource) {
      console.log('🔗 UnifiedSSEService: Connection opened, attaching registered handlers...');
      this.attachRegisteredHandlers(this.eventSource);
      console.log(`🔗 UnifiedSSEService: Listening for events: (${this.eventHandlers.size})`, Array.from(this.eventHandlers.keys()));
    }
    console.log(`🔗 UnifiedSSEService: SSE connection established! ReadyState: ${readyStateText} (${readyState})`);
    console.log(`🔗 UnifiedSSEService: Connection URL: ${this.connectionUrl}`);
    console.log(`🔗 UnifiedSSEService: Listening for events:`, Array.from(this.eventHandlers.keys()));
    
    // Reset initialization flag now that connection is established
    this.isInitializing = false;
    
    // Notify connection status listeners
    this.notifyConnectionStatusChange();
  };

  /**
   * Handle connection errors
   */
  private handleConnectionError = (error: Event): void => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
    const readyState = this.eventSource?.readyState;
    
    logger.error('UnifiedSSEService: SSE connection error', { 
      error: errorMessage,
      readyState,
      url: this.connectionUrl,
      reconnectAttempts: this.reconnectAttempts,
    });
    console.error('🔗 UnifiedSSEService: SSE connection error:', error);
    
    // Check for permanent closure
    if (readyState === EventSource.CLOSED) {
      logger.warn('UnifiedSSEService: SSE connection closed - possible authentication error');
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

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('UnifiedSSEService: Maximum reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000 // Max 1 minute
    ) * (0.8 + Math.random() * 0.4); // Add 20% jitter

    logger.info(`UnifiedSSEService: Scheduling reconnect in ${delay / 1000}s (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.reconnectAttempts++;
      
      const baseURL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
        
      this.connectToEventSource(baseURL);
    }, delay);
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return {
      connected: this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN,
      url: this.connectionUrl,
      readyState: this.eventSource ? this.eventSource.readyState : null,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Add a listener for connection status changes
   */
  public addConnectionStatusListener(callback: ConnectionStatusListener): () => void {
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
    
    this.connectionStatusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        logger.error('UnifiedSSEService: Error notifying connection status listener', { error });
      }
    });
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info('UnifiedSSEService: Cleaning up');
    
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
  }
}

// Export singleton instance
const unifiedSSEService = new UnifiedSSEService();
export default unifiedSSEService;


