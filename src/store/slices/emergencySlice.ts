import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { EmergencyAlert, AlertCategory, AlertUrgency } from "../../api/models";
import emergencyAlertService from "../../services/emergencyAlertService";
import logger from "../../utils/logger";

// State interface
export interface EmergencyState {
  // Current alert
  currentAlert: EmergencyAlert | null;

  // Connection status
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // SSE connection details
  connectionUrl: string | null;
  reconnectAttempts: number;
  lastReconnectTime: string | null;

  // Alert history (keep last few for debugging)
  alertHistory: Array<{
    alert: EmergencyAlert;
    timestamp: string;
    action: "received" | "cleared" | "expired";
  }>;

  // Settings
  isEnabled: boolean;
  autoReconnect: boolean;
  maxReconnectAttempts: number;

  // Statistics
  totalAlertsReceived: number;
  lastAlertTime: string | null;
  connectionStartTime: string | null;

  // Error handling
  lastError: string | null;
  errorCount: number;
}

// Initial state
const initialState: EmergencyState = {
  currentAlert: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  connectionUrl: null,
  reconnectAttempts: 0,
  lastReconnectTime: null,
  alertHistory: [],
  isEnabled: true,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  totalAlertsReceived: 0,
  lastAlertTime: null,
  connectionStartTime: null,
  lastError: null,
  errorCount: 0,
};

// Async thunks
export const initializeEmergencyService = createAsyncThunk(
  "emergency/initialize",
  async (baseURL: string, { rejectWithValue }) => {
    try {
      logger.debug(
        "[Emergency] Initializing emergency service with baseURL",
        { baseURL },
      );

      // Note: Services are now initialised via WebSocket in realtimeMiddleware
      // This thunk is kept for state management purposes

      return {
        baseURL,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("[Emergency] Error initializing emergency service", {
        error,
      });
      return rejectWithValue(
        error.message || "Failed to initialize emergency service",
      );
    }
  },
);

export const connectToEmergencyService = createAsyncThunk(
  "emergency/connect",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { emergency: EmergencyState };

      if (!state.emergency.isEnabled) {
        throw new Error("Emergency service is disabled");
      }

      logger.debug("[Emergency] Connecting to emergency service...");

      // The actual connection is handled by the service
      // This thunk is mainly for state management
      return {
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("[Emergency] Error connecting to emergency service", {
        error,
      });
      return rejectWithValue(
        error.message || "Failed to connect to emergency service",
      );
    }
  },
);

