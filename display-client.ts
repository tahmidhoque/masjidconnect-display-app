/**
 * Display App WebSocket Client
 *
 * This is a reference implementation for the Electron display app's
 * WebSocket connection to the realtime server.
 *
 * Copy this file to the Electron display app and adapt as needed.
 *
 * Usage:
 *   import { RealtimeClient } from './display-client';
 *
 *   const client = new RealtimeClient();
 *   client.connect({
 *     serverUrl: 'https://realtime.masjidconnect.com',
 *     screenId: 'screen-123',
 *     masjidId: 'masjid-456',
 *     authToken: 'your-auth-token',
 *   });
 */

import { io, Socket } from "socket.io-client";

// Event types that the display app can receive
export interface EmergencyAlertData {
  id: string;
  title: string;
  message: string;
  color: string | null;
  createdAt: string;
  expiresAt: string;
  timing?: {
    duration: number;
    remaining: number;
    autoCloseAt: string;
  };
  action: "show" | "clear";
}

export interface ScreenOrientationData {
  id: string;
  orientation: "LANDSCAPE" | "PORTRAIT";
  updatedAt: string;
}

export interface RemoteCommandData {
  commandId: string;
  command: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  sentBy?: string;
}

// Connection configuration
export interface ConnectionConfig {
  serverUrl: string;
  screenId: string;
  masjidId: string;
  authToken: string;
}

// Event handlers
export interface RealtimeEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: (attemptNumber: number) => void;
  onEmergencyAlert?: (alert: EmergencyAlertData) => void;
  onEmergencyClear?: (alertId: string) => void;
  onOrientationChange?: (orientation: ScreenOrientationData) => void;
  onCommand?: (command: RemoteCommandData) => void;
  onError?: (error: Error) => void;
}

/**
 * Realtime WebSocket Client for Display Apps
 *
 * Handles persistent WebSocket connection to the realtime server
 * with automatic reconnection and event handling.
 */
export class RealtimeClient {
  private socket: Socket | null = null;
  private config: ConnectionConfig | null = null;
  private handlers: RealtimeEventHandlers = {};
  private reconnectAttempts = 0;
  private isConnected = false;

