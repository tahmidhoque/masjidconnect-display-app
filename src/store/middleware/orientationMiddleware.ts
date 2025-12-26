/**
 * Orientation Middleware
 *
 * Redux middleware that integrates orientationEventService with the Redux store.
 * Handles orientation state synchronisation between the service and Redux.
 *
 * Note: Real-time orientation events are now handled by realtimeMiddleware via WebSocket.
 * This middleware only handles local state synchronisation and loading saved orientation.
 */

import { Middleware } from "@reduxjs/toolkit";
import orientationEventService from "../../services/orientationEventService";
import { setOrientation } from "../slices/uiSlice";
import { selectIsAuthenticated } from "../slices/authSlice";
import logger from "../../utils/logger";

// Track if we've set up listeners to avoid duplicates
let listenersSetup = false;

/**
 * Orientation middleware handles orientation state synchronisation
 */
export const orientationMiddleware: Middleware = (api: any) => {
  // Set up orientation service listeners
  const setupOrientationListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;

    logger.debug(
      "[OrientationMiddleware] Setting up orientation service listeners",
    );

    // Listen for orientation changes from the service
    orientationEventService.addListener((orientation, screenId) => {
      logger.debug(
        "[OrientationMiddleware] Orientation change received from service",
        {
          orientation,
          screenId,
        },
      );
      console.log(
        `🔄 OrientationMiddleware: Orientation changed to ${orientation} for screen ${screenId}`,
      );

      // Dispatch Redux action to update orientation state
      api.dispatch(setOrientation(orientation));
    });
  };

  // Load saved orientation from localStorage
  const loadSavedOrientation = () => {
    try {
      const savedOrientation = localStorage.getItem("screen_orientation");
      if (
        savedOrientation === "LANDSCAPE" ||
        savedOrientation === "PORTRAIT"
      ) {
        logger.debug(
          "[OrientationMiddleware] Loading saved orientation from localStorage",
          { orientation: savedOrientation },
        );
        api.dispatch(
          setOrientation(savedOrientation as "LANDSCAPE" | "PORTRAIT"),
        );
      }
    } catch (error) {
      logger.warn(
        "[OrientationMiddleware] Could not load saved orientation",
        { error },
      );
    }
  };

  // Set screen ID in the service
  const setScreenId = () => {
    const screenId =
      localStorage.getItem("masjid_screen_id") ||
      localStorage.getItem("screenId");

    if (screenId) {
      orientationEventService.setScreenId(screenId);
      logger.debug("[OrientationMiddleware] Screen ID set", { screenId });
    }
  };

  // Set up listeners once
  setupOrientationListeners();

  return (next) => (action: any) => {
    const result = next(action);
    const state = api.getState();

    // Handle specific actions
    switch (action.type) {
      case "auth/initializeFromStorage/fulfilled":
      case "auth/checkPairingStatus/fulfilled":
      case "auth/setIsPaired": {
        // When authentication is successful, set screen ID and load saved orientation
        const isAuthenticated = selectIsAuthenticated(state);

        if (isAuthenticated) {
          logger.debug("[OrientationMiddleware] Auth action received, setting up", {
            actionType: action.type,
          });
          setScreenId();
          loadSavedOrientation();
        }
        break;
      }

      case "auth/logout": {
        // When logging out, cleanup orientation service
        logger.info(
          "[OrientationMiddleware] Logout detected, cleaning up orientation service",
        );
        orientationEventService.cleanup();
        listenersSetup = false; // Reset so listeners can be set up again on next auth
        break;
      }

      case "ui/setOffline": {
        // Handle coming back online
        const isOffline = action.payload;

        if (!isOffline) {
          logger.debug("[OrientationMiddleware] Device came back online");

          const isAuthenticated = selectIsAuthenticated(state);

          if (isAuthenticated) {
            // Set screen ID in case it was cleared
            setTimeout(() => {
              setScreenId();
            }, 2000);
          }
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
export const cleanupOrientationMiddleware = () => {
  listenersSetup = false;
  orientationEventService.cleanup();
  logger.debug("[OrientationMiddleware] Cleaned up");
};
