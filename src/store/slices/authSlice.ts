/**
 * Auth Slice
 * 
 * Redux slice for authentication state management.
 * Uses the new credentialService and apiClient for all operations.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiClient, { PairedCredentialsResponse } from '../../api/apiClient';
import credentialService from '../../services/credentialService';
import logger from '../../utils/logger';

// Define Orientation type
export type Orientation = 'LANDSCAPE' | 'PORTRAIT';

// ============================================================================
// State Interface
// ============================================================================

export interface AuthState {
  // Authentication status
  isAuthenticated: boolean;
  isPaired: boolean;

  // Pairing process
  isPairing: boolean;
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  isPairingCodeExpired: boolean;
  isPolling: boolean;

  // Credentials
  screenId: string | null;
  apiKey: string | null;
  masjidId: string | null;

  // Error handling
  pairingError: string | null;
  authError: string | null;

  // Timestamps
  lastPairingCodeRequestTime: number | null;
  lastUpdated: string | null;

  // Loading states
  isRequestingPairingCode: boolean;
  isCheckingPairingStatus: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AuthState = {
  isAuthenticated: false,
  isPaired: false,
  isPairing: false,
  pairingCode: null,
  pairingCodeExpiresAt: null,
  isPairingCodeExpired: false,
  isPolling: false,
  screenId: null,
  apiKey: null,
  masjidId: null,
  pairingError: null,
  authError: null,
  lastPairingCodeRequestTime: null,
  lastUpdated: null,
  isRequestingPairingCode: false,
  isCheckingPairingStatus: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get device info for pairing request
 */
function getDeviceInfo(orientation: Orientation) {
  return {
    name: `Display ${Date.now()}`,
    type: 'WEB',
    platform: navigator.platform || 'Unknown',
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    orientation: orientation.toLowerCase(),
    appVersion: '1.0.0', // TODO: Get from environment
  };
}

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Request a new pairing code
 */
