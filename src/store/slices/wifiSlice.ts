/**
 * WiFi Slice
 *
 * Redux slice for managing WiFi connection state.
 * Handles network scanning, connection status, and reconnection logic.
 */

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import wifiService, {
  type ConnectionStatus,
} from "../../services/wifiService";
import logger from "../../utils/logger";

/**
 * WiFi network interface
 */
export interface WiFiNetwork {
  ssid: string;
  signal: number;
  security: string;
  inUse: boolean;
}

/**
 * WiFi state interface
 */
export interface WiFiState {
  // Availability
  isWiFiAvailable: boolean;
  isChecked: boolean;

  // Networks
  availableNetworks: WiFiNetwork[];
  currentNetwork: WiFiNetwork | null;

  // Connection state
  connectionStatus: ConnectionStatus;
  isScanning: boolean;
  isConnecting: boolean;

  // Reconnection tracking
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastDisconnectTime: string | null;
  showReconnectOverlay: boolean;

  // Errors
  error: string | null;
  lastError: string | null;
}

/**
 * Initial state
 */
const initialState: WiFiState = {
  isWiFiAvailable: false,
  isChecked: false,

  availableNetworks: [],
  currentNetwork: null,

  connectionStatus: "unknown",
  isScanning: false,
  isConnecting: false,

  reconnectAttempts: 0,
  maxReconnectAttempts: 3,
  lastDisconnectTime: null,
  showReconnectOverlay: false,

  error: null,
  lastError: null,
};

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Check if WiFi configuration is available on this system
 */
export const checkWiFiAvailability = createAsyncThunk(
  "wifi/checkAvailability",
  async () => {
    logger.info("[WiFiSlice] Checking WiFi availability...");
    const available = await wifiService.isAvailable();
    return available;
  },
);

/**
 * Scan for available WiFi networks
 */
export const scanNetworks = createAsyncThunk(
  "wifi/scanNetworks",
  async (_, { rejectWithValue }) => {
    logger.info("[WiFiSlice] Scanning for networks...");
    const result = await wifiService.scan();

    if (!result.success) {
      return rejectWithValue(result.error || "Scan failed");
    }

    return result.networks;
  },
);

/**
 * Connect to a WiFi network
 */
export const connectToNetwork = createAsyncThunk(
  "wifi/connect",
  async (
    { ssid, password }: { ssid: string; password?: string },
    { rejectWithValue },
  ) => {
    logger.info(`[WiFiSlice] Connecting to network: ${ssid}`);
    const result = await wifiService.connect(ssid, password);

    if (!result.success) {
      return rejectWithValue(result.error || "Connection failed");
    }

    // Get the current network info after connecting
    const currentResult = await wifiService.getCurrentNetwork();
    return currentResult.network;
  },
);

/**
 * Disconnect from current network
 */
export const disconnectFromNetwork = createAsyncThunk(
  "wifi/disconnect",
  async (_, { rejectWithValue }) => {
    logger.info("[WiFiSlice] Disconnecting from network...");
    const result = await wifiService.disconnect();

    if (!result.success) {
      return rejectWithValue(result.error || "Disconnect failed");
    }

    return true;
  },
);

/**
 * Get current connection status
 */
export const refreshConnectionStatus = createAsyncThunk(
  "wifi/refreshStatus",
  async () => {
    logger.info("[WiFiSlice] Refreshing connection status...");
    const [statusResult, networkResult] = await Promise.all([
      wifiService.getStatus(),
      wifiService.getCurrentNetwork(),
    ]);

    return {
      status: statusResult.status,
      network: networkResult.network,
    };
  },
);

/**
 * Check internet connectivity
 */
export const checkInternetConnectivity = createAsyncThunk(
  "wifi/checkInternet",
  async () => {
    logger.info("[WiFiSlice] Checking internet connectivity...");
    const hasInternet = await wifiService.hasInternetConnectivity();
    return hasInternet;
  },
);

// ============================================================================
// Slice Definition
// ============================================================================

