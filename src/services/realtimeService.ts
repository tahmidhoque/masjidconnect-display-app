/**
 * Realtime WebSocket Service
 *
 * Manages WebSocket connection to the realtime server using Socket.io.
 * Handles emergency alerts, screen orientation changes, remote commands,
 * and heartbeat communication.
 *
 * This service replaces the SSE-based connection for more reliable
 * bidirectional real-time communication.
 */

import { io, Socket } from "socket.io-client";
import logger from "../utils/logger";
import {
  EmergencyAlertData,
  ScreenOrientationData,
  RemoteCommandData,
  HeartbeatMetrics,
  RealtimeConnectionConfig,
  RealtimeEventHandlers,
  RealtimeConnectionState,
  RealtimeConnectionStatus,
  CommandAcknowledgement,
  ErrorReport,
  SyncRequest,
  StatusUpdate,
  ContentChangeNotification,
} from "../types/realtime";

// Remote command types that can be received
const COMMAND_TYPES = [
  "RESTART_APP",
  "RELOAD_CONTENT",
  "CLEAR_CACHE",
  "FORCE_UPDATE",
  "UPDATE_SETTINGS",
  "FACTORY_RESET",
  "CAPTURE_SCREENSHOT",
] as const;

/**
 * Realtime WebSocket Service Class
 *
 * Handles persistent WebSocket connection to the realtime server
 * with automatic reconnection and event handling.
 */
class RealtimeService {
  private socket: Socket | null = null;
  private config: RealtimeConnectionConfig | null = null;
  private handlers: RealtimeEventHandlers = {};
  private reconnectAttempts = 0;
  private connectionState: RealtimeConnectionState = {
    status: "disconnected",
    isConnected: false,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastError: null,
  };

  // Connection status listeners
  private statusListeners: Set<(state: RealtimeConnectionState) => void> = new Set();

  /**
   * Check if WebSocket feature is enabled
   * @deprecated WebSocket is now always enabled - SSE has been removed
   */
  public isWebSocketEnabled(): boolean {
    return true;
  }

  // Hardcoded production WebSocket URL
  private static readonly PRODUCTION_REALTIME_URL = "https://masjidconnect-realtime.fly.dev";

  /**
   * Get the realtime server URL
   * Uses hardcoded production URL in production builds for reliability
   */
  public getServerUrl(): string {
    // In production, always use the hardcoded production URL
    if (process.env.NODE_ENV === "production") {
      const url = RealtimeService.PRODUCTION_REALTIME_URL;
      logger.info("[RealtimeService] Using hardcoded production URL", { url });
      return url;
    }

    // In development, allow environment variable override
    const envUrl = process.env.REACT_APP_REALTIME_URL;
    let url = envUrl || "http://localhost:3002";

    // Remove trailing slash if present
    url = url.replace(/\/$/, "");

    // Log the URL being used for debugging
    logger.info("[RealtimeService] Server URL configured", {
      url,
      fromEnv: !!envUrl,
      nodeEnv: process.env.NODE_ENV,
    });

    return url;
  }

  /**
   * Validate connection configuration
   */
  private validateConfig(config: RealtimeConnectionConfig): string | null {
    if (!config.serverUrl) {
      return "Server URL is required";
    }

    if (!config.screenId) {
      return "Screen ID is required";
    }

    if (!config.authToken) {
      return "Auth token is required";
    }

    // Validate URL format
    try {
      new URL(config.serverUrl);
    } catch (error) {
      return `Invalid server URL format: ${config.serverUrl}`;
    }

    return null;
  }

