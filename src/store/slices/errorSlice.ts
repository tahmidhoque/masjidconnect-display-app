import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import logger from "../../utils/logger";

// Error codes for systematic debugging
export enum ErrorCode {
  // Network Errors (NET_xxx)
  NET_OFFLINE = "NET_001",
  NET_TIMEOUT = "NET_002",
  NET_CONNECTION_FAILED = "NET_003",
  NET_DNS_FAILED = "NET_004",
  NET_CORS_BLOCKED = "NET_005",

  // Authentication Errors (AUTH_xxx)
  AUTH_INVALID_TOKEN = "AUTH_001",
  AUTH_TOKEN_EXPIRED = "AUTH_002",
  AUTH_SCREEN_NOT_PAIRED = "AUTH_003",
  AUTH_PAIRING_FAILED = "AUTH_004",
  AUTH_API_KEY_INVALID = "AUTH_005",

  // API Errors (API_xxx)
  API_SERVER_DOWN = "API_001",
  API_RATE_LIMITED = "API_002",
  API_INVALID_RESPONSE = "API_003",
  API_ENDPOINT_NOT_FOUND = "API_004",
  API_INTERNAL_ERROR = "API_005",

  // Data Errors (DATA_xxx)
  DATA_PRAYER_TIMES_MISSING = "DATA_001",
  DATA_CONTENT_MISSING = "DATA_002",
  DATA_MASJID_INFO_MISSING = "DATA_003",
  DATA_CACHE_CORRUPTED = "DATA_004",
  DATA_SYNC_FAILED = "DATA_005",

  // System Errors (SYS_xxx)
  SYS_STORAGE_FULL = "SYS_001",
  SYS_MEMORY_EXCEEDED = "SYS_002",
  SYS_RENDER_FAILED = "SYS_003",
  SYS_SERVICE_WORKER_FAILED = "SYS_004",
  SYS_ELECTRON_ERROR = "SYS_005",

  // Application Errors (APP_xxx)
  APP_INITIALIZATION_FAILED = "APP_001",
  APP_COMPONENT_CRASHED = "APP_002",
  APP_CONFIGURATION_INVALID = "APP_003",
  APP_UPDATE_FAILED = "APP_004",
  APP_UNKNOWN_ERROR = "APP_999",
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "low", // Minor issues that don't affect core functionality
  MEDIUM = "medium", // Issues that affect some functionality
  HIGH = "high", // Issues that significantly impact functionality
  CRITICAL = "critical", // Issues that prevent core functionality
}

// Error categories for UI grouping
export enum ErrorCategory {
  NETWORK = "network",
  AUTHENTICATION = "authentication",
  DATA = "data",
  SYSTEM = "system",
  APPLICATION = "application",
}

// Error interface
export interface AppError {
  id: string;
  code: ErrorCode;
  message: string;
  description?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: string;
  source?: string; // Component or service that reported the error
  metadata?: Record<string, any>;
  userFriendlyMessage?: string;
  recoveryAction?: string;
  isRecoverable: boolean;
  hasBeenShown: boolean;
  dismissedAt?: string;
}

// Network status interface
export interface NetworkStatus {
  isOnline: boolean;
  isApiReachable: boolean;
  lastConnected: string | null;
  connectionType: "wifi" | "cellular" | "ethernet" | "unknown";
  latency: number | null;
  failedAttempts: number;
}

// Error state interface
export interface ErrorState {
  // Current errors
  activeErrors: AppError[];

  // Network status
  networkStatus: NetworkStatus;

  // Error display settings
  showErrorOverlay: boolean;
  currentDisplayedError: AppError | null;

  // Rate limiting
  lastErrorTime: Record<string, number>; // Error code -> timestamp
  errorCounts: Record<string, number>; // Error code -> count

  // Recovery state
  isRecovering: boolean;
  recoveryAttempts: number;
  lastRecoveryAttempt: string | null;

  // System health
  systemHealth: {
    api: "healthy" | "degraded" | "down";
    storage: "healthy" | "degraded" | "full";
    memory: "healthy" | "high" | "critical";
    overall: "healthy" | "degraded" | "critical";
  };
}

