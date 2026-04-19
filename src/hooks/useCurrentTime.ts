import { useState, useEffect, useRef, useCallback } from "react";
import logger from '@/utils/logger';

/**
 * Global time manager to prevent multiple timer conflicts
 * Uses a single timer that all components can subscribe to
 */
class GlobalTimeManager {
  private currentTime: Date = new Date();
  private subscribers: Set<(time: Date) => void> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Subscribe to time updates
   */
  subscribe(callback: (time: Date) => void): () => void {
    this.subscribers.add(callback);

    // Start timer if this is the first subscription
    if (!this.isRunning) {
      this.startTimer();
    }

    // Return current time immediately
    callback(this.currentTime);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);

      // Stop timer if no more subscribers
      if (this.subscribers.size === 0) {
        this.stopTimer();
      }
    };
  }

  /**
   * Start the global timer
   */
  private startTimer(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Use a more precise timer approach
    const updateTime = () => {
      this.currentTime = new Date();

      // Notify all subscribers
      this.subscribers.forEach((callback) => {
        try {
          callback(this.currentTime);
        } catch (error) {
          logger.error('[GlobalTimeManager] Subscriber callback failed', { error: error instanceof Error ? error.message : String(error) });
        }
      });
    };

    // Update immediately
    updateTime();

    // Set up interval - use more precise timing
    this.timer = setInterval(updateTime, 1000);
  }

  /**
   * Stop the global timer
   */
  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  /**
   * Get current time synchronously
   */
  getCurrentTime(): Date {
    return this.currentTime;
  }

  /**
   * Get number of active subscribers
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Force time update (useful for testing)
   */
  forceUpdate(): void {
    if (this.isRunning) {
      this.currentTime = new Date();
      this.subscribers.forEach((callback) => {
        try {
          callback(this.currentTime);
        } catch (error) {
          logger.error('[GlobalTimeManager] Subscriber callback failed', { error: error instanceof Error ? error.message : String(error) });
        }
      });
    }
  }
}

// Create singleton instance
const globalTimeManager = new GlobalTimeManager();

/**
 * Hook to get current time with centralized timer management
 * Prevents multiple timer conflicts that cause skipped seconds
 */
export const useCurrentTime = (): Date => {
  const [currentTime, setCurrentTime] = useState(() =>
    globalTimeManager.getCurrentTime(),
  );
  const callbackRef = useRef<(time: Date) => void>();

  // Create stable callback reference
  const updateTime = useCallback((time: Date) => {
    setCurrentTime(time);
  }, []);

  useEffect(() => {
    callbackRef.current = updateTime;
  }, [updateTime]);

  useEffect(() => {
    // Subscribe to global time manager
    const unsubscribe = globalTimeManager.subscribe((time: Date) => {
      if (callbackRef.current) {
        callbackRef.current(time);
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  return currentTime;
};

/**
 * Hook to get time manager statistics (for debugging)
 */
export const useTimeManagerStats = () => {
  const [stats, setStats] = useState({
    subscriberCount: 0,
    isRunning: false,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        subscriberCount: globalTimeManager.getSubscriberCount(),
        isRunning: globalTimeManager.getSubscriberCount() > 0,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return stats;
};

// Export for direct access if needed
export { globalTimeManager };

export default useCurrentTime;