export const disconnectFromEmergencyService = createAsyncThunk(
  "emergency/disconnect",
  async (_, { rejectWithValue }) => {
    try {
      logger.debug("[Emergency] Disconnecting from emergency service...");

      // Cleanup the service
      emergencyAlertService.cleanup();

      return {
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("[Emergency] Error disconnecting from emergency service", {
        error,
      });
      return rejectWithValue(
        error.message || "Failed to disconnect from emergency service",
      );
    }
  },
);

export const clearExpiredAlert = createAsyncThunk(
  "emergency/clearExpired",
  async (alertId: string, { getState }) => {
    try {
      const state = getState() as { emergency: EmergencyState };
      const currentAlert = state.emergency.currentAlert;

      if (currentAlert && currentAlert.id === alertId) {
        logger.debug("[Emergency] Clearing expired alert", { alertId });

        return {
          alertId,
          timestamp: new Date().toISOString(),
        };
      }

      return null;
    } catch (error: any) {
      logger.error("[Emergency] Error clearing expired alert", { error });
      throw error;
    }
  },
);

// Slice
const emergencySlice = createSlice({
  name: "emergency",
  initialState,
  reducers: {
    // Alert management
    setCurrentAlert: (state, action: PayloadAction<EmergencyAlert | null>) => {
      const previousAlert = state.currentAlert;
      state.currentAlert = action.payload;

      if (action.payload) {
        // New alert received
        state.totalAlertsReceived += 1;
        state.lastAlertTime = new Date().toISOString();

        // Add to history
        state.alertHistory.push({
          alert: action.payload,
          timestamp: new Date().toISOString(),
          action: "received",
        });

        // Keep only last 10 alerts in history
        if (state.alertHistory.length > 10) {
          state.alertHistory = state.alertHistory.slice(-10);
        }

        logger.info("[Emergency] Alert received", {
          alertId: action.payload.id,
          title: action.payload.title,
        });
      } else if (previousAlert) {
        // Alert cleared
        state.alertHistory.push({
          alert: previousAlert,
          timestamp: new Date().toISOString(),
          action: "cleared",
        });

        // Keep only last 10 alerts in history (prevent memory growth)
        if (state.alertHistory.length > 10) {
          state.alertHistory = state.alertHistory.slice(-10);
        }

        logger.info("[Emergency] Alert cleared", { alertId: previousAlert.id });
      }
    },

    // Test emergency alert action for development
    createTestAlert: (
      state,
      action: PayloadAction<{ type?: string; category?: AlertCategory; urgency?: AlertUrgency; duration?: number }>,
    ) => {
      const { type = "1", duration = 15 } = action.payload || {};

      interface TestAlertTemplate {
        title: string;
        message: string;
        category: AlertCategory;
        urgency: AlertUrgency;
        color: string | null;
      }

      // Keyed by dev shortcut number (1–7)
      const testAlerts: Record<string, TestAlertTemplate> = {
        "1": {
          title: "Fire Evacuation Alert",
          message:
            "Please evacuate the building immediately via the nearest emergency exit. Do not use lifts. Assemble at the designated meeting point.",
          category: "safety",
          urgency: "critical",
          color: null,
        },
        "2": {
          title: "Facility Maintenance Notice",
          message:
            "The main ablution area is temporarily closed for urgent maintenance. Please use the alternative facilities on the lower ground floor.",
          category: "facility",
          urgency: "high",
          color: null,
        },
        "3": {
          title: "Janazah Announcement",
          message:
            "The janazah prayer for our dear brother will take place after Asr today. May Allah grant him Jannatul Firdaus. Ameen.",
          category: "janazah",
          urgency: "medium",
          color: null,
        },
        "4": {
          title: "Prayer Time Change",
          message:
            "Due to a special programme, Maghrib Jamaat tonight will be delayed by 15 minutes. Jazakumullahu khayran for your patience.",
          category: "schedule",
          urgency: "medium",
          color: null,
        },
        "5": {
          title: "Please Move Your Vehicle",
          message:
            "A vehicle is blocking access and needs to be moved immediately. Registration: AB12 CDE. Please return to your vehicle as soon as possible.",
          category: "community",
          urgency: "high",
          color: null,
        },
        "6": {
          title: "Special Community Event",
          message:
            "Join us this Saturday for a special lecture by a distinguished scholar. Doors open at 7 PM. Light refreshments will be served.",
          category: "custom",
          urgency: "medium",
          color: "#6A1B9A",
        },
        "7": {
          title: "Security Notice",
          message:
            "Enhanced security measures are currently in effect. Please report any suspicious activity to masjid staff immediately.",
          category: "safety",
          urgency: "medium",
          color: null,
        },
      };

      const alertTemplate = testAlerts[type] ?? testAlerts["1"];
      const now = new Date();
      const expiresAt = new Date(now.getTime() + duration * 1_000);

      const testAlert: EmergencyAlert = {
        id: `test-alert-${Date.now()}`,
        title: alertTemplate.title,
        message: alertTemplate.message,
        category: action.payload.category ?? alertTemplate.category,
        urgency: action.payload.urgency ?? alertTemplate.urgency,
        color: alertTemplate.color,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
        masjidId: "test-masjid",
      };

      // Set the alert
      state.currentAlert = testAlert;
      state.totalAlertsReceived += 1;
      state.lastAlertTime = now.toISOString();

      // Add to history
      state.alertHistory.push({
        alert: testAlert,
        timestamp: now.toISOString(),
        action: "received",
      });

      // Keep only last 10 alerts in history
      if (state.alertHistory.length > 10) {
        state.alertHistory = state.alertHistory.slice(-10);
      }

      logger.info("[Emergency] Test alert created", {
        alertId: testAlert.id,
        title: testAlert.title,
        category: testAlert.category,
        urgency: testAlert.urgency,
        duration,
      });
    },

    clearCurrentAlert: (state) => {
      if (state.currentAlert) {
        const alertId = state.currentAlert.id;

        // Add to history
        state.alertHistory.push({
          alert: state.currentAlert,
          timestamp: new Date().toISOString(),
          action: "cleared",
        });

        // Keep only last 10 alerts in history (prevent memory growth)
        if (state.alertHistory.length > 10) {
          state.alertHistory = state.alertHistory.slice(-10);
        }

        state.currentAlert = null;

        logger.info("[Emergency] Alert manually cleared", { alertId });
      }
    },

    // Connection status
    setConnectionStatus: (
      state,
      action: PayloadAction<{
        isConnected: boolean;
        isConnecting?: boolean;
        error?: string | null;
      }>,
    ) => {
      state.isConnected = action.payload.isConnected;

      if (action.payload.isConnecting !== undefined) {
        state.isConnecting = action.payload.isConnecting;
      }

      if (action.payload.error !== undefined) {
        state.connectionError = action.payload.error;
        if (action.payload.error) {
          state.lastError = action.payload.error;
          state.errorCount += 1;
        }
      }

      if (action.payload.isConnected) {
        state.connectionStartTime = new Date().toISOString();
        state.reconnectAttempts = 0;
        state.connectionError = null;
      }
    },

    setConnectionUrl: (state, action: PayloadAction<string>) => {
      state.connectionUrl = action.payload;
    },

    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
      state.lastReconnectTime = new Date().toISOString();
    },

    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
      state.lastReconnectTime = null;
    },

    // Settings
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.isEnabled = action.payload;

      if (!action.payload) {
        // Disable service
        state.isConnected = false;
        state.isConnecting = false;
        state.connectionError = null;
        state.currentAlert = null;
      }
    },

    setAutoReconnect: (state, action: PayloadAction<boolean>) => {
      state.autoReconnect = action.payload;
    },

    setMaxReconnectAttempts: (state, action: PayloadAction<number>) => {
      state.maxReconnectAttempts = Math.max(0, action.payload);
    },

    // Error handling
    setError: (state, action: PayloadAction<string>) => {
      state.lastError = action.payload;
      state.errorCount += 1;
      state.connectionError = action.payload;
    },

    clearError: (state) => {
      state.lastError = null;
      state.connectionError = null;
    },

    // Reset state
    resetEmergencyState: (state) => {
      state.currentAlert = null;
      state.isConnected = false;
      state.isConnecting = false;
      state.connectionError = null;
      state.connectionUrl = null;
      state.reconnectAttempts = 0;
      state.lastReconnectTime = null;
      state.alertHistory = [];
      state.totalAlertsReceived = 0;
      state.lastAlertTime = null;
      state.connectionStartTime = null;
      state.lastError = null;
      state.errorCount = 0;
    },

    // Statistics
    resetStatistics: (state) => {
      state.totalAlertsReceived = 0;
      state.lastAlertTime = null;
      state.errorCount = 0;
    },
  },
  extraReducers: (builder) => {
    // Initialize emergency service
    builder
      .addCase(initializeEmergencyService.pending, (state) => {
        state.isConnecting = true;
        state.connectionError = null;
      })
      .addCase(initializeEmergencyService.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.connectionUrl = action.payload.baseURL;
        state.connectionError = null;
      })
      .addCase(initializeEmergencyService.rejected, (state, action) => {
        state.isConnecting = false;
        state.connectionError = action.payload as string;
        state.lastError = action.payload as string;
        state.errorCount += 1;
      });

    // Connect to emergency service
    builder
      .addCase(connectToEmergencyService.pending, (state) => {
        state.isConnecting = true;
        state.connectionError = null;
      })
      .addCase(connectToEmergencyService.fulfilled, (state) => {
        state.isConnecting = false;
        state.isConnected = true;
        state.connectionStartTime = new Date().toISOString();
        state.reconnectAttempts = 0;
      })
      .addCase(connectToEmergencyService.rejected, (state, action) => {
        state.isConnecting = false;
        state.isConnected = false;
        state.connectionError = action.payload as string;
        state.lastError = action.payload as string;
        state.errorCount += 1;
      });

    // Disconnect from emergency service
    builder
      .addCase(disconnectFromEmergencyService.pending, (state) => {
        state.isConnecting = false;
      })
      .addCase(disconnectFromEmergencyService.fulfilled, (state) => {
        state.isConnected = false;
        state.isConnecting = false;
        state.connectionError = null;
        state.currentAlert = null;
        state.connectionStartTime = null;
      })
      .addCase(disconnectFromEmergencyService.rejected, (state, action) => {
        state.connectionError = action.payload as string;
        state.lastError = action.payload as string;
        state.errorCount += 1;
      });

    // Clear expired alert
    builder.addCase(clearExpiredAlert.fulfilled, (state, action) => {
      if (action.payload && state.currentAlert?.id === action.payload.alertId) {
        // Add to history
        state.alertHistory.push({
          alert: state.currentAlert,
          timestamp: action.payload.timestamp,
          action: "expired",
        });

        // Keep only last 10 alerts in history (prevent memory growth)
        if (state.alertHistory.length > 10) {
          state.alertHistory = state.alertHistory.slice(-10);
        }

        state.currentAlert = null;
      }
    });
  },
});

