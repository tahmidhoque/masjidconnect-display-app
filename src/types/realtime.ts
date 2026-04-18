/**
 * Realtime WebSocket Types
 *
 * TypeScript interfaces for WebSocket communication with the realtime server.
 * These types define the structure of events sent and received via Socket.io.
 */

import type { EmergencyAlert } from '@/api/models';

/**
 * Emergency alert payload received from WebSocket (v2 contract).
 * Derived from {@link EmergencyAlert} so the WebSocket payload stays in sync
 * with the canonical model. `masjidId` is optional here because the WebSocket
 * payload may omit it — middleware fills it in from the connection context.
 */
type EmergencyAlertData = Omit<EmergencyAlert, 'masjidId'> & { masjidId?: string };

/**
 * Four supported screen orientations (admin-configured).
 * LANDSCAPE / LANDSCAPE_INVERTED = landscape layout; PORTRAIT / PORTRAIT_INVERTED = portrait layout.
 */
export type ScreenOrientation =
  | "LANDSCAPE"
  | "LANDSCAPE_INVERTED"
  | "PORTRAIT"
  | "PORTRAIT_INVERTED";

/** Rotation in degrees applied to the display (0, 90, 180, 270). */
export type RotationDegrees = 0 | 90 | 180 | 270;

/**
 * Screen orientation payload from WebSocket event `screen:orientation`.
 * When rotationDegrees is present it MUST be used; when absent, derive from orientation (§3.3).
 */
interface ScreenOrientationData {
  id: string;
  orientation: ScreenOrientation;
  updatedAt: string;
  /** Optional: rotation in degrees. When present, use this instead of deriving from orientation. */
  rotationDegrees?: RotationDegrees;
}

/**
 * Remote command data received from WebSocket
 */
interface RemoteCommandData {
  commandId: string;
  command: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  sentBy?: string;
}

/**
 * Heartbeat metrics sent to the server (legacy — prefer HeartbeatPayload)
 */
interface HeartbeatMetrics {
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
interface RealtimeConnectionConfig {
  serverUrl: string;
  screenId: string;
  masjidId: string;
  authToken: string;
}

/**
 * Event handlers for realtime events
 */
interface RealtimeEventHandlers {
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
type RealtimeConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

/**
 * Detailed connection status with metadata
 */
interface RealtimeConnectionState {
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
interface CommandAcknowledgement {
  commandId: string;
  commandType: string;
  success: boolean;
  error?: string;
}

/**
 * Error report payload
 */
interface ErrorReport {
  errorType: string;
  message: string;
  errorCode?: string;
  stack?: string;
}

/**
 * Sync request payload
 */
interface SyncRequest {
  type: "full" | "partial";
  lastSyncTime?: string;
}

/**
 * Status update payload
 */
interface StatusUpdate {
  status: "ONLINE" | "BUSY" | "OFFLINE";
  oldStatus?: string;
}

/**
 * Content change notification payload
 */
interface ContentChangeNotification {
  contentId: string;
  contentType: string;
}

/**
 * Payload for content:invalidate WebSocket event.
 * Do not assume additional fields are present (FR-2).
 */
export interface ContentInvalidationPayload {
  type: "prayer_times" | "schedule" | "content_item" | "schedule_assignment" | "playlist_assignment" | "events" | "display_settings";
  masjidId: string;
  entityId?: string;
  screenId?: string;
  action: "created" | "updated" | "deleted";
  timestamp: string; // ISO 8601
}



