import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define Orientation type locally instead of importing from context
export type Orientation = "LANDSCAPE" | "PORTRAIT";

// State interface
export interface UIState {
  // Orientation
  orientation: Orientation;

  // Offline status
  isOffline: boolean;
  wasOffline: boolean;
  offlineStartTime: string | null;

  // App initialization
  isInitializing: boolean;
  initializationStage: string;
  loadingMessage: string;

  // Update notifications
  hasUpdate: boolean;
  updateDownloaded: boolean;
  updateError: string | null;

  // Loading states (not persisted)
  showLoadingScreen: boolean;
  showContent: boolean;
  dataLoaded: boolean;

  // Error boundaries
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;

  // Notifications
  notifications: Array<{
    id: string;
    type: "info" | "warning" | "error" | "success";
    message: string;
    timestamp: string;
    duration?: number;
  }>;

  // Performance monitoring
  renderCount: number;
  lastRenderTime: string | null;

  // Kiosk mode
  isKioskMode: boolean;
  preventContextMenu: boolean;
  preventKeyboardShortcuts: boolean;
}

// Initial state
const initialState: UIState = {
  orientation: "LANDSCAPE",
  isOffline: false,
  wasOffline: false,
  offlineStartTime: null,
  isInitializing: true,
  initializationStage: "start",
  loadingMessage: "Initializing...",
  hasUpdate: false,
  updateDownloaded: false,
  updateError: null,
  showLoadingScreen: true,
  showContent: false,
  dataLoaded: false,
  hasError: false,
  errorMessage: null,
  errorStack: null,
  notifications: [],
  renderCount: 0,
  lastRenderTime: null,
  isKioskMode: true,
  preventContextMenu: true,
  preventKeyboardShortcuts: true,
};

// Slice
const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    // Orientation
    setOrientation: (state, action: PayloadAction<Orientation>) => {
      state.orientation = action.payload;
    },

    // Offline status
    setOffline: (state, action: PayloadAction<boolean>) => {
      const wasOffline = state.isOffline;
      state.isOffline = action.payload;

      if (action.payload && !wasOffline) {
        // Going offline
        state.wasOffline = true;
        state.offlineStartTime = new Date().toISOString();
      } else if (!action.payload && wasOffline) {
        // Coming back online
        state.offlineStartTime = null;
      }
    },

    resetOfflineStatus: (state) => {
      state.isOffline = false;
      state.wasOffline = false;
      state.offlineStartTime = null;
    },

    // App initialization
    setInitializing: (state, action: PayloadAction<boolean>) => {
      state.isInitializing = action.payload;
    },

    setInitializationStage: (state, action: PayloadAction<string>) => {
      state.initializationStage = action.payload;
    },

    setLoadingMessage: (state, action: PayloadAction<string>) => {
      state.loadingMessage = action.payload;
    },

    // Update notifications
    setHasUpdate: (state, action: PayloadAction<boolean>) => {
      state.hasUpdate = action.payload;
    },

    setUpdateDownloaded: (state, action: PayloadAction<boolean>) => {
      state.updateDownloaded = action.payload;
    },

    setUpdateError: (state, action: PayloadAction<string | null>) => {
      state.updateError = action.payload;
    },

    // Loading screens
    setShowLoadingScreen: (state, action: PayloadAction<boolean>) => {
      state.showLoadingScreen = action.payload;
    },

    setShowContent: (state, action: PayloadAction<boolean>) => {
      state.showContent = action.payload;
    },

    setDataLoaded: (state, action: PayloadAction<boolean>) => {
      state.dataLoaded = action.payload;
    },

    // Error handling
    setError: (
      state,
      action: PayloadAction<{
        message: string;
        stack?: string;
      }>,
    ) => {
      state.hasError = true;
      state.errorMessage = action.payload.message;
      state.errorStack = action.payload.stack || null;
    },

    clearError: (state) => {
      state.hasError = false;
      state.errorMessage = null;
      state.errorStack = null;
    },

    // Notifications
    addNotification: (
      state,
      action: PayloadAction<{
        type: "info" | "warning" | "error" | "success";
        message: string;
        duration?: number;
      }>,
    ) => {
      const notification = {
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...action.payload,
        timestamp: new Date().toISOString(),
      };

      state.notifications.push(notification);

      // Keep only the last 10 notifications
      if (state.notifications.length > 10) {
        state.notifications = state.notifications.slice(-10);
      }
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload,
      );
    },

    clearNotifications: (state) => {
      state.notifications = [];
    },

    // Performance monitoring
    incrementRenderCount: (state) => {
      state.renderCount += 1;
      state.lastRenderTime = new Date().toISOString();
    },

    resetRenderCount: (state) => {
      state.renderCount = 0;
      state.lastRenderTime = null;
    },

    // Kiosk mode
    setKioskMode: (state, action: PayloadAction<boolean>) => {
      state.isKioskMode = action.payload;
    },

    setPreventContextMenu: (state, action: PayloadAction<boolean>) => {
      state.preventContextMenu = action.payload;
    },

    setPreventKeyboardShortcuts: (state, action: PayloadAction<boolean>) => {
      state.preventKeyboardShortcuts = action.payload;
    },

    // Reset UI state (useful for logout)
    resetUIState: (state) => {
      // Reset most UI state but keep kiosk settings
      state.isOffline = false;
      state.wasOffline = false;
      state.offlineStartTime = null;
      state.isInitializing = true;
      state.initializationStage = "start";
      state.loadingMessage = "Initializing...";
      state.hasUpdate = false;
      state.updateDownloaded = false;
      state.updateError = null;
      state.showLoadingScreen = true;
      state.showContent = false;
      state.dataLoaded = false;
      state.hasError = false;
      state.errorMessage = null;
      state.errorStack = null;
      state.notifications = [];
      state.renderCount = 0;
      state.lastRenderTime = null;
    },
  },
});

