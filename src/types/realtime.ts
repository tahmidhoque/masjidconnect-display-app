/**
 * Realtime WebSocket Types
 *
 * TypeScript interfaces for WebSocket communication with the realtime server.
 * These types define the structure of events sent and received via Socket.io.
 */

/**
 * Emergency alert payload received from WebSocket (v2 contract).
 * category + urgency are the canonical fields for driving visual style.
 */
export interface EmergencyAlertData {
  id: string;
  action: "show" | "clear";

  // Content
  title: string;
  message: string;

  // Classification (v2)
  category: "safety" | "facility" | "janazah" | "schedule" | "community" | "custom";
  urgency: "critical" | "high" | "medium";
  /** Only non-null when category === 'custom' */
  color: string | null;

  // Timing
  createdAt: string;
  expiresAt: string;
  timing?: {
    duration: number;
    remaining: number;
    autoCloseAt: string;
  };
}

/**
 * Screen orientation data received from WebSocket
 */
export interface ScreenOrientationData {
  id: string;
  orientation: "LANDSCAPE" | "PORTRAIT";
  updatedAt: string;
}

/**
 * Remote command data received from WebSocket
 */
export interface RemoteCommandData {
  commandId: string;
  command: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  sentBy?: string;
}

/**
 * Heartbeat metrics sent to the server (legacy — prefer HeartbeatPayload)
 */
export interface HeartbeatMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  networkLatency?: number;
  temperature?: number;
  currentContent?: string;
  version?: string;
  frameRate?: number;
  displayBrightness?: number;
  resolution?: string;
  storageUsed?: number;
  bandwidthUsage?: number;
  connectionType?: string;
  signalStrength?: number;
  updateProgress?: number;
}

/**
 * Full heartbeat payload sent over WebSocket via display:heartbeat.
 * All fields except timestamp are optional — send only what the device can collect.
 */
export interface HeartbeatPayload {
  /** ISO 8601 timestamp of when the heartbeat was generated */
  timestamp: string;
  status?: 'ONLINE' | 'OFFLINE' | 'PAIRING';
  version?: string;
  cpuUsage?: number;
  /** JS heap usage as a percentage (0–100) */
  memoryUsage?: number;
  /** Persistent storage used in GB */
  storageUsed?: number;
  networkLatency?: number;
  bandwidthUsage?: number;
  frameRate?: number;
  displayBrightness?: number;
  /** e.g. "1920x1080" */
  resolution?: string;
  /** Device temperature in °C */
  temperature?: number;
  /** ID of content currently being displayed */
  currentContent?: string;
  contentLoadTime?: number;
  contentErrors?: number;
  signalStrength?: number;
  /** e.g. "WIFI" | "ETHERNET" | "CELLULAR" */
  connectionType?: string;
  powerConsumption?: number;
  ambientLight?: number;
}

/**
 * Acknowledgement payload returned by the server after display:heartbeat
 */
export interface HeartbeatAck {
  timestamp: string;
  serverTime: string;
}

/**
 * Connection configuration for WebSocket
 */
export interface RealtimeConnectionConfig {
  serverUrl: string;
  screenId: string;
  masjidId: string;
  authToken: string;
}

/**
 * Event handlers for realtime events
 */
export interface RealtimeEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: (attemptNumber: number) => void;
  onReconnecting?: (attemptNumber: number) => void;
  onEmergencyAlert?: (alert: EmergencyAlertData) => void;
  onEmergencyClear?: (alertId: string) => void;
  onOrientationChange?: (orientation: ScreenOrientationData) => void;
  onCommand?: (command: RemoteCommandData) => void;
  onError?: (error: Error) => void;
  onSyncResponse?: (data: Record<string, unknown>) => void;
}

/**
 * Connection status for realtime service
 */
export type RealtimeConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

/**
 * Detailed connection status with metadata
 */
export interface RealtimeConnectionState {
  status: RealtimeConnectionStatus;
  isConnected: boolean;
  reconnectAttempts: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  lastError: string | null;
}

/**
 * Command acknowledgement payload
 */
export interface CommandAcknowledgement {
  commandId: string;
  commandType: string;
  success: boolean;
  error?: string;
}

/**
 * Error report payload
 */
export interface ErrorReport {
  errorType: string;
  message: string;
  errorCode?: string;
  stack?: string;
}

/**
 * Sync request payload
 */
export interface SyncRequest {
  type: "full" | "partial";
  lastSyncTime?: string;
}

/**
 * Status update payload
 */
export interface StatusUpdate {
  status: "ONLINE" | "BUSY" | "OFFLINE";
  oldStatus?: string;
}

/**
 * Content change notification payload
 */
export interface ContentChangeNotification {
  contentId: string;
  contentType: string;
}



