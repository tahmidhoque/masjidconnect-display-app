/**
 * Remote Control Service
 *
 * Handles remote commands for device management.
 * Commands are received via heartbeat polling or WebSocket through realtimeMiddleware.
 * Supports commands: FORCE_UPDATE, RESTART_APP, RELOAD_CONTENT, CLEAR_CACHE,
 * UPDATE_SETTINGS, FACTORY_RESET, CAPTURE_SCREENSHOT
 */

import logger from "../utils/logger";
import apiClient from "../api/apiClient";
import localforage from "localforage";
import { analyticsService } from "./analyticsService";
import type { RemoteCommand as ApiRemoteCommand } from "../api/models";

// Command types
const REMOTE_COMMAND_TYPES = {
  FORCE_UPDATE: "FORCE_UPDATE",
  RESTART_APP: "RESTART_APP",
  RELOAD_CONTENT: "RELOAD_CONTENT",
  CLEAR_CACHE: "CLEAR_CACHE",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  FACTORY_RESET: "FACTORY_RESET",
  CAPTURE_SCREENSHOT: "CAPTURE_SCREENSHOT",
  UPDATE_ORIENTATION: "UPDATE_ORIENTATION",
  REFRESH_PRAYER_TIMES: "REFRESH_PRAYER_TIMES",
  DISPLAY_MESSAGE: "DISPLAY_MESSAGE",
  REBOOT_DEVICE: "REBOOT_DEVICE",
};

export interface RemoteCommand {
  type: keyof typeof REMOTE_COMMAND_TYPES;
  payload?: any;
  timestamp: string;
  commandId: string;
}

export interface RemoteCommandResponse {
  commandId: string;
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
  executionTime?: number;
}

class RemoteControlService {
  private commandListeners: Set<(command: RemoteCommand) => void> = new Set();
  private lastCommandTimestamp: Record<string, number> = {};
  private commandCooldownMs = 2000; // 2 seconds cooldown between commands
  private commandQueue: RemoteCommand[] = [];
  private commandsInProgress: Set<string> = new Set();
  private maxStoredResponses = 50;
  private processedCommandIds: Set<string> = new Set();
  private commandIdCleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Handle a remote command from heartbeat or WebSocket
   */
  public async handleCommandFromHeartbeat(
    command: ApiRemoteCommand,
  ): Promise<void> {
    logger.info("RemoteControlService: Processing command", {
      commandId: command.commandId,
      type: command.type,
    });
    console.log("📥 [RemoteControlService] handleCommandFromHeartbeat called", {
      commandId: command.commandId,
      type: command.type,
      payload: command.payload,
      fullCommand: command,
    });

    // Don't process commands when offline
    if (!navigator.onLine) {
      logger.warn("RemoteControlService: Ignoring command - device is offline");
      console.warn("⚠️ [RemoteControlService] Device is offline, ignoring command");
      return;
    }
    console.log("✅ [RemoteControlService] Device is online, proceeding...");

    // Validate command
    if (!command || !command.type || !command.commandId) {
      logger.warn("RemoteControlService: Invalid command format", {
        command,
        hasType: !!command?.type,
        hasCommandId: !!command?.commandId,
      });
      console.error("❌ [RemoteControlService] Invalid command format", {
        command,
        hasCommand: !!command,
        hasType: !!command?.type,
        hasCommandId: !!command?.commandId,
      });
      return;
    }
    console.log("✅ [RemoteControlService] Command validation passed");

    // Check for duplicate command IDs
    if (this.processedCommandIds.has(command.commandId)) {
      logger.warn("RemoteControlService: Duplicate command detected, skipping", {
        commandId: command.commandId,
        type: command.type,
      });
      console.warn("⚠️ [RemoteControlService] Duplicate command, already processed", {
        commandId: command.commandId,
      });
      return;
    }
    console.log("✅ [RemoteControlService] Not a duplicate, continuing...");

    // Check cooldown to prevent command spam
    const now = Date.now();
    const lastTime = this.lastCommandTimestamp[command.type] || 0;

    if (now - lastTime < this.commandCooldownMs) {
      logger.warn("RemoteControlService: Command throttled", {
        type: command.type,
        cooldown: this.commandCooldownMs,
        commandId: command.commandId,
      });

      // Queue command instead of dropping it
      this.commandQueue.push(command as RemoteCommand);

      // Dispatch throttled event for UI feedback
      window.dispatchEvent(
        new CustomEvent("remote:command-throttled", {
          detail: {
            type: command.type,
            commandId: command.commandId,
            queued: true,
          },
        }),
      );

      // Process queue after cooldown period
      setTimeout(() => {
        this.processCommandQueue();
      }, this.commandCooldownMs - (now - lastTime));

      return;
    }

    // Mark command as processed BEFORE execution
    this.processedCommandIds.add(command.commandId);

    // Schedule cleanup of command ID after 5 seconds
    const cleanupTimer = setTimeout(() => {
      this.processedCommandIds.delete(command.commandId);
      this.commandIdCleanupTimers.delete(command.commandId);
    }, 5000);
    this.commandIdCleanupTimers.set(command.commandId, cleanupTimer);

    this.lastCommandTimestamp[command.type] = now;

    // Execute command
    console.log("🚀 [RemoteControlService] Executing command...", { type: command.type });
    const internalCommand = command as RemoteCommand;
    await this.executeCommand(internalCommand);
    console.log("✅ [RemoteControlService] Command executed");

    // Notify listeners
    console.log("📢 [RemoteControlService] Notifying listeners...");
    this.notifyListeners(internalCommand);
    console.log("✅ [RemoteControlService] Listeners notified");

    // Process any queued commands
    this.processCommandQueue();
  }

