/**
 * WiFi Service
 *
 * Provides a TypeScript wrapper around the Electron WiFi API for managing
 * WiFi connections on Raspberry Pi devices running NetworkManager.
 *
 * This service is designed for keyboard-only operation on display devices.
 */

import logger from "../utils/logger";

// Types are available globally from global.d.ts
// Re-export them here for convenience in imports
export type WiFiNetworkType = WiFiNetwork;
export type WiFiStatusType = WiFiStatus;
export type CurrentNetworkType = CurrentNetwork;

/**
 * Connection status enum for clearer state management
 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed"
  | "unknown";

/**
 * Result of a WiFi scan operation
 */
export interface ScanResult {
  success: boolean;
  networks: WiFiNetwork[];
  error?: string;
}

/**
 * Result of a WiFi connection attempt
 */
export interface ConnectResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Result of getting WiFi status
 */
export interface StatusResult {
  success: boolean;
  status: WiFiStatus | null;
  error?: string;
}

/**
 * Result of getting current network
 */
export interface CurrentNetworkResult {
  success: boolean;
  network: CurrentNetwork | null;
  error?: string;
}

/**
 * WiFi Service class for managing WiFi connections
 */
class WiFiService {
  private isElectron: boolean;
  private lastScanResults: WiFiNetwork[] = [];
  private scanInProgress: boolean = false;

  constructor() {
    this.isElectron = typeof window !== "undefined" && !!window.electron?.wifi;
    logger.info(
      `[WiFiService] Initialised. Electron WiFi API available: ${this.isElectron}`,
    );
  }

  /**
   * Check if WiFi configuration is available on this system
   * Only available on Raspberry Pi with NetworkManager
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isElectron) {
      logger.debug("[WiFiService] Not running in Electron environment");
      return false;
    }

    try {
      const result = await window.electron!.wifi!.isAvailable();
      logger.info(`[WiFiService] WiFi availability: ${result.available}`);
      return result.available;
    } catch (error) {
      logger.error("[WiFiService] Error checking WiFi availability:", {
        error,
      });
      return false;
    }
  }

  /**
   * Scan for available WiFi networks
   * Returns networks sorted by signal strength
   */
  async scan(): Promise<ScanResult> {
    if (!this.isElectron) {
      return {
        success: false,
        networks: [],
        error: "WiFi scanning is only available on Raspberry Pi",
      };
    }

    // Prevent concurrent scans
    if (this.scanInProgress) {
      logger.warn("[WiFiService] Scan already in progress, returning cached");
      return { success: true, networks: this.lastScanResults };
    }

    this.scanInProgress = true;
    logger.info("[WiFiService] Starting network scan...");

    try {
      const result = await window.electron!.wifi!.scan();

      if (result.success && result.networks) {
        this.lastScanResults = result.networks;
        logger.info(
          `[WiFiService] Scan complete. Found ${result.networks.length} networks`,
        );
        return { success: true, networks: result.networks };
      }

      logger.warn("[WiFiService] Scan failed:", { error: result.error });
      return {
        success: false,
        networks: this.lastScanResults,
        error: result.error || "Scan failed",
      };
    } catch (error) {
      logger.error("[WiFiService] Scan error:", { error });
      return {
        success: false,
        networks: this.lastScanResults,
        error: error instanceof Error ? error.message : "Unknown scan error",
      };
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Connect to a WiFi network
   * @param ssid - The network SSID to connect to
   * @param password - The network password (optional for open networks)
   */
  async connect(ssid: string, password?: string): Promise<ConnectResult> {
    if (!this.isElectron) {
      return {
        success: false,
        error: "WiFi connection is only available on Raspberry Pi",
      };
    }

    if (!ssid || ssid.trim() === "") {
      return { success: false, error: "Network name (SSID) is required" };
    }

    logger.info(`[WiFiService] Attempting to connect to: ${ssid}`);

    try {
      const result = await window.electron!.wifi!.connect(
        ssid,
        password || "",
      );

      if (result.success) {
        logger.info(`[WiFiService] Successfully connected to: ${ssid}`);
        return {
          success: true,
          message: result.message || `Connected to ${ssid}`,
        };
      }

      logger.warn(`[WiFiService] Failed to connect to ${ssid}:`, { error: result.error });
      return { success: false, error: result.error || "Connection failed" };
    } catch (error) {
      logger.error(`[WiFiService] Connection error for ${ssid}:`, { error });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown connection error",
      };
    }
  }

  /**
   * Get the current WiFi/network status from NetworkManager
   */
  async getStatus(): Promise<StatusResult> {
    if (!this.isElectron) {
      return {
        success: true,
        status: {
          state: "unknown",
          connectivity: "unknown",
          wifi: "unavailable",
          wifiHw: "unavailable",
        },
      };
    }

    try {
      const result = await window.electron!.wifi!.getStatus();

      if (result.success && result.status) {
        logger.debug("[WiFiService] Status:", result.status);
        return { success: true, status: result.status };
      }

      return {
        success: false,
        status: null,
        error: result.error || "Failed to get status",
      };
    } catch (error) {
      logger.error("[WiFiService] Status error:", { error });
      return {
        success: false,
        status: null,
        error: error instanceof Error ? error.message : "Unknown status error",
      };
    }
  }

  /**
   * Get information about the currently connected network
   */
  async getCurrentNetwork(): Promise<CurrentNetworkResult> {
    if (!this.isElectron) {
      return { success: true, network: null };
    }

    try {
      const result = await window.electron!.wifi!.getCurrentNetwork();

      if (result.success) {
        if (result.network) {
          logger.debug(
            `[WiFiService] Currently connected to: ${result.network.ssid}`,
          );
        } else {
          logger.debug("[WiFiService] Not connected to any network");
        }
        return { success: true, network: result.network || null };
      }

      return {
        success: false,
        network: null,
        error: result.error || "Failed to get current network",
      };
    } catch (error) {
      logger.error("[WiFiService] getCurrentNetwork error:", { error });
      return {
        success: false,
        network: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown getCurrentNetwork error",
      };
    }
  }

  /**
   * Disconnect from the current WiFi network
   */
  async disconnect(): Promise<ConnectResult> {
    if (!this.isElectron) {
      return {
        success: false,
        error: "WiFi disconnect is only available on Raspberry Pi",
      };
    }

    logger.info("[WiFiService] Disconnecting from current network...");

    try {
      const result = await window.electron!.wifi!.disconnect();

      if (result.success) {
        logger.info("[WiFiService] Successfully disconnected");
        return {
          success: true,
          message: result.message || "Disconnected from WiFi",
        };
      }

      logger.warn("[WiFiService] Disconnect failed:", { error: result.error });
      return { success: false, error: result.error || "Disconnect failed" };
    } catch (error) {
      logger.error("[WiFiService] Disconnect error:", { error });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown disconnect error",
      };
    }
  }

