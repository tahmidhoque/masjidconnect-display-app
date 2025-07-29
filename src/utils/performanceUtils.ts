/**
 * Performance optimization utilities
 * 
 * This file contains utility functions to help optimize the application performance.
 * Enhanced for Raspberry Pi devices to reduce CPU and memory usage.
 */

import logger from './logger';

/**
 * Check if we're likely running on a Raspberry Pi device
 * This is a best-effort detection, not 100% accurate
 */
export const isLowPowerDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  // Check for common Raspberry Pi indicators
  if (userAgent.includes('linux arm') || userAgent.includes('armv7') || userAgent.includes('aarch64')) {
    return true;
  }
  
  // Check for limited memory/CPU which might indicate an RPi
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    return true;
  }
  
  // Check for memory constraints typically found on RPi
  if (window.performance && (window.performance as any).memory) {
    const memoryInfo = (window.performance as any).memory;
    if (memoryInfo.jsHeapSizeLimit && memoryInfo.jsHeapSizeLimit < 1073741824) { // Less than 1GB
      return true;
    }
  }
  
  return false;
};

/**
 * Check if we're running on a 4K display
 */
export const is4KDisplay = (): boolean => {
  const width = window.screen.width;
  const height = window.screen.height;
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Check for 4K resolution (3840x2160 or similar)
  const actualWidth = width * pixelRatio;
  const actualHeight = height * pixelRatio;
  
  return actualWidth >= 3840 || actualHeight >= 2160 || width >= 3840 || height >= 2160;
};

/**
 * Check if we're in a high-strain scenario (4K + Low Power)
 */
export const isHighStrainDevice = (): boolean => {
  return isLowPowerDevice() && is4KDisplay();
};

/**
 * Enhanced device detection with more specific performance characteristics
 */
export const getDevicePerformanceProfile = () => {
  const isLowPower = isLowPowerDevice();
  const is4K = is4KDisplay();
  const isHighStrain = isHighStrainDevice();
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (window.performance as any)?.memory?.jsHeapSizeLimit || 0;
  
  let profile: 'ultra-low' | 'low' | 'medium' | 'high' = 'high';
  
  if (isHighStrain) {
    // 4K on RPi is ultra-low performance scenario
    profile = 'ultra-low';
  } else if (isLowPower || cores <= 2 || memory < 536870912) { // Less than 512MB
    profile = 'low';
  } else if (cores <= 4 || memory < 1073741824) { // Less than 1GB
    profile = 'medium';
  }
  
  return {
    profile,
    cores,
    memory: memory / 1024 / 1024, // Convert to MB
    isLowPower,
    is4K,
    isHighStrain,
    screenResolution: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
    },
    recommendations: {
      animationDuration: profile === 'ultra-low' ? 0 : profile === 'low' ? 100 : profile === 'medium' ? 200 : 300,
      debounceDelay: profile === 'ultra-low' ? 1000 : profile === 'low' ? 500 : profile === 'medium' ? 300 : 150,
      throttleDelay: profile === 'ultra-low' ? 2000 : profile === 'low' ? 1000 : profile === 'medium' ? 500 : 250,
      maxConcurrentOperations: profile === 'ultra-low' ? 1 : profile === 'low' ? 1 : profile === 'medium' ? 2 : 4,
      // 4K specific optimizations
      enableHardwareAcceleration: !isHighStrain, // Disable for 4K RPi
      enableTransitions: !isHighStrain, // Disable transitions for 4K RPi
      enableAnimations: !isHighStrain, // Disable animations for 4K RPi
      loadingStrategy: isHighStrain ? 'progressive' : 'standard',
      renderBatching: isHighStrain ? 'aggressive' : 'normal',
    },
  };
};

/**
 * Enables hardware acceleration for the element by applying CSS properties
 * that trigger GPU acceleration, but only what's necessary based on device capability.
 * 
 * @param element - The DOM element to optimize
 */
