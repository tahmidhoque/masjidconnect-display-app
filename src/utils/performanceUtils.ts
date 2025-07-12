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
 * Performance monitoring class for tracking frame rates and rendering performance
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;
  private frameTimes: number[] = [];
  private maxFrameTimes = 60; // Keep last 60 frames for averaging
  
  constructor() {
    this.startMonitoring();
  }
  
  private startMonitoring() {
    const measureFrame = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastTime;
      
      this.frameCount++;
      this.frameTimes.push(deltaTime);
      
      // Keep only the last N frame times
      if (this.frameTimes.length > this.maxFrameTimes) {
        this.frameTimes.shift();
      }
      
      // Calculate FPS every 60 frames
      if (this.frameCount % 60 === 0) {
        const avgFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
        this.fps = Math.round(1000 / avgFrameTime);
        
        // Log performance metrics
        if (this.fps < 30) {
          console.warn(`Low FPS detected: ${this.fps}fps`);
        }
      }
      
      this.lastTime = currentTime;
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }
  
  getFPS(): number {
    return this.fps;
  }
  
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
  }
  
  getMemoryUsage(): any {
    if (window.performance && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100
      };
    }
    return null;
  }
}

/**
 * Enables hardware acceleration for the element by applying CSS properties
 * that trigger GPU acceleration, but only what's necessary based on device capability.
 * 
 * @param element - The DOM element to optimize
 */
export const enableHardwareAcceleration = (element: HTMLElement): void => {
  if (!element) return;
  
  const isLowPower = isLowPowerDevice();
  const style = element.style;
  
  if (isLowPower) {
    // Reduced set of properties for low-power devices
    style.transform = 'translateZ(0)';
    style.backfaceVisibility = 'hidden';
    
    // Use simplified transforms
    style.setProperty('-webkit-transform', 'translateZ(0)');
    style.setProperty('-webkit-backface-visibility', 'hidden');
  } else {
    // Full set for more powerful devices
    style.transform = 'translateZ(0)';
    style.backfaceVisibility = 'hidden';
    style.perspective = '1000px';
    style.willChange = 'transform, opacity';
    
    // Add vendor prefixes
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
  const isLowPower = isLowPowerDevice();
  console.log(`Optimizing for ${isLowPower ? 'low-power device' : 'standard device'}`);
  
  // Optimize the main container
  const mainContainer = document.getElementById('root');
  if (mainContainer) {
    enableHardwareAcceleration(mainContainer);
  }
  
  // Apply CSS optimizations to body and html
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  // For low-power devices, be more selective about what gets hardware acceleration
  const criticalElements = isLowPower
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
    if (isLowPower && img.width > 500) {
      img.style.transform = 'scale(0.85)';
    }
  });
  
  // For low-power devices, minimize animations and effects
  if (isLowPower) {
    // Add a class to the body that can be used in CSS to reduce animations
    document.body.classList.add('low-power-device');
    
    // Reduce animation complexity via CSS variables
    document.documentElement.style.setProperty('--transition-duration', '0.1s');
    document.documentElement.style.setProperty('--animation-duration', '0.5s');
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
  const isLowPower = isLowPowerDevice();
  // Increase debounce wait time on low-power devices
  const adjustedWait = isLowPower ? wait * 1.5 : wait;
  
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
  const isLowPower = isLowPowerDevice();
  // Increase throttle limit on low-power devices
  const adjustedLimit = isLowPower ? limit * 2 : limit;
  
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
 * Creates a performance monitor instance
 */
export const createPerformanceMonitor = (): PerformanceMonitor => {
  return new PerformanceMonitor();
};

/**
 * Logs current performance metrics
 */
export const logPerformanceMetrics = (): void => {
  const monitor = createPerformanceMonitor();
  const memory = monitor.getMemoryUsage();
  
  console.log('Performance Metrics:', {
    fps: monitor.getFPS(),
    avgFrameTime: monitor.getAverageFrameTime(),
    memory: memory,
    isLowPower: isLowPowerDevice()
  });
}; 