/**
 * Update Redux Slice
 *
 * Manages the state for OTA updates including:
 * - Update availability
 * - Download progress
 * - Installation state
 * - Version information
 */

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import updateService, {
  UpdateInfo,
  DownloadProgress,
} from "../../services/updateService";
import logger from "../../utils/logger";
import type { RootState } from "../index";

export interface UpdateState {
  // Update status
  checking: boolean;
  downloading: boolean;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  updateReady: boolean;

  // Version information
  currentVersion: string;
  latestVersion: string | null;

  // Download progress
  downloadProgress: number; // 0-100
  downloadSpeed: number; // bytes per second
  downloadTransferred: number; // bytes
  downloadTotal: number; // bytes

  // Error state
  error: string | null;

  // Last check timestamp
  lastChecked: string | null;

  // User preferences
  autoCheckEnabled: boolean;
  notificationsEnabled: boolean;
}

const initialState: UpdateState = {
  checking: false,
  downloading: false,
  updateAvailable: false,
  updateDownloaded: false,
  updateReady: false,
  currentVersion: updateService.getCurrentVersion(),
  latestVersion: null,
  downloadProgress: 0,
  downloadSpeed: 0,
  downloadTransferred: 0,
  downloadTotal: 0,
  error: null,
  lastChecked: null,
  autoCheckEnabled: true,
  notificationsEnabled: true,
};

// Async thunks
export const checkForUpdates = createAsyncThunk(
  "update/checkForUpdates",
  async (_, { rejectWithValue }) => {
    try {
      logger.info("Initiating update check");
      const result = await updateService.checkForUpdates();

      if (!result) {
        return rejectWithValue("Update check failed");
      }

      return { timestamp: new Date().toISOString() };
    } catch (error: any) {
      logger.error("Update check error", { error: error.message });
      return rejectWithValue(error.message);
    }
  },
);

export const downloadUpdate = createAsyncThunk(
  "update/downloadUpdate",
  async (_, { rejectWithValue }) => {
    try {
      logger.info("Initiating update download");
      const result = await updateService.downloadUpdate();

      if (!result) {
        return rejectWithValue("Update download failed");
      }

      return {};
    } catch (error: any) {
      logger.error("Update download error", { error: error.message });
      return rejectWithValue(error.message);
    }
  },
);

export const installUpdate = createAsyncThunk(
  "update/installUpdate",
  async (_, { rejectWithValue }) => {
    try {
      logger.info("Initiating update installation");
      const result = await updateService.installUpdate();

      if (!result) {
        return rejectWithValue("Update installation failed");
      }

      return {};
    } catch (error: any) {
      logger.error("Update installation error", { error: error.message });
      return rejectWithValue(error.message);
    }
  },
);

export const restartApp = createAsyncThunk(
  "update/restartApp",
  async (_, { rejectWithValue }) => {
    try {
      logger.info("Restarting app");
      const result = await updateService.restartApp();

      if (!result) {
        return rejectWithValue("App restart failed");
      }

      return {};
    } catch (error: any) {
      logger.error("App restart error", { error: error.message });
      return rejectWithValue(error.message);
    }
  },
);

