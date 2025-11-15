/**
 * Update Progress Service
 *
 * Tracks update progress state and stores it for reporting in heartbeat data.
 * Listens to Electron IPC events for update state changes and persists progress
 * in localStorage for reporting across app restarts.
 */

import logger from "../utils/logger";

export interface UpdateProgress {
  status:
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error"
    | "not-available"
    | "idle";
  version?: string;
  progress?: number;
  error?: string;
  timestamp: string;
}

interface UpdateState {
  status: string;
  version: string | null;
  progress: number;
  error: string | null;
}

class UpdateProgressService {
  private currentProgress: UpdateProgress | null = null;
  private isInitialized = false;
  private unsubscribeFunctions: (() => void)[] = [];

  /**
   * Initialize the service and set up event listeners
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn("UpdateProgressService: Already initialized");
      return;
    }

    // Only initialize if running in Electron
    if (typeof window === "undefined" || !window.electron) {
      logger.debug(
        "UpdateProgressService: Not running in Electron, skipping initialization",
      );
      return;
    }

    logger.info("UpdateProgressService: Initializing");

    // Load any existing progress from localStorage
    this.loadProgressFromStorage();

    // Listen to update events from electron main process
    if (window.electron.ipcRenderer) {
      // Listen for update-state-changed events
      const unsubscribeStateChanged = window.electron.ipcRenderer.on(
        "update-state-changed",
        this.handleUpdateStateChanged,
      );
      this.unsubscribeFunctions.push(unsubscribeStateChanged);

      // Listen for individual update events for redundancy
      const unsubscribeAvailable = window.electron.ipcRenderer.on(
        "update-available",
        this.handleUpdateAvailable,
      );
      this.unsubscribeFunctions.push(unsubscribeAvailable);

      const unsubscribeProgress = window.electron.ipcRenderer.on(
        "download-progress",
        this.handleDownloadProgress,
      );
      this.unsubscribeFunctions.push(unsubscribeProgress);

      const unsubscribeDownloaded = window.electron.ipcRenderer.on(
        "update-downloaded",
        this.handleUpdateDownloaded,
      );
      this.unsubscribeFunctions.push(unsubscribeDownloaded);

      const unsubscribeError = window.electron.ipcRenderer.on(
        "update-error",
        this.handleUpdateError,
      );
      this.unsubscribeFunctions.push(unsubscribeError);
    }

    this.isInitialized = true;
    logger.info("UpdateProgressService: Initialized successfully");
  }

  /**
   * Handle update state changed event from main process
   */
  private handleUpdateStateChanged = (state: UpdateState): void => {
    logger.debug("UpdateProgressService: Update state changed", state);

    this.currentProgress = {
      status: state.status as UpdateProgress["status"],
      version: state.version || undefined,
      progress: state.progress !== undefined ? state.progress : undefined,
      error: state.error || undefined,
      timestamp: new Date().toISOString(),
    };

    // Store in localStorage for reporting in next heartbeat
    this.storeProgress();
  };

  /**
   * Handle update available event
   */
  private handleUpdateAvailable = (info: { version: string }): void => {
    logger.debug("UpdateProgressService: Update available", info);

    this.currentProgress = {
      status: "available",
      version: info.version,
      progress: 0,
      timestamp: new Date().toISOString(),
    };

    this.storeProgress();
  };

  /**
   * Handle download progress event
   */
  private handleDownloadProgress = (progress: {
    bytesPerSecond: number;
    percent: number;
    transferred: number;
    total: number;
  }): void => {
    logger.debug("UpdateProgressService: Download progress", {
      percent: progress.percent,
    });

    this.currentProgress = {
      status: "downloading",
      version: this.currentProgress?.version,
      progress: progress.percent,
      timestamp: new Date().toISOString(),
    };

    this.storeProgress();
  };

  /**
   * Handle update downloaded event
   */
  private handleUpdateDownloaded = (info: { version: string }): void => {
    logger.debug("UpdateProgressService: Update downloaded", info);

    this.currentProgress = {
      status: "downloaded",
      version: info.version,
      progress: 100,
      timestamp: new Date().toISOString(),
    };

    this.storeProgress();
  };

  /**
   * Handle update error event
   */
  private handleUpdateError = (error: {
    message: string;
    stack?: string;
  }): void => {
    logger.error("UpdateProgressService: Update error", error);

    this.currentProgress = {
      status: "error",
      version: this.currentProgress?.version,
      progress: this.currentProgress?.progress,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    this.storeProgress();
  };

  /**
   * Store progress in localStorage
   */
  private storeProgress(): void {
    if (this.currentProgress) {
      try {
        localStorage.setItem(
          "update_progress",
          JSON.stringify(this.currentProgress),
        );
        logger.debug("UpdateProgressService: Progress stored", {
          status: this.currentProgress.status,
          version: this.currentProgress.version,
        });
      } catch (error) {
        logger.error("UpdateProgressService: Failed to store progress", {
          error,
        });
      }
    }
  }

  /**
   * Load progress from localStorage
   */
  private loadProgressFromStorage(): void {
    try {
      const stored = localStorage.getItem("update_progress");
      if (stored) {
        this.currentProgress = JSON.parse(stored) as UpdateProgress;
        logger.debug("UpdateProgressService: Progress loaded from storage", {
          status: this.currentProgress?.status,
          version: this.currentProgress?.version,
        });
      }
    } catch (error) {
      logger.error(
        "UpdateProgressService: Failed to load progress from storage",
        { error },
      );
      this.currentProgress = null;
    }
  }

  /**
   * Get current update progress
   */
  public getProgress(): UpdateProgress | null {
    // Try to get fresh state from main process if available
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer
        .invoke("get-update-state")
        .then((state: UpdateState) => {
          if (state) {
            this.currentProgress = {
              status: state.status as UpdateProgress["status"],
              version: state.version || undefined,
              progress:
                state.progress !== undefined ? state.progress : undefined,
              error: state.error || undefined,
              timestamp: new Date().toISOString(),
            };
            this.storeProgress();
          }
        })
        .catch((error) => {
          logger.debug(
            "UpdateProgressService: Could not get update state from main process",
            { error },
          );
        });
    }

    // Return current progress (from localStorage or memory)
    return this.currentProgress;
  }

  /**
   * Clear progress from storage
   */
  public clearProgress(): void {
    try {
      localStorage.removeItem("update_progress");
      this.currentProgress = null;
      logger.debug("UpdateProgressService: Progress cleared");
    } catch (error) {
      logger.error("UpdateProgressService: Failed to clear progress", {
        error,
      });
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info("UpdateProgressService: Cleaning up");
    this.unsubscribeFunctions.forEach((unsub) => {
      try {
        unsub();
      } catch (error) {
        logger.error("UpdateProgressService: Error unsubscribing", { error });
      }
    });
    this.unsubscribeFunctions = [];
    this.isInitialized = false;
  }
}

// Create and export a singleton instance
const updateProgressService = new UpdateProgressService();
export default updateProgressService;