  /**
   * Check if we have internet connectivity
   * This checks both WiFi connection and actual internet access
   */
  async hasInternetConnectivity(): Promise<boolean> {
    // First check if we're in electron and can use WiFi API
    if (this.isElectron) {
      const statusResult = await this.getStatus();
      if (
        statusResult.success &&
        statusResult.status?.connectivity === "full"
      ) {
        return true;
      }
    }

    // Fallback: check navigator.onLine and try to reach a known endpoint
    if (!navigator.onLine) {
      return false;
    }

    // Try to actually reach the internet
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("https://1.1.1.1", {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached scan results without performing a new scan
   */
  getCachedNetworks(): WiFiNetwork[] {
    return [...this.lastScanResults];
  }

  /**
   * Get signal strength as a descriptive label
   */
  static getSignalStrengthLabel(signal: number): string {
    if (signal >= 80) return "Excellent";
    if (signal >= 60) return "Good";
    if (signal >= 40) return "Fair";
    if (signal >= 20) return "Weak";
    return "Very Weak";
  }

  /**
   * Get signal strength as number of bars (0-4)
   */
  static getSignalBars(signal: number): number {
    if (signal >= 80) return 4;
    if (signal >= 60) return 3;
    if (signal >= 40) return 2;
    if (signal >= 20) return 1;
    return 0;
  }

  /**
   * Check if a network requires a password
   */
  static requiresPassword(security: string): boolean {
    const securityLower = security.toLowerCase();
    return (
      securityLower !== "open" &&
      securityLower !== "--" &&
      securityLower !== ""
    );
  }
}

// Export singleton instance
export const wifiService = new WiFiService();

// Export class for static method access
export { WiFiService };

export default wifiService;