export const enableHardwareAcceleration = (element: HTMLElement): void => {
  if (!element) return;
  
  const { profile } = getDevicePerformanceProfile();
  const style = element.style;
  
  if (profile === 'low') {
    // Minimal acceleration for low-power devices
    style.transform = 'translateZ(0)';
    style.backfaceVisibility = 'hidden';
    style.setProperty('-webkit-transform', 'translateZ(0)');
    style.setProperty('-webkit-backface-visibility', 'hidden');
  } else if (profile === 'medium') {
    // Moderate acceleration
    style.transform = 'translateZ(0)';
    style.backfaceVisibility = 'hidden';
    style.willChange = 'transform';
    style.setProperty('-webkit-transform', 'translateZ(0)');
    style.setProperty('-webkit-backface-visibility', 'hidden');
  } else {
    // Full acceleration for high-performance devices
    style.transform = 'translateZ(0)';
    style.backfaceVisibility = 'hidden';
    style.perspective = '1000px';
    style.willChange = 'transform, opacity';
    style.setProperty('-webkit-transform', 'translateZ(0)');
    style.setProperty('-webkit-backface-visibility', 'hidden');
    style.setProperty('-webkit-perspective', '1000px');
  }
};

/**
 * Optimizes all animation-related elements in the app
 * with special handling for Raspberry Pi devices
 */
export const optimizeAppPerformance = (): void => {
  const { profile, recommendations } = getDevicePerformanceProfile();
  console.log(`Optimizing for ${profile}-performance device`);
  
  // Optimize the main container
  const mainContainer = document.getElementById('root');
  if (mainContainer) {
    enableHardwareAcceleration(mainContainer);
  }

  // Apply CSS optimizations to body and html
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  // Apply performance class based on device profile
  document.body.classList.remove('low-power-device', 'medium-power-device', 'high-power-device');
  document.body.classList.add(`${profile}-power-device`);
  
  // Set CSS variables for performance tuning
  document.documentElement.style.setProperty('--transition-duration', `${recommendations.animationDuration}ms`);
  document.documentElement.style.setProperty('--animation-duration', `${recommendations.animationDuration * 2}ms`);
  document.documentElement.style.setProperty('--debounce-delay', `${recommendations.debounceDelay}ms`);

  // For low-power devices, be more selective about what gets hardware acceleration
  const criticalElements = profile === 'low'
    ? [
        document.body,
        ...Array.from(document.querySelectorAll('.MuiPaper-root')), // Only accelerate primary UI containers
      ]
    : [
        document.body,
        ...Array.from(document.querySelectorAll('.MuiBox-root'))
      ];
  
  criticalElements.forEach(el => {
    if (el instanceof HTMLElement) {
      enableHardwareAcceleration(el);
    }
  });

  // Optimize all images for rendering
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    img.decoding = 'async';
    img.loading = 'lazy';
    
    // Downscale images on low-power devices if they're large
    if (profile === 'low' && img.width > 500) {
      img.style.transform = 'scale(0.85)';
    }
  });
  
  // Additional optimizations for low-power devices
  if (profile === 'low') {
    // Disable smooth scrolling
    document.documentElement.style.scrollBehavior = 'auto';
    
    // Reduce animation complexity
    const style = document.createElement('style');
    style.textContent = `
      * {
        animation-duration: ${recommendations.animationDuration}ms !important;
        transition-duration: ${recommendations.animationDuration}ms !important;
      }
    `;
    document.head.appendChild(style);
  }
};

/**
 * Debounces a function call to limit how often it can be called
 * with special handling for low-power devices
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  const { recommendations } = getDevicePerformanceProfile();
  // Use device-appropriate debounce delay
  const adjustedWait = Math.max(wait, recommendations.debounceDelay);
  
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, adjustedWait);
  };
};

/**
 * Throttles a function to limit how often it can be called
 * with special handling for low-power devices
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  const { recommendations } = getDevicePerformanceProfile();
  // Use device-appropriate throttle delay
  const adjustedLimit = Math.max(limit, recommendations.throttleDelay);
  
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= adjustedLimit) {
      lastCall = now;
      func(...args);
    }
  };
};

/**
 * Uses requestAnimationFrame to schedule updates at the optimal time
 * for rendering performance
 * 
 * @param callback - The function to call on next animation frame
 * @returns A function to cancel the scheduled callback
 */
