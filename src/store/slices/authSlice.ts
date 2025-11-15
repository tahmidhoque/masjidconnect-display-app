import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import masjidDisplayClient from "../../api/masjidDisplayClient";
import {
  ApiCredentials,
  RequestPairingCodeResponse,
  CheckPairingStatusResponse,
} from "../../api/models";
import logger from "../../utils/logger";
import dataSyncService from "../../services/dataSyncService";
import { analyticsService } from "../../services/analyticsService";
// Define Orientation type locally instead of importing from context
export type Orientation = "LANDSCAPE" | "PORTRAIT";

// State interface
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

// Initial state
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
  pairingError: null,
  authError: null,
  lastPairingCodeRequestTime: null,
  lastUpdated: null,
  isRequestingPairingCode: false,
  isCheckingPairingStatus: false,
};

// Async thunks
export const requestPairingCode = createAsyncThunk(
  "auth/requestPairingCode",
  async (orientation: Orientation, { rejectWithValue }) => {
    try {
      logger.debug("[Auth] Requesting pairing code with orientation", {
        orientation,
      });

      const response = await masjidDisplayClient.requestPairingCode({
        deviceType: "WEB",
        orientation,
      });

      if (response.success && response.data) {
        logger.debug("[Auth] Pairing code received", {
          pairingCode: response.data.pairingCode,
        });

        // Store in localStorage for persistence across app restarts
        localStorage.setItem("pairingCode", response.data.pairingCode);
        localStorage.setItem("pairingCodeExpiresAt", response.data.expiresAt);
        localStorage.setItem(
          "lastPairingCodeRequestTime",
          Date.now().toString(),
        );

        return {
          pairingCode: response.data.pairingCode,
          expiresAt: response.data.expiresAt,
          requestTime: Date.now(),
        };
      } else {
        throw new Error(response.error || "Failed to request pairing code");
      }
    } catch (error: any) {
      logger.error("[Auth] Error requesting pairing code", { error });
      return rejectWithValue(error.message || "Failed to request pairing code");
    }
  },
);

export const checkPairingStatus = createAsyncThunk(
  "auth/checkPairingStatus",
  async (pairingCode: string, { rejectWithValue }) => {
    try {
      logger.debug("[Auth] Checking pairing status for code", { pairingCode });

      const isPaired =
        await masjidDisplayClient.checkPairingStatus(pairingCode);

      logger.debug("[Auth] Pairing status checked", { isPaired });

      if (isPaired) {
        // Get the credentials from localStorage since API client already stores them there
        const apiKey =
          localStorage.getItem("masjid_api_key") ||
          localStorage.getItem("apiKey");
        const screenId =
          localStorage.getItem("masjid_screen_id") ||
          localStorage.getItem("screenId");

        logger.info("[Auth] Redux checking for credentials in localStorage", {
          hasApiKey: !!apiKey,
          hasScreenId: !!screenId,
          apiKeyLength: apiKey?.length || 0,
          screenIdLength: screenId?.length || 0,
          isPaired,
        });

        if (apiKey && screenId) {
          // Store credentials in multiple formats for compatibility
          localStorage.setItem("masjid_api_key", apiKey);
          localStorage.setItem("masjid_screen_id", screenId);
          localStorage.setItem("apiKey", apiKey);
          localStorage.setItem("screenId", screenId);
          localStorage.setItem(
            "masjidconnect_credentials",
            JSON.stringify({
              apiKey,
              screenId,
            }),
          );

          // Clear pairing data
          localStorage.removeItem("pairingCode");
          localStorage.removeItem("pairingCodeExpiresAt");
          localStorage.removeItem("lastPairingCodeRequestTime");

          // Initialize API client
          masjidDisplayClient.setCredentials({ apiKey, screenId });

          logger.info("[Auth] Redux returning successful pairing result", {
            isPaired: true,
            hasCredentials: true,
          });

          return {
            isPaired: true,
            credentials: { apiKey, screenId },
          };
        } else {
          return {
            isPaired: false,
            credentials: null,
          };
        }
      } else {
        return {
          isPaired: false,
          credentials: null,
        };
      }
    } catch (error: any) {
      logger.error("[Auth] Error checking pairing status", { error });
      return rejectWithValue(error.message || "Failed to check pairing status");
    }
  },
);

