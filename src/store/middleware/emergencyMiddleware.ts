/**
 * Emergency Middleware
 *
 * Redux middleware that integrates emergencyAlertService with the Redux store.
 * Handles alert state synchronisation between the service and Redux.
 *
 * Note: Real-time communication is now handled entirely by realtimeMiddleware
 * using WebSocket. This middleware only handles local state synchronisation.
 */

import { Middleware } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "../index";
import emergencyAlertService from "../../services/emergencyAlertService";
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

/**
 * Emergency middleware handles emergency alert integration with Redux
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
    console.log(
      "[EmergencyMiddleware] Registering listener with emergencyAlertService",
    );
    emergencyAlertService.addListener((alert) => {
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
        console.log(
          "[EmergencyMiddleware] Dispatching setCurrentAlert with alert:",
          alert,
        );
      } else {
        logger.debug("[EmergencyMiddleware] Alert cleared from service");
        console.log(
          "[EmergencyMiddleware] Dispatching setCurrentAlert with null",
        );
      }
      api.dispatch(setCurrentAlert(alert));
      console.log("[EmergencyMiddleware] setCurrentAlert dispatched");
    });
    console.log("[EmergencyMiddleware] Listener registered");
  };

  // Set up listeners once
  setupEmergencyListeners();

  return (next) => (action: any) => {
    const result = next(action);
    const state = api.getState();

    // Handle specific actions
    switch (action.type) {
      case "emergency/initializeEmergencyService/fulfilled": {
        // After successful initialization, mark as connected
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
        break;
      }

      case "emergency/disconnectFromEmergencyService/fulfilled": {
        // Disconnection successful
        logger.debug("[EmergencyMiddleware] Emergency service disconnected");
        api.dispatch(
          setConnectionStatus({ isConnected: false, isConnecting: false }),
        );
        break;
      }

      case "auth/logout": {
        // When logging out, disconnect emergency service
        logger.debug(
          "[EmergencyMiddleware] Logout detected, cleaning up emergency service",
        );
        (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
        emergencyAlertService.cleanup();
        break;
      }

      case "emergency/setEnabled": {
        // When emergency service is enabled/disabled
        const isEnabled = action.payload;
        const isAuthenticated = selectIsAuthenticated(state);

        if (isEnabled && isAuthenticated) {
          // Re-initialize if enabled
          const baseURL =
            process.env.NODE_ENV === "development"
              ? "http://localhost:3000"
              : process.env.REACT_APP_API_URL || "https://api.masjid.app";
          (api.dispatch as AppDispatch)(initializeEmergencyService(baseURL));
        } else if (!isEnabled) {
          // Disconnect if disabled
          (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
        }
        break;
      }
    }

    return result;
  };
};

/**
 * Cleanup function for the middleware
 */
export const cleanupEmergencyMiddleware = () => {
  listenersSetup = false;
  emergencyAlertService.cleanup();
  logger.debug("[EmergencyMiddleware] Cleaned up");
};