  /**
   * Execute a remote command
   */
  private async executeCommand(command: RemoteCommand): Promise<void> {
    const startTime = Date.now();

    // Check if command is already in progress
    if (this.commandsInProgress.has(command.commandId)) {
      logger.warn("RemoteControlService: Command already in progress", {
        commandId: command.commandId,
        type: command.type,
      });
      return;
    }

    // Mark command as in progress
    this.commandsInProgress.add(command.commandId);

    logger.info("RemoteControlService: Executing command", {
      type: command.type,
      commandId: command.commandId,
    });

    let response: RemoteCommandResponse;

    try {
      switch (command.type) {
        case REMOTE_COMMAND_TYPES.FORCE_UPDATE:
          response = await this.handleForceUpdate(command);
          break;

        case REMOTE_COMMAND_TYPES.RESTART_APP:
        case "RESTART_APP":
          logger.info("RemoteControlService: Matched RESTART_APP case");
          response = await this.handleRestartApp(command);
          break;

        case REMOTE_COMMAND_TYPES.RELOAD_CONTENT:
          response = await this.handleReloadContent(command);
          break;

        case REMOTE_COMMAND_TYPES.CLEAR_CACHE:
          response = await this.handleClearCache(command);
          break;

        case REMOTE_COMMAND_TYPES.UPDATE_SETTINGS:
          response = await this.handleUpdateSettings(command);
          break;

        case REMOTE_COMMAND_TYPES.FACTORY_RESET:
          response = await this.handleFactoryReset(command);
          break;

        case REMOTE_COMMAND_TYPES.CAPTURE_SCREENSHOT:
          response = await this.handleCaptureScreenshot(command);
          break;

        case REMOTE_COMMAND_TYPES.UPDATE_ORIENTATION:
          response = await this.handleUpdateOrientation(command);
          break;

        case REMOTE_COMMAND_TYPES.REFRESH_PRAYER_TIMES:
          response = await this.handleRefreshPrayerTimes(command);
          break;

        case REMOTE_COMMAND_TYPES.DISPLAY_MESSAGE:
          response = await this.handleDisplayMessage(command);
          break;

        case REMOTE_COMMAND_TYPES.REBOOT_DEVICE:
          response = await this.handleRebootDevice(command);
          break;

        default:
          response = {
            commandId: command.commandId,
            success: false,
            error: `Unknown command type: ${command.type}`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
          };
      }

      response.executionTime = Date.now() - startTime;
      this.sendCommandResponse(response);

      // Dispatch success event
      window.dispatchEvent(
        new CustomEvent("remote:command-completed", {
          detail: {
            commandId: command.commandId,
            success: response.success,
            type: command.type,
          },
        }),
      );
    } catch (error: any) {
      logger.error("RemoteControlService: Error executing command", {
        error,
        command,
      });

      response = {
        commandId: command.commandId,
        success: false,
        error: error.message || "Command execution failed",
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
      };

      this.sendCommandResponse(response);
    } finally {
      this.commandsInProgress.delete(command.commandId);
    }
  }