// Export actions
export const {
  setCurrentAlert,
  clearCurrentAlert,
  setConnectionStatus,
  setConnectionUrl,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  setEnabled,
  setAutoReconnect,
  setMaxReconnectAttempts,
  setError,
  clearError,
  resetEmergencyState,
  resetStatistics,
  createTestAlert,
} = emergencySlice.actions;

// Selectors
export const selectCurrentAlert = (state: { emergency: EmergencyState }) =>
  state.emergency.currentAlert;
export const selectHasActiveAlert = (state: { emergency: EmergencyState }) =>
  !!state.emergency.currentAlert;
export const selectIsConnected = (state: { emergency: EmergencyState }) =>
  state.emergency.isConnected;
export const selectIsConnecting = (state: { emergency: EmergencyState }) =>
  state.emergency.isConnecting;
export const selectConnectionError = (state: { emergency: EmergencyState }) =>
  state.emergency.connectionError;
export const selectConnectionUrl = (state: { emergency: EmergencyState }) =>
  state.emergency.connectionUrl;
export const selectReconnectAttempts = (state: { emergency: EmergencyState }) =>
  state.emergency.reconnectAttempts;
export const selectLastReconnectTime = (state: { emergency: EmergencyState }) =>
  state.emergency.lastReconnectTime;
