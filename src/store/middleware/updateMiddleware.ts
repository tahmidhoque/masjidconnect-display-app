/**
 * Update Middleware
 *
 * Connects the update service to Redux store.
 * Listens to update service events and dispatches appropriate actions.
 */

import { Middleware } from "@reduxjs/toolkit";
import updateService from "../../services/updateService";
import {
  setUpdateAvailable,
  setUpdateNotAvailable,
  setDownloadProgress,
  setUpdateDownloaded,
  setChecking,
  setUpdateError,
} from "../slices/updateSlice";
import logger from "../../utils/logger";

let listenersSetup = false;

/**
 * Update middleware handles update service integration with Redux
 */
export const updateMiddleware: Middleware = (api: any) => {
  // Set up update service listeners
  const setupUpdateListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;

    logger.debug("[UpdateMiddleware] Setting up update service listeners");

    // Listen for update events from the service
    updateService.addUpdateListener((event) => {
      logger.debug("[UpdateMiddleware] Update event received:", {
        type: event.type,
      });

      switch (event.type) {
        case "checking":
          api.dispatch(setChecking(true));
          break;

        case "available":
          api.dispatch(setUpdateAvailable(event.data));
          break;

        case "not-available":
          api.dispatch(setUpdateNotAvailable());
          break;

        case "downloading":
          // Progress is handled separately
          break;

        case "downloaded":
          api.dispatch(setUpdateDownloaded(event.data));
          break;

        case "error":
          const errorMessage = event.data?.message || "Update error occurred";
          api.dispatch(setUpdateError(errorMessage));
          break;

        default:
          logger.warn("[UpdateMiddleware] Unknown update event type:", {
            type: event.type,
          });
      }
    });

    // Listen for download progress updates
    updateService.addProgressListener((progress) => {
      api.dispatch(setDownloadProgress(progress));
    });
  };

  return (next) => (action) => {
    // Set up listeners on first action
    if (!listenersSetup && updateService.isElectronEnvironment()) {
      setupUpdateListeners();
    }

    return next(action);
  };
};

export default updateMiddleware;
