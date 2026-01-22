// Authentication Types
export interface ApiCredentials {
  apiKey: string;
  screenId: string;
}

// Version/Update Types
export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface VersionInfo {
  version: string;
  releaseNotes: string;
  publishedAt: string;
  isPrerelease: boolean;
  downloadUrls: {
    armv7l?: string;
    arm64?: string;
  };
  assets: GitHubAsset[];
}

export interface PairingRequest {
  pairingCode: string;
  deviceInfo: {
    deviceType: string;
    orientation: "LANDSCAPE" | "PORTRAIT";
  };
}

// Step 1: Request a pairing code
export interface RequestPairingCodeRequest {
  deviceInfo: {
    deviceId: string;
    model: string;
    platform: string;
  };
}

export interface RequestPairingCodeResponse {
  pairingCode: string;
  expiresAt: string;
}

// Step 2: Check pairing status
export interface CheckPairingStatusRequest {
  pairingCode: string;
}

export interface CheckPairingStatusResponse {
  isPaired?: boolean; // Keep for backward compatibility
  paired?: boolean; // This is what the API actually returns
  screenId?: string;
  apiKey?: string;
  masjidId?: string;
}

// Make these more explicit for when we receive `paired: true`
export interface PairedCheckResponse {
  paired: boolean; // API returns this format with explicit paired: true
  apiKey: string;
  screenId: string;
  masjidId: string;
}

// Step 3: Complete pairing & get credentials
export interface PairedCredentialsRequest {
  pairingCode: string;
  deviceInfo: {
    deviceId: string;
    model: string;
    platform: string;
  };
}

export interface PairedCredentialsResponse {
  apiKey: string;
  screenId: string;
  masjidId: string;
}

export interface PairingResponse {
  screen: {
    id: string;
    name: string;
    apiKey: string;
  };
}

export interface HeartbeatRequest {
  status: "ONLINE" | "OFFLINE" | "ERROR";
  metrics: {
    uptime: number;
    memoryUsage: number;
    lastError: string;
  };
}

// Remote Command interface (shared with remoteControlService)
export interface RemoteCommand {
  id?: string; // Backward compatibility
  commandId: string; // Unique command identifier
  type:
    | "RESTART_APP"
    | "RELOAD_CONTENT"
    | "CLEAR_CACHE"
    | "FORCE_UPDATE"
    | "UPDATE_SETTINGS"
    | "FACTORY_RESET"
    | "CAPTURE_SCREENSHOT"
    | "UPDATE_ORIENTATION"
    | "REFRESH_PRAYER_TIMES"
    | "DISPLAY_MESSAGE"
    | "REBOOT_DEVICE";
  payload?: {
    countdown?: number;
    settings?: any;
    orientation?: string;
    [key: string]: any;
  };
  timestamp: string;
  _queueId?: string; // Internal: queue ID for marking as delivered
}

export interface HeartbeatResponse {
  success: boolean;
  hasPendingEvents?: boolean; // Backward compatibility: indicates queued SSE events are available on backend
  hasPendingEmergencyAlerts?: boolean; // Indicates pending emergency alerts (EMERGENCY_ALERT, EMERGENCY_UPDATE, EMERGENCY_CANCEL) queued on backend
  pendingCommands?: RemoteCommand[]; // New: actual pending commands to process
  nextHeartbeatInterval?: number; // New: server-controlled heartbeat interval in milliseconds
  data?: {
    acknowledged?: boolean;
    serverTime?: string;
    hasPendingEvents?: boolean;
    hasPendingEmergencyAlerts?: boolean;
    pendingCommands?: RemoteCommand[];
    nextHeartbeatInterval?: number;
    [key: string]: any; // Allow other data fields
  };
}

// New Analytics Types for Enhanced Heartbeat System

export type AnalyticsDataType =
  | "heartbeat"
  | "content_view"
  | "error"
  | "schedule_event";

export interface BaseAnalyticsRequest {
  type: AnalyticsDataType;
  timestamp: string; // ISO 8601 format
  data: any; // Will be one of the specific data types below
}

// Update Progress Interface
export interface UpdateProgress {
  status:
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error"
    | "not-available"
    | "idle";
  version?: string;
  progress?: number;
  error?: string;
  timestamp: string;
}

// Heartbeat Analytics Data
export interface HeartbeatAnalyticsData {
  // Application Information (REQUIRED)
  appVersion: string; // Current app version (e.g., "1.2.3")
  platform: string; // Platform (e.g., "Linux armv7l")
  electronVersion?: string; // Electron version

  // System Performance (REQUIRED)
  cpuUsage: number; // CPU usage percentage (0-100)
  memoryUsage: number; // Memory usage percentage (0-100)

