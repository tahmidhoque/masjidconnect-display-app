import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import { refreshAllContent, refreshPrayerTimes } from "../slices/contentSlice";
import { setOrientation } from "../slices/uiSlice";
import { isLowPowerDevice, throttle } from "../../utils/performanceUtils";
import logger from "../../utils/logger";

// Performance monitoring
let actionCount = 0;
let lastPerformanceCheck = Date.now();
const PERFORMANCE_CHECK_INTERVAL = 5000; // Check every 5 seconds

export const performanceMiddleware = createListenerMiddleware();

// Throttle expensive actions on low-power devices
const throttledRefreshContent = throttle(
  (dispatch: any) => {
    dispatch(refreshAllContent({ forceRefresh: false }));
  },
  isLowPowerDevice() ? 15000 : 10000,
); // 15s for RPi vs 10s for others

// Monitor action frequency and warn about performance issues
performanceMiddleware.startListening({
  predicate: () => true, // Listen to all actions
  effect: (action, listenerApi) => {
    actionCount++;
    const now = Date.now();

    if (now - lastPerformanceCheck > PERFORMANCE_CHECK_INTERVAL) {
      const actionsPerSecond =
        actionCount / (PERFORMANCE_CHECK_INTERVAL / 1000);

      if (isLowPowerDevice() && actionsPerSecond > 2) {
        logger.warn("High action frequency detected on low-power device", {
          actionsPerSecond,
          actionCount,
          interval: PERFORMANCE_CHECK_INTERVAL,
        });
      }

      // Reset counters
      actionCount = 0;
      lastPerformanceCheck = now;
    }
  },
});

// Throttle content refresh actions on low-power devices
performanceMiddleware.startListening({
  matcher: isAnyOf(refreshAllContent.pending),
  effect: (action, listenerApi) => {
    if (isLowPowerDevice()) {
      const state = listenerApi.getState() as RootState;
      const lastUpdated = state.content.lastUpdated;

      if (lastUpdated) {
        const timeSinceLastUpdate =
          Date.now() - new Date(lastUpdated).getTime();
        const minInterval = 30000; // 30 seconds minimum on RPi

        if (timeSinceLastUpdate < minInterval) {
          logger.debug("Throttling content refresh on low-power device", {
            timeSinceLastUpdate,
            minInterval,
          });
          return; // Skip this refresh
        }
      }
    }
  },
});

// Batch state updates to reduce re-renders
let pendingUpdates: any[] = [];
let updateTimeout: NodeJS.Timeout | null = null;

const flushPendingUpdates = (listenerApi: any) => {
  if (pendingUpdates.length > 0) {
    logger.debug("Flushing batched updates", { count: pendingUpdates.length });
    // Process all pending updates
    pendingUpdates.forEach((update) => {
      // Apply the actual update
      listenerApi.dispatch(update);
    });
    pendingUpdates = [];
  }
  updateTimeout = null;
};

// Batch certain UI updates on low-power devices
performanceMiddleware.startListening({
  matcher: isAnyOf(setOrientation),
  effect: (action, listenerApi) => {
    if (isLowPowerDevice()) {
      // Batch UI updates to reduce re-render frequency
      pendingUpdates.push(action);

      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      updateTimeout = setTimeout(() => {
        flushPendingUpdates(listenerApi);
      }, 100); // Batch for 100ms
    }
  },
});

// Memory usage monitoring for low-power devices
if (
  isLowPowerDevice() &&
  window.performance &&
  (window.performance as any).memory
) {
  performanceMiddleware.startListening({
    predicate: () => true,
    effect: (action, listenerApi) => {
      const memoryInfo = (window.performance as any).memory;
      const usedMemoryMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
      const totalMemoryMB = memoryInfo.totalJSHeapSize / 1024 / 1024;
      const usagePercent = (usedMemoryMB / totalMemoryMB) * 100;

      if (usagePercent > 80) {
        logger.warn("High memory usage detected", {
          usedMemoryMB: usedMemoryMB.toFixed(2),
          totalMemoryMB: totalMemoryMB.toFixed(2),
          usagePercent: usagePercent.toFixed(1),
        });

        // Trigger garbage collection if available
        if (window.gc) {
          window.gc();
          logger.debug("Triggered garbage collection");
        }
      }
    },
  });
}

// Performance optimization for prayer time updates
performanceMiddleware.startListening({
  matcher: isAnyOf(refreshPrayerTimes.fulfilled),
  effect: (action, listenerApi) => {
    if (isLowPowerDevice()) {
      // Defer non-critical UI updates after prayer time changes
      setTimeout(() => {
        document.dispatchEvent(
          new CustomEvent("prayer-times-updated", {
            detail: action.payload,
          }),
        );
      }, 100);
    }
  },
});

export default performanceMiddleware;
