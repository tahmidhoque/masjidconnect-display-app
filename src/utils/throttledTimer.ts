import React from "react";

/**
 * Throttled Timer Utility
 *
 * Prevents multiple overlapping timers and optimizes countdown performance
 * by using a single global timer with throttled updates
 */

type TimerCallback = () => void;

interface TimerSubscription {
  id: string;
  callback: TimerCallback;
  interval: number;
  lastRun: number;
}

class ThrottledTimerManager {
  private subscriptions: Map<string, TimerSubscription> = new Map();
  private globalTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Subscribe to throttled timer updates
   */
  subscribe(
    id: string,
    callback: TimerCallback,
    interval: number = 1000,
  ): void {
    this.subscriptions.set(id, {
      id,
      callback,
      interval,
      lastRun: 0,
    });

    this.startGlobalTimer();
  }

  /**
   * Unsubscribe from timer updates
   */
  unsubscribe(id: string): void {
    this.subscriptions.delete(id);

    // Stop global timer if no more subscriptions
    if (this.subscriptions.size === 0) {
      this.stopGlobalTimer();
    }
  }

  /**
   * Start the global timer
   */
  private startGlobalTimer(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.globalTimer = setInterval(() => {
      this.runCallbacks();
    }, 100); // Run every 100ms for precision, but throttle individual callbacks
  }

  /**
   * Stop the global timer
   */
  private stopGlobalTimer(): void {
    if (this.globalTimer) {
      clearInterval(this.globalTimer);
      this.globalTimer = null;
    }
    this.isRunning = false;
  }

  /**
   * Run callbacks that are due for execution
   */
  private runCallbacks(): void {
    const now = Date.now();

    this.subscriptions.forEach((subscription) => {
      const timeSinceLastRun = now - subscription.lastRun;

      if (timeSinceLastRun >= subscription.interval) {
        try {
          subscription.callback();
          subscription.lastRun = now;
        } catch (error) {
          console.error(
            `ThrottledTimer callback error for ${subscription.id}:`,
            error,
          );
        }
      }
    });
  }

  /**
   * Get number of active subscriptions
   */
  getActiveCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions and stop timer
   */
  clear(): void {
    this.subscriptions.clear();
    this.stopGlobalTimer();
  }
}

// Export singleton instance
export const throttledTimer = new ThrottledTimerManager();

/**
 * React hook for using throttled timer
 */
export const useThrottledTimer = (
  callback: TimerCallback,
  interval: number = 1000,
  enabled: boolean = true,
) => {
  const idRef = React.useRef<string>("");
  const callbackRef = React.useRef<TimerCallback>(callback);

  // Update callback ref
  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (!enabled) return;

    // Generate unique ID
    const id = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    idRef.current = id;

    // Subscribe to throttled timer
    throttledTimer.subscribe(
      id,
      () => {
        callbackRef.current();
      },
      interval,
    );

    // Cleanup on unmount
    return () => {
      throttledTimer.unsubscribe(id);
    };
  }, [interval, enabled]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (idRef.current) {
        throttledTimer.unsubscribe(idRef.current);
      }
    };
  }, []);
};

export default throttledTimer;