export const selectAlertHistory = (state: { emergency: EmergencyState }) =>
  state.emergency.alertHistory;
export const selectIsEnabled = (state: { emergency: EmergencyState }) =>
  state.emergency.isEnabled;
export const selectAutoReconnect = (state: { emergency: EmergencyState }) =>
  state.emergency.autoReconnect;
export const selectMaxReconnectAttempts = (state: {
  emergency: EmergencyState;
}) => state.emergency.maxReconnectAttempts;
export const selectTotalAlertsReceived = (state: {
  emergency: EmergencyState;
}) => state.emergency.totalAlertsReceived;
export const selectLastAlertTime = (state: { emergency: EmergencyState }) =>
  state.emergency.lastAlertTime;
export const selectConnectionStartTime = (state: {
  emergency: EmergencyState;
}) => state.emergency.connectionStartTime;
export const selectLastError = (state: { emergency: EmergencyState }) =>
  state.emergency.lastError;
export const selectErrorCount = (state: { emergency: EmergencyState }) =>
  state.emergency.errorCount;

// Computed selectors
export const selectConnectionDuration = (state: {
  emergency: EmergencyState;
}) => {
  if (!state.emergency.isConnected || !state.emergency.connectionStartTime)
    return null;
  return Date.now() - new Date(state.emergency.connectionStartTime).getTime();
};

export const selectShouldReconnect = (state: { emergency: EmergencyState }) => {
  return (
    state.emergency.isEnabled &&
    state.emergency.autoReconnect &&
    !state.emergency.isConnected &&
    !state.emergency.isConnecting &&
    state.emergency.reconnectAttempts < state.emergency.maxReconnectAttempts
  );
};

export const selectRecentAlerts = (state: { emergency: EmergencyState }) => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return state.emergency.alertHistory.filter(
    (item) => new Date(item.timestamp).getTime() > oneHourAgo,
  );
};

export default emergencySlice.reducer;
