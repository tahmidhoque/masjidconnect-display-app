import { EmergencyAlert } from "../api/models";
import logger from "../utils/logger";
import storageService from "./storageService";
import { AlertColorSchemeKey } from "../components/common/EmergencyAlertOverlay";
import unifiedSSEService from "./unifiedSSEService";

// Event Types for SSE
const EVENT_TYPES = {
  ALERT: "EMERGENCY_ALERT",
  UPDATE: "EMERGENCY_UPDATE",
  CANCEL: "EMERGENCY_CANCEL",
};

// Storage key for offline persistence
const STORAGE_KEY = "emergency_alert";

class EmergencyAlertService {
  private listeners: Set<(alert: EmergencyAlert | null) => void> = new Set();
  private currentAlert: EmergencyAlert | null = null;
  private expirationTimer: NodeJS.Timeout | null = null;
  private isInitializing = false; // Prevent duplicate initialization
  private unregisterHandlers: (() => void)[] = []; // Track registered handlers for cleanup

  /**
   * Initialize the emergency alert service using the unified SSE connection
   */
  public initialize(baseURL: string): void {
    // Prevent duplicate initialization
    if (this.isInitializing) {
      logger.warn(
        "EmergencyAlertService: Already initializing, skipping duplicate call",
      );
      return;
    }

    this.isInitializing = true;
    logger.info(
      "EmergencyAlertService: Initializing with unified SSE service",
      { baseURL },
    );
    console.log(
      "🚨 EmergencyAlertService: Initializing with unified SSE service",
    );

    // Load any saved alert
    this.loadSavedAlert();

    // Ensure unified SSE service is initialized
    unifiedSSEService.initialize(baseURL);

    // Register handlers for emergency alert events
    this.registerEventHandlers();

    this.isInitializing = false;
  }

  /**
   * Register event handlers with the unified SSE service
   */
  private registerEventHandlers(): void {
    // Clean up any existing handlers first
    this.unregisterHandlers.forEach((unregister) => unregister());
    this.unregisterHandlers = [];

    // Register handler for each emergency alert event type
    Object.values(EVENT_TYPES).forEach((eventType) => {
      const unregister = unifiedSSEService.addEventListener(
        eventType,
        (event: MessageEvent) => {
          console.log(
            `🚨 EmergencyAlertService: ${eventType} event received via unified SSE!`,
            event.data,
          );
          try {
            if (eventType === EVENT_TYPES.ALERT) {
              this.handleAlertEvent(event);
            } else if (eventType === EVENT_TYPES.UPDATE) {
              this.handleUpdateEvent(event);
            } else if (eventType === EVENT_TYPES.CANCEL) {
              this.handleCancelEvent(event);
            }
          } catch (error) {
            console.error(
              `🚨 EmergencyAlertService: Error in ${eventType} handler:`,
              error,
            );
            logger.error(
              `EmergencyAlertService: Error handling ${eventType} event`,
              { error },
            );
          }
        },
      );
      this.unregisterHandlers.push(unregister);
    });

    // Also listen for alternative event names
    const altNames = [
      "emergency_alert",
      "emergencyAlert",
      "emergency",
      "alert",
    ];
    altNames.forEach((eventName) => {
      const unregister = unifiedSSEService.addEventListener(
        eventName,
        (event: MessageEvent) => {
          console.log(
            `🚨 EmergencyAlertService: ${eventName} event received via unified SSE!`,
            event.data,
          );
          this.handleAlertEvent(event);
        },
      );
      this.unregisterHandlers.push(unregister);
    });

    logger.info(
      "EmergencyAlertService: All event handlers registered with unified SSE service",
    );
    console.log(
      "🚨 EmergencyAlertService: All event handlers registered successfully",
    );
  }