  /**
   * Force Update Handler
   */
  private async handleForceUpdate(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Force update command received", {
      commandId: command.commandId,
    });

    try {
      if (command.payload && typeof command.payload !== "object") {
        throw new Error("Invalid command payload format");
      }

      const isElectron =
        typeof window !== "undefined" &&
        window.electron !== undefined &&
        window.electron.ipcRenderer !== undefined;

      if (!isElectron) {
        return {
          commandId: command.commandId,
          success: false,
          error: "Update service not available (not running in Electron)",
          timestamp: new Date().toISOString(),
        };
      }

      try {
        const updateState =
          await window.electron!.ipcRenderer!.invoke("get-update-state");

        if (updateState?.status === "downloaded") {
          window.dispatchEvent(
            new CustomEvent("remote:force-update", {
              detail: {
                commandId: command.commandId,
                action: "installing",
                version: updateState.version,
              },
            }),
          );

          const installResult = await window.electron!.updater!.installUpdate();

          if (!installResult.success) {
            return {
              commandId: command.commandId,
              success: false,
              error: installResult.error || "Failed to install downloaded update",
              timestamp: new Date().toISOString(),
            };
          }

          return {
            commandId: command.commandId,
            success: true,
            message: `Installing update ${updateState.version} immediately`,
            timestamp: new Date().toISOString(),
          };
        }

        const result =
          await window.electron!.ipcRenderer!.invoke("check-for-updates");

        if (!result.success) {
          return {
            commandId: command.commandId,
            success: false,
            error: result.error || "Failed to check for updates",
            timestamp: new Date().toISOString(),
          };
        }

        window.dispatchEvent(
          new CustomEvent("remote:force-update", {
            detail: { commandId: command.commandId, action: "checking" },
          }),
        );

        return {
          commandId: command.commandId,
          success: true,
          message: "Update check initiated",
          timestamp: new Date().toISOString(),
        };
      } catch (ipcError: any) {
        throw new Error(`Force update failed: ${ipcError.message || "Unknown error"}`);
      }
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Force update failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Restart App Handler
   */
  private async handleRestartApp(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Restart app command received", {
      commandId: command.commandId,
    });

    try {
      window.dispatchEvent(
        new CustomEvent("remote:restart-app", {
          detail: {
            commandId: command.commandId,
            countdown: command.payload?.countdown || 10,
          },
        }),
      );

      return {
        commandId: command.commandId,
        success: true,
        message: "Restart initiated with countdown",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Restart app failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Reload Content Handler
   */
  private async handleReloadContent(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Reload content command received", {
      commandId: command.commandId,
    });

    try {
      apiClient.clearCache();

      logger.info("RemoteControlService: Dispatching remote:reload-content event", {
        commandId: command.commandId,
      });
      console.log("🚀 [RemoteControlService] Dispatching event: remote:reload-content", {
        commandId: command.commandId,
      });
      
      window.dispatchEvent(
        new CustomEvent("remote:reload-content", {
          detail: { commandId: command.commandId },
        }),
      );
      
      console.log("✅ [RemoteControlService] Event dispatched: remote:reload-content");

      return {
        commandId: command.commandId,
        success: true,
        message: "Content reload initiated",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Reload content failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear Cache Handler
   */
  private async handleClearCache(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Clear cache command received", {
      commandId: command.commandId,
    });

    try {
      await localforage.clear();
      logger.info("Cleared localforage");

      const preserveKeys = [
        "masjid_api_key",
        "masjid_screen_id",
        "apiKey",
        "screenId",
        "device_id",
        "masjidconnect_credentials",
        "isPaired",
        "masjidconnect-root",
      ];

      const allKeys = Object.keys(localStorage);
      const keysToRemove: string[] = [];

      allKeys.forEach((key) => {
        if (!preserveKeys.includes(key)) {
          keysToRemove.push(key);
          localStorage.removeItem(key);
        }
      });

      logger.info("Cleared localStorage (preserved credentials)");

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        logger.info("Cleared service worker caches");
      }

      apiClient.clearCache();
      this.cleanup();

      window.dispatchEvent(
        new CustomEvent("remote:clear-cache", {
          detail: { commandId: command.commandId },
        }),
      );

      setTimeout(() => {
        window.location.reload();
      }, 2000);

      return {
        commandId: command.commandId,
        success: true,
        message: "Cache cleared successfully. App will reload.",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Clear cache failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update Settings Handler
   */
  private async handleUpdateSettings(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Update settings command received", {
      commandId: command.commandId,
    });

    try {
      if (!command.payload || !command.payload.settings) {
        return {
          commandId: command.commandId,
          success: false,
          error: "No settings provided",
          timestamp: new Date().toISOString(),
        };
      }

      const settings = command.payload.settings;
      const allowedSettings = ["orientation", "brightness", "autoUpdate", "displaySchedule"];
      const receivedKeys = Object.keys(settings);

      const invalidKeys = receivedKeys.filter(
        (key) => !allowedSettings.includes(key),
      );
      if (invalidKeys.length > 0) {
        return {
          commandId: command.commandId,
          success: false,
          error: `Invalid settings keys: ${invalidKeys.join(", ")}`,
          timestamp: new Date().toISOString(),
        };
      }

      Object.entries(settings).forEach(([key, value]) => {
        localStorage.setItem(`setting_${key}`, JSON.stringify(value));
      });

      window.dispatchEvent(
        new CustomEvent("remote:update-settings", {
          detail: { commandId: command.commandId, settings },
        }),
      );

      return {
        commandId: command.commandId,
        success: true,
        message: `Settings updated: ${receivedKeys.join(", ")}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Update settings failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Factory Reset Handler
   */
  private async handleFactoryReset(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Factory reset command received", {
      commandId: command.commandId,
    });

    try {
      window.dispatchEvent(
        new CustomEvent("remote:factory-reset", {
          detail: {
            commandId: command.commandId,
            countdown: command.payload?.countdown || 30,
          },
        }),
      );

      return {
        commandId: command.commandId,
        success: true,
        message: "Factory reset initiated with 30-second countdown",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Factory reset failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Capture Screenshot Handler
   */
  private async handleCaptureScreenshot(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Capture screenshot command received", {
      commandId: command.commandId,
    });

    try {
      const html2canvas = await import("html2canvas");

      const canvas = await html2canvas.default(document.body, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        scale: 0.5,
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob: Blob | null) => resolve(blob), "image/jpeg", 0.8);
      });

      if (!blob) {
        throw new Error("Failed to create screenshot blob");
      }

      const base64 = await this.blobToBase64(blob);

      localStorage.setItem("last_screenshot", base64);
      localStorage.setItem("last_screenshot_timestamp", new Date().toISOString());

      window.dispatchEvent(
        new CustomEvent("remote:screenshot-captured", {
          detail: { commandId: command.commandId },
        }),
      );

      return {
        commandId: command.commandId,
        success: true,
        message: "Screenshot captured successfully",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Screenshot capture failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update Orientation Handler
   */
  private async handleUpdateOrientation(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Update orientation command received", {
      commandId: command.commandId,
    });

    try {
      if (!command.payload || typeof command.payload !== "object") {
        return {
          commandId: command.commandId,
          success: false,
          error: "No orientation payload provided",
          timestamp: new Date().toISOString(),
        };
      }

      const orientation = (command.payload as Record<string, unknown>).orientation;
      if (typeof orientation !== "string") {
        return {
          commandId: command.commandId,
          success: false,
          error: "Invalid orientation value",
          timestamp: new Date().toISOString(),
        };
      }

      const normalizedOrientation = orientation.toUpperCase();
      if (normalizedOrientation !== "LANDSCAPE" && normalizedOrientation !== "PORTRAIT") {
        return {
          commandId: command.commandId,
          success: false,
          error: `Invalid orientation: ${orientation}. Must be LANDSCAPE or PORTRAIT`,
          timestamp: new Date().toISOString(),
        };
      }

      // Store in localStorage
      localStorage.setItem("screen_orientation", normalizedOrientation);

      // Dispatch custom event for React components
      window.dispatchEvent(
        new CustomEvent("orientation-changed", {
          detail: {
            orientation: normalizedOrientation,
            timestamp: Date.now(),
            source: "remote-command",
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("remote:update-orientation", {
          detail: { commandId: command.commandId, orientation: normalizedOrientation },
        }),
      );

      return {
        commandId: command.commandId,
        success: true,
        message: `Orientation updated to ${normalizedOrientation}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Update orientation failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Refresh Prayer Times Handler
   */
  private async handleRefreshPrayerTimes(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Refresh prayer times command received", {
      commandId: command.commandId,
    });

    try {
      window.dispatchEvent(
        new CustomEvent("remote:refresh-prayer-times", {
          detail: { commandId: command.commandId },
        }),
      );

      return {
        commandId: command.commandId,
        success: true,
        message: "Prayer times refresh initiated",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Refresh prayer times failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Display Message Handler
   */
  private async handleDisplayMessage(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Display message command received", {
      commandId: command.commandId,
    });

    try {
      if (!command.payload || typeof command.payload !== "object") {
        return {
          commandId: command.commandId,
          success: false,
          error: "No message payload provided",
          timestamp: new Date().toISOString(),
        };
      }

      window.dispatchEvent(
        new CustomEvent("remote:display-message", {
          detail: { commandId: command.commandId, ...command.payload },
        }),
      );

      return {
        commandId: command.commandId,
        success: true,
        message: "Message display initiated",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Display message failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Reboot Device Handler
   */
  private async handleRebootDevice(
    command: RemoteCommand,
  ): Promise<RemoteCommandResponse> {
    logger.info("RemoteControlService: Reboot device command received", {
      commandId: command.commandId,
    });

    try {
      window.dispatchEvent(
        new CustomEvent("remote:reboot-device", {
          detail: {
            commandId: command.commandId,
            countdown: command.payload?.countdown || 5,
          },
        }),
      );

      // For Electron apps - use ipcRenderer if available
      const isElectron =
        typeof window !== "undefined" &&
        window.electron !== undefined &&
        window.electron.app !== undefined;

      if (isElectron && window.electron?.app?.relaunch) {
        setTimeout(() => {
          window.electron!.app!.relaunch();
          window.electron!.app!.exit();
        }, (command.payload?.countdown || 5) * 1000);
      } else {
        // Fallback: reload the page
        setTimeout(() => {
          window.location.reload();
        }, (command.payload?.countdown || 5) * 1000);
      }

      return {
        commandId: command.commandId,
        success: true,
        message: "Reboot initiated",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || "Reboot device failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Convert blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Send command response back to portal
   */
  private sendCommandResponse(response: RemoteCommandResponse): void {
    logger.info("RemoteControlService: Sending command response", response);

    try {
      const storedResponses = localStorage.getItem("pending_command_responses");
      const responses: RemoteCommandResponse[] = storedResponses
        ? JSON.parse(storedResponses)
        : [];

      responses.push(response);

      if (responses.length > this.maxStoredResponses) {
        responses.splice(0, responses.length - this.maxStoredResponses);
      }

      localStorage.setItem("pending_command_responses", JSON.stringify(responses));

      try {
        if (analyticsService && typeof (analyticsService as any).sendHeartbeat === "function") {
          setTimeout(() => {
            (analyticsService as any).sendHeartbeat().catch(() => {});
          }, 100);
        }
      } catch {
        // Silently fail - heartbeat will be sent on next interval
      }
    } catch (error: any) {
      logger.error("RemoteControlService: Error storing command response", {
        error: error.message || error,
        response,
      });
    }
  }

  /**
   * Add a listener for remote commands
   */
  public addListener(callback: (command: RemoteCommand) => void): () => void {
    this.commandListeners.add(callback);
    return () => {
      this.commandListeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of a command
   */
  private notifyListeners(command: RemoteCommand): void {
    this.commandListeners.forEach((listener) => {
      try {
        listener(command);
      } catch (error) {
        logger.error("RemoteControlService: Error notifying listener", { error });
      }
    });
  }

  /**
   * Process queued commands after cooldown period
   */
  private processCommandQueue(): void {
    if (this.commandQueue.length === 0) {
      return;
    }

    const now = Date.now();
    const command = this.commandQueue.shift();

    if (!command) {
      return;
    }

    const lastTime = this.lastCommandTimestamp[command.type] || 0;

    if (now - lastTime >= this.commandCooldownMs) {
      this.lastCommandTimestamp[command.type] = now;
      this.executeCommand(command);
      this.notifyListeners(command);

      setTimeout(() => {
        this.processCommandQueue();
      }, this.commandCooldownMs);
    } else {
      this.commandQueue.unshift(command);
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info("RemoteControlService: Cleaning up");

    this.commandIdCleanupTimers.forEach((timer) => clearTimeout(timer));
    this.commandIdCleanupTimers.clear();

    this.commandListeners.clear();
    this.commandQueue = [];
    this.commandsInProgress.clear();
    this.processedCommandIds.clear();
  }
}

const remoteControlService = new RemoteControlService();
export default remoteControlService;