// Export actions
export const {
  setOrientation,
  setOffline,
  resetOfflineStatus,
  setInitializing,
  setInitializationStage,
  setLoadingMessage,
  setHasUpdate,
  setUpdateDownloaded,
  setUpdateError,
  setShowLoadingScreen,
  setShowContent,
  setDataLoaded,
  setError,
  clearError,
  addNotification,
  removeNotification,
  clearNotifications,
  incrementRenderCount,
  resetRenderCount,
  setKioskMode,
  setPreventContextMenu,
  setPreventKeyboardShortcuts,
  resetUIState,
} = uiSlice.actions;

// Selectors
export const selectOrientation = (state: { ui: UIState }) =>
  state.ui.orientation;
export const selectIsOffline = (state: { ui: UIState }) => state.ui.isOffline;
export const selectWasOffline = (state: { ui: UIState }) => state.ui.wasOffline;
export const selectOfflineStartTime = (state: { ui: UIState }) =>
  state.ui.offlineStartTime;
export const selectIsInitializing = (state: { ui: UIState }) =>
  state.ui.isInitializing;
export const selectInitializationStage = (state: { ui: UIState }) =>
  state.ui.initializationStage;
export const selectLoadingMessage = (state: { ui: UIState }) =>
  state.ui.loadingMessage;
export const selectHasUpdate = (state: { ui: UIState }) => state.ui.hasUpdate;
export const selectUpdateDownloaded = (state: { ui: UIState }) =>
  state.ui.updateDownloaded;
export const selectUpdateError = (state: { ui: UIState }) =>
  state.ui.updateError;
export const selectShowLoadingScreen = (state: { ui: UIState }) =>
  state.ui.showLoadingScreen;
export const selectShowContent = (state: { ui: UIState }) =>
  state.ui.showContent;
export const selectDataLoaded = (state: { ui: UIState }) => state.ui.dataLoaded;
export const selectHasError = (state: { ui: UIState }) => state.ui.hasError;
export const selectErrorMessage = (state: { ui: UIState }) =>
  state.ui.errorMessage;
export const selectErrorStack = (state: { ui: UIState }) => state.ui.errorStack;
export const selectNotifications = (state: { ui: UIState }) =>
  state.ui.notifications;
export const selectRenderCount = (state: { ui: UIState }) =>
  state.ui.renderCount;
export const selectLastRenderTime = (state: { ui: UIState }) =>
  state.ui.lastRenderTime;
export const selectIsKioskMode = (state: { ui: UIState }) =>
  state.ui.isKioskMode;
export const selectPreventContextMenu = (state: { ui: UIState }) =>
  state.ui.preventContextMenu;
export const selectPreventKeyboardShortcuts = (state: { ui: UIState }) =>
  state.ui.preventKeyboardShortcuts;

// Computed selectors
export const selectOfflineDuration = (state: { ui: UIState }) => {
  if (!state.ui.isOffline || !state.ui.offlineStartTime) return null;
  return Date.now() - new Date(state.ui.offlineStartTime).getTime();
};

export const selectActiveNotifications = (state: { ui: UIState }) => {
  const now = Date.now();
  return state.ui.notifications.filter((notification) => {
    if (!notification.duration) return true; // No duration means permanent
    const notificationTime = new Date(notification.timestamp).getTime();
    return now - notificationTime < notification.duration;
  });
};

export default uiSlice.reducer;