  /**
   * Handle a new emergency alert
   */
  private handleAlertEvent = (event: MessageEvent): void => {
    console.log(
      "🚨 EmergencyAlertService: EMERGENCY_ALERT event received:",
      event.data,
    );

    // CRITICAL: Verify unified SSE connection is ready before processing events
    const connectionStatus = unifiedSSEService.getConnectionStatus();
    if (!connectionStatus.connected) {
      logger.warn(
        "EmergencyAlertService: Ignoring alert - unified SSE connection not ready",
        {
          readyState: connectionStatus.readyState,
          connected: connectionStatus.connected,
        },
      );
      console.warn(
        "🚨 EmergencyAlertService: Alert blocked - unified SSE connection not ready",
      );
      return;
    }

    try {
      let alertData: EmergencyAlert;

      // Try to parse the data - handle both string and object formats
      if (typeof event.data === "string") {
        alertData = JSON.parse(event.data) as EmergencyAlert;
      } else {
        alertData = event.data as EmergencyAlert;
      }

      // Validate required fields
      if (!alertData || !alertData.title || !alertData.message) {
        console.error(
          "🚨 EmergencyAlertService: Invalid alert data format:",
          alertData,
        );
        return;
      }

      // Ensure id exists (generate one if missing)
      if (!alertData.id) {
        alertData.id = `alert-${Date.now()}`;
      }

      // Ensure expiresAt exists (default to 30 minutes if missing)
      if (!alertData.expiresAt) {
        alertData.expiresAt = new Date(
          Date.now() + 30 * 60 * 1000,
        ).toISOString();
      }

      // Ensure createdAt exists
      if (!alertData.createdAt) {
        alertData.createdAt = new Date().toISOString();
      }

      // Detect color scheme based on the color value
      if (alertData.color && !alertData.colorScheme) {
        // Define color mappings for predefined schemes
        const colorToScheme: Record<string, AlertColorSchemeKey> = {
          "#f44336": "RED",
          "#ff9800": "ORANGE",
          "#ffb74d": "AMBER",
          "#2196f3": "BLUE",
          "#4caf50": "GREEN",
          "#9c27b0": "PURPLE",
          "#263238": "DARK",
        };

        // Normalize the color for comparison (lowercase, no spaces)
        const normalizedColor = alertData.color
          .toLowerCase()
          .replace(/\s+/g, "");

        // Look for exact match in predefined schemes
        Object.entries(colorToScheme).forEach(([color, scheme]) => {
          if (color.toLowerCase() === normalizedColor) {
            alertData.colorScheme = scheme;
            console.log(
              "🚨 EmergencyAlertService: Detected color scheme:",
              scheme,
            );
          }
        });
      }

      console.log("🚨 EmergencyAlertService: Parsed alert data:", alertData);
      // Display the alert
      this.setCurrentAlert(alertData);
    } catch (error) {
      console.error(
        "🚨 EmergencyAlertService: Error parsing alert data:",
        error,
      );
      // Try to extract any useful information from the raw event
      this.tryParseRawAlert(event.data);
    }
  };

  /**
   * Handle an update to an existing alert
   */
  private handleUpdateEvent = (event: MessageEvent): void => {
    // CRITICAL: Verify unified SSE connection is ready before processing events
    const connectionStatus = unifiedSSEService.getConnectionStatus();
    if (!connectionStatus.connected) {
      logger.warn(
        "EmergencyAlertService: Ignoring update - unified SSE connection not ready",
      );
      return;
    }

    try {
      let alertData: EmergencyAlert;

      // Try to parse the data - handle both string and object formats
      if (typeof event.data === "string") {
        alertData = JSON.parse(event.data) as EmergencyAlert;
      } else {
        alertData = event.data as EmergencyAlert;
      }

      console.log(
        "🚨 EmergencyAlertService: EMERGENCY_UPDATE event received:",
        alertData,
      );

      // Only update if we have the required fields
      if (alertData && alertData.id) {
        this.setCurrentAlert(alertData);
      }
    } catch (error) {
      console.error(
        "🚨 EmergencyAlertService: Error parsing alert update data:",
        error,
      );
    }
  };