  /**
   * Connect to the realtime server
   */
  connect(config: ConnectionConfig, handlers: RealtimeEventHandlers = {}): void {
    this.config = config;
    this.handlers = handlers;

    console.log(`[RealtimeClient] Connecting to ${config.serverUrl}...`);

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
      transports: ["websocket", "polling"], // Prefer WebSocket
    });

    this.setupEventHandlers();
  }

  /**
   * Disconnect from the realtime server
   */
  disconnect(): void {
    if (this.socket) {
      console.log("[RealtimeClient] Disconnecting...");
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected
   */
  isSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Send heartbeat to server
   */
  sendHeartbeat(metrics: {
    cpuUsage?: number;
    memoryUsage?: number;
    networkLatency?: number;
    temperature?: number;
    currentContent?: string;
    version?: string;
  }): void {
    if (!this.socket || !this.isConnected) {
      console.warn("[RealtimeClient] Cannot send heartbeat - not connected");
      return;
    }

    this.socket.emit("display:heartbeat", {
      timestamp: new Date().toISOString(),
      ...metrics,
    });
  }

  /**
   * Acknowledge a command was received and executed
   */
  acknowledgeCommand(
    commandId: string,
    commandType: string,
    success: boolean,
    error?: string,
  ): void {
    if (!this.socket || !this.isConnected) {
      console.warn("[RealtimeClient] Cannot acknowledge command - not connected");
      return;
    }

    this.socket.emit("display:command:ack", {
      commandId,
      commandType,
      success,
      error,
    });
  }

  /**
   * Report an error to the server
   */
  reportError(
    errorType: string,
    message: string,
    errorCode?: string,
    stack?: string,
  ): void {
    if (!this.socket || !this.isConnected) {
      console.warn("[RealtimeClient] Cannot report error - not connected");
      return;
    }

    this.socket.emit("display:error", {
      errorType,
      message,
      errorCode,
      stack,
    });
  }

  /**
   * Request content sync
   */
  requestSync(type: "full" | "partial" = "partial", lastSyncTime?: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn("[RealtimeClient] Cannot request sync - not connected");
      return;
    }

    this.socket.emit("display:sync:request", {
      type,
      lastSyncTime,
    });
  }

  /**
   * Update status (online, busy, etc.)
   */
  updateStatus(status: "ONLINE" | "BUSY" | "OFFLINE", oldStatus?: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn("[RealtimeClient] Cannot update status - not connected");
      return;
    }

    this.socket.emit("display:status", {
      status,
      oldStatus,
    });
  }

  /**
   * Notify content change
   */
  notifyContentChange(contentId: string, contentType: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn("[RealtimeClient] Cannot notify content change - not connected");
      return;
    }

    this.socket.emit("display:content:changed", {
      contentId,
      contentType,
    });
  }

  /**
   * Set up socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", () => {
      console.log("[RealtimeClient] Connected to server");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.handlers.onConnect?.();
    });

    this.socket.on("disconnect", (reason: string) => {
      console.log(`[RealtimeClient] Disconnected: ${reason}`);
      this.isConnected = false;
      this.handlers.onDisconnect?.(reason);
    });

    this.socket.on("connect_error", (error: Error) => {
      console.error("[RealtimeClient] Connection error:", error);
      this.handlers.onError?.(error);
    });

    // Reconnection events (Socket.io Manager events)
    this.socket.io.on("reconnect", (attemptNumber: number) => {
      console.log(`[RealtimeClient] Reconnected after ${attemptNumber} attempts`);
      this.reconnectAttempts = 0;
      this.handlers.onReconnect?.(attemptNumber);
    });

    this.socket.io.on("reconnect_attempt", (attemptNumber: number) => {
      console.log(`[RealtimeClient] Reconnection attempt ${attemptNumber}`);
      this.reconnectAttempts = attemptNumber;
    });

    this.socket.io.on("reconnect_error", (error: Error) => {
      console.error("[RealtimeClient] Reconnection error:", error);
    });

    // Display-specific events
    this.socket.on("display:connected", (data: Record<string, unknown>) => {
      console.log("[RealtimeClient] Server confirmed connection:", data);
    });

    this.socket.on("display:heartbeat:ack", (data: Record<string, unknown>) => {
      console.debug("[RealtimeClient] Heartbeat acknowledged:", data);
    });

    // Emergency alerts
    this.socket.on("emergency:alert", (data: EmergencyAlertData) => {
      console.log("[RealtimeClient] Emergency alert received:", data);

      if (data.action === "clear") {
        this.handlers.onEmergencyClear?.(data.id);
      } else {
        this.handlers.onEmergencyAlert?.(data);
      }
    });

    // Screen orientation
    this.socket.on("screen:orientation", (data: ScreenOrientationData) => {
      console.log("[RealtimeClient] Orientation change received:", data);
      this.handlers.onOrientationChange?.(data);
    });

    // Remote commands (all command types)
    const commandTypes = [
      "RESTART_APP",
      "RELOAD_CONTENT",
      "CLEAR_CACHE",
      "FORCE_UPDATE",
      "UPDATE_SETTINGS",
      "FACTORY_RESET",
      "CAPTURE_SCREENSHOT",
    ];

    for (const cmdType of commandTypes) {
      this.socket.on(`screen:command:${cmdType}`, (data: RemoteCommandData) => {
        console.log(`[RealtimeClient] Command received: ${cmdType}`, data);
        this.handlers.onCommand?.({ ...data, command: cmdType });
      });
    }

    // Sync response
    this.socket.on("display:sync:response", (data: Record<string, unknown>) => {
      console.log("[RealtimeClient] Sync response received:", data);
    });
  }
}

// Export a singleton instance for convenience
export const realtimeClient = new RealtimeClient();

// Default export
export default RealtimeClient;

