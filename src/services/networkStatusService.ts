import logger from "../utils/logger";
import masjidDisplayClient from "../api/masjidDisplayClient";

// Import Redux types and actions for error reporting
import { store } from "../store";
import {
  reportError,
  ErrorCode,
  ErrorSeverity,
} from "../store/slices/errorSlice";
import {
  setShowReconnectOverlay,
  setConnectionStatus,
  recordDisconnect,
  resetReconnectAttempts,
} from "../store/slices/wifiSlice";

export interface NetworkStatusUpdate {
  isOnline: boolean;
  isApiReachable: boolean;
  connectionType: "wifi" | "cellular" | "ethernet" | "unknown";
  latency: number | null;
  lastConnected: string | null;
  lastDisconnected: string | null;
  offlineDuration: number | null;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export type NetworkStatusCallback = (status: NetworkStatusUpdate) => void;

/**
 * NetworkStatusService - Advanced network connectivity monitoring
 *
 * Provides more reliable network status detection than navigator.onLine
 * Includes API reachability testing and connection quality metrics
 * Now also dispatches error reports when network issues are detected
 */
class NetworkStatusService {
  private callbacks: Set<NetworkStatusCallback> = new Set();
  private currentStatus: NetworkStatusUpdate;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastOnlineTime: number = Date.now();
  private consecutiveFailures: number = 0;
  private isInitialized: boolean = false;
  private lastErrorReportTime: number = 0;
  private errorReportCooldown: number = 30000; // 30 seconds between error reports

  // Reconnection tracking
  private lastDisconnectTime: number | null = null;
  private reconnectOverlayTimer: NodeJS.Timeout | null = null;
  private wasOnline: boolean = true;

  // Configuration
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
  private readonly FAST_CHECK_INTERVAL = 5000; // 5 seconds when offline
  private readonly LATENCY_TIMEOUT = 5000; // 5 seconds for latency test
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly RECONNECT_OVERLAY_DELAY = 30000; // Show overlay after 30 seconds offline

  constructor() {
    this.currentStatus = {
      isOnline: navigator.onLine,
      isApiReachable: true,
      connectionType: "unknown",
      latency: null,
      lastConnected: navigator.onLine ? new Date().toISOString() : null,
      lastDisconnected: null,
      offlineDuration: null,
    };
  }

  /**
   * Initialize the network status service
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn("[NetworkStatus] Service already initialized");
      return;
    }

    logger.info("[NetworkStatus] Initializing network status service");

    // Set up event listeners
    this.setupEventListeners();

    // Perform initial check
    this.performComprehensiveCheck();

    // Start periodic checks
    this.startPeriodicChecks();

    this.isInitialized = true;
  }

  /**
   * Clean up the service
   */
  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.reconnectOverlayTimer) {
      clearTimeout(this.reconnectOverlayTimer);
      this.reconnectOverlayTimer = null;
    }

