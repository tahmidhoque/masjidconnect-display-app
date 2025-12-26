/**
 * Emergency Alert Service
 *
 * Manages emergency alert state and persistence.
 * Alert events are received via WebSocket through the realtimeMiddleware.
 * This service handles local state management, expiration timers, and listener notifications.
 */

import { EmergencyAlert } from "../api/models";
import logger from "../utils/logger";
import { AlertColorSchemeKey } from "../components/common/EmergencyAlertOverlay";

// Storage key for offline persistence
const STORAGE_KEY = "emergency_alert";

class EmergencyAlertService {
  private listeners: Set<(alert: EmergencyAlert | null) => void> = new Set();
  private currentAlert: EmergencyAlert | null = null;
  private expirationTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Load any saved alert on construction
    this.loadSavedAlert();
  }

  /**
   * Set an emergency alert (called by middleware when WebSocket event received)
   */
  public setAlert(alertData: EmergencyAlert): void {
    console.log("🚨 EmergencyAlertService: Setting alert:", alertData.title);

    // Handle action field - if action is "clear" or "hide", clear the alert instead of showing it
    if (
      (alertData as any).action === "clear" ||
      (alertData as any).action === "hide"
    ) {
      console.log(
        "🚨 EmergencyAlertService: Alert has action='clear' or 'hide', clearing current alert",
      );
      this.clearAlert();
      return;
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
      alertData.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }

    // Ensure createdAt exists
    if (!alertData.createdAt) {
      alertData.createdAt = new Date().toISOString();
    }

    // Detect color scheme based on the color value
    if (alertData.color && !alertData.colorScheme) {
      const colorToScheme: Record<string, AlertColorSchemeKey> = {
        "#f44336": "RED",
        "#ff9800": "ORANGE",
        "#ffb74d": "AMBER",
        "#2196f3": "BLUE",
        "#4caf50": "GREEN",
        "#9c27b0": "PURPLE",
        "#263238": "DARK",
      };

      const normalizedColor = alertData.color.toLowerCase().replace(/\s+/g, "");

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

    this.setCurrentAlert(alertData);
  }

  /**
   * Clear the current alert (called by middleware when WebSocket clear event received)
   */
  public clearAlert(alertId?: string): void {
    console.log("🚨 EmergencyAlertService: Clear alert requested", { alertId });

    // If alertId provided, only clear if it matches
    if (alertId && this.currentAlert) {
      if (this.currentAlert.id !== alertId && alertId !== "*") {
        console.log(
          "🚨 EmergencyAlertService: Alert ID does not match, not clearing",
        );
        return;
      }
    }

    this.clearCurrentAlert();
  }

  /**
   * Set the current alert and schedule its expiration
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
    } else {
      // FALLBACK: Calculate from expiresAt
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
          `🚨 EmergencyAlertService: Alert "${alert.title}" expired automatically`,
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

    // Clear from storage
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
    console.log(
      `🚨 EmergencyAlertService: Notifying ${this.listeners.size} listener(s)`,
      {
        hasAlert: !!this.currentAlert,
        alertId: this.currentAlert?.id,
        alertTitle: this.currentAlert?.title,
      },
    );
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentAlert);
      } catch (error) {
        console.error(
          "🚨 EmergencyAlertService: Error notifying listener",
          error,
        );
        logger.error("EmergencyAlertService: Error notifying listener", {
          error,
        });
      }
    });
  }

  /**
   * Load any saved alert from storage on startup
   */
  private loadSavedAlert(): void {
    try {
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
   * Clean up resources
   */
  public cleanup(): void {
    logger.info("EmergencyAlertService: Cleaning up");

    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }

    this.currentAlert = null;

    console.log("🚨 EmergencyAlertService: Cleanup complete");
  }
}

const emergencyAlertService = new EmergencyAlertService();

export default emergencyAlertService;
