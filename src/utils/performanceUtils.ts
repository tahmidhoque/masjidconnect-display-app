/**
 * Performance optimization utilities
 * 
 * This file contains utility functions to help optimize the application performance.
 * Enhanced for Raspberry Pi devices to reduce CPU and memory usage.
 */

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
 * Enhanced device detection with more specific performance characteristics
 */
export const getDevicePerformanceProfile = () => {
  const isLowPower = isLowPowerDevice();
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (window.performance as any)?.memory?.jsHeapSizeLimit || 0;
  
  let profile: 'low' | 'medium' | 'high' = 'high';
  
  if (isLowPower || cores <= 2 || memory < 536870912) { // Less than 512MB
    profile = 'low';
  } else if (cores <= 4 || memory < 1073741824) { // Less than 1GB
    profile = 'medium';
  }
  
  return {
    profile,
    cores,
    memory: memory / 1024 / 1024, // Convert to MB
    isLowPower,
    recommendations: {
      animationDuration: profile === 'low' ? 100 : profile === 'medium' ? 200 : 300,
      debounceDelay: profile === 'low' ? 500 : profile === 'medium' ? 300 : 150,
      throttleDelay: profile === 'low' ? 1000 : profile === 'medium' ? 500 : 250,
      maxConcurrentOperations: profile === 'low' ? 1 : profile === 'medium' ? 2 : 4,
    }
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