  /**
   * Handle a canceled alert
   */
  private handleCancelEvent = (event: MessageEvent): void => {
    console.log(
      "🚨 EmergencyAlertService: EMERGENCY_CANCEL event received, raw data:",
      event.data,
    );

    // CRITICAL: Verify unified SSE connection is ready before processing events
    const connectionStatus = unifiedSSEService.getConnectionStatus();
    if (!connectionStatus.connected) {
      logger.warn(
        "EmergencyAlertService: Ignoring cancel - unified SSE connection not ready",
      );
      return;
    }

    try {
      // Handle different formats of cancel data
      let alertId: string | undefined;

      if (typeof event.data === "string") {
        try {
          // Try to parse as JSON
          const data = JSON.parse(event.data);
          alertId = data.id || data.alertId;
        } catch (parseError) {
          // If it's not JSON, it might be just the ID as a string
          alertId = event.data;
        }
      } else if (typeof event.data === "object" && event.data !== null) {
        // It's already an object
        const data = event.data;
        alertId = data.id || data.alertId;
      }

      console.log(
        "🚨 EmergencyAlertService: Extracted alert ID for cancellation:",
        alertId,
      );

      // If we have a current alert and the ID matches, clear it
      if (alertId && this.currentAlert) {
        if (this.currentAlert.id === alertId || alertId === "*") {
          console.log(
            "🚨 EmergencyAlertService: Canceling alert with ID:",
            this.currentAlert.id,
          );
          this.clearCurrentAlert();
        } else {
          console.log(
            "🚨 EmergencyAlertService: Cancel ID does not match current alert ID:",
            {
              cancelId: alertId,
              currentAlertId: this.currentAlert.id,
            },
          );
        }
      } else {
        console.log(
          "🚨 EmergencyAlertService: No current alert to cancel or no ID provided",
        );
      }
    } catch (error) {
      console.error(
        "🚨 EmergencyAlertService: Error processing alert cancellation:",
        error,
      );
    }
  };

  /**
   * Set the current alert and schedule its expiration
   * Uses timing.remaining from backend (server-calculated) when available,
   * falls back to expiresAt calculation for backward compatibility
   */
  private setCurrentAlert(alert: EmergencyAlert): void {
    // Clear any existing expiration timer
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }

    // Set the new alert
    this.currentAlert = alert;

    // Save to local storage for offline fallback
    localStorage.setItem("emergencyAlert", JSON.stringify(alert));

    // Calculate time until expiry
    let timeUntilExpiry: number;

    // PREFER: Use timing.remaining from backend (server-calculated, no clock sync issues)
    if (
      alert.timing &&
      typeof alert.timing.remaining === "number" &&
      alert.timing.remaining > 0
    ) {
      timeUntilExpiry = alert.timing.remaining;
      console.log(
        `🚨 EmergencyAlertService: Using server-calculated remaining time: ${timeUntilExpiry}ms (${(timeUntilExpiry / 1000).toFixed(1)}s)`,
      );
    }
    // FALLBACK: Calculate from expiresAt (for backward compatibility)
    else {
      const expiresAt = new Date(alert.expiresAt).getTime();
      const now = Date.now();
      timeUntilExpiry = Math.max(0, expiresAt - now);
      console.log(
        `🚨 EmergencyAlertService: Calculated expiry from expiresAt: ${timeUntilExpiry}ms (${(timeUntilExpiry / 1000).toFixed(1)}s)`,
      );
    }