const updateSlice = createSlice({
  name: "update",
  initialState,
  reducers: {
    // Set update available
    setUpdateAvailable: (state, action: PayloadAction<UpdateInfo>) => {
      state.updateAvailable = true;
      state.latestVersion = action.payload.version;
      state.checking = false;
      state.error = null;
      logger.info("Update available", { version: action.payload.version });
    },

    // Set update not available
    setUpdateNotAvailable: (state) => {
      state.updateAvailable = false;
      state.latestVersion = null;
      state.checking = false;
      state.error = null;
      logger.info("No update available");
    },

    // Set download progress
    setDownloadProgress: (state, action: PayloadAction<DownloadProgress>) => {
      state.downloading = true;
      state.downloadProgress = action.payload.percent;
      state.downloadSpeed = action.payload.bytesPerSecond;
      state.downloadTransferred = action.payload.transferred;
      state.downloadTotal = action.payload.total;
      state.error = null;
    },

    // Set update downloaded
    setUpdateDownloaded: (state, action: PayloadAction<UpdateInfo>) => {
      state.updateDownloaded = true;
      state.updateReady = true;
      state.downloading = false;
      state.downloadProgress = 100;
      state.latestVersion = action.payload.version;
      state.error = null;
      logger.info("Update downloaded and ready", {
        version: action.payload.version,
      });
    },

    // Set checking status
    setChecking: (state, action: PayloadAction<boolean>) => {
      state.checking = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    // Set error
    setUpdateError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.checking = false;
      state.downloading = false;
      logger.error("Update error", { error: action.payload });
    },

    // Clear error
    clearUpdateError: (state) => {
      state.error = null;
    },

    // Reset update state (after installation)
    resetUpdateState: (state) => {
      state.updateAvailable = false;
      state.updateDownloaded = false;
      state.updateReady = false;
      state.downloading = false;
      state.downloadProgress = 0;
      state.downloadSpeed = 0;
      state.downloadTransferred = 0;
      state.downloadTotal = 0;
      state.latestVersion = null;
      state.error = null;
    },

    // Toggle auto check
    setAutoCheckEnabled: (state, action: PayloadAction<boolean>) => {
      state.autoCheckEnabled = action.payload;
      logger.info("Auto check updates", { enabled: action.payload });
    },

    // Toggle notifications
    setNotificationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.notificationsEnabled = action.payload;
      logger.info("Update notifications", { enabled: action.payload });
    },

    // Dismiss update notification (user chose "later")
    dismissUpdateNotification: (state) => {
      // Don't reset update state, just mark that user was notified
      // The notification UI can use this to avoid showing repeatedly
      state.lastChecked = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    // Check for updates
    builder.addCase(checkForUpdates.pending, (state) => {
      state.checking = true;
      state.error = null;
    });
    builder.addCase(checkForUpdates.fulfilled, (state, action) => {
      state.checking = false;
      state.lastChecked = action.payload.timestamp;
    });
    builder.addCase(checkForUpdates.rejected, (state, action) => {
      state.checking = false;
      state.error = action.payload as string;
    });

    // Download update
    builder.addCase(downloadUpdate.pending, (state) => {
      state.downloading = true;
      state.error = null;
    });
    builder.addCase(downloadUpdate.fulfilled, (state) => {
      // Downloading state will be managed by progress events
      // Don't set downloading to false here
    });
    builder.addCase(downloadUpdate.rejected, (state, action) => {
      state.downloading = false;
      state.error = action.payload as string;
    });

    // Install update
    builder.addCase(installUpdate.pending, (state) => {
      // App will restart, no need to update state
    });
    builder.addCase(installUpdate.rejected, (state, action) => {
      state.error = action.payload as string;
    });

    // Restart app
    builder.addCase(restartApp.pending, (state) => {
      // App will restart, no need to update state
    });
    builder.addCase(restartApp.rejected, (state, action) => {
      state.error = action.payload as string;
    });
  },
});

// Actions
export const {
  setUpdateAvailable,
  setUpdateNotAvailable,
  setDownloadProgress,
  setUpdateDownloaded,
  setChecking,
  setUpdateError,
  clearUpdateError,
  resetUpdateState,
  setAutoCheckEnabled,
  setNotificationsEnabled,
  dismissUpdateNotification,
} = updateSlice.actions;

// Selectors
export const selectUpdateState = (state: RootState) => state.update;
export const selectUpdateAvailable = (state: RootState) =>
  state.update.updateAvailable;
export const selectUpdateReady = (state: RootState) => state.update.updateReady;
export const selectDownloadProgress = (state: RootState) =>
  state.update.downloadProgress;
export const selectCurrentVersion = (state: RootState) =>
  state.update.currentVersion;
export const selectLatestVersion = (state: RootState) =>
  state.update.latestVersion;
export const selectUpdateError = (state: RootState) => state.update.error;
export const selectIsChecking = (state: RootState) => state.update.checking;
export const selectIsDownloading = (state: RootState) =>
  state.update.downloading;

export default updateSlice.reducer;
