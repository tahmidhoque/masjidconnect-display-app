import {
  Middleware,
  MiddlewareAPI,
  ThunkDispatch,
  UnknownAction,
} from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "../index";
import emergencyAlertService from "../../services/emergencyAlertService";
import remoteControlService from "../../services/remoteControlService";
import unifiedSSEService from "../../services/unifiedSSEService";
import { getApiBaseUrl } from "../../utils/adminUrlUtils";
import {
  setCurrentAlert,
  setConnectionStatus,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  setError,
  clearError,
  initializeEmergencyService,
  connectToEmergencyService,
  disconnectFromEmergencyService,
  selectIsEnabled,
  selectAutoReconnect,
  selectShouldReconnect,
  selectReconnectAttempts,
  selectMaxReconnectAttempts,
} from "../slices/emergencySlice";
import { selectIsAuthenticated } from "../slices/authSlice";
import logger from "../../utils/logger";

// Track if we've set up listeners to avoid duplicates
let listenersSetup = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reloadDetectionChecked = false; // Track if we've checked for reload scenario

/**
 * Emergency middleware handles SSE connections and emergency alert integration
 */
export const emergencyMiddleware: Middleware = (api: any) => {
  // Set up emergency service listeners
  const setupEmergencyListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;

    logger.debug(
      "[EmergencyMiddleware] Setting up emergency service listeners",
    );

    // Listen for alert changes from the service
    console.log("[EmergencyMiddleware] Registering listener with emergencyAlertService");
    const unregisterListener = emergencyAlertService.addListener((alert) => {
      console.log("[EmergencyMiddleware] Alert callback invoked", {
        hasAlert: !!alert,
        alertId: alert?.id,
        alertTitle: alert?.title,
      });
      if (alert) {
        logger.debug("[EmergencyMiddleware] Alert received from service:", {
          id: alert.id,
          title: alert.title,
        });
        console.log("[EmergencyMiddleware] Dispatching setCurrentAlert with alert:", alert);
      } else {
        logger.debug("[EmergencyMiddleware] Alert cleared from service");
        console.log("[EmergencyMiddleware] Dispatching setCurrentAlert with null");
      }
      api.dispatch(setCurrentAlert(alert));
      console.log("[EmergencyMiddleware] setCurrentAlert dispatched");
    });
    console.log("[EmergencyMiddleware] Listener registered, unregister function:", typeof unregisterListener);

    // Monitor connection status (we'll implement this in the service if needed)
    // For now, we'll manage connection status through the middleware
  };

  // Initialize unified SSE service (this handles all SSE connections)
  const initializeUnifiedSSE = (baseURL: string) => {
    try {
      logger.info("[EmergencyMiddleware] Initializing unified SSE service");
      unifiedSSEService.initialize(baseURL);
    } catch (error) {
      logger.error(
        "[EmergencyMiddleware] Error initializing unified SSE service",
        { error },
      );
    }
  };

  // Initialize remote control service (registers handlers with unified SSE)
  const initializeRemoteControl = (baseURL: string) => {
    try {
      logger.info("[EmergencyMiddleware] Initializing remote control service");
      remoteControlService.initialize(baseURL);
    } catch (error) {
      logger.error(
        "[EmergencyMiddleware] Error initializing remote control service",
        { error },
      );
    }
  };

  // Initialize emergency alert service (registers handlers with unified SSE)
  const initializeEmergency = (baseURL: string) => {
    try {
      logger.info("[EmergencyMiddleware] Initializing emergency alert service");
      emergencyAlertService.initialize(baseURL);
    } catch (error) {
      logger.error(
        "[EmergencyMiddleware] Error initializing emergency alert service",
        { error },
      );
    }
  };

  // Initialize orientation service (registers handlers with unified SSE)
  const initializeOrientation = (baseURL: string) => {
    try {
      import("../../services/orientationEventService")
        .then(({ default: orientationEventService }) => {
          logger.info("[EmergencyMiddleware] Initializing orientation service");
          orientationEventService.initialize(baseURL);
        })
        .catch((error) => {
          logger.error(
            "[EmergencyMiddleware] Could not initialize orientation service",
            { error },
          );
        });
    } catch (error) {
      logger.error(
        "[EmergencyMiddleware] Error initializing orientation service",
        { error },
      );
    }
  };

  // Check for stale connections after reload and force reinitialization if needed
  const checkForStaleConnections = () => {
    if (reloadDetectionChecked) return;
    reloadDetectionChecked = true;

    const state = api.getState();
    const isAuthenticated = selectIsAuthenticated(state);
    const isEnabled = selectIsEnabled(state);
    const hasCredentials = !!(
      localStorage.getItem("masjid_screen_id") ||
      localStorage.getItem("screenId")
    );

    if (isAuthenticated && isEnabled && hasCredentials) {
      // Wait a bit longer to allow connections to establish before checking
      // This prevents closing connections that are still in CONNECTING state
      setTimeout(() => {
        // Check unified SSE service status (this is the single connection)
        const unifiedStatus = unifiedSSEService.getConnectionStatus();
        const unifiedIsStale =
          !unifiedStatus.readyState ||
          unifiedStatus.readyState === EventSource.CLOSED;

        // Also check individual service statuses for reference
        const emergencyStatus = emergencyAlertService.getConnectionStatus();
        const remoteStatus = remoteControlService.getConnectionStatus();

        // CRITICAL: Only consider connections stale if unified SSE is CLOSED or null
        // Don't close connections that are CONNECTING or OPEN
        const needsReinitialization = unifiedIsStale;

        if (needsReinitialization) {
          logger.info(
            "[EmergencyMiddleware] Detected stale or missing SSE connections after reload, reinitializing...",
            {
              emergencyConnected: emergencyStatus.connected,
              remoteConnected: remoteStatus.connected,
              emergencyReadyState: emergencyStatus.readyState,
              remoteReadyState: remoteStatus.readyState,
              unifiedIsStale,
            },
          );

          const baseURL = getApiBaseUrl();

          // Only cleanup if connections are actually stale (CLOSED or null)
          // Don't cleanup connections that are CONNECTING or OPEN
          try {
            if (unifiedIsStale) {
              unifiedSSEService.cleanup();
            }
            // Always cleanup individual services to ensure handlers are re-registered
            // BUT: Re-register listeners after cleanup since cleanup clears them
            emergencyAlertService.cleanup();
            // Re-register listeners after cleanup
            setupEmergencyListeners();
            remoteControlService.cleanup();
            import("../../services/orientationEventService")
              .then(({ default: orientationEventService }) => {
                orientationEventService.cleanup();
              })
              .catch(() => {});
          } catch (error) {
            logger.warn(
              "[EmergencyMiddleware] Error during cleanup before reinitialization",
              { error },
            );
          }

          // Small delay to ensure cleanup completes
          setTimeout(() => {
            // Always initialize unified SSE service first (creates the single connection)
            if (unifiedIsStale || needsReinitialization) {
              initializeUnifiedSSE(baseURL);
            }

            // Then initialize all services (they register handlers with unified SSE)
            api.dispatch(initializeEmergencyService(baseURL));
            initializeRemoteControl(baseURL);
            initializeOrientation(baseURL);
          }, 100);
        } else {
          logger.debug(
            "[EmergencyMiddleware] SSE connections appear healthy after reload check",
            {
              emergencyReadyState: emergencyStatus.readyState,
              remoteReadyState: remoteStatus.readyState,
              unifiedReadyState: unifiedStatus.readyState,
            },
          );
        }
      }, 2000); // Wait 2 seconds to allow connections to establish
    }
  };

  // Handle reconnection logic
  const handleReconnection = () => {
    const state = api.getState();
    const shouldReconnect = selectShouldReconnect(state);
    const isAuthenticated = selectIsAuthenticated(state);

    if (shouldReconnect && isAuthenticated) {
      const reconnectAttempts = selectReconnectAttempts(state);
      const maxAttempts = selectMaxReconnectAttempts(state);

      if (reconnectAttempts < maxAttempts) {
        // Calculate exponential backoff delay
        const baseDelay = 5000; // 5 seconds
        const delay = Math.min(
          baseDelay * Math.pow(2, reconnectAttempts),
          60000,
        ); // Max 1 minute

        logger.debug(
          `[EmergencyMiddleware] Scheduling reconnection attempt ${reconnectAttempts + 1}/${maxAttempts} in ${delay}ms`,
        );

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        reconnectTimer = setTimeout(() => {
          const currentState = api.getState();
          const stillShouldReconnect = selectShouldReconnect(currentState);

          if (stillShouldReconnect) {
            api.dispatch(incrementReconnectAttempts());
            api.dispatch(connectToEmergencyService());
          }
        }, delay);
      } else {
        logger.warn(
          "[EmergencyMiddleware] Maximum reconnection attempts reached",
        );
        api.dispatch(setError("Maximum reconnection attempts reached"));
      }
    }
  };

  // Set up listeners once
  setupEmergencyListeners();

  return (next) => (action: any) => {
    const result = next(action);
    const state = api.getState();

    // Helper function to initialize SSE services when authenticated
    const tryInitializeSSE = () => {
      const isAuthenticated = selectIsAuthenticated(state);
      const isEmergencyEnabled = selectIsEnabled(state);

      if (isAuthenticated && isEmergencyEnabled) {
        // Check if credentials are in localStorage
        const hasCredentials = !!(
          localStorage.getItem("masjid_screen_id") ||
          localStorage.getItem("screenId")
        );

        if (hasCredentials) {
          const baseURL = getApiBaseUrl();

          logger.info(
            "[EmergencyMiddleware] Authentication successful with credentials, initializing emergency service",
            {
              baseURL,
              hasScreenId: !!localStorage.getItem("masjid_screen_id"),
            },
          );
          api.dispatch(initializeEmergencyService(baseURL));
          return true;
        } else {
          logger.warn(
            "[EmergencyMiddleware] Authentication successful but no credentials found, delaying SSE initialization",
          );
          // Retry after a short delay to allow credentials to be stored
          setTimeout(() => {
            const currentState = api.getState();
            const stillAuthenticated = selectIsAuthenticated(currentState);
            const hasCredentialsNow = !!(
              localStorage.getItem("masjid_screen_id") ||
              localStorage.getItem("screenId")
            );
            if (stillAuthenticated && hasCredentialsNow) {
              const baseURL =
                process.env.NODE_ENV === "development"
                  ? "http://localhost:3000"
                  : process.env.REACT_APP_API_URL || "https://api.masjid.app";
              logger.info(
                "[EmergencyMiddleware] Credentials now available, initializing emergency service",
              );
              (api.dispatch as AppDispatch)(
                initializeEmergencyService(baseURL),
              );
            }
          }, 1000);
          return false;
        }
      }
      return false;
    };

    // Handle specific actions
    switch (action.type) {
      case "auth/initializeFromStorage/fulfilled":
      case "auth/checkPairingStatus/fulfilled":
      case "auth/setIsPaired": {
        // When authentication is successful, initialize emergency service
        logger.debug("[EmergencyMiddleware] Auth action received", {
          actionType: action.type,
        });
        tryInitializeSSE();
        break;
      }

      case "emergency/initializeEmergencyService/fulfilled": {
        // After successful initialization, attempt to connect
        const isAuthenticated = selectIsAuthenticated(state);

        if (isAuthenticated) {
          logger.debug(
            "[EmergencyMiddleware] Emergency service initialized, connecting...",
          );
          api.dispatch(connectToEmergencyService());
        }
        break;
      }

      case "emergency/connectToEmergencyService/fulfilled": {
        // Connection successful
        logger.debug(
          "[EmergencyMiddleware] Emergency service connected successfully",
        );
        api.dispatch(
          setConnectionStatus({ isConnected: true, isConnecting: false }),
        );
        api.dispatch(resetReconnectAttempts());
        api.dispatch(clearError());

        // Also ensure unified SSE and all services are initialized
        const baseURL =
          process.env.NODE_ENV === "development"
            ? "http://localhost:3000"
            : process.env.REACT_APP_API_URL || "https://api.masjid.app";
        initializeUnifiedSSE(baseURL);
        initializeRemoteControl(baseURL);
        initializeEmergency(baseURL);
        initializeOrientation(baseURL);

        // Clear any reconnection timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        break;
      }

      case "emergency/connectToEmergencyService/rejected": {
        // Connection failed
        logger.warn(
          "[EmergencyMiddleware] Emergency service connection failed",
        );
        api.dispatch(
          setConnectionStatus({
            isConnected: false,
            isConnecting: false,
            error: action.payload as string,
          }),
        );

        // Schedule reconnection if enabled
        handleReconnection();
        break;
      }

      case "emergency/disconnectFromEmergencyService/fulfilled": {
        // Disconnection successful
        logger.debug("[EmergencyMiddleware] Emergency service disconnected");
        api.dispatch(
          setConnectionStatus({ isConnected: false, isConnecting: false }),
        );

        // Clear any reconnection timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        break;
      }

      case "auth/logout": {
        // When logging out, disconnect emergency service
        logger.debug(
          "[EmergencyMiddleware] Logout detected, disconnecting emergency service",
        );
        (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
        break;
      }

      case "emergency/setEnabled": {
        // When emergency service is enabled/disabled
        const isEnabled = action.payload;
        const isAuthenticated = selectIsAuthenticated(state);

        if (isEnabled && isAuthenticated) {
          // Re-initialize if enabled
          const baseURL = getApiBaseUrl();

          (api.dispatch as AppDispatch)(initializeEmergencyService(baseURL));
        } else if (!isEnabled) {
          // Disconnect if disabled
          (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
        }
        break;
      }

      case "ui/setOffline": {
        // Handle offline/online status changes
        const isOffline = action.payload;

        if (isOffline) {
          // Going offline - disconnect SSE connections
          logger.info(
            "[EmergencyMiddleware] Device going offline, disconnecting SSE",
          );
          (api.dispatch as AppDispatch)(disconnectFromEmergencyService());

          // Also cleanup unified SSE and other services
          try {
            unifiedSSEService.cleanup();
            logger.debug(
              "[EmergencyMiddleware] Cleaned up unified SSE service",
            );
          } catch (error) {
            logger.debug(
              "[EmergencyMiddleware] Error cleaning up unified SSE service",
              { error },
            );
          }

          import("../../services/remoteControlService")
            .then(({ default: remoteControlService }) => {
              try {
                remoteControlService.cleanup();
                logger.debug(
                  "[EmergencyMiddleware] Cleaned up remote control service",
                );
              } catch (error) {
                logger.debug(
                  "[EmergencyMiddleware] Error cleaning up remote control service",
                  { error },
                );
              }
            })
            .catch((error) => {
              logger.debug(
                "[EmergencyMiddleware] Could not cleanup remote control service",
                { error },
              );
            });

          import("../../services/orientationEventService")
            .then(({ default: orientationEventService }) => {
              try {
                orientationEventService.cleanup();
                logger.debug(
                  "[EmergencyMiddleware] Cleaned up orientation service",
                );
              } catch (error) {
                logger.debug(
                  "[EmergencyMiddleware] Error cleaning up orientation service",
                  { error },
                );
              }
            })
            .catch((error) => {
              logger.debug(
                "[EmergencyMiddleware] Could not cleanup orientation service",
                { error },
              );
            });
        } else {
          // Coming back online - attempt reconnection if needed
          logger.debug("[EmergencyMiddleware] Device came back online");

          const isAuthenticated = selectIsAuthenticated(state);
          const isEnabled = selectIsEnabled(state);

          // CRITICAL FIX: Check for credentials before reconnecting
          if (isAuthenticated && isEnabled) {
            const hasCredentials = !!(
              localStorage.getItem("masjid_screen_id") ||
              localStorage.getItem("screenId")
            );

            if (hasCredentials) {
              // Small delay to ensure network is stable
              setTimeout(() => {
                logger.debug(
                  "[EmergencyMiddleware] Reconnecting SSE after coming online",
                );
                (api.dispatch as AppDispatch)(connectToEmergencyService());

                // Also reconnect unified SSE and all services
                const baseURL =
                  process.env.NODE_ENV === "development"
                    ? "http://localhost:3000"
                    : process.env.REACT_APP_API_URL || "https://api.masjid.app";

                // Initialize unified SSE first (creates the single connection)
                initializeUnifiedSSE(baseURL);

                // Then initialize all services (they register handlers with unified SSE)
                initializeRemoteControl(baseURL);
                initializeEmergency(baseURL);
                initializeOrientation(baseURL);
              }, 2000);
            } else {
              logger.warn(
                "[EmergencyMiddleware] Cannot reconnect SSE - no credentials available",
              );
            }
          }
        }
        break;
      }
    }

    // CRITICAL: Check for stale connections after reload on first auth/emergency action
    // This detects if the app reloaded and SSE connections need to be reestablished
    const isAuthAction =
      action.type.startsWith("auth/") || action.type.startsWith("emergency/");
    if (isAuthAction && !reloadDetectionChecked) {
      // Small delay to allow state to settle after reload
      setTimeout(() => {
        checkForStaleConnections();
      }, 500);
    }

    // CRITICAL: Also check state after every action to catch any missed authentication cases
    // This ensures SSE is initialized even if we missed the specific action
    // BUT: Only check on auth-related actions to prevent excessive checks
    if (isAuthAction) {
      const isAuthenticated = selectIsAuthenticated(state);
      const isEnabled = selectIsEnabled(state);
      const hasCredentials = !!(
        localStorage.getItem("masjid_screen_id") ||
        localStorage.getItem("screenId")
      );

      // Check if we should have SSE initialized but don't
      if (isAuthenticated && isEnabled && hasCredentials) {
        const emergencyState = state.emergency;
        // Only initialize if we haven't already initialized or if connection failed
        if (
          !emergencyState.connectionUrl &&
          !emergencyState.isConnecting &&
          !emergencyState.isConnected
        ) {
          logger.info(
            "[EmergencyMiddleware] Detected authenticated state but SSE not initialized, initializing now",
          );
          const baseURL = getApiBaseUrl();
          api.dispatch(initializeEmergencyService(baseURL));
        }
      }
    }

    return result;
  };
};

// Cleanup function for the middleware
export const cleanupEmergencyMiddleware = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Reset listeners flag so they can be set up again if needed
  listenersSetup = false;
  reloadDetectionChecked = false; // Reset reload detection flag

  logger.debug("[EmergencyMiddleware] Cleaned up");
};