  // Storage & Network (REQUIRED)
  storageUsed: number; // Storage used percentage (0-100)
  networkLatency: number; // Network latency in milliseconds
  bandwidthUsage: number; // Current bandwidth usage in Mbps

  // Display Metrics (REQUIRED)
  frameRate: number; // Current frame rate (fps)
  displayBrightness: number; // Display brightness percentage (0-100)
  resolution: string; // Current resolution (e.g., "1920x1080")

  // Hardware Monitoring (OPTIONAL)
  temperature?: number; // Device temperature in Celsius
  powerConsumption?: number; // Power consumption in watts
  ambientLight?: number; // Ambient light sensor reading (0-100)

  // Content Information (REQUIRED)
  currentContent: string; // ID or name of currently displayed content
  contentLoadTime: number; // Time taken to load current content (ms)
  contentErrors: number; // Number of content errors since last heartbeat

  // Network Details (REQUIRED)
  signalStrength: number; // WiFi/Network signal strength percentage (0-100)
  connectionType: string; // Connection type: "wifi", "ethernet", "cellular"

  // Update Progress (OPTIONAL - included when available, as percentage 0-100)
  updateProgress?: number;
}

export interface HeartbeatAnalyticsRequest extends BaseAnalyticsRequest {
  type: "heartbeat";
  data: HeartbeatAnalyticsData;
}

// Content View Analytics Data
export interface ContentViewAnalyticsData {
  contentId: string; // Unique identifier for the content
  contentType: string; // Type: "announcement", "verse_hadith", "prayer_times", etc.
  startTime: string; // ISO 8601 timestamp when content started displaying
  endTime?: string; // ISO 8601 timestamp when content stopped (if applicable)
  duration: number; // Display duration in milliseconds
  viewComplete: boolean; // Whether the content was fully displayed
}

export interface ContentViewAnalyticsRequest extends BaseAnalyticsRequest {
  type: "content_view";
  data: ContentViewAnalyticsData;
}

// Error Reporting Analytics Data
export type ErrorType = "NETWORK" | "CONTENT" | "DISPLAY" | "SYSTEM" | "API";

export interface ErrorAnalyticsData {
  errorType: ErrorType;
  errorCode?: string; // Application-specific error code
  message: string; // Human-readable error message
  stack?: string; // Stack trace (if available)
  resolved: boolean; // Whether the error has been resolved
}

export interface ErrorAnalyticsRequest extends BaseAnalyticsRequest {
  type: "error";
  data: ErrorAnalyticsData;
}

// Schedule Event Analytics Data
export type ScheduleEventType =
  | "content_change"
  | "schedule_update"
  | "override_start"
  | "override_end";

export interface ScheduleEventAnalyticsData {
  eventType: ScheduleEventType;
  scheduleId?: string; // ID of the schedule being executed
  contentId?: string; // ID of the content being displayed
  expectedStartTime: string; // When the event was scheduled to occur
  actualStartTime: string; // When the event actually occurred
  delay?: number; // Delay in milliseconds (if any)
}

export interface ScheduleEventAnalyticsRequest extends BaseAnalyticsRequest {
  type: "schedule_event";
  data: ScheduleEventAnalyticsData;
}

// Union type for all analytics requests
export type AnalyticsRequest =
  | HeartbeatAnalyticsRequest
  | ContentViewAnalyticsRequest
  | ErrorAnalyticsRequest
  | ScheduleEventAnalyticsRequest;

export interface AnalyticsResponse {
  success: boolean;
  message?: string;
}

// Display Settings Types
/**
 * Time format preference for displaying times
 * - '12h': 12-hour format with AM/PM (e.g., "4:30 PM")
 * - '24h': 24-hour format (e.g., "16:30")
 */
export type TimeFormat = "12h" | "24h";

/**
 * Screen content configuration settings
 * These are controlled from the admin portal
 */
export interface ScreenContentConfig {
  carouselInterval?: number; // Interval in seconds for carousel rotation
  timeFormat?: TimeFormat; // Time display format preference
  [key: string]: any; // Allow additional settings
}

// Content Types
export type ContentItemType =
  | "VERSE_HADITH"
  | "ANNOUNCEMENT"
  | "EVENT"
  | "CUSTOM"
  | "ASMA_AL_HUSNA";

export interface ContentItem {
  id: string;
  type: ContentItemType;
  title: string;
  content: any; // This will be different based on the type
  duration: number;
}

export interface ScheduleItem {
  id: string;
  order: number;
  contentItem: ContentItem;
}

export interface Schedule {
  id: string;
  name: string;
  items: ScheduleItem[];
  data?: Schedule[]; // For new API format that returns a wrapped data array
  success?: boolean;
  error?: null | string;
  timestamp?: string;
  cacheControl?: { maxAge?: number; staleWhileRevalidate?: number };
}