  /**
   * Connect to the realtime server
   */
  public connect(
    config: RealtimeConnectionConfig,
    handlers: RealtimeEventHandlers = {}
  ): void {
    // Prevent duplicate connections
    if (this.socket?.connected) {
      logger.warn("[RealtimeService] Already connected, skipping");
      return;
    }

    // Validate configuration
    const validationError = this.validateConfig(config);
    if (validationError) {
      logger.error("[RealtimeService] Invalid configuration", { error: validationError, config });
      console.error(`❌ [RealtimeService] ${validationError}`);
      this.updateConnectionState({
        status: "disconnected",
        lastError: validationError,
      });
      this.handlers.onError?.(new Error(validationError));
      return;
    }

    this.config = config;
    this.handlers = handlers;

    logger.info(`[RealtimeService] Connecting to ${config.serverUrl}...`);
    console.log(`🔌 [RealtimeService] Connecting to ${config.serverUrl}...`);
    console.log(`🔌 [RealtimeService] Screen ID: ${config.screenId}`);
    console.log(`🔌 [RealtimeService] Masjid ID: ${config.masjidId}`);

    this.updateConnectionState({ status: "connecting" });

    // Log connection details for debugging
    logger.info("[RealtimeService] Connection configuration", {
      serverUrl: config.serverUrl,
      screenId: config.screenId,
      masjidId: config.masjidId,
      hasToken: !!config.authToken,
      isWebSocketEnabled: this.isWebSocketEnabled(),
    });

    try {
      this.socket = io(config.serverUrl, {
        auth: {
          type: "display",
          screenId: config.screenId,
          masjidId: config.masjidId,
          token: config.authToken,
        },
        // Reconnection settings
        reconnection: true,
        reconnectionAttempts: Infinity, // Never stop trying
        reconnectionDelay: 1000, // Start with 1 second
        reconnectionDelayMax: 30000, // Max 30 seconds between attempts
        randomizationFactor: 0.5, // Add some randomness
        // Connection settings
        timeout: 20000, // Connection timeout
        transports: ["polling", "websocket"], // Try polling first, then upgrade to websocket
        // CORS and security settings
        withCredentials: false, // Disable credentials to avoid CORS issues
        // Force new connection (don't reuse existing)
        forceNew: false,
        // Upgrade from polling to websocket
        upgrade: true,
        // Path for Socket.io (default is /socket.io/)
        path: "/socket.io/",
        // Query parameters (if needed)
        query: {},
        // Additional options for better compatibility
        rememberUpgrade: true, // Remember transport preference
        // Auto-connect
        autoConnect: true,
      });

      this.setupEventHandlers();
    } catch (error: any) {
      logger.error("[RealtimeService] Failed to create Socket.io connection", {
        error: error.message,
        stack: error.stack,
        serverUrl: config.serverUrl,
      });
      console.error("❌ [RealtimeService] Failed to create connection:", error);
      this.updateConnectionState({
        status: "disconnected",
        lastError: error.message || "Failed to create connection",
      });
      this.handlers.onError?.(error);
    }
  }