const wifiSlice = createSlice({
  name: "wifi",
  initialState,
  reducers: {
    /**
     * Clear any errors
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Set connection status manually
     */
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
    },

    /**
     * Record a disconnect event
     */
    recordDisconnect: (state) => {
      state.connectionStatus = "disconnected";
      state.currentNetwork = null;
      state.lastDisconnectTime = new Date().toISOString();
    },

    /**
     * Increment reconnect attempts
     */
    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
      logger.info(
        `[WiFiSlice] Reconnect attempt ${state.reconnectAttempts}/${state.maxReconnectAttempts}`,
      );
    },

    /**
     * Reset reconnect attempts
     */
    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
      state.lastDisconnectTime = null;
    },

    /**
     * Show/hide the reconnect overlay
     */
    setShowReconnectOverlay: (state, action: PayloadAction<boolean>) => {
      state.showReconnectOverlay = action.payload;
    },

    /**
     * Reset WiFi state to initial values
     */
    resetWiFiState: (state) => {
      Object.assign(state, initialState);
    },

    /**
     * Update networks from external source
     */
    setAvailableNetworks: (state, action: PayloadAction<WiFiNetwork[]>) => {
      state.availableNetworks = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Check WiFi availability
    builder
      .addCase(checkWiFiAvailability.pending, (state) => {
        state.isChecked = false;
      })
      .addCase(checkWiFiAvailability.fulfilled, (state, action) => {
        state.isWiFiAvailable = action.payload;
        state.isChecked = true;
        logger.info(
          `[WiFiSlice] WiFi availability: ${action.payload ? "available" : "not available"}`,
        );
      })
      .addCase(checkWiFiAvailability.rejected, (state) => {
        state.isWiFiAvailable = false;
        state.isChecked = true;
      });

    // Scan networks
    builder
      .addCase(scanNetworks.pending, (state) => {
        state.isScanning = true;
        state.error = null;
      })
      .addCase(scanNetworks.fulfilled, (state, action) => {
        state.isScanning = false;
        state.availableNetworks = action.payload;
        logger.info(
          `[WiFiSlice] Scan complete. Found ${action.payload.length} networks`,
        );
      })
      .addCase(scanNetworks.rejected, (state, action) => {
        state.isScanning = false;
        state.error = action.payload as string;
        state.lastError = action.payload as string;
        logger.error("[WiFiSlice] Scan failed:", action.payload);
      });

    // Connect to network
    builder
      .addCase(connectToNetwork.pending, (state) => {
        state.isConnecting = true;
        state.connectionStatus = "connecting";
        state.error = null;
      })
      .addCase(connectToNetwork.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.connectionStatus = "connected";
        state.currentNetwork = action.payload as WiFiNetwork | null;
        state.reconnectAttempts = 0;
        state.showReconnectOverlay = false;
        logger.info(
          `[WiFiSlice] Connected to: ${action.payload?.ssid || "unknown"}`,
        );
      })
      .addCase(connectToNetwork.rejected, (state, action) => {
        state.isConnecting = false;
        state.connectionStatus = "failed";
        state.error = action.payload as string;
        state.lastError = action.payload as string;
        logger.error("[WiFiSlice] Connection failed:", action.payload);
      });

    // Disconnect from network
    builder
      .addCase(disconnectFromNetwork.pending, (state) => {
        state.isConnecting = true;
      })
      .addCase(disconnectFromNetwork.fulfilled, (state) => {
        state.isConnecting = false;
        state.connectionStatus = "disconnected";
        state.currentNetwork = null;
        logger.info("[WiFiSlice] Disconnected from network");
      })
      .addCase(disconnectFromNetwork.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.payload as string;
        logger.error("[WiFiSlice] Disconnect failed:", action.payload);
      });

    // Refresh connection status
    builder
      .addCase(refreshConnectionStatus.fulfilled, (state, action) => {
        const { status, network } = action.payload;

        if (network) {
          state.currentNetwork = network as WiFiNetwork;
          state.connectionStatus = "connected";
        } else {
          state.currentNetwork = null;
          // Only set disconnected if we were previously connected
          if (state.connectionStatus === "connected") {
            state.connectionStatus = "disconnected";
          }
        }

        // Update from NetworkManager status
        if (status) {
          if (status.connectivity === "full") {
            state.connectionStatus = "connected";
          } else if (status.connectivity === "none") {
            state.connectionStatus = "disconnected";
          }
        }
      })
      .addCase(refreshConnectionStatus.rejected, (state, action) => {
        logger.warn("[WiFiSlice] Failed to refresh status:", action.error);
      });

    // Check internet connectivity
    builder.addCase(checkInternetConnectivity.fulfilled, (state, action) => {
      const hasInternet = action.payload;

      if (hasInternet && state.connectionStatus !== "connecting") {
        state.connectionStatus = "connected";
        state.showReconnectOverlay = false;
        state.reconnectAttempts = 0;
      } else if (!hasInternet && state.connectionStatus === "connected") {
        state.connectionStatus = "disconnected";
      }
    });
  },
});

// Export actions
export const {
  clearError,
  setConnectionStatus,
  recordDisconnect,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  setShowReconnectOverlay,
  resetWiFiState,
  setAvailableNetworks,
} = wifiSlice.actions;

// Selectors
export const selectIsWiFiAvailable = (state: { wifi: WiFiState }) =>
  state.wifi.isWiFiAvailable;
export const selectIsWiFiChecked = (state: { wifi: WiFiState }) =>
  state.wifi.isChecked;
export const selectAvailableNetworks = (state: { wifi: WiFiState }) =>
  state.wifi.availableNetworks;
export const selectCurrentNetwork = (state: { wifi: WiFiState }) =>
  state.wifi.currentNetwork;
export const selectConnectionStatus = (state: { wifi: WiFiState }) =>
  state.wifi.connectionStatus;
export const selectIsScanning = (state: { wifi: WiFiState }) =>
  state.wifi.isScanning;
export const selectIsConnecting = (state: { wifi: WiFiState }) =>
  state.wifi.isConnecting;
export const selectWiFiError = (state: { wifi: WiFiState }) => state.wifi.error;
export const selectShowReconnectOverlay = (state: { wifi: WiFiState }) =>
  state.wifi.showReconnectOverlay;
export const selectReconnectAttempts = (state: { wifi: WiFiState }) =>
  state.wifi.reconnectAttempts;
export const selectMaxReconnectAttempts = (state: { wifi: WiFiState }) =>
  state.wifi.maxReconnectAttempts;
export const selectIsConnected = (state: { wifi: WiFiState }) =>
  state.wifi.connectionStatus === "connected";

// Export reducer
export default wifiSlice.reducer;

