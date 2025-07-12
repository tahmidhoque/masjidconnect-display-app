import { useEffect, useCallback, useRef } from 'react';
import { isLowPowerDevice, createPerformanceMonitor, logPerformanceMetrics } from '../utils/performanceUtils';

/**
 * Hook for applying performance optimizations based on device capabilities
 * 
 * This hook provides utilities for optimizing React components for low-power devices
 * like Raspberry Pi, including reduced animations, simplified rendering, and
 * performance monitoring.
 */
export const usePerformanceOptimization = () => {
  const isLowPower = isLowPowerDevice();
  const performanceMonitorRef = useRef<any>(null);
  const optimizationAppliedRef = useRef(false);

  // Initialize performance monitoring
  useEffect(() => {
    if (!performanceMonitorRef.current) {
      performanceMonitorRef.current = createPerformanceMonitor();
    }

    // Log initial performance metrics
    logPerformanceMetrics();

    // Set up periodic performance logging (every 30 seconds)
    const performanceInterval = setInterval(() => {
      if (performanceMonitorRef.current) {
        const fps = performanceMonitorRef.current.getFPS();
        const memory = performanceMonitorRef.current.getMemoryUsage();
        
        // Log performance issues
        if (fps < 30) {
          console.warn(`Performance warning: Low FPS (${fps}) detected`);
        }
        
        if (memory && memory.used > memory.limit * 0.8) {
          console.warn(`Performance warning: High memory usage (${memory.used}MB / ${memory.limit}MB)`);
        }
      }
    }, 30000);

    return () => {
      clearInterval(performanceInterval);
    };
  }, []);

  // Apply performance optimizations to the DOM
  useEffect(() => {
    if (optimizationAppliedRef.current) return;
    
    optimizationAppliedRef.current = true;
    
    // Add low-power device class to body
    if (isLowPower) {
      document.body.classList.add('low-power-device');
      console.log('Performance optimizations applied for low-power device');
    }

    // Optimize critical elements
    const optimizeElements = () => {
      // Optimize Material-UI components
      const muiElements = document.querySelectorAll('.MuiBox-root, .MuiPaper-root, .MuiCard-root');
      muiElements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.classList.add('hardware-accelerated');
          if (isLowPower) {
            el.classList.add('gpu-optimized');
          }
        }
      });

      // Optimize images
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        img.decoding = 'async';
        img.loading = 'lazy';
        
        if (isLowPower && img.width > 500) {
          img.style.transform = 'scale(0.85)';
        }
      });
    };

    // Apply optimizations immediately and on DOM changes
    optimizeElements();
    
    // Use MutationObserver to optimize new elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          optimizeElements();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }, [isLowPower]);

  // Optimized animation frame scheduling
  const scheduleOptimizedUpdate = useCallback((callback: () => void) => {
    if (isLowPower) {
      // Use setTimeout for low-power devices to reduce CPU usage
      return setTimeout(callback, 16); // ~60fps equivalent
    } else {
      // Use requestAnimationFrame for more powerful devices
      return requestAnimationFrame(callback);
    }
  }, [isLowPower]);

  // Optimized debounce function
  const optimizedDebounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ) => {
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
  }, [isLowPower]);

  // Optimized throttle function
  const optimizedThrottle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ) => {
    const adjustedLimit = isLowPower ? limit * 2 : limit;
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCall >= adjustedLimit) {
        lastCall = now;
        func(...args);
      }
    };
  }, [isLowPower]);

  // Get current performance metrics
  const getPerformanceMetrics = useCallback(() => {
    if (!performanceMonitorRef.current) return null;
    
    return {
      fps: performanceMonitorRef.current.getFPS(),
      avgFrameTime: performanceMonitorRef.current.getAverageFrameTime(),
      memory: performanceMonitorRef.current.getMemoryUsage(),
      isLowPower
    };
  }, [isLowPower]);

  // Optimized transition duration
  const getTransitionDuration = useCallback(() => {
    return isLowPower ? 200 : 500;
  }, [isLowPower]);

  // Optimized animation duration
  const getAnimationDuration = useCallback(() => {
    return isLowPower ? 300 : 600;
  }, [isLowPower]);

  // Check if performance is acceptable
  const isPerformanceAcceptable = useCallback(() => {
    if (!performanceMonitorRef.current) return true;
    
    const fps = performanceMonitorRef.current.getFPS();
    const memory = performanceMonitorRef.current.getMemoryUsage();
    
    // Consider performance acceptable if FPS > 30 and memory usage < 80%
    return fps > 30 && (!memory || memory.used < memory.limit * 0.8);
  }, []);

  return {
    isLowPower,
    scheduleOptimizedUpdate,
    optimizedDebounce,
    optimizedThrottle,
    getPerformanceMetrics,
    getTransitionDuration,
    getAnimationDuration,
    isPerformanceAcceptable,
    performanceMonitor: performanceMonitorRef.current
  };
};

export default usePerformanceOptimization;