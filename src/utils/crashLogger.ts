import logger from "./logger";

interface CrashReport {
  timestamp: string;
  type:
    | "javascript_error"
    | "promise_rejection"
    | "component_error"
    | "network_error";
  error: string;
  stack?: string;
  componentStack?: string;
  userAgent: string;
  url: string;
  additionalInfo?: Record<string, any>;
}

class CrashLogger {
  private crashes: CrashReport[] = [];
  private maxCrashes = 50; // Keep last 50 crashes
  private isInitialized = false;

  public initialize(): void {
    if (this.isInitialized) return;

    this.setupGlobalErrorHandlers();
    this.setupPerformanceMonitoring();
    this.startPeriodicReporting();
    this.isInitialized = true;

    logger.info("CrashLogger initialized");
  }

  private setupGlobalErrorHandlers(): void {
    // Capture JavaScript errors
    const originalErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.logCrash({
        type: "javascript_error",
        error: message?.toString() || "Unknown JavaScript error",
        stack: error?.stack,
        additionalInfo: {
          source,
          lineno,
          colno,
          errorObject: error?.toString(),
        },
      });

      // Call original handler if it exists
      if (originalErrorHandler) {
        return originalErrorHandler.call(
          window,
          message,
          source,
          lineno,
          colno,
          error,
        );
      }
      return false;
    };

    // Capture unhandled promise rejections
    const originalRejectionHandler = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      this.logCrash({
        type: "promise_rejection",
        error: event.reason?.toString() || "Unhandled promise rejection",
        stack: event.reason?.stack,
        additionalInfo: {
          reason: event.reason,
          promise: event.promise?.toString(),
        },
      });

      // Call original handler if it exists
      if (originalRejectionHandler) {
        return originalRejectionHandler.call(window, event);
      }

      // Prevent default to avoid crashes
      event.preventDefault();
      return true;
    };
  }

  private setupPerformanceMonitoring(): void {
    // Monitor memory usage if available
    if ("memory" in (performance as any)) {
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
          this.logCrash({
            type: "javascript_error",
            error: "High memory usage detected",
            additionalInfo: {
              usedJSHeapSize: memory.usedJSHeapSize,
              totalJSHeapSize: memory.totalJSHeapSize,
              jsHeapSizeLimit: memory.jsHeapSizeLimit,
              usagePercentage: (
                (memory.usedJSHeapSize / memory.jsHeapSizeLimit) *
                100
              ).toFixed(2),
            },
          });
        }
      }, 30000); // Check every 30 seconds
    }

    // Monitor long tasks that could indicate performance issues
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 100) {
              // Tasks longer than 100ms
              this.logCrash({
                type: "javascript_error",
                error: `Long task detected: ${entry.duration.toFixed(2)}ms`,
                additionalInfo: {
                  duration: entry.duration,
                  startTime: entry.startTime,
                  entryType: entry.entryType,
                },
              });
            }
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch (error) {
        logger.debug("PerformanceObserver not supported for longtask", {
          error,
        });
      }
    }
  }

  private startPeriodicReporting(): void {
    // Report crashes every 5 minutes if any exist
    setInterval(() => {
      if (this.crashes.length > 0) {
        logger.error("Periodic crash report", {
          crashCount: this.crashes.length,
          recentCrashes: this.crashes.slice(-5), // Last 5 crashes
        });
      }
    }, 300000); // 5 minutes
  }

  public logCrash(crash: Partial<CrashReport>): void {
    const fullCrash: CrashReport = {
      timestamp: new Date().toISOString(),
      type: crash.type || "javascript_error",
      error: crash.error || "Unknown error",
      stack: crash.stack,
      componentStack: crash.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      additionalInfo: crash.additionalInfo,
    };

    this.crashes.push(fullCrash);

    // Keep only the last N crashes
    if (this.crashes.length > this.maxCrashes) {
      this.crashes = this.crashes.slice(-this.maxCrashes);
    }

    // Log immediately for debugging
    logger.error("Application crash detected", fullCrash);

    // Try to save to localStorage for persistence across restarts
    try {
      const existingCrashes = JSON.parse(
        localStorage.getItem("masjidconnect_crashes") || "[]",
      );
      existingCrashes.push(fullCrash);

      // Keep only last 20 in localStorage
      const crashesToSave = existingCrashes.slice(-20);
      localStorage.setItem(
        "masjidconnect_crashes",
        JSON.stringify(crashesToSave),
      );
    } catch (error) {
      logger.debug("Failed to save crash to localStorage", { error });
    }
  }

  public logComponentError(
    error: Error,
    errorInfo: { componentStack: string },
  ): void {
    this.logCrash({
      type: "component_error",
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      additionalInfo: {
        errorName: error.name,
        errorInfo,
      },
    });
  }

  public logNetworkError(error: any, url: string): void {
    this.logCrash({
      type: "network_error",
      error: error.message || "Network request failed",
      additionalInfo: {
        url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorCode: error.code,
        config: error.config,
      },
    });
  }

  public getCrashes(): CrashReport[] {
    return [...this.crashes];
  }

  public getCrashesFromStorage(): CrashReport[] {
    try {
      const storedCrashes = localStorage.getItem("masjidconnect_crashes");
      return storedCrashes ? JSON.parse(storedCrashes) : [];
    } catch (error) {
      logger.debug("Failed to retrieve crashes from localStorage", { error });
      return [];
    }
  }

  public clearCrashes(): void {
    this.crashes = [];
    try {
      localStorage.removeItem("masjidconnect_crashes");
    } catch (error) {
      logger.debug("Failed to clear crashes from localStorage", { error });
    }
  }

  public generateCrashReport(): string {
    const allCrashes = [...this.getCrashesFromStorage(), ...this.crashes];

    if (allCrashes.length === 0) {
      return "No crashes detected.";
    }

    const report = [
      "=== MasjidConnect Crash Report ===",
      `Generated: ${new Date().toISOString()}`,
      `Total Crashes: ${allCrashes.length}`,
      "",
      "=== Recent Crashes ===",
    ];

    // Group crashes by type
    const crashesByType = allCrashes.reduce(
      (acc, crash) => {
        acc[crash.type] = (acc[crash.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    report.push("Crash Types:");
    Object.entries(crashesByType).forEach(([type, count]) => {
      report.push(`  ${type}: ${count}`);
    });

    report.push("", "=== Last 10 Crashes ===");

    allCrashes.slice(-10).forEach((crash, index) => {
      report.push(
        `\n${index + 1}. [${crash.timestamp}] ${crash.type.toUpperCase()}`,
      );
      report.push(`   Error: ${crash.error}`);
      if (crash.stack) {
        report.push(`   Stack: ${crash.stack.split("\n")[0]}`);
      }
      if (crash.additionalInfo) {
        report.push(`   Info: ${JSON.stringify(crash.additionalInfo)}`);
      }
    });

    return report.join("\n");
  }
}

// Export singleton instance
export const crashLogger = new CrashLogger();