export const scheduleUpdate = (callback: () => void): () => void => {
  const frameId = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(frameId);
};

/**
 * Optimizes React component rendering by batching updates
 */
export const batchUpdates = (() => {
  let updateQueue: (() => void)[] = [];
  let isScheduled = false;

  const flushUpdates = () => {
    const updates = updateQueue;
    updateQueue = [];
    isScheduled = false;
    
    updates.forEach(update => update());
  };

  return (callback: () => void) => {
    updateQueue.push(callback);
    
    if (!isScheduled) {
      isScheduled = true;
      scheduleUpdate(flushUpdates);
    }
  };
})();

/**
 * Memory-aware component preloader for better perceived performance
 */
export class ComponentPreloader {
  private static preloadedComponents = new Map<string, any>();
  private static maxCacheSize = (() => {
    const profile = getDevicePerformanceProfile().profile;
    return profile === 'low' ? 3 : 10;
  })();

  static preload(componentName: string, componentLoader: () => Promise<any>) {
    if (this.preloadedComponents.has(componentName)) {
      return this.preloadedComponents.get(componentName);
    }

    if (this.preloadedComponents.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.preloadedComponents.keys().next().value;
      if (firstKey !== undefined) {
        this.preloadedComponents.delete(firstKey);
      }
    }

    const promise = componentLoader();
    this.preloadedComponents.set(componentName, promise);
    return promise;
  }

  static get(componentName: string) {
    return this.preloadedComponents.get(componentName);
  }

  static clear() {
    this.preloadedComponents.clear();
  }
}

/**
 * Performance monitor for tracking render performance
 */
export class PerformanceMonitor {
  private static renderTimes: number[] = [];
  private static maxSamples = 100;