  /**
   * Disconnect from the realtime server
   */
  public disconnect(): void {
    if (this.socket) {
      logger.info("[RealtimeService] Disconnecting...");
      console.log("🔌 [RealtimeService] Disconnecting...");
      this.socket.disconnect();
      this.socket = null;
      this.updateConnectionState({
        status: "disconnected",
        isConnected: false,
        lastDisconnectedAt: Date.now(),
      });
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): RealtimeConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get connection status (simplified)
   */
  public getConnectionStatus(): RealtimeConnectionStatus {
    return this.connectionState.status;
  }

  /**
   * Add a listener for connection status changes
   */
  public addConnectionStatusListener(
    listener: (state: RealtimeConnectionState) => void
  ): () => void {
    this.statusListeners.add(listener);
    // Immediately call with current state
    listener(this.connectionState);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Send heartbeat to server
   */
  public sendHeartbeat(metrics: HeartbeatMetrics): void {
    if (!this.socket || !this.connectionState.isConnected) {
      logger.debug("[RealtimeService] Cannot send heartbeat - not connected");
      return;
    }

    this.socket.emit("display:heartbeat", {
      timestamp: new Date().toISOString(),
      ...metrics,
    });

    logger.debug("[RealtimeService] Heartbeat sent", { metrics });
  }

  /**
   * Acknowledge a command was received and executed
   */
  public acknowledgeCommand(ack: CommandAcknowledgement): void {
    if (!this.socket || !this.connectionState.isConnected) {
      logger.warn("[RealtimeService] Cannot acknowledge command - not connected");
      return;
    }

    this.socket.emit("display:command:ack", ack);
    logger.info("[RealtimeService] Command acknowledged", { ack });
  }

  /**
   * Report an error to the server
   */
  public reportError(error: ErrorReport): void {
    if (!this.socket || !this.connectionState.isConnected) {
      logger.warn("[RealtimeService] Cannot report error - not connected");
      return;
    }

    this.socket.emit("display:error", error);
    logger.info("[RealtimeService] Error reported", { error });
  }

  /**
   * Request content sync
   */
  public requestSync(request: SyncRequest): void {
    if (!this.socket || !this.connectionState.isConnected) {
      logger.warn("[RealtimeService] Cannot request sync - not connected");
      return;
    }

    this.socket.emit("display:sync:request", request);
    logger.info("[RealtimeService] Sync requested", { request });
  }

  /**
   * Update status (online, busy, etc.)
   */
  public updateStatus(status: StatusUpdate): void {
    if (!this.socket || !this.connectionState.isConnected) {
      logger.warn("[RealtimeService] Cannot update status - not connected");
      return;
    }

    this.socket.emit("display:status", status);
    logger.debug("[RealtimeService] Status updated", { status });
  }

  /**
   * Notify content change
   */
  public notifyContentChange(notification: ContentChangeNotification): void {
    if (!this.socket || !this.connectionState.isConnected) {
      logger.warn("[RealtimeService] Cannot notify content change - not connected");
      return;
    }

    this.socket.emit("display:content:changed", notification);
    logger.debug("[RealtimeService] Content change notified", { notification });
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info("[RealtimeService] Cleaning up");
    console.log("🔌 [RealtimeService] Cleaning up");

    this.disconnect();
    this.handlers = {};
    this.statusListeners.clear();
    this.reconnectAttempts = 0;
    this.connectionState = {
      status: "disconnected",
      isConnected: false,
      reconnectAttempts: 0,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: null,
    };
  }

  /**
   * Update connection state and notify listeners
   */
  private updateConnectionState(partial: Partial<RealtimeConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...partial };
    this.notifyStatusListeners();
  }

  /**
   * Notify all status listeners of state change
   */
  private notifyStatusListeners(): void {
    this.statusListeners.forEach((listener) => {
      try {
        listener(this.connectionState);
      } catch (error) {
        logger.error("[RealtimeService] Error notifying status listener", { error });
      }
    });
  }

  /**
   * Set up socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", () => {
      logger.info("[RealtimeService] Connected to server");
      console.log("✅ [RealtimeService] Connected to server");

      this.updateConnectionState({
        status: "connected",
        isConnected: true,
        reconnectAttempts: 0,
        lastConnectedAt: Date.now(),
        lastError: null,
      });

      this.reconnectAttempts = 0;
      this.handlers.onConnect?.();
    });

    this.socket.on("disconnect", (reason: string) => {
      logger.info(`[RealtimeService] Disconnected: ${reason}`);
      console.log(`🔴 [RealtimeService] Disconnected: ${reason}`);

      this.updateConnectionState({
        status: "disconnected",
        isConnected: false,
        lastDisconnectedAt: Date.now(),
      });

      this.handlers.onDisconnect?.(reason);
    });

    this.socket.on("connect_error", (error: Error & { type?: string; description?: string | number; context?: any; data?: any }) => {
      // Extract more detailed error information
      const errorMessage = error.message || String(error.description) || "Connection failed";
      const errorType = error.type || "Unknown";
      
      // Check if it's a transport error and log transport details
      const transport = this.socket?.io?.engine?.transport?.name || "unknown";
      const readyState = this.socket?.io?.engine?.readyState || "unknown";
      
      // Extract HTTP status code if available (description is often the status code)
      const statusCode = typeof error.description === "number" ? error.description : null;
      const xhrStatus = (error.context as XMLHttpRequest)?.status;
      const xhrStatusText = (error.context as XMLHttpRequest)?.statusText;
      
      const errorDetails = {
        message: errorMessage,
        type: errorType,
        description: error.description,
        statusCode: statusCode || xhrStatus,
        statusText: xhrStatusText,
        context: error.context,
        data: error.data,
        serverUrl: this.config?.serverUrl,
        screenId: this.config?.screenId,
        transport,
        readyState,
        socketConnected: this.socket?.connected,
        // Check if it's a CORS or network error
        isCorsError: statusCode === 0 || (xhrStatus === 0 && !navigator.onLine === false),
        isNetworkError: statusCode === 0 || xhrStatus === 0,
      };

      logger.error("[RealtimeService] Connection error:", errorDetails);
      console.error("❌ [RealtimeService] Connection error:", errorDetails);
      
      // Provide helpful error messages
      if (statusCode === 0 || xhrStatus === 0) {
        logger.error("[RealtimeService] Network or CORS error detected - check server URL and CORS configuration", {
          serverUrl: this.config?.serverUrl,
          suggestion: "Verify REACT_APP_REALTIME_URL is set correctly and server allows CORS",
        });
        console.error("❌ [RealtimeService] Network/CORS error - check server URL:", this.config?.serverUrl);
      }
      
      // If WebSocket fails, Socket.io should automatically fall back to polling
      // Log this for debugging
      if (transport === "websocket" && errorType === "TransportError") {
        logger.info("[RealtimeService] WebSocket failed, Socket.io will attempt polling fallback");
        console.log("🔄 [RealtimeService] WebSocket failed, falling back to polling...");
      }

      // Don't update state to disconnected immediately - let Socket.io try polling
      // Only update if we've exhausted all transport options
      if (errorType !== "TransportError" || readyState === "closed") {
        this.updateConnectionState({
          status: "disconnected",
          lastError: errorMessage,
        });
      }

      this.handlers.onError?.(error);
    });

    // Transport upgrade events (polling -> websocket)
    this.socket.io.engine.on("upgrade", () => {
      const transport = this.socket?.io?.engine?.transport?.name;
      logger.info(`[RealtimeService] Transport upgraded to: ${transport}`);
      console.log(`⬆️ [RealtimeService] Transport upgraded to: ${transport}`);
    });

    this.socket.io.engine.on("upgradeError", (error: Error) => {
      logger.warn("[RealtimeService] Transport upgrade failed, staying on polling", {
        error: error.message,
      });
      console.log("⚠️ [RealtimeService] Transport upgrade failed, staying on polling");
    });

    // Reconnection events (Socket.io Manager events)
    this.socket.io.on("reconnect", (attemptNumber: number) => {
      const transport = this.socket?.io?.engine?.transport?.name;
      logger.info(`[RealtimeService] Reconnected after ${attemptNumber} attempts (transport: ${transport})`);
      console.log(`🔄 [RealtimeService] Reconnected after ${attemptNumber} attempts (transport: ${transport})`);

      this.reconnectAttempts = 0;
      this.updateConnectionState({
        status: "connected",
        isConnected: true,
        reconnectAttempts: 0,
        lastConnectedAt: Date.now(),
        lastError: null,
      });

      this.handlers.onReconnect?.(attemptNumber);
    });

    this.socket.io.on("reconnect_attempt", (attemptNumber: number) => {
      logger.debug(`[RealtimeService] Reconnection attempt ${attemptNumber}`);
      console.log(`🔄 [RealtimeService] Reconnection attempt ${attemptNumber}`);

      this.reconnectAttempts = attemptNumber;
      this.updateConnectionState({
        status: "reconnecting",
        reconnectAttempts: attemptNumber,
      });

      this.handlers.onReconnecting?.(attemptNumber);
    });

    this.socket.io.on("reconnect_error", (error: Error) => {
      logger.error("[RealtimeService] Reconnection error:", { error: error.message });
      console.error("❌ [RealtimeService] Reconnection error:", error.message);
    });

    // Display-specific events
    this.socket.on("display:connected", (data: Record<string, unknown>) => {
      logger.info("[RealtimeService] Server confirmed connection:", data);
      console.log("✅ [RealtimeService] Server confirmed connection:", data);
    });

    this.socket.on("display:heartbeat:ack", (data: Record<string, unknown>) => {
      logger.debug("[RealtimeService] Heartbeat acknowledged:", data);
    });

    // Emergency alerts
    this.socket.on("emergency:alert", (data: EmergencyAlertData) => {
      logger.info("[RealtimeService] Emergency alert received:", data);
      console.log("🚨 [RealtimeService] Emergency alert received:", data);

      if (data.action === "clear") {
        this.handlers.onEmergencyClear?.(data.id);
      } else {
        this.handlers.onEmergencyAlert?.(data);
      }
    });

    // Screen orientation
    this.socket.on("screen:orientation", (data: ScreenOrientationData) => {
      logger.info("[RealtimeService] Orientation change received:", data);
      console.log("🔄 [RealtimeService] Orientation change received:", data);
      this.handlers.onOrientationChange?.(data);
    });

    // Remote commands (all command types)
    for (const cmdType of COMMAND_TYPES) {
      this.socket.on(`screen:command:${cmdType}`, (data: RemoteCommandData) => {
        logger.info(`[RealtimeService] Command received: ${cmdType}`, data);
        console.log(`🎮 [RealtimeService] Command received: ${cmdType}`, data);
        this.handlers.onCommand?.({ ...data, command: cmdType });
      });
    }

    // Sync response
    this.socket.on("display:sync:response", (data: Record<string, unknown>) => {
      logger.info("[RealtimeService] Sync response received:", data);
      this.handlers.onSyncResponse?.(data);
    });
  }
}

// Export singleton instance
const realtimeService = new RealtimeService();
export default realtimeService;