export const requestPairingCode = createAsyncThunk(
  'auth/requestPairingCode',
  async (orientation: Orientation, { rejectWithValue }) => {
    try {
      logger.info('[Auth] Requesting pairing code', { orientation });

      const deviceInfo = getDeviceInfo(orientation);
      const response = await apiClient.requestPairingCode(deviceInfo);

      if (response.success && response.data) {
        logger.info('[Auth] Pairing code received', {
          pairingCode: response.data.pairingCode,
          expiresAt: response.data.expiresAt,
        });

        // Store pairing code for persistence
        localStorage.setItem('pairingCode', response.data.pairingCode);
        localStorage.setItem('pairingCodeExpiresAt', response.data.expiresAt);

        return {
          pairingCode: response.data.pairingCode,
          expiresAt: response.data.expiresAt,
          requestTime: Date.now(),
        };
      } else {
        throw new Error(response.error || 'Failed to request pairing code');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request pairing code';
      logger.error('[Auth] Error requesting pairing code', { error: errorMessage });
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Check pairing status and get credentials if paired
 */
export const checkPairingStatus = createAsyncThunk(
  'auth/checkPairingStatus',
  async (pairingCode: string, { rejectWithValue }) => {
    try {
      logger.debug('[Auth] Checking pairing status', { pairingCode });

      // Step 1: Check if pairing is complete
      const statusResponse = await apiClient.checkPairingStatus(pairingCode);

      if (!statusResponse.success) {
        throw new Error(statusResponse.error || 'Failed to check pairing status');
      }

      if (!statusResponse.data?.isPaired) {
        logger.debug('[Auth] Not yet paired');
        return { isPaired: false, credentials: null };
      }

      // Step 2: Pairing is complete, fetch credentials
      logger.info('[Auth] Device is paired, fetching credentials');
      const credentialsResponse = await apiClient.getPairedCredentials(pairingCode);

      if (!credentialsResponse.success || !credentialsResponse.data) {
        throw new Error(credentialsResponse.error || 'Failed to fetch credentials');
      }

      const { apiKey, screenId, masjidId, masjidName, screenName, orientation } = 
        credentialsResponse.data;

      // Credentials are automatically saved by apiClient.getPairedCredentials
      // But let's verify and store additional info
      logger.info('[Auth] Credentials received and saved', {
        screenId,
        masjidId,
        masjidName,
        screenName,
      });

      // Store additional info
      if (masjidName) localStorage.setItem('masjid_name', masjidName);
      if (screenName) localStorage.setItem('screen_name', screenName);
      if (orientation) localStorage.setItem('screen_orientation', orientation);

      // Clear pairing data
      localStorage.removeItem('pairingCode');
      localStorage.removeItem('pairingCodeExpiresAt');

      return {
        isPaired: true,
        credentials: { apiKey, screenId, masjidId },
        masjidName,
        screenName,
        orientation,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check pairing status';
      logger.error('[Auth] Error checking pairing status', { error: errorMessage });
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Initialise auth state from storage
 */
export const initializeFromStorage = createAsyncThunk(
  'auth/initializeFromStorage',
  async (_, { rejectWithValue }) => {
    try {
      logger.info('[Auth] Initialising from storage');

      // Initialise credential service
      credentialService.initialise();
      credentialService.debugLogState();

      // Check for existing credentials
      const credentials = credentialService.getCredentials();

      if (credentials && credentials.apiKey && credentials.screenId) {
        logger.info('[Auth] Valid credentials found', {
          screenId: credentials.screenId,
          hasMasjidId: !!credentials.masjidId,
        });

        // Clean up any old pairing data
        localStorage.removeItem('pairingCode');
        localStorage.removeItem('pairingCodeExpiresAt');

        return {
          credentials: {
            apiKey: credentials.apiKey,
            screenId: credentials.screenId,
            masjidId: credentials.masjidId || null,
          },
          pairingData: null,
        };
      }

      // Check for stored pairing code (resuming pairing flow)
      const storedPairingCode = localStorage.getItem('pairingCode');
      const storedPairingCodeExpiresAt = localStorage.getItem('pairingCodeExpiresAt');

      if (storedPairingCode && storedPairingCodeExpiresAt) {
        const expiresAt = new Date(storedPairingCodeExpiresAt);
        const now = new Date();

        if (expiresAt > now) {
          logger.info('[Auth] Found valid pairing code, resuming pairing flow');
          return {
            credentials: null,
            pairingData: {
              pairingCode: storedPairingCode,
              expiresAt: storedPairingCodeExpiresAt,
            },
          };
        } else {
          // Clear expired pairing code
          logger.debug('[Auth] Clearing expired pairing code');
          localStorage.removeItem('pairingCode');
          localStorage.removeItem('pairingCodeExpiresAt');
        }
      }

      logger.info('[Auth] No valid credentials or pairing data found');
      return {
        credentials: null,
        pairingData: null,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialise from storage';
      logger.error('[Auth] Error initialising from storage', { error: errorMessage });
      return rejectWithValue(errorMessage);
    }
  }
);

// ============================================================================
// Slice
// ============================================================================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Set paired status
    setIsPaired: (state, action: PayloadAction<boolean>) => {
      state.isPaired = action.payload;
      state.isAuthenticated = action.payload;
    },

    // Set polling status
    setPolling: (state, action: PayloadAction<boolean>) => {
      state.isPolling = action.payload;
    },

    // Set pairing code expired
    setPairingCodeExpired: (state, action: PayloadAction<boolean>) => {
      state.isPairingCodeExpired = action.payload;
      if (action.payload) {
        state.pairingCode = null;
        state.pairingCodeExpiresAt = null;
        localStorage.removeItem('pairingCode');
        localStorage.removeItem('pairingCodeExpiresAt');
      }
    },

    // Clear pairing error
    clearPairingError: (state) => {
      state.pairingError = null;
    },

    // Clear auth error
    clearAuthError: (state) => {
      state.authError = null;
    },

    // Logout
    logout: (state) => {
      logger.info('[Auth] Logging out');

      // Reset state
      state.isAuthenticated = false;
      state.isPaired = false;
      state.isPairing = false;
      state.screenId = null;
      state.apiKey = null;
      state.masjidId = null;
      state.pairingCode = null;
      state.pairingCodeExpiresAt = null;
      state.isPairingCodeExpired = false;
      state.isPolling = false;
      state.pairingError = null;
      state.authError = null;
      state.lastPairingCodeRequestTime = null;

      // Clear credentials via service
      credentialService.clearCredentials();

      // Clear additional localStorage items
      localStorage.removeItem('pairingCode');
      localStorage.removeItem('pairingCodeExpiresAt');
      localStorage.removeItem('masjid_name');
      localStorage.removeItem('screen_name');
      localStorage.removeItem('screen_orientation');

      logger.info('[Auth] Logout complete');
    },

    // Set last updated
    setLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    // Request pairing code
    builder
      .addCase(requestPairingCode.pending, (state) => {
        state.isRequestingPairingCode = true;
        state.pairingError = null;
        state.isPairing = true;
      })
      .addCase(requestPairingCode.fulfilled, (state, action) => {
        state.isRequestingPairingCode = false;
        state.pairingCode = action.payload.pairingCode;
        state.pairingCodeExpiresAt = action.payload.expiresAt;
        state.lastPairingCodeRequestTime = action.payload.requestTime;
        state.isPairingCodeExpired = false;
        state.pairingError = null;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(requestPairingCode.rejected, (state, action) => {
        state.isRequestingPairingCode = false;
        state.isPairing = false;
        state.pairingError = action.payload as string;
      });

    // Check pairing status
    builder
      .addCase(checkPairingStatus.pending, (state) => {
        state.isCheckingPairingStatus = true;
        state.pairingError = null;
      })
      .addCase(checkPairingStatus.fulfilled, (state, action) => {
        state.isCheckingPairingStatus = false;

        if (action.payload.isPaired && action.payload.credentials) {
          logger.info('[Auth] Pairing complete, updating state', {
            screenId: action.payload.credentials.screenId,
          });

          state.isAuthenticated = true;
          state.isPaired = true;
          state.isPairing = false;
          state.screenId = action.payload.credentials.screenId;
          state.apiKey = action.payload.credentials.apiKey;
          state.masjidId = action.payload.credentials.masjidId || null;
          state.pairingCode = null;
          state.pairingCodeExpiresAt = null;
          state.isPairingCodeExpired = false;
          state.isPolling = false;
          state.pairingError = null;
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(checkPairingStatus.rejected, (state, action) => {
        state.isCheckingPairingStatus = false;
        state.pairingError = action.payload as string;
      });

    // Initialise from storage
    builder
      .addCase(initializeFromStorage.pending, (state) => {
        state.authError = null;
      })
      .addCase(initializeFromStorage.fulfilled, (state, action) => {
        if (action.payload.credentials) {
          logger.info('[Auth] Authenticated from storage');

          state.isAuthenticated = true;
          state.isPaired = true;
          state.screenId = action.payload.credentials.screenId;
          state.apiKey = action.payload.credentials.apiKey;
          state.masjidId = action.payload.credentials.masjidId;
          state.isPairing = false;
          state.pairingCode = null;
          state.pairingCodeExpiresAt = null;
          state.isPairingCodeExpired = false;
          state.isPolling = false;
        } else if (action.payload.pairingData) {
          logger.info('[Auth] Resuming pairing from storage');

          state.pairingCode = action.payload.pairingData.pairingCode;
          state.pairingCodeExpiresAt = action.payload.pairingData.expiresAt;
          state.isPairing = true;
        }

        state.lastUpdated = new Date().toISOString();
      })
      .addCase(initializeFromStorage.rejected, (state, action) => {
        state.authError = action.payload as string;
      });
  },
});

// ============================================================================
// Exports
// ============================================================================

export const {
  setIsPaired,
  setPolling,
  setPairingCodeExpired,
  clearPairingError,
  clearAuthError,
  logout,
  setLastUpdated,
} = authSlice.actions;

// Selectors
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated;
export const selectIsPaired = (state: { auth: AuthState }) =>
  state.auth.isPaired;
export const selectIsPairing = (state: { auth: AuthState }) =>
  state.auth.isPairing;
export const selectPairingCode = (state: { auth: AuthState }) =>
  state.auth.pairingCode;
export const selectPairingCodeExpiresAt = (state: { auth: AuthState }) =>
  state.auth.pairingCodeExpiresAt;
export const selectIsPairingCodeExpired = (state: { auth: AuthState }) =>
  state.auth.isPairingCodeExpired;
export const selectScreenId = (state: { auth: AuthState }) =>
  state.auth.screenId;
export const selectMasjidId = (state: { auth: AuthState }) =>
  state.auth.masjidId;
export const selectPairingError = (state: { auth: AuthState }) =>
  state.auth.pairingError;
export const selectAuthError = (state: { auth: AuthState }) =>
  state.auth.authError;
export const selectIsPolling = (state: { auth: AuthState }) =>
  state.auth.isPolling;
export const selectIsRequestingPairingCode = (state: { auth: AuthState }) =>
  state.auth.isRequestingPairingCode;
export const selectIsCheckingPairingStatus = (state: { auth: AuthState }) =>
  state.auth.isCheckingPairingStatus;

export default authSlice.reducer;