  static startRender(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      this.renderTimes.push(renderTime);
      if (this.renderTimes.length > this.maxSamples) {
        this.renderTimes.shift();
      }

      if (renderTime > 16.67) { // More than one frame at 60fps
        console.warn(`Slow render detected for ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  }

  static getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    const sum = this.renderTimes.reduce((a, b) => a + b, 0);
    return sum / this.renderTimes.length;
  }

  static getPerformanceStats() {
    const avg = this.getAverageRenderTime();
    const profile = getDevicePerformanceProfile();
    
    return {
      averageRenderTime: avg,
      deviceProfile: profile,
      isPerformanceGood: avg < 16.67,
      samples: this.renderTimes.length,
    };
  }
}

/**
 * Memory management utilities for improved stability on low-power devices
 * Helps prevent app crashes and restarts on Raspberry Pi
 */
export class MemoryManager {
  private static cleanupCallbacks: Array<() => void> = [];
  private static isMonitoring = false;
  private static lastCleanup = Date.now();
  private static readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private static readonly MEMORY_THRESHOLD = 0.8; // 80% memory usage threshold

  /**
   * Register a cleanup callback to be called during memory pressure
   */
  static registerCleanupCallback(callback: () => void): () => void {
    this.cleanupCallbacks.push(callback);
    
    // Return unregister function
    return () => {
      const index = this.cleanupCallbacks.indexOf(callback);
      if (index > -1) {
        this.cleanupCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start memory monitoring for low-power devices
   */
  static startMonitoring(): void {
    if (this.isMonitoring || !isLowPowerDevice()) return;
    
    this.isMonitoring = true;
    
    // Check memory usage every 30 seconds
    const monitorInterval = setInterval(() => {
      try {
        this.checkMemoryUsage();
      } catch (error) {
        console.warn('Memory monitoring error:', error);
      }
    }, 30000);

    // Periodic cleanup every 5 minutes
    const cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    // Global error handler to prevent app crashes
    const originalErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('Global error caught:', { message, source, lineno, colno, error });
      
      // Perform emergency cleanup
      this.performEmergencyCleanup();
      
      // Call original handler if it exists
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      
      // Prevent default browser error handling to avoid crashes
      return true;
    };

    // Unhandled promise rejection handler
    const originalRejectionHandler = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Perform emergency cleanup
      this.performEmergencyCleanup();
      
      // Call original handler if it exists
      if (originalRejectionHandler) {
        return originalRejectionHandler.call(window, event);
      }
      
      // Prevent default to avoid crashes
      event.preventDefault();
    };

    // Cleanup when page unloads
    window.addEventListener('beforeunload', () => {
      clearInterval(monitorInterval);
      clearInterval(cleanupInterval);
      this.performCleanup();
    });

    console.log('Memory monitoring started for low-power device');
  }

  /**
   * Check current memory usage and trigger cleanup if needed
   */
  private static checkMemoryUsage(): void {
    if (window.performance && (window.performance as any).memory) {
      const memoryInfo = (window.performance as any).memory;
      const usedMemory = memoryInfo.usedJSHeapSize;
      const totalMemory = memoryInfo.jsHeapSizeLimit;
      const usageRatio = usedMemory / totalMemory;

      if (usageRatio > this.MEMORY_THRESHOLD) {
        console.warn(`High memory usage detected: ${(usageRatio * 100).toFixed(1)}%`);
        this.performCleanup();
      }
    }
  }

  /**
   * Perform routine cleanup
   */
  private static performCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < 60000) return; // Don't cleanup more than once per minute
    
    this.lastCleanup = now;
    
    try {
      // Run registered cleanup callbacks
      this.cleanupCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.warn('Cleanup callback error:', error);
        }
      });

      // Force garbage collection if available
      if (window.gc && typeof window.gc === 'function') {
        window.gc();
      }

      console.log('Memory cleanup performed');
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  /**
   * Perform emergency cleanup when errors occur
   */
  private static performEmergencyCleanup(): void {
    try {
      // Clear any large data structures that might be consuming memory
      this.cleanupCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          // Ignore errors during emergency cleanup
        }
      });

      // Clear console to free memory
      if (console.clear) {
        console.clear();
      }

      // Force garbage collection
      if (window.gc && typeof window.gc === 'function') {
        window.gc();
      }

      console.log('Emergency cleanup performed');
    } catch (error) {
      // Even emergency cleanup failed - this is bad
      console.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Get current memory statistics
   */
  static getMemoryStats() {
    if (window.performance && (window.performance as any).memory) {
      const memoryInfo = (window.performance as any).memory;
      return {
        used: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024), // MB
        usagePercent: Math.round((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100),
        cleanupCallbacks: this.cleanupCallbacks.length,
      };
    }
    return null;
  }
}

/**
 * Initialize memory management for low-power devices
 */
export const initializeMemoryManagement = () => {
  if (isLowPowerDevice()) {
    MemoryManager.startMonitoring();
    
    // Register cleanup for common memory leaks
    MemoryManager.registerCleanupCallback(() => {
      // Clear any cached images that might be consuming memory
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
      });
    });
  }
}; 

// Add RPi memory monitoring and cleanup utilities
interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
  timestamp: string;
}

interface MemoryConfig {
  warningThreshold: number;  // Percentage
  criticalThreshold: number; // Percentage
  cleanupInterval: number;   // Milliseconds
  maxLogEntries: number;
}

class RPiMemoryManager {
  private static instance: RPiMemoryManager;
  private config: MemoryConfig;
  private memoryHistory: MemoryInfo[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  private constructor() {
    this.config = {
      warningThreshold: 70,    // 70% memory usage warning
      criticalThreshold: 85,   // 85% memory usage critical
      cleanupInterval: 30000,  // Check every 30 seconds
      maxLogEntries: 10        // Keep only last 10 memory readings
    };
  }

  public static getInstance(): RPiMemoryManager {
    if (!RPiMemoryManager.instance) {
      RPiMemoryManager.instance = new RPiMemoryManager();
    }
    return RPiMemoryManager.instance;
  }

  public startMonitoring(): void {
    if (this.isMonitoring || !isLowPowerDevice()) {
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting RPi memory monitoring', { config: this.config });

    this.cleanupInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.cleanupInterval);
  }

  public stopMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isMonitoring = false;
    // logger.info('Stopped RPi memory monitoring');
  }

  private checkMemoryUsage(): void {
    try {
      const memInfo = this.getMemoryInfo();
      
      // Add to history with bounds
      this.memoryHistory.push(memInfo);
      if (this.memoryHistory.length > this.config.maxLogEntries) {
        this.memoryHistory = this.memoryHistory.slice(-this.config.maxLogEntries);
      }

      // Check thresholds and take action
      if (memInfo.percentage > this.config.criticalThreshold) {
        // logger.error('Critical memory usage detected on RPi', { 
        //   memInfo,
        //   trend: this.getMemoryTrend()
        // });
        this.performEmergencyCleanup();
      } else if (memInfo.percentage > this.config.warningThreshold) {
        // logger.warn('High memory usage detected on RPi', { 
        //   memInfo,
        //   trend: this.getMemoryTrend()
        // });
        this.performGentleCleanup();
      }
    } catch (error) {
      // logger.error('Error checking memory usage', { error });
    }
  }

  private getMemoryInfo(): MemoryInfo {
    if (window.performance && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      const used = memory.usedJSHeapSize / 1024 / 1024; // MB
      const total = memory.totalJSHeapSize / 1024 / 1024; // MB
      const percentage = (used / total) * 100;

      return {
        used: Number(used.toFixed(2)),
        total: Number(total.toFixed(2)),
        percentage: Number(percentage.toFixed(1)),
        timestamp: new Date().toISOString()
      };
    }

    // Fallback estimation for devices without memory API
    return {
      used: 0,
      total: 0,
      percentage: 50, // Assume moderate usage
      timestamp: new Date().toISOString()
    };
  }

  private getMemoryTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.memoryHistory.length < 3) return 'stable';
    
    const recent = this.memoryHistory.slice(-3);
    const avgChange = (recent[2].percentage - recent[0].percentage) / 2;
    
    if (avgChange > 2) return 'increasing';
    if (avgChange < -2) return 'decreasing';
    return 'stable';
  }

  private performGentleCleanup(): void {
    // logger.debug('Performing gentle memory cleanup');
    
    // Trigger garbage collection if available
    if (window.gc) {
      window.gc();
    }

    // Clear any expired caches or temporary data
    this.clearExpiredCaches();
  }

  private performEmergencyCleanup(): void {
    // logger.warn('Performing emergency memory cleanup');
    
    // More aggressive cleanup
    this.performGentleCleanup();
    
    // Clear Redux state that can be safely reset
    this.clearNonCriticalState();
    
    // Dispatch event for components to self-cleanup
    document.dispatchEvent(new CustomEvent('memory-pressure', {
      detail: { severity: 'critical' }
    }));
  }

  private clearExpiredCaches(): void {
    try {
      // Clear expired items from localStorage if any
      const keysToCheck = ['hijri_cache', 'temporary_data', 'debug_logs'];
      keysToCheck.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (parsed.expiry && Date.now() > parsed.expiry) {
              localStorage.removeItem(key);
              // logger.debug('Cleared expired cache', { key });
            }
          } catch {
            // Invalid JSON, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      // logger.error('Error clearing expired caches', { error });
    }
  }

  private clearNonCriticalState(): void {
    // This would interact with Redux store to clear non-critical data
    // For now, just emit an event
    document.dispatchEvent(new CustomEvent('clear-non-critical-data'));
  }

  public getMemoryStats(): { current: MemoryInfo | null; history: MemoryInfo[] } {
    return {
      current: this.memoryHistory[this.memoryHistory.length - 1] || null,
      history: [...this.memoryHistory]
    };
  }
}

// Export singleton instance
export const rpiMemoryManager = RPiMemoryManager.getInstance();

// Add this to the existing performanceUtils exports
export { RPiMemoryManager }; 