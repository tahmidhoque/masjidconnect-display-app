/**
 * Performance optimization utilities
 * 
 * This file contains utility functions to help optimize the application performance.
 */

/**
 * Enables hardware acceleration for the element by applying CSS properties
 * that trigger GPU acceleration.
 * 
 * @param element - The DOM element to optimize
 */
export const enableHardwareAcceleration = (element: HTMLElement): void => {
  if (!element) return;
  
  // Apply hardware acceleration styles
  const style = element.style;
  style.transform = 'translateZ(0)';
  style.backfaceVisibility = 'hidden';
  style.perspective = '1000px';
  style.willChange = 'transform, opacity';
  
  // Add vendor prefixes for broader support
  style.setProperty('-webkit-transform', 'translateZ(0)');
  style.setProperty('-webkit-backface-visibility', 'hidden');
  style.setProperty('-webkit-perspective', '1000px');
};

/**
 * Optimizes all animation-related elements in the app
 * Call this function when the app is initialized
 */
export const optimizeAppPerformance = (): void => {
  // Optimize the main container
  const mainContainer = document.getElementById('root');
  if (mainContainer) {
    enableHardwareAcceleration(mainContainer);
  }
  
  // Apply CSS optimizations to body and html
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  // Optimize critical elements that will animate
  const criticalElements = [
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
  });
};

/**
 * Debounces a function call to limit how often it can be called
 * 
 * @param func - The function to debounce
 * @param wait - The wait time in milliseconds
 * @returns A debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

/**
 * Throttles a function to limit how often it can be called
 * 
 * @param func - The function to throttle
 * @param limit - The limit time in milliseconds
 * @returns A throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= limit) {
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