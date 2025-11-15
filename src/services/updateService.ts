/**
 * Update Service
 *
 * Provides a clean interface for handling OTA updates through Electron's
 * auto-updater. This service wraps Electron IPC calls and manages update state.
 */

import logger from "../utils/logger";
import { getCurrentVersion } from "../utils/versionManager";

// Check if we're running in Electron
const isElectron = () => {
  return (
    typeof window !== "undefined" &&
    window.electron !== undefined &&
    window.electron.updater !== undefined
  );
};

export interface UpdateInfo {
  version: string;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export type UpdateEventType =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateEvent {
  type: UpdateEventType;
  data?: any;
}

class UpdateService {
  private updateListeners: Set<(event: UpdateEvent) => void> = new Set();
  private progressListeners: Set<(progress: DownloadProgress) => void> =
    new Set();
  private unsubscribeFunctions: (() => void)[] = [];

  constructor() {
    // Set up event listeners when service is initialized
    if (isElectron()) {
      this.setupElectronListeners();
    }
  }

  /**
   * Set up listeners for Electron update events
   */
  private setupElectronListeners(): void {
    if (!window.electron?.updater) return;

    logger.info("Setting up update service listeners");

    // Update available listener
    const unsub1 = window.electron.updater.onUpdateAvailable(
      (info: UpdateInfo) => {
        logger.info("Update available", { version: info.version });
        this.notifyListeners({ type: "available", data: info });
      },
    );
    this.unsubscribeFunctions.push(unsub1);

    // Download progress listener
    const unsub2 = window.electron.updater.onDownloadProgress(
      (progress: DownloadProgress) => {
        logger.debug("Update download progress", { percent: progress.percent });
        this.notifyListeners({ type: "downloading", data: progress });
        this.notifyProgressListeners(progress);
      },
    );
    this.unsubscribeFunctions.push(unsub2);

    // Update downloaded listener
    const unsub3 = window.electron.updater.onUpdateDownloaded(
      (info: UpdateInfo) => {
        logger.info("Update downloaded", { version: info.version });
        this.notifyListeners({ type: "downloaded", data: info });
      },
    );
    this.unsubscribeFunctions.push(unsub3);

    // Update error listener
    const unsub4 = window.electron.updater.onUpdateError((error: Error) => {
      logger.error("Update error", { error: error.message });
      this.notifyListeners({ type: "error", data: error });
    });
    this.unsubscribeFunctions.push(unsub4);

    // Update message listener (generic messages)
    const unsub5 = window.electron.updater.onUpdateMessage(
      (message: string) => {
        logger.debug("Update message", { message });
      },
    );
    this.unsubscribeFunctions.push(unsub5);
  }

  /**
   * Check if updates are available
   */
  public async checkForUpdates(): Promise<boolean> {
    if (!isElectron()) {
      logger.warn("Update check requested but not running in Electron");
      return false;
    }

    try {
      logger.info("Checking for updates");
      this.notifyListeners({ type: "checking" });

      const result = await window.electron!.updater.checkForUpdates();

      if (result.success) {
        logger.info("Update check completed successfully");
        return true;
      } else {
        logger.error("Update check failed", { error: result.error });
        this.notifyListeners({
          type: "error",
          data: { message: result.error },
        });
        return false;
      }
    } catch (error: any) {
      logger.error("Error checking for updates", { error: error.message });
      this.notifyListeners({ type: "error", data: error });
      return false;
    }
  }

  /**
   * Download an available update
   */
  public async downloadUpdate(): Promise<boolean> {
    if (!isElectron()) {
      logger.warn("Update download requested but not running in Electron");
      return false;
    }

    try {
      logger.info("Downloading update");

      const result = await window.electron!.updater.downloadUpdate();

      if (result.success) {
        logger.info("Update download started successfully");
        return true;
      } else {
        logger.error("Update download failed", { error: result.error });
        this.notifyListeners({
          type: "error",
          data: { message: result.error },
        });
        return false;
      }
    } catch (error: any) {
      logger.error("Error downloading update", { error: error.message });
      this.notifyListeners({ type: "error", data: error });
      return false;
    }
  }

  /**
   * Install the downloaded update and restart the app
   */
  public async installUpdate(): Promise<boolean> {
    if (!isElectron()) {
      logger.warn("Update install requested but not running in Electron");
      return false;
    }

    try {
      logger.info("Installing update and restarting app");

      const result = await window.electron!.updater.installUpdate();

      if (result.success) {
        logger.info("Update installation initiated");
        return true;
      } else {
        logger.error("Update installation failed", { error: result.error });
        this.notifyListeners({
          type: "error",
          data: { message: result.error },
        });
        return false;
      }
    } catch (error: any) {
      logger.error("Error installing update", { error: error.message });
      this.notifyListeners({ type: "error", data: error });
      return false;
    }
  }

  /**
   * Restart the app without installing an update
   */
  public async restartApp(): Promise<boolean> {
    if (!isElectron()) {
      logger.warn("App restart requested but not running in Electron");
      return false;
    }

    try {
      logger.info("Restarting app");

      const result = await window.electron!.updater.restartApp();

      if (result.success) {
        logger.info("App restart initiated");
        return true;
      } else {
        logger.error("App restart failed", { error: result.error });
        return false;
      }
    } catch (error: any) {
      logger.error("Error restarting app", { error: error.message });
      return false;
    }
  }

  /**
   * Get the current app version
   */
  public getCurrentVersion(): string {
    return getCurrentVersion();
  }

  /**
   * Add a listener for update events
   */
  public addUpdateListener(callback: (event: UpdateEvent) => void): () => void {
    this.updateListeners.add(callback);
    return () => {
      this.updateListeners.delete(callback);
    };
  }

  /**
   * Add a listener for download progress events
   */
  public addProgressListener(
    callback: (progress: DownloadProgress) => void,
  ): () => void {
    this.progressListeners.add(callback);
    return () => {
      this.progressListeners.delete(callback);
    };
  }

  /**
   * Notify all update listeners
   */
  private notifyListeners(event: UpdateEvent): void {
    this.updateListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error("Error notifying update listener", { error });
      }
    });
  }

  /**
   * Notify all progress listeners
   */
  private notifyProgressListeners(progress: DownloadProgress): void {
    this.progressListeners.forEach((listener) => {
      try {
        listener(progress);
      } catch (error) {
        logger.error("Error notifying progress listener", { error });
      }
    });
  }

  /**
   * Check if running in Electron
   */
  public isElectronEnvironment(): boolean {
    return isElectron();
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info("Cleaning up update service");
    this.unsubscribeFunctions.forEach((unsub) => unsub());
    this.unsubscribeFunctions = [];
    this.updateListeners.clear();
    this.progressListeners.clear();
  }
}

// Create and export a singleton instance
const updateService = new UpdateService();
export default updateService;