// Initial state
const initialState: ErrorState = {
  activeErrors: [],
  networkStatus: {
    isOnline: navigator.onLine,
    isApiReachable: true,
    lastConnected: new Date().toISOString(),
    connectionType: "unknown",
    latency: null,
    failedAttempts: 0,
  },
  showErrorOverlay: false,
  currentDisplayedError: null,
  lastErrorTime: {},
  errorCounts: {},
  isRecovering: false,
  recoveryAttempts: 0,
  lastRecoveryAttempt: null,
  systemHealth: {
    api: "healthy",
    storage: "healthy",
    memory: "healthy",
    overall: "healthy",
  },
};

// Rate limiting constants
const ERROR_RATE_LIMIT = 30000; // 30 seconds between same error codes
const MAX_ERROR_COUNT = 5; // Max same errors before suppression
const RECOVERY_COOLDOWN = 60000; // 1 minute between recovery attempts

// Async thunk for network connectivity test
export const testNetworkConnectivity = createAsyncThunk(
  "errors/testNetworkConnectivity",
  async (_, { rejectWithValue }) => {
    try {
      // Test multiple connectivity methods
      const onlineCheck = navigator.onLine;

      // Try to reach a reliable endpoint
      const apiCheck = await Promise.race([
        fetch("/api/health", { method: "HEAD", cache: "no-cache" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 5000),
        ),
      ]);

      // Test DNS resolution
      const dnsCheck = await Promise.race([
        fetch("https://1.1.1.1", { method: "HEAD", mode: "no-cors" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 3000),
        ),
      ]);

      return {
        isOnline: onlineCheck,
        isApiReachable: apiCheck instanceof Response && apiCheck.ok,
        dnsWorking: true, // If we got here, DNS is working
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return rejectWithValue({
        isOnline: navigator.onLine,
        isApiReachable: false,
        dnsWorking: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// Helper function to create error
function createError(
  code: ErrorCode,
  message: string,
  severity: ErrorSeverity,
  options: Partial<AppError> = {},
): AppError {
  return {
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    code,
    message,
    severity,
    category: getCategoryFromCode(code),
    timestamp: new Date().toISOString(),
    isRecoverable: getRecoverabilityFromCode(code),
    hasBeenShown: false,
    userFriendlyMessage: getUserFriendlyMessage(code, message),
    recoveryAction: getRecoveryAction(code),
    ...options,
  };
}

// Helper functions
function getCategoryFromCode(code: ErrorCode): ErrorCategory {
  if (code.startsWith("NET_")) return ErrorCategory.NETWORK;
  if (code.startsWith("AUTH_")) return ErrorCategory.AUTHENTICATION;
  if (code.startsWith("API_")) return ErrorCategory.NETWORK;
  if (code.startsWith("DATA_")) return ErrorCategory.DATA;
  if (code.startsWith("SYS_")) return ErrorCategory.SYSTEM;
  return ErrorCategory.APPLICATION;
}

function getRecoverabilityFromCode(code: ErrorCode): boolean {
  const nonRecoverableCodes = [
    ErrorCode.AUTH_SCREEN_NOT_PAIRED,
    ErrorCode.SYS_STORAGE_FULL,
    ErrorCode.APP_CONFIGURATION_INVALID,
  ];
  return !nonRecoverableCodes.includes(code);
}

function getUserFriendlyMessage(
  code: ErrorCode,
  originalMessage: string,
): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.NET_OFFLINE]:
      "Your device appears to be offline. Please check your internet connection.",
    [ErrorCode.NET_TIMEOUT]:
      "The connection is taking longer than usual. Please wait or try again.",
    [ErrorCode.NET_CONNECTION_FAILED]:
      "Unable to connect to the server. Please check your network settings.",
    [ErrorCode.NET_DNS_FAILED]:
      "Cannot resolve server address. Please check your DNS settings.",
    [ErrorCode.NET_CORS_BLOCKED]:
      "Server configuration issue. Please contact your system administrator.",

    [ErrorCode.AUTH_INVALID_TOKEN]:
      "Authentication token is invalid. Please re-pair this device.",
    [ErrorCode.AUTH_TOKEN_EXPIRED]:
      "Authentication has expired. Please re-pair this device.",
    [ErrorCode.AUTH_SCREEN_NOT_PAIRED]:
      "This display is not yet paired with a masjid account.",
    [ErrorCode.AUTH_PAIRING_FAILED]:
      "Failed to pair device. Please try again or contact support.",
    [ErrorCode.AUTH_API_KEY_INVALID]:
      "API credentials are invalid. Please re-pair this device.",

    [ErrorCode.API_SERVER_DOWN]:
      "The server is temporarily unavailable. Using cached data where possible.",
    [ErrorCode.API_RATE_LIMITED]:
      "Too many requests. The system will automatically retry in a moment.",
    [ErrorCode.API_INVALID_RESPONSE]:
      "Received unexpected data from server. Retrying...",
    [ErrorCode.API_ENDPOINT_NOT_FOUND]:
      "Server endpoint not found. Please check your configuration.",
    [ErrorCode.API_INTERNAL_ERROR]:
      "Server encountered an error. Using cached data where possible.",

    [ErrorCode.DATA_PRAYER_TIMES_MISSING]:
      "Prayer times are not available. Retrying...",
    [ErrorCode.DATA_CONTENT_MISSING]:
      "Display content is not available. Using cached content.",
    [ErrorCode.DATA_MASJID_INFO_MISSING]:
      "Masjid information is not available. Using default settings.",
    [ErrorCode.DATA_CACHE_CORRUPTED]:
      "Local data cache needs to be refreshed. Please wait...",
    [ErrorCode.DATA_SYNC_FAILED]:
      "Failed to sync latest data. Using cached information.",

    [ErrorCode.SYS_STORAGE_FULL]:
      "Device storage is full. Please free up space and restart.",
    [ErrorCode.SYS_MEMORY_EXCEEDED]:
      "System memory is low. Optimizing performance...",
    [ErrorCode.SYS_RENDER_FAILED]:
      "Display rendering error. Attempting to recover...",
    [ErrorCode.SYS_SERVICE_WORKER_FAILED]:
      "Background services failed. Restarting...",
    [ErrorCode.SYS_ELECTRON_ERROR]:
      "Application system error. Please restart the application.",

    [ErrorCode.APP_INITIALIZATION_FAILED]:
      "Failed to initialize application. Please restart.",
    [ErrorCode.APP_COMPONENT_CRASHED]:
      "A component crashed. Attempting to recover...",
    [ErrorCode.APP_CONFIGURATION_INVALID]:
      "Application configuration is invalid. Please contact support.",
    [ErrorCode.APP_UPDATE_FAILED]:
      "Application update failed. Continuing with current version.",
    [ErrorCode.APP_UNKNOWN_ERROR]:
      "An unexpected error occurred. Please restart if the issue persists.",
  };

  return messages[code] || originalMessage;
}

function getRecoveryAction(code: ErrorCode): string {
  const actions: Record<ErrorCode, string> = {
    [ErrorCode.NET_OFFLINE]: "Check network connection",
    [ErrorCode.NET_TIMEOUT]: "Wait and retry automatically",
    [ErrorCode.NET_CONNECTION_FAILED]: "Check network settings",
    [ErrorCode.NET_DNS_FAILED]: "Check DNS settings",
    [ErrorCode.NET_CORS_BLOCKED]: "Contact administrator",

    [ErrorCode.AUTH_INVALID_TOKEN]: "Re-pair device",
    [ErrorCode.AUTH_TOKEN_EXPIRED]: "Re-pair device",
    [ErrorCode.AUTH_SCREEN_NOT_PAIRED]: "Pair device with masjid",
    [ErrorCode.AUTH_PAIRING_FAILED]: "Try pairing again",
    [ErrorCode.AUTH_API_KEY_INVALID]: "Re-pair device",

    [ErrorCode.API_SERVER_DOWN]: "Wait for server recovery",
    [ErrorCode.API_RATE_LIMITED]: "Wait and retry automatically",
    [ErrorCode.API_INVALID_RESPONSE]: "Retry automatically",
    [ErrorCode.API_ENDPOINT_NOT_FOUND]: "Check configuration",
    [ErrorCode.API_INTERNAL_ERROR]: "Wait and retry",

    [ErrorCode.DATA_PRAYER_TIMES_MISSING]: "Retry data fetch",
    [ErrorCode.DATA_CONTENT_MISSING]: "Use cached content",
    [ErrorCode.DATA_MASJID_INFO_MISSING]: "Retry data fetch",
    [ErrorCode.DATA_CACHE_CORRUPTED]: "Refresh cache",
    [ErrorCode.DATA_SYNC_FAILED]: "Retry sync",

    [ErrorCode.SYS_STORAGE_FULL]: "Free up storage space",
    [ErrorCode.SYS_MEMORY_EXCEEDED]: "Optimize automatically",
    [ErrorCode.SYS_RENDER_FAILED]: "Restart component",
    [ErrorCode.SYS_SERVICE_WORKER_FAILED]: "Restart services",
    [ErrorCode.SYS_ELECTRON_ERROR]: "Restart application",

    [ErrorCode.APP_INITIALIZATION_FAILED]: "Restart application",
    [ErrorCode.APP_COMPONENT_CRASHED]: "Restart component",
    [ErrorCode.APP_CONFIGURATION_INVALID]: "Contact support",
    [ErrorCode.APP_UPDATE_FAILED]: "Continue with current version",
    [ErrorCode.APP_UNKNOWN_ERROR]: "Restart if persists",
  };

  return actions[code] || "Contact support";
}

// Create the slice
const errorSlice = createSlice({
  name: "errors",
  initialState,
  reducers: {
    // Report a new error
    reportError: (
      state,
      action: PayloadAction<{
        code: ErrorCode;
        message: string;
        severity: ErrorSeverity;
        source?: string;
        metadata?: Record<string, any>;
      }>,
    ) => {
      const { code, message, severity, source, metadata } = action.payload;

      // Check rate limiting
      const now = Date.now();
      const lastTime = state.lastErrorTime[code] || 0;
      const count = state.errorCounts[code] || 0;

      // Skip if same error reported too recently or too many times
      if (now - lastTime < ERROR_RATE_LIMIT && count >= MAX_ERROR_COUNT) {
        logger.debug(`Error ${code} rate limited`, { count, lastTime });
        return;
      }

      // Create the error
      const error = createError(code, message, severity, { source, metadata });

      // Add to active errors (limit to last 10)
      state.activeErrors.push(error);
      if (state.activeErrors.length > 10) {
        state.activeErrors = state.activeErrors.slice(-10);
      }

      // Update rate limiting
      state.lastErrorTime[code] = now;
      state.errorCounts[code] = count + 1;

      // Set display error if high/critical severity and no current display
      if (
        !state.currentDisplayedError &&
        (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL)
      ) {
        state.currentDisplayedError = error;
        state.showErrorOverlay = true;
        logger.debug("[ErrorSlice] Setting error overlay to show", {
          errorId: error.id,
          severity,
          code,
          showErrorOverlay: state.showErrorOverlay,
        });
      }

      // Update system health based on error
      updateSystemHealth(state, error);

      logger.error(`[ErrorManager] ${code}: ${message}`, {
        severity,
        source,
        metadata,
        errorId: error.id,
      });
    },

    // Dismiss an error
    dismissError: (state, action: PayloadAction<string>) => {
      const errorId = action.payload;
      const error = state.activeErrors.find((e) => e.id === errorId);

      if (error) {
        error.dismissedAt = new Date().toISOString();
        error.hasBeenShown = true;
      }

      // If this was the displayed error, hide overlay
      if (state.currentDisplayedError?.id === errorId) {
        state.currentDisplayedError = null;
        state.showErrorOverlay = false;
      }

      // Remove from active errors
      state.activeErrors = state.activeErrors.filter((e) => e.id !== errorId);
    },

    // Clear all errors
    clearErrors: (state) => {
      state.activeErrors = [];
      state.currentDisplayedError = null;
      state.showErrorOverlay = false;
      state.errorCounts = {};
      state.lastErrorTime = {};
    },

    // Update network status
    updateNetworkStatus: (
      state,
      action: PayloadAction<Partial<NetworkStatus>>,
    ) => {
      state.networkStatus = { ...state.networkStatus, ...action.payload };

      // Auto-clear network errors if back online
      if (action.payload.isOnline && action.payload.isApiReachable) {
        state.activeErrors = state.activeErrors.filter(
          (error) => error.category !== ErrorCategory.NETWORK,
        );
        state.networkStatus.failedAttempts = 0;
      }
    },

    // Start recovery process
    startRecovery: (state) => {
      const now = Date.now();
      const lastAttempt = state.lastRecoveryAttempt
        ? new Date(state.lastRecoveryAttempt).getTime()
        : 0;

      // Respect recovery cooldown
      if (now - lastAttempt < RECOVERY_COOLDOWN) {
        return;
      }

      state.isRecovering = true;
      state.recoveryAttempts += 1;
      state.lastRecoveryAttempt = new Date().toISOString();

      logger.info("[ErrorManager] Starting recovery process", {
        attempt: state.recoveryAttempts,
      });
    },

    // Complete recovery
    completeRecovery: (
      state,
      action: PayloadAction<{ success: boolean; message?: string }>,
    ) => {
      state.isRecovering = false;

      if (action.payload.success) {
        // Clear recoverable errors
        state.activeErrors = state.activeErrors.filter(
          (error) => !error.isRecoverable,
        );
        state.recoveryAttempts = 0;

        // Update system health
        state.systemHealth.overall = "healthy";

        logger.info("[ErrorManager] Recovery successful");
      } else {
        logger.warn("[ErrorManager] Recovery failed", {
          message: action.payload.message,
        });
      }
    },

    // Reset error counts (for testing or admin)
    resetErrorCounts: (state) => {
      state.errorCounts = {};
      state.lastErrorTime = {};
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(testNetworkConnectivity.fulfilled, (state, action) => {
        state.networkStatus = {
          ...state.networkStatus,
          isOnline: action.payload.isOnline,
          isApiReachable: action.payload.isApiReachable,
          lastConnected: action.payload.timestamp,
          failedAttempts: 0,
        };
      })
      .addCase(testNetworkConnectivity.rejected, (state, action) => {
        const payload = action.payload as any;
        state.networkStatus = {
          ...state.networkStatus,
          isOnline: payload?.isOnline || false,
          isApiReachable: false,
          failedAttempts: state.networkStatus.failedAttempts + 1,
        };
      });
  },
});

// Helper function to update system health
function updateSystemHealth(state: ErrorState, error: AppError) {
  const { category, severity } = error;

  // Update individual health metrics
  if (category === ErrorCategory.NETWORK) {
    state.systemHealth.api =
      severity === ErrorSeverity.CRITICAL ? "down" : "degraded";
  } else if (category === ErrorCategory.SYSTEM) {
    if (error.code === ErrorCode.SYS_STORAGE_FULL) {
      state.systemHealth.storage = "full";
    } else if (error.code === ErrorCode.SYS_MEMORY_EXCEEDED) {
      state.systemHealth.memory =
        severity === ErrorSeverity.CRITICAL ? "critical" : "high";
    }
  }

  // Calculate overall health
  const healthScores = Object.values(state.systemHealth).slice(0, -1); // Exclude 'overall'
  const hasHealthy = healthScores.some((h) => h === "healthy");
  const hasCritical = healthScores.some(
    (h) => h === "critical" || h === "down" || h === "full",
  );
  const hasDegraded = healthScores.some(
    (h) => h === "degraded" || h === "high",
  );

  if (hasCritical) {
    state.systemHealth.overall = "critical";
  } else if (hasDegraded) {
    state.systemHealth.overall = "degraded";
  } else if (hasHealthy) {
    state.systemHealth.overall = "healthy";
  }
}

// Export actions and reducer
export const {
  reportError,
  dismissError,
  clearErrors,
  updateNetworkStatus,
  startRecovery,
  completeRecovery,
  resetErrorCounts,
} = errorSlice.actions;

export default errorSlice.reducer;

// Selectors
export const selectActiveErrors = (state: { errors: ErrorState }) =>
  state.errors.activeErrors;
export const selectCurrentError = (state: { errors: ErrorState }) =>
  state.errors.currentDisplayedError;
export const selectNetworkStatus = (state: { errors: ErrorState }) =>
  state.errors.networkStatus;
export const selectSystemHealth = (state: { errors: ErrorState }) =>
  state.errors.systemHealth;
export const selectIsRecovering = (state: { errors: ErrorState }) =>
  state.errors.isRecovering;
export const selectShowErrorOverlay = (state: { errors: ErrorState }) =>
  state.errors.showErrorOverlay;