export interface PrayerTimes {
  date?: string;
  fajr: string;
  sunrise: string;
  zuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  fajrJamaat: string;
  zuhrJamaat: string;
  asrJamaat: string;
  maghribJamaat: string;
  ishaJamaat: string;
  jummahKhutbah?: string;
  jummahJamaat?: string;
  data?: PrayerTimes[]; // For new API format that returns an array of days
  success?: boolean;
  error?: null | string;
  timestamp?: string;
  cacheControl?: { maxAge?: number; staleWhileRevalidate?: number };
}

export interface ContentOverride {
  contentType: string;
  enabled: boolean;
  config: any;
}

export interface ScreenContent {
  screen: {
    id: string;
    name: string;
    orientation: "LANDSCAPE" | "PORTRAIT";
    contentConfig: ScreenContentConfig;
    masjid?: {
      name: string;
      timezone: string;
    };
  };
  masjid?: {
    id?: string; // masjidId - added for WebSocket connection support
    name: string;
    timezone: string;
  };
  schedule: Schedule;
  prayerTimes: PrayerTimes;
  contentOverrides: ContentOverride[];
  lastUpdated: string;
  // New fields for the updated API format
  data?: {
    masjid?: {
      id?: string; // masjidId - added for WebSocket connection support
      name: string;
      timezone: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
    screen?: {
      id: string;
      name: string;
      orientation: "LANDSCAPE" | "PORTRAIT";
      contentConfig?: ScreenContentConfig;
      masjid?: {
        name: string;
        timezone: string;
      };
    };
    events?: Event[] | { data: Event[] };
  };
  events?: Event[] | { data: Event[] };
}

// Prayer Status Types
export type PrayerName =
  | "FAJR"
  | "SUNRISE"
  | "ZUHR"
  | "ASR"
  | "MAGHRIB"
  | "ISHA"
  | "JUMMAH";

export interface Prayer {
  name: PrayerName;
  time: string;
}

export interface PrayerStatus {
  currentPrayer: Prayer;
  nextPrayer: Prayer | null;
  currentPrayerTime?: string; // May be deprecated in new format
  currentJamaatTime?: string; // May be deprecated in new format
  nextPrayerTime?: string; // May be deprecated in new format
  nextJamaatTime?: string; // May be deprecated in new format
  timeUntilNextPrayer: string; // Duration in format HH:MM:SS
  timeUntilNextJamaat: string; // Duration in format HH:MM:SS
  timestamp?: string; // ISO date string of when status was generated
  isAfterIsha?: boolean; // Whether it's after Isha and before Fajr
  success?: boolean; // New API response format
  data?: {
    // New API response format may include nested data
    currentJamaatTime?: string;
    currentPrayer?: Prayer;
    currentPrayerTime?: string;
    error?: null | string;
    isAfterIsha?: boolean;
    nextJamaatTime?: string;
    nextPrayer?: Prayer;
    nextPrayerTime?: string;
    success?: boolean;
    timeUntilNextJamaat?: string;
    timeUntilNextPrayer?: string;
    timestamp?: string;
  };
  error?: null | string; // New API response format
}

// Event Types
export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  category: string;
}

export interface EventsResponse {
  events: Event[];
}

// Generic API Response
export interface ApiResponse<T> {
  data: T | null;
  success: boolean;
  error?: string;
  cached?: boolean;
  offlineFallback?: boolean;
  timestamp?: number;
  cacheAge?: number;
  status?: number;
}

// Predefined alert color values matching ALERT_COLOR_SCHEMES
export type AlertColorType =
  | "#f44336" // RED
  | "#ff9800" // ORANGE
  | "#ffb74d" // AMBER
  | "#2196f3" // BLUE
  | "#4caf50" // GREEN
  | "#9c27b0" // PURPLE
  | "#263238" // DARK
  | string; // Allow for custom colors

import { AlertColorSchemeKey } from "../components/common/EmergencyAlertOverlay";

export interface EmergencyAlert {
  id: string;
  title: string;
  message: string;
  color: AlertColorType;
  colorScheme?: AlertColorSchemeKey; // Name of predefined color scheme (RED, PURPLE, etc)
  expiresAt: string; // ISO date string when alert expires
  createdAt: string; // ISO date string when alert was created
  masjidId: string; // ID of the masjid that created the alert
  timing?: {
    duration: number; // Total duration in milliseconds
    remaining: number; // Remaining time in milliseconds (calculated by server)
    autoCloseAt: string; // ISO date string when alert should auto-close
  };
  action?: "show" | "hide" | "update" | "clear"; // Action to perform with this alert
}