export const initializeFromStorage = createAsyncThunk(
  "auth/initializeFromStorage",
  async (_, { rejectWithValue }) => {
    try {
      logger.debug("[Auth] Initializing from storage...");

      // Check for credentials in multiple formats with enhanced logging
      const checkAllCredentialFormats = () => {
        logger.debug("[Auth] === Checking All Credential Formats ===");

        const formats = [
          {
            name: "Primary masjid_* format",
            apiKey: localStorage.getItem("masjid_api_key"),
            screenId: localStorage.getItem("masjid_screen_id"),
          },
          {
            name: "Simple format",
            apiKey: localStorage.getItem("apiKey"),
            screenId: localStorage.getItem("screenId"),
          },
        ];

        // Log what we found in each format
        formats.forEach((format) => {
          logger.debug(`[Auth] ${format.name}:`, {
            hasApiKey: !!format.apiKey,
            hasScreenId: !!format.screenId,
            apiKeyLength: format.apiKey?.length || 0,
            screenIdLength: format.screenId?.length || 0,
          });
        });

        // Check each format
        for (const format of formats) {
          if (format.apiKey && format.screenId) {
            logger.info(`[Auth] ✅ Valid credentials found in ${format.name}`);
            return {
              apiKey: format.apiKey,
              screenId: format.screenId,
              found: true,
            };
          }
        }

        // Try JSON format
        try {
          const jsonCreds = localStorage.getItem("masjidconnect_credentials");
          logger.debug("[Auth] JSON credentials check:", {
            exists: !!jsonCreds,
            length: jsonCreds?.length || 0,
          });

          if (jsonCreds) {
            const parsed = JSON.parse(jsonCreds);
            if (parsed.apiKey && parsed.screenId) {
              logger.info("[Auth] ✅ Valid credentials found in JSON format");
              return {
                apiKey: parsed.apiKey,
                screenId: parsed.screenId,
                found: true,
              };
            }
          }
        } catch (error) {
          logger.warn("[Auth] Failed to parse JSON credentials", { error });
        }

        logger.warn("[Auth] ❌ No valid credentials found in any format");
        return { apiKey: null, screenId: null, found: false };
      };

      const { apiKey, screenId, found } = checkAllCredentialFormats();

      if (found && apiKey && screenId) {
        logger.info(
          "[Auth] Valid credentials found, initializing authentication...",
          {
            apiKeyLength: apiKey.length,
            screenIdLength: screenId.length,
          },
        );

        // Ensure consistent localStorage state - save in ALL formats for compatibility
        const credentialData = { apiKey, screenId };

        localStorage.setItem("masjid_api_key", apiKey);
        localStorage.setItem("masjid_screen_id", screenId);
        localStorage.setItem("apiKey", apiKey);
        localStorage.setItem("screenId", screenId);
        localStorage.setItem(
          "masjidconnect_credentials",
          JSON.stringify(credentialData),
        );
        localStorage.setItem("isPaired", "true");

        logger.debug("[Auth] Credentials saved in all formats for consistency");

        // Initialize API client
        masjidDisplayClient.setCredentials({ apiKey, screenId });

        // Clean up localStorage pairing items
        localStorage.removeItem("pairingCode");
        localStorage.removeItem("pairingCodeExpiresAt");
        localStorage.removeItem("lastPairingCodeRequestTime");

        return {
          credentials: { apiKey, screenId },
          pairingData: null,
        };
      } else {
        logger.info(
          "[Auth] No valid credentials found, checking for pairing data...",
        );

        // Check for stored pairing code
        const storedPairingCode = localStorage.getItem("pairingCode");
        const storedPairingCodeExpiresAt = localStorage.getItem(
          "pairingCodeExpiresAt",
        );

        if (storedPairingCode && storedPairingCodeExpiresAt) {
          const expiresAt = new Date(storedPairingCodeExpiresAt);
          const now = new Date();

          logger.debug("[Auth] Found stored pairing code", {
            code: storedPairingCode,
            expiresAt: expiresAt.toISOString(),
            isExpired: expiresAt <= now,
          });

          if (expiresAt > now) {
            logger.debug("[Auth] Restoring valid pairing code");
            return {
              credentials: null,
              pairingData: {
                pairingCode: storedPairingCode,
                expiresAt: storedPairingCodeExpiresAt,
              },
            };
          } else {
            // Clear expired pairing code
            logger.debug("[Auth] Clearing expired pairing code");
            localStorage.removeItem("pairingCode");
            localStorage.removeItem("pairingCodeExpiresAt");
          }
        }

        logger.info("[Auth] No valid credentials or pairing data found");
        return {
          credentials: null,
          pairingData: null,
        };
      }
    } catch (error: any) {
      logger.error("[Auth] Error initializing from storage", { error });
      return rejectWithValue(
        error.message || "Failed to initialize from storage",
      );
    }
  },
);

// Slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Synchronous actions
    setIsPaired: (state, action: PayloadAction<boolean>) => {
      state.isPaired = action.payload;
      state.isAuthenticated = action.payload;
    },

    setPolling: (state, action: PayloadAction<boolean>) => {
      state.isPolling = action.payload;
    },

    setPairingCodeExpired: (state, action: PayloadAction<boolean>) => {
      state.isPairingCodeExpired = action.payload;
      if (action.payload) {
        // Clear expired pairing code
        state.pairingCode = null;
        state.pairingCodeExpiresAt = null;
        localStorage.removeItem("pairingCode");
        localStorage.removeItem("pairingCodeExpiresAt");
      }
    },

    clearPairingError: (state) => {
      state.pairingError = null;
    },

    clearAuthError: (state) => {
      state.authError = null;
    },

    logout: (state) => {
      // Reset auth state
      state.isAuthenticated = false;
      state.isPaired = false;
      state.isPairing = false;
      state.screenId = null;
      state.apiKey = null;
      state.pairingCode = null;
      state.pairingCodeExpiresAt = null;
      state.isPairingCodeExpired = false;
      state.isPolling = false;
      state.pairingError = null;
      state.authError = null;
      state.lastPairingCodeRequestTime = null;

      // Clear localStorage
      localStorage.removeItem("masjid_api_key");
      localStorage.removeItem("masjid_screen_id");
      localStorage.removeItem("apiKey");
      localStorage.removeItem("screenId");
      localStorage.removeItem("masjidconnect_credentials");
      localStorage.removeItem("pairingCode");
      localStorage.removeItem("pairingCodeExpiresAt");
      localStorage.removeItem("lastPairingCodeRequestTime");

      // Reset API client
      masjidDisplayClient.clearCredentials();

      logger.debug("[Auth] Logged out successfully");
    },

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

        logger.info(
          "[Auth] Redux reducer received checkPairingStatus.fulfilled",
          {
            isPaired: action.payload.isPaired,
            hasCredentials: !!action.payload.credentials,
            payload: action.payload,
          },
        );

        if (action.payload.isPaired && action.payload.credentials) {
          logger.info("[Auth] Redux updating state to authenticated", {
            oldAuthenticated: state.isAuthenticated,
            newAuthenticated: true,
            oldPairing: state.isPairing,
            newPairing: false,
          });

          state.isAuthenticated = true;
          state.isPaired = true;
          state.isPairing = false;
          state.screenId = action.payload.credentials.screenId;
          state.apiKey = action.payload.credentials.apiKey;
          state.pairingCode = null;
          state.pairingCodeExpiresAt = null;
          state.isPairingCodeExpired = false;
          state.isPolling = false;

          // Initialize services when pairing is successful
          try {
            dataSyncService.initialize();
            analyticsService.initialize(action.payload.credentials.apiKey);
            // Initialize sync service for offline support (async, don't await in reducer)
            import("../../services/syncService")
              .then((syncServiceModule) => {
                syncServiceModule.default.initialize();
                logger.info("[Auth] Sync service initialized after pairing");
              })
              .catch((error) => {
                logger.error(
                  "[Auth] Error initializing sync service after pairing",
                  { error },
                );
              });
            logger.info(
              "[Auth] Services initialized successfully after pairing",
            );
          } catch (error) {
            logger.error("[Auth] Error initializing services after pairing", {
              error,
            });
          }
          state.pairingError = null;
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(checkPairingStatus.rejected, (state, action) => {
        state.isCheckingPairingStatus = false;
        state.pairingError = action.payload as string;
      });

    // Initialize from storage
    builder
      .addCase(initializeFromStorage.pending, (state) => {
        state.authError = null;
      })
      .addCase(initializeFromStorage.fulfilled, (state, action) => {
        if (action.payload.credentials) {
          state.isAuthenticated = true;
          state.isPaired = true;
          state.screenId = action.payload.credentials.screenId;
          state.apiKey = action.payload.credentials.apiKey;
          state.isPairing = false;
          state.pairingCode = null;
          state.pairingCodeExpiresAt = null;
          state.isPairingCodeExpired = false;
          state.isPolling = false;

          // Initialize services when authentication is successful
          try {
            dataSyncService.initialize();
            analyticsService.initialize(action.payload.credentials.apiKey);
            // Initialize sync service for offline support (async, don't await in reducer)
            import("../../services/syncService")
              .then((syncServiceModule) => {
                syncServiceModule.default.initialize();
                logger.info("[Auth] Sync service initialized from storage");
              })
              .catch((error) => {
                logger.error(
                  "[Auth] Error initializing sync service from storage",
                  { error },
                );
              });
            logger.info(
              "[Auth] Services initialized successfully from storage",
            );
          } catch (error) {
            logger.error("[Auth] Error initializing services", { error });
          }
        } else if (action.payload.pairingData) {
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

// Export actions
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
