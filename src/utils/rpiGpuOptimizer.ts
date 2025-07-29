import logger from './logger';

interface GPUOptimizationSettings {
  reduceAnimations: boolean;
  limitParallelRendering: boolean;
  forceGarbageCollection: boolean;
  reduceTextureQuality: boolean;
}

class RPiGPUOptimizer {
  private settings: GPUOptimizationSettings;
  private isOptimized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.settings = {
      reduceAnimations: true,
      limitParallelRendering: true,
      forceGarbageCollection: true,
      reduceTextureQuality: true
    };
  }

  /**
   * Initialize GPU optimizations for Raspberry Pi
   */
  public initialize(): void {
    if (this.isOptimized) return;

    // Only optimize on likely RPi environments
    if (!this.isRaspberryPi()) {
      logger.debug('GPU Optimizer: Not running on RPi, skipping optimizations');
      return;
    }

    logger.info('GPU Optimizer: Initializing RPi GPU optimizations');
    
    this.applyGPUOptimizations();
    this.setupMemoryCleanup();
    this.monitorGPUHealth();
    
    this.isOptimized = true;
    logger.info('GPU Optimizer: RPi optimizations applied');
  }

  /**
   * Detect if running on Raspberry Pi
   */
  private isRaspberryPi(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    // Check for RPi indicators
    return userAgent.includes('raspberry') ||
           platform.includes('arm') ||
           userAgent.includes('linux arm') ||
           // Check for specific RPi GPU indicators
           this.hasRPiGPUIndicators();
  }

  /**
   * Check for RPi GPU-specific indicators
   */
  private hasRPiGPUIndicators(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl || !(gl instanceof WebGLRenderingContext)) return false;
      
      const renderer = gl.getParameter(gl.RENDERER) || '';
      const vendor = gl.getParameter(gl.VENDOR) || '';
      
      // Clean up
      canvas.remove();
      
      // Look for VideoCore/Broadcom indicators
      return renderer.toLowerCase().includes('videocore') ||
             vendor.toLowerCase().includes('broadcom') ||
             renderer.toLowerCase().includes('vc4');
    } catch (error) {
      logger.debug('GPU Optimizer: Could not detect GPU info', { error });
      return false;
    }
  }

  /**
   * Apply CSS and DOM optimizations to reduce GPU load
   */
  private applyGPUOptimizations(): void {
    // Inject CSS optimizations
    const style = document.createElement('style');
    style.textContent = `
      /* RPi GPU Optimizations */
      * {
        /* Reduce hardware acceleration for non-critical elements */
        -webkit-transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      
      /* Disable expensive visual effects */
      .masjid-content * {
        /* Disable shadows and filters that strain GPU */
        box-shadow: none !important;
        text-shadow: none !important;
        filter: none !important;
        backdrop-filter: none !important;
      }
      
      /* Reduce animation complexity */
      @media (prefers-reduced-motion: no-preference) {
        * {
          animation-duration: 0.3s !important;
          transition-duration: 0.3s !important;
        }
      }
      
      /* Force simpler rendering for backgrounds */
      .glassmorphic, .modern-background, .islamic-pattern {
        background-attachment: scroll !important;
        background-size: contain !important;
      }
      
      /* Optimize countdown and dynamic elements */
      .prayer-countdown, .time-display {
        /* Use CPU rendering for frequently updating elements */
        will-change: auto !important;
        transform: none !important;
      }
    `;
    style.setAttribute('data-rpi-optimization', 'true');
    document.head.appendChild(style);
  }

  /**
   * Setup periodic GPU memory cleanup
   */
  private setupMemoryCleanup(): void {
    // Clean up GPU resources every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.performGPUCleanup();
    }, 120000);
  }

  /**
   * Perform GPU memory cleanup
   */
  private performGPUCleanup(): void {
    try {
      // Force garbage collection if available
      if (this.settings.forceGarbageCollection && (window as any).gc) {
        (window as any).gc();
      }

      // Clean up any detached canvases
      this.cleanupDetachedCanvases();
      
      // Log GPU memory status
      this.logGPUMemoryStatus();
      
    } catch (error) {
      logger.debug('GPU Optimizer: Cleanup error', { error });
    }
  }

  /**
   * Clean up detached canvas elements that might be leaking GPU memory
   */
  private cleanupDetachedCanvases(): void {
    const canvases = document.querySelectorAll('canvas');
    let cleanedCount = 0;
    
    canvases.forEach(canvas => {
      // Check if canvas is detached or hidden
      if (!canvas.isConnected || canvas.offsetParent === null) {
        const context = canvas.getContext('2d') || canvas.getContext('webgl');
        if (context) {
          try {
            // Clear canvas content
            if (context instanceof CanvasRenderingContext2D) {
              context.clearRect(0, 0, canvas.width, canvas.height);
            } else if (context instanceof WebGLRenderingContext) {
              context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
            }
            cleanedCount++;
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });

    if (cleanedCount > 0) {
      logger.debug(`GPU Optimizer: Cleaned ${cleanedCount} canvas elements`);
    }
  }

  /**
   * Log GPU memory status for monitoring
   */
  private logGPUMemoryStatus(): void {
    if ('memory' in (performance as any)) {
      const memory = (performance as any).memory;
      const gpuMemoryUsageMB = memory.usedJSHeapSize / 1024 / 1024;
      
      logger.debug('GPU Optimizer: Memory status', {
        jsHeapUsed: `${gpuMemoryUsageMB.toFixed(1)}MB`,
        jsHeapLimit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`
      });
    }
  }

  /**
   * Monitor for GPU-related errors and warnings
   */
  private monitorGPUHealth(): void {
    // Listen for WebGL context lost events
    document.addEventListener('webglcontextlost', (event) => {
      logger.warn('GPU Optimizer: WebGL context lost detected', {
        type: event.type,
        target: event.target
      });
      
      // Prevent default to allow context restoration
      event.preventDefault();
    });

    // Listen for context restored events
    document.addEventListener('webglcontextrestored', () => {
      logger.info('GPU Optimizer: WebGL context restored');
    });
  }

  /**
   * Emergency GPU optimization for when buffer errors occur
   */
  public emergencyOptimization(): void {
    logger.warn('GPU Optimizer: Applying emergency optimizations');
    
    // Disable all animations immediately
    const emergencyStyle = document.createElement('style');
    emergencyStyle.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        will-change: auto !important;
        transform: none !important;
      }
    `;
    emergencyStyle.setAttribute('data-emergency-optimization', 'true');
    document.head.appendChild(emergencyStyle);

    // Force immediate cleanup
    this.performGPUCleanup();
  }

  /**
   * Cleanup on shutdown
   */
  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Remove optimization styles
    const optimizationStyles = document.querySelectorAll('style[data-rpi-optimization]');
    optimizationStyles.forEach(style => style.remove());

    this.isOptimized = false;
    logger.info('GPU Optimizer: Cleanup completed');
  }
}

// Export singleton instance
export const rpiGPUOptimizer = new RPiGPUOptimizer(); 