    // Schedule automatic expiration
    if (timeUntilExpiry > 0) {
      console.log(
        `🚨 EmergencyAlertService: Alert "${alert.title}" will auto-clear in ${(timeUntilExpiry / 1000).toFixed(1)}s`,
      );
      this.expirationTimer = setTimeout(() => {
        console.log(
          `🚨 EmergencyAlertService: Alert "${alert.title}" expired automatically after ${(timeUntilExpiry / 1000).toFixed(1)}s`,
        );
        this.clearCurrentAlert();
      }, timeUntilExpiry);
    } else {
      console.warn(
        `🚨 EmergencyAlertService: Received already expired alert "${alert.title}" - clearing immediately`,
      );
      this.clearCurrentAlert();
      return;
    }

    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Clear the current alert
   */
  private clearCurrentAlert(): void {
    this.currentAlert = null;

    // Clear from storage - using the exact localStorage method from the documentation
    localStorage.removeItem("emergencyAlert");

    // Clear any existing expiration timer
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }

    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Add a listener for alert changes
   */
  public addListener(
    callback: (alert: EmergencyAlert | null) => void,
  ): () => void {
    this.listeners.add(callback);

    // Immediately call with current state
    if (this.currentAlert) {
      callback(this.currentAlert);
    }

    // Return a function to remove the listener
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of the current alert state
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentAlert);
      } catch (error) {
        logger.error("EmergencyAlertService: Error notifying listener", {
          error,
        });
      }
    });
  }

  /**
   * Load any saved alert from storage on startup
   * Follows the exact pattern in the documentation
   */
  private async loadSavedAlert(): Promise<void> {
    try {
      // Follow exactly the pattern in the documentation
      const savedAlertJson = localStorage.getItem("emergencyAlert");
      if (!savedAlertJson) return;

      const savedAlert = JSON.parse(savedAlertJson);

      if (savedAlert) {
        const expiresAt = new Date(savedAlert.expiresAt).getTime();
        const now = Date.now();

        // Only restore if the alert hasn't expired
        if (expiresAt > now) {
          console.log(
            "EmergencyAlertService: Restoring saved alert from storage",
            savedAlert,
          );
          this.setCurrentAlert(savedAlert);
        } else {
          console.log(
            "EmergencyAlertService: Saved alert has expired, removing from storage",
          );
          localStorage.removeItem("emergencyAlert");
        }
      }
    } catch (error) {
      console.error("EmergencyAlertService: Error loading saved alert", error);
    }
  }

  /**
   * Get the current alert
   */
  public getCurrentAlert(): EmergencyAlert | null {
    return this.currentAlert;
  }

  /**
   * Clean up resources on unmount
   */
  public cleanup(): void {
    logger.info("EmergencyAlertService: Cleaning up");

    // Unregister all event handlers
    this.unregisterHandlers.forEach((unregister) => unregister());
    this.unregisterHandlers = [];

    // Note: We don't close the unified SSE connection here as other services may be using it
    // The unified service manages its own lifecycle

    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }

    this.listeners.clear();
    this.currentAlert = null;
    this.isInitializing = false;
  }

  /**
   * Get current connection status (delegates to unified SSE service)
   */
  public getConnectionStatus(): {
    connected: boolean;
    url: string | null;
    readyState: number | null;
  } {
    const status = unifiedSSEService.getConnectionStatus();
    return {
      connected: status.connected,
      url: status.url,
      readyState: status.readyState,
    };
  }

  /**
   * Handle an alert that comes in via the API instead of SSE
   */
  private tryParseRawAlert(data: any): void {
    try {
      // Check if it's already a valid object
      if (typeof data === "object" && data !== null) {
        if (data.id && data.title && data.message && data.expiresAt) {
          this.setCurrentAlert(data as EmergencyAlert);
          return;
        }
      }

      // Try to parse as JSON string
      if (typeof data === "string") {
        const parsed = JSON.parse(data);
        if (
          parsed &&
          parsed.id &&
          parsed.title &&
          parsed.message &&
          parsed.expiresAt
        ) {
          this.setCurrentAlert(parsed as EmergencyAlert);
          return;
        }
      }

      logger.warn(
        "EmergencyAlertService: Raw alert data not valid for emergency alert",
        { data },
      );
    } catch (e) {
      logger.error("EmergencyAlertService: Error parsing raw alert data", {
        error: e,
      });
    }
  }
}

const emergencyAlertService = new EmergencyAlertService();

export default emergencyAlertService;