    window.removeEventListener("online", this.handleOnlineEvent);
    window.removeEventListener("offline", this.handleOfflineEvent);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );

    this.callbacks.clear();
    this.isInitialized = false;

    logger.info("[NetworkStatus] Service destroyed");
  }

  /**
   * Subscribe to network status updates
   */
  public subscribe(callback: NetworkStatusCallback): () => void {
    this.callbacks.add(callback);

    // Immediately call with current status
    callback(this.currentStatus);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get current network status
   */
  public getCurrentStatus(): NetworkStatusUpdate {
    return { ...this.currentStatus };
  }

  /**
   * Force a network check
   */
  public async forceCheck(): Promise<NetworkStatusUpdate> {
    await this.performComprehensiveCheck();
    return this.getCurrentStatus();
  }

  /**
   * Manually trigger a network error report (for testing)
   */
  public triggerTestError(): void {
    this.dispatchNetworkError(
      ErrorCode.NET_OFFLINE,
      "Test network error from NetworkStatusService",
      ErrorSeverity.MEDIUM,
    );
  }

  /**
   * Set up browser event listeners
   */
  private setupEventListeners(): void {
    // Browser online/offline events
    window.addEventListener("online", this.handleOnlineEvent);
    window.addEventListener("offline", this.handleOfflineEvent);

    // Page visibility changes (to check when tab becomes active)
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Connection change events (if supported)
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener("change", this.handleConnectionChange);
      }
    }
  }

  /**
   * Handle browser online event
   */
  private handleOnlineEvent = (): void => {
    logger.info("[NetworkStatus] Browser reports online");
    this.performComprehensiveCheck();
  };

  /**
   * Handle browser offline event
   */
  private handleOfflineEvent = (): void => {
    logger.info("[NetworkStatus] Browser reports offline");

    // Report offline error immediately
    this.dispatchNetworkError(
      ErrorCode.NET_OFFLINE,
      "Device appears to be offline",
      ErrorSeverity.MEDIUM,
    );

    this.updateStatus({
      isOnline: false,
      isApiReachable: false,
      latency: null,
    });

    // Start faster checking when offline
    this.startPeriodicChecks(this.FAST_CHECK_INTERVAL);
  };

  /**
   * Handle page visibility change
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      logger.debug("[NetworkStatus] Page became visible, checking network");
      this.performComprehensiveCheck();
    }
  };

  /**
   * Handle connection type changes
   */
  private handleConnectionChange = (): void => {
    logger.debug("[NetworkStatus] Connection type changed");
    this.performComprehensiveCheck();
  };

  /**
   * Start periodic network checks
   */
  private startPeriodicChecks(interval = this.CHECK_INTERVAL): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.performComprehensiveCheck();
    }, interval);

    logger.debug("[NetworkStatus] Started periodic checks", { interval });
  }

  /**
   * Perform a comprehensive network status check
   */
  private async performComprehensiveCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Check basic browser connectivity
      const browserOnline = navigator.onLine;

      // Get connection info if available
      const connectionInfo = this.getConnectionInfo();

      // Test actual connectivity with multiple methods
      const connectivityTests = await Promise.allSettled([
        this.testDNSConnectivity(),
        this.testAPIConnectivity(),
        this.testInternetConnectivity(),
      ]);

      const dnsResult = connectivityTests[0];
      const apiResult = connectivityTests[1];
      const internetResult = connectivityTests[2];

      const dnsWorking = dnsResult.status === "fulfilled" && dnsResult.value;
      const apiReachable = apiResult.status === "fulfilled" && apiResult.value;
      const internetWorking =
        internetResult.status === "fulfilled" && internetResult.value;

      // Calculate latency from API test
      const latency =
        apiResult.status === "fulfilled" && apiReachable
          ? Date.now() - startTime
          : null;

      // Determine overall connectivity
      const isOnline = browserOnline && (dnsWorking || internetWorking);

      // Update status
      const newStatus: Partial<NetworkStatusUpdate> = {
        isOnline,
        isApiReachable: apiReachable,
        latency,
        connectionType: connectionInfo.type,
        effectiveType: connectionInfo.effectiveType,
        downlink: connectionInfo.downlink,
        rtt: connectionInfo.rtt,
      };

      // Update last connected time if we're online
      if (isOnline && apiReachable) {
        newStatus.lastConnected = new Date().toISOString();
        this.lastOnlineTime = Date.now();
        this.consecutiveFailures = 0;

        // Return to normal check interval if we were checking frequently
        if (this.checkInterval && this.consecutiveFailures > 0) {
          this.startPeriodicChecks();
        }
      } else {
        this.consecutiveFailures++;

        // If we've had multiple failures, start checking more frequently
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.startPeriodicChecks(this.FAST_CHECK_INTERVAL);
        }
      }

      this.updateStatus(newStatus);

      logger.debug("[NetworkStatus] Check completed", {
        isOnline,
        apiReachable,
        latency,
        consecutiveFailures: this.consecutiveFailures,
      });
    } catch (error) {
      logger.error("[NetworkStatus] Check failed", { error });

      // Report network error when comprehensive check fails
      this.dispatchNetworkError(
        ErrorCode.NET_CONNECTION_FAILED,
        "Network connectivity check failed",
        ErrorSeverity.MEDIUM,
      );

      this.updateStatus({
        isOnline: false,
        isApiReachable: false,
        latency: null,
      });
    }
  }

  /**
   * Test DNS connectivity
   */
  private async testDNSConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch("https://1.1.1.1", {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Test API connectivity
   * Returns true if API is reachable (even if auth fails), false only for network/server issues
   */
  private async testAPIConnectivity(): Promise<boolean> {
    try {
      const response = await masjidDisplayClient.sendHeartbeat({
        status: "ONLINE",
        metrics: {
          uptime: Math.floor((Date.now() - this.lastOnlineTime) / 1000),
          memoryUsage: 0,
          lastError: "",
        },
      });

      // If heartbeat succeeds, API is definitely reachable
      if (response.success) {
        return true;
      }

      // If heartbeat fails, check if it's an auth error or network error
      const errorMessage = response.error || "";
      const isAuthError =
        errorMessage.toLowerCase().includes("not authenticated") ||
        errorMessage.toLowerCase().includes("authentication") ||
        errorMessage.toLowerCase().includes("unauthorized") ||
        errorMessage.toLowerCase().includes("forbidden");

      // If it's an auth error, the API is reachable (server responded, just not authenticated)
      if (isAuthError) {
        return true;
      }

      // For other errors (network, timeout, server down), API is unreachable
      return false;
    } catch (error: any) {
      // Check if error is auth-related
      const errorMessage = error?.message || error?.toString() || "";
      const isAuthError =
        errorMessage.toLowerCase().includes("not authenticated") ||
        errorMessage.toLowerCase().includes("authentication") ||
        errorMessage.toLowerCase().includes("unauthorized") ||
        errorMessage.toLowerCase().includes("forbidden") ||
        error?.response?.status === 401 ||
        error?.response?.status === 403;

      // If it's an auth error, the API is reachable (server responded, just not authenticated)
      if (isAuthError) {
        return true;
      }

      // For network errors (timeout, connection refused, DNS error, etc.), API is unreachable
      const isNetworkError =
        errorMessage.toLowerCase().includes("timeout") ||
        errorMessage.toLowerCase().includes("network") ||
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("dns") ||
        errorMessage.toLowerCase().includes("failed to fetch") ||
        errorMessage.toLowerCase().includes("networkerror");

      // If it's a network error, API is unreachable
      if (isNetworkError) {
        return false;
      }

      // For unknown errors, assume unreachable to be safe
      return false;
    }
  }

  /**
   * Test general internet connectivity
   */
  private async testInternetConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch("https://httpbin.org/get", {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get connection information from browser
   */
  private getConnectionInfo(): {
    type: "wifi" | "cellular" | "ethernet" | "unknown";
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!connection) {
      return { type: "unknown" };
    }

    // Map connection types
    let type: "wifi" | "cellular" | "ethernet" | "unknown" = "unknown";

    if (connection.type) {
      switch (connection.type) {
        case "wifi":
          type = "wifi";
          break;
        case "cellular":
        case "2g":
        case "3g":
        case "4g":
        case "5g":
          type = "cellular";
          break;
        case "ethernet":
        case "wired":
          type = "ethernet";
          break;
        default:
          type = "unknown";
      }
    }

    return {
      type,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
    };
  }

  /**
   * Update network status and notify subscribers
   */
  private updateStatus(updates: Partial<NetworkStatusUpdate>): void {
    const previousStatus = { ...this.currentStatus };
    this.currentStatus = { ...this.currentStatus, ...updates };

    // Check if status actually changed
    const statusChanged = Object.keys(updates).some((key) => {
      return (
        previousStatus[key as keyof NetworkStatusUpdate] !==
        this.currentStatus[key as keyof NetworkStatusUpdate]
      );
    });

    if (statusChanged) {
      logger.info("[NetworkStatus] Status updated", {
        previous: {
          isOnline: previousStatus.isOnline,
          isApiReachable: previousStatus.isApiReachable,
        },
        current: {
          isOnline: this.currentStatus.isOnline,
          isApiReachable: this.currentStatus.isApiReachable,
        },
      });

      // Report errors when network issues are detected
      this.reportNetworkErrors(previousStatus, this.currentStatus);

      // Notify all subscribers
      this.callbacks.forEach((callback) => {
        try {
          callback(this.currentStatus);
        } catch (error) {
          logger.error("[NetworkStatus] Callback failed", { error });
        }
      });
    }
  }

  /**
   * Report network errors to the error system and handle reconnection tracking
   */
  private reportNetworkErrors(
    previousStatus: NetworkStatusUpdate,
    currentStatus: NetworkStatusUpdate,
  ): void {
    const now = Date.now();

    // Track disconnect/reconnect events for WiFi overlay
    this.handleReconnectionTracking(previousStatus, currentStatus);

    // Check if we should report an error (respect cooldown)
    if (now - this.lastErrorReportTime < this.errorReportCooldown) {
      return;
    }

    // Report when going offline
    if (previousStatus.isOnline && !currentStatus.isOnline) {
      this.dispatchNetworkError(
        ErrorCode.NET_OFFLINE,
        "Device appears to be offline",
        ErrorSeverity.MEDIUM,
      );
      this.lastErrorReportTime = now;
    }

    // Report when API becomes unreachable
    else if (previousStatus.isApiReachable && !currentStatus.isApiReachable) {
      this.dispatchNetworkError(
        ErrorCode.NET_CONNECTION_FAILED,
        "Unable to connect to the server",
        ErrorSeverity.HIGH,
      );
      this.lastErrorReportTime = now;
    }

    // Report when both offline and API unreachable (most severe)
    else if (
      !currentStatus.isOnline &&
      !currentStatus.isApiReachable &&
      (previousStatus.isOnline || previousStatus.isApiReachable)
    ) {
      this.dispatchNetworkError(
        ErrorCode.NET_OFFLINE,
        "No internet connection available",
        ErrorSeverity.HIGH,
      );
      this.lastErrorReportTime = now;
    }

    // Report when coming back online (clear errors)
    else if (
      (!previousStatus.isOnline && currentStatus.isOnline) ||
      (!previousStatus.isApiReachable && currentStatus.isApiReachable)
    ) {
      logger.info(
        "[NetworkStatus] Network restored, errors should be cleared automatically",
      );
    }

    // Report when we have multiple consecutive failures
    if (
      this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES &&
      (!currentStatus.isOnline || !currentStatus.isApiReachable)
    ) {
      this.dispatchNetworkError(
        ErrorCode.NET_CONNECTION_FAILED,
        `Network connection unstable (${this.consecutiveFailures} consecutive failures)`,
        ErrorSeverity.HIGH,
      );
      this.lastErrorReportTime = now;
    }
  }

  /**
   * Handle reconnection tracking for WiFi overlay
   */
  private handleReconnectionTracking(
    previousStatus: NetworkStatusUpdate,
    currentStatus: NetworkStatusUpdate,
  ): void {
    const wasOnline = previousStatus.isOnline || previousStatus.isApiReachable;
    const isOnline = currentStatus.isOnline || currentStatus.isApiReachable;

    // Going offline
    if (wasOnline && !isOnline) {
      logger.info("[NetworkStatus] Connection lost, starting reconnect tracking");
      this.lastDisconnectTime = Date.now();
      this.wasOnline = false;

      // Update WiFi slice
      try {
        store.dispatch(recordDisconnect());
        store.dispatch(setConnectionStatus("disconnected"));
      } catch (error) {
        logger.error("[NetworkStatus] Failed to dispatch disconnect", { error });
      }

      // Start timer to show reconnect overlay after delay
      if (this.reconnectOverlayTimer) {
        clearTimeout(this.reconnectOverlayTimer);
      }

      this.reconnectOverlayTimer = setTimeout(() => {
        // Only show overlay if still offline
        if (!this.currentStatus.isOnline && !this.currentStatus.isApiReachable) {
          logger.info("[NetworkStatus] Offline for 30s, showing reconnect overlay");
          try {
            store.dispatch(setShowReconnectOverlay(true));
          } catch (error) {
            logger.error("[NetworkStatus] Failed to show reconnect overlay", { error });
          }
        }
      }, this.RECONNECT_OVERLAY_DELAY);

      // Update status with disconnect time
      this.currentStatus.lastDisconnected = new Date().toISOString();
    }

    // Coming back online
    if (!this.wasOnline && isOnline) {
      logger.info("[NetworkStatus] Connection restored");
      this.wasOnline = true;

      // Calculate offline duration
      if (this.lastDisconnectTime) {
        const offlineDuration = Date.now() - this.lastDisconnectTime;
        this.currentStatus.offlineDuration = offlineDuration;
        logger.info(`[NetworkStatus] Was offline for ${offlineDuration}ms`);
      }

      // Clear reconnect overlay timer
      if (this.reconnectOverlayTimer) {
        clearTimeout(this.reconnectOverlayTimer);
        this.reconnectOverlayTimer = null;
      }

      // Reset last disconnect time
      this.lastDisconnectTime = null;

      // Update WiFi slice
      try {
        store.dispatch(setShowReconnectOverlay(false));
        store.dispatch(setConnectionStatus("connected"));
        store.dispatch(resetReconnectAttempts());
      } catch (error) {
        logger.error("[NetworkStatus] Failed to dispatch reconnect", { error });
      }
    }

    // Update offline duration while offline
    if (!isOnline && this.lastDisconnectTime) {
      this.currentStatus.offlineDuration = Date.now() - this.lastDisconnectTime;
    }
  }

  /**
   * Get the time since last disconnect (in milliseconds)
   */
  public getOfflineDuration(): number | null {
    if (this.lastDisconnectTime) {
      return Date.now() - this.lastDisconnectTime;
    }
    return null;
  }

  /**
   * Check if we've been offline long enough to show reconnect overlay
   */
  public shouldShowReconnectOverlay(): boolean {
    const offlineDuration = this.getOfflineDuration();
    return offlineDuration !== null && offlineDuration >= this.RECONNECT_OVERLAY_DELAY;
  }

  /**
   * Dispatch a network error to the Redux store
   */
  private dispatchNetworkError(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity,
  ): void {
    try {
      console.log("[NetworkStatus] Dispatching network error", {
        code,
        message,
        severity,
      });

      store.dispatch(
        reportError({
          code,
          message,
          severity,
          source: "NetworkStatusService",
          metadata: {
            isOnline: this.currentStatus.isOnline,
            isApiReachable: this.currentStatus.isApiReachable,
            connectionType: this.currentStatus.connectionType,
            consecutiveFailures: this.consecutiveFailures,
            timestamp: new Date().toISOString(),
          },
        }),
      );

      logger.info("[NetworkStatus] Dispatched network error", {
        code,
        message,
        severity,
      });
      console.log("[NetworkStatus] Successfully dispatched network error", {
        code,
        message,
        severity,
      });
    } catch (error) {
      logger.error("[NetworkStatus] Failed to dispatch network error", {
        error,
        code,
        message,
      });
      console.error("[NetworkStatus] Failed to dispatch network error", {
        error,
        code,
        message,
      });
    }
  }
}

// Export singleton instance
export const networkStatusService = new NetworkStatusService();
export default networkStatusService;
