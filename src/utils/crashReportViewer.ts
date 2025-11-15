import { crashLogger } from "./crashLogger";
import logger from "./logger";

/**
 * Browser console interface for viewing crash reports
 * Use in browser console: window.MasjidConnectDebug.showCrashes()
 */
class CrashReportViewer {
  public showCrashes(): void {
    const report = crashLogger.generateCrashReport();
    console.log("\n🔍 MASJIDCONNECT CRASH REPORT\n" + "=".repeat(50));
    console.log(report);
    console.log("=".repeat(50));
  }

  public showRecentCrashes(count: number = 5): void {
    const crashes = crashLogger.getCrashes();
    const storedCrashes = crashLogger.getCrashesFromStorage();
    const allCrashes = [...storedCrashes, ...crashes];

    console.log(`\n📊 Last ${count} crashes:`);
    allCrashes.slice(-count).forEach((crash, index) => {
      console.log(`\n${index + 1}. [${crash.timestamp}] ${crash.type}`);
      console.log(`   Error: ${crash.error}`);
      if (crash.additionalInfo) {
        console.log(`   Details:`, crash.additionalInfo);
      }
    });
  }

  public clearCrashes(): void {
    crashLogger.clearCrashes();
    console.log("✅ All crash logs cleared");
  }

  public downloadCrashReport(): void {
    const report = crashLogger.generateCrashReport();
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `masjidconnect-crash-report-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("📥 Crash report downloaded");
  }

  public showSystemInfo(): void {
    console.log("\n🖥️ SYSTEM INFORMATION\n" + "-".repeat(30));
    console.log("User Agent:", navigator.userAgent);
    console.log("Platform:", navigator.platform);
    console.log("Language:", navigator.language);
    console.log("Online:", navigator.onLine);
    console.log("URL:", window.location.href);

    if ("memory" in (performance as any)) {
      const memory = (performance as any).memory;
      console.log("\n💾 MEMORY USAGE:");
      console.log(
        `Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
      );
    }

    console.log("\n🕰️ TIMING:");
    console.log(
      "Page Load Time:",
      performance.timing.loadEventEnd - performance.timing.navigationStart,
      "ms",
    );
    console.log(
      "DOM Ready Time:",
      performance.timing.domContentLoadedEventEnd -
        performance.timing.navigationStart,
      "ms",
    );
  }

  public testCrash(): void {
    console.log("🧪 Testing crash logging...");

    // Test JavaScript error
    crashLogger.logCrash({
      type: "javascript_error",
      error: "Test error for debugging",
      additionalInfo: {
        source: "manual_test",
        timestamp: new Date().toISOString(),
      },
    });

    console.log("✅ Test crash logged. Check with showCrashes()");
  }

  public monitorPerformance(duration: number = 60000): void {
    console.log(
      `🔍 Starting performance monitoring for ${duration / 1000} seconds...`,
    );

    const startTime = Date.now();
    const interval = setInterval(() => {
      if ("memory" in (performance as any)) {
        const memory = (performance as any).memory;
        const memoryUsageMB = memory.usedJSHeapSize / 1024 / 1024;
        const memoryLimitMB = memory.jsHeapSizeLimit / 1024 / 1024;
        const usagePercent = ((memoryUsageMB / memoryLimitMB) * 100).toFixed(1);

        console.log(
          `📊 Memory: ${memoryUsageMB.toFixed(1)}MB (${usagePercent}%)`,
        );

        if (memoryUsageMB > memoryLimitMB * 0.8) {
          console.warn("⚠️ High memory usage detected!");
        }
      }

      if (Date.now() - startTime >= duration) {
        clearInterval(interval);
        console.log("✅ Performance monitoring completed");
      }
    }, 5000); // Check every 5 seconds
  }

  public help(): void {
    console.log(`
🔧 MASJIDCONNECT DEBUG COMMANDS
===============================

📊 Crash Analysis:
• showCrashes()           - View full crash report
• showRecentCrashes(5)    - Show last 5 crashes
• clearCrashes()          - Clear all crash logs
• downloadCrashReport()   - Download report file

🖥️ System Information:
• showSystemInfo()        - Display system details
• monitorPerformance(60)  - Monitor for 60 seconds

🧪 Testing:
• testCrash()            - Log a test crash
• help()                 - Show this help

📝 Usage Example:
window.MasjidConnectDebug.showCrashes()
    `);
  }
}

// Create global debug interface
const crashReportViewer = new CrashReportViewer();

// Attach to window for console access
(window as any).MasjidConnectDebug = {
  showCrashes: () => crashReportViewer.showCrashes(),
  showRecentCrashes: (count?: number) =>
    crashReportViewer.showRecentCrashes(count),
  clearCrashes: () => crashReportViewer.clearCrashes(),
  downloadCrashReport: () => crashReportViewer.downloadCrashReport(),
  showSystemInfo: () => crashReportViewer.showSystemInfo(),
  testCrash: () => crashReportViewer.testCrash(),
  monitorPerformance: (duration?: number) =>
    crashReportViewer.monitorPerformance(duration),
  help: () => crashReportViewer.help(),
};

// Log availability in development
if (process.env.NODE_ENV === "development") {
  logger.info("🔧 Debug console available: window.MasjidConnectDebug.help()");
}

export default crashReportViewer;
