import logger from "./logger";

// Utility interfaces
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface NavigatorConnection {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface ExtendedNavigator extends Navigator {
  memory?: MemoryInfo;
  connection?: NavigatorConnection;
  mozConnection?: NavigatorConnection;
  webkitConnection?: NavigatorConnection;
}

declare const window: Window & {
  performance: Performance & {
    memory?: MemoryInfo;
  };
};

/**
 * System metrics collection utilities for analytics
 */
export class SystemMetricsCollector {
  private lastCpuTime = 0;
  private lastTime = 0;
  private frameCount = 0;
  private lastFrameTime = Date.now();
  private currentFrameRate = 60; // Default assumption
  private contentErrors = 0;
  private currentContent = "";
  private lastContentLoadTime = 0;

  constructor() {
    this.initializeFrameRateMonitoring();
  }

  /**
   * Initialize frame rate monitoring
   */
  private initializeFrameRateMonitoring(): void {
    const updateFrameRate = () => {
      this.frameCount++;
      const currentTime = Date.now();

      if (currentTime - this.lastFrameTime >= 1000) {
        this.currentFrameRate = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = currentTime;
      }

      requestAnimationFrame(updateFrameRate);
    };

    requestAnimationFrame(updateFrameRate);
  }

  /**
   * Get CPU usage percentage (web approximation)
   * For web apps, we'll use a combination of performance timing and task processing
   */
  async getCPUUsage(): Promise<number> {
    try {
      // For web apps, we can approximate CPU usage using performance metrics
      if (typeof window !== "undefined" && window.performance) {
        const now = performance.now();
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;

        if (navigation) {
          // Calculate processing time as a percentage of total time
          const processingTime =
            navigation.loadEventEnd - navigation.fetchStart;
          const totalTime = now;

          // This is a rough approximation
          const cpuUsage = Math.min((processingTime / totalTime) * 100, 100);
          return Math.max(cpuUsage, 0);
        }
      }

      // If in Electron, try to get actual CPU usage
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI.getCPUUsage) {
          return await electronAPI.getCPUUsage();
        }
      }

      // Fallback: estimate based on recent performance
      return this.estimateCPUFromPerformance();
    } catch (error) {
      logger.error("Failed to get CPU usage", { error });
      return 0;
    }
  }

  /**
   * Estimate CPU usage from performance metrics
   */
  private estimateCPUFromPerformance(): number {
    try {
      // Use performance observer to estimate CPU load
      const entries = performance.getEntriesByType("measure");
      const recentEntries = entries.slice(-10); // Last 10 measurements

      if (recentEntries.length > 0) {
        const avgDuration =
          recentEntries.reduce((sum, entry) => sum + entry.duration, 0) /
          recentEntries.length;
        // Convert to a rough CPU percentage (this is an approximation)
        return Math.min(avgDuration / 10, 100);
      }

      return 15; // Default assumption for web apps
    } catch (error) {
      return 15;
    }
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsage(): number {
    try {
      const nav = navigator as ExtendedNavigator;

      // Try different memory APIs
      const memoryInfo = nav.memory || window.performance?.memory;

      if (memoryInfo) {
        const { usedJSHeapSize, jsHeapSizeLimit } = memoryInfo;
        return (usedJSHeapSize / jsHeapSizeLimit) * 100;
      }

      // If in Electron, try to get system memory
      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.getMemoryUsage
      ) {
        return (window as any).electronAPI.getMemoryUsage();
      }

      // Fallback estimate
      return 25; // Conservative estimate for web apps
    } catch (error) {
      logger.error("Failed to get memory usage", { error });
      return 25;
    }
  }

  /**
   * Get storage usage percentage
   */
  async getStorageUsage(): Promise<number> {
    try {
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage && estimate.quota) {
          return (estimate.usage / estimate.quota) * 100;
        }
      }

      // Fallback for older browsers or Electron
      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.getStorageUsage
      ) {
        return await (window as any).electronAPI.getStorageUsage();
      }

      return 10; // Conservative estimate
    } catch (error) {
      logger.error("Failed to get storage usage", { error });
      return 10;
    }
  }

  /**
   * Measure network latency
   * Note: We use heartbeat for connectivity checks instead of a separate ping endpoint
   * This method returns a default value since latency is tracked via heartbeat responses
   */
  async measureNetworkLatency(): Promise<number> {
    // Heartbeat already handles connectivity checks, so we don't need a separate ping
    // Return a default value to indicate latency measurement is handled elsewhere
    // Negative value indicates we're not actively measuring here
    return -1;
  }

  /**
   * Get bandwidth usage estimate
   */
  getBandwidthUsage(): number {
    try {
      const nav = navigator as ExtendedNavigator;
      const connection =
        nav.connection || nav.mozConnection || nav.webkitConnection;

      if (connection && connection.downlink) {
        return connection.downlink; // Returns Mbps
      }

      return 0; // Unknown
    } catch (error) {
      logger.error("Failed to get bandwidth usage", { error });
      return 0;
    }
  }

  /**
   * Get current frame rate
   */
  getFrameRate(): number {
    return this.currentFrameRate;
  }

  /**
   * Get display brightness (limited in web browsers)
   */
  async getDisplayBrightness(): Promise<number> {
    try {
      // Most browsers don't allow reading screen brightness for privacy
      // In Electron, we might have access to system APIs
      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.getDisplayBrightness
      ) {
        return await (window as any).electronAPI.getDisplayBrightness();
      }

      return 80; // Default assumption
    } catch (error) {
      logger.error("Failed to get display brightness", { error });
      return 80;
    }
  }

  /**
   * Get current screen resolution
   */
  getResolution(): string {
    try {
      return `${window.screen.width}x${window.screen.height}`;
    } catch (error) {
      logger.error("Failed to get resolution", { error });
      return "1920x1080"; // Default assumption
    }
  }

  /**
   * Get device temperature (limited availability)
   */
  async getTemperature(): Promise<number | undefined> {
    try {
      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.getTemperature
      ) {
        return await (window as any).electronAPI.getTemperature();
      }

      return undefined; // Not available in web browsers
    } catch (error) {
      logger.error("Failed to get temperature", { error });
      return undefined;
    }
  }

  /**
   * Get power consumption (limited availability)
   */
  async getPowerConsumption(): Promise<number | undefined> {
    try {
      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.getPowerConsumption
      ) {
        return await (window as any).electronAPI.getPowerConsumption();
      }

      return undefined; // Not available in web browsers
    } catch (error) {
      logger.error("Failed to get power consumption", { error });
      return undefined;
    }
  }

  /**
   * Get ambient light reading (limited availability)
   */
  async getAmbientLight(): Promise<number | undefined> {
    try {
      if ("AmbientLightSensor" in window) {
        // This is an experimental API, very limited browser support
        return undefined;
      }

      if (
        typeof window !== "undefined" &&
        (window as any).electronAPI?.getAmbientLight
      ) {
        return await (window as any).electronAPI.getAmbientLight();
      }

      return undefined;
    } catch (error) {
      logger.error("Failed to get ambient light", { error });
      return undefined;
    }
  }

  /**
   * Get signal strength
   */
  getSignalStrength(): number {
    try {
      const nav = navigator as ExtendedNavigator;
      const connection =
        nav.connection || nav.mozConnection || nav.webkitConnection;

      if (connection && connection.effectiveType) {
        // Map connection types to approximate signal strength
        switch (connection.effectiveType) {
          case "4g":
            return 90;
          case "3g":
            return 70;
          case "2g":
            return 50;
          case "slow-2g":
            return 30;
          default:
            return 80;
        }
      }

      return 80; // Default assumption
    } catch (error) {
      logger.error("Failed to get signal strength", { error });
      return 80;
    }
  }

  /**
   * Get connection type
   */
  getConnectionType(): string {
    try {
      const nav = navigator as ExtendedNavigator;
      const connection =
        nav.connection || nav.mozConnection || nav.webkitConnection;

      if (connection && connection.effectiveType) {
        // For web, we typically have wifi/cellular info
        return connection.effectiveType.includes("g") ? "cellular" : "wifi";
      }

      // Default assumption for display apps
      return "wifi";
    } catch (error) {
      logger.error("Failed to get connection type", { error });
      return "wifi";
    }
  }

  /**
   * Content tracking methods
   */
  setCurrentContent(contentId: string): void {
    this.currentContent = contentId;
  }

  getCurrentContent(): string {
    return this.currentContent;
  }

  setContentLoadTime(loadTime: number): void {
    this.lastContentLoadTime = loadTime;
  }

  getContentLoadTime(): number {
    return this.lastContentLoadTime;
  }

  incrementContentErrors(): void {
    this.contentErrors++;
  }

  getContentErrors(): number {
    return this.contentErrors;
  }

  resetContentErrors(): void {
    this.contentErrors = 0;
  }
}

// Create a singleton instance
export const systemMetrics = new SystemMetricsCollector();
