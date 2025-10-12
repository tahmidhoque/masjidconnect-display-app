/**
 * Raspberry Pi Performance Configuration
 * Lightweight settings to prevent performance issues and blank screens
 */

import logger from './logger';

export interface RPiConfig {
  // Disable heavy features
  disableAnimations: boolean;
  disableGPUOptimizer: boolean;
  disableMemoryManager: boolean;
  disableServiceWorker: boolean;
  
  // Reduce polling/timers
  heartbeatInterval: number; // milliseconds
  contentRefreshInterval: number; // milliseconds
  maxConcurrentRequests: number;
  
  // Memory limits
  maxCacheSize: number; // MB
  cacheExpiration: number; // milliseconds
  
  // Rendering
  reducedMotion: boolean;
  simplifiedUI: boolean;
  lazyLoadImages: boolean;
}

// Default RPi-optimized config
const RPI_CONFIG: RPiConfig = {
  disableAnimations: true,
  disableGPUOptimizer: true, // Causing issues
  disableMemoryManager: true, // Too aggressive
  disableServiceWorker: false,
  
  heartbeatInterval: 60000, // 1 minute (was 30s)
  contentRefreshInterval: 300000, // 5 minutes (was 2min)
  maxConcurrentRequests: 2, // Limit parallel API calls
  
  maxCacheSize: 50, // 50MB max cache
  cacheExpiration: 3600000, // 1 hour
  
  reducedMotion: true,
  simplifiedUI: true,
  lazyLoadImages: true,
};

// Desktop/dev config (more aggressive)
const DESKTOP_CONFIG: RPiConfig = {
  disableAnimations: false,
  disableGPUOptimizer: false,
  disableMemoryManager: false,
  disableServiceWorker: false,
  
  heartbeatInterval: 30000,
  contentRefreshInterval: 120000,
  maxConcurrentRequests: 5,
  
  maxCacheSize: 100,
  cacheExpiration: 1800000,
  
  reducedMotion: false,
  simplifiedUI: false,
  lazyLoadImages: false,
};

class RPiConfigManager {
  private config: RPiConfig;
  private isRPi: boolean = false;

  constructor() {
    this.isRPi = this.detectRPi();
    this.config = this.isRPi ? RPI_CONFIG : DESKTOP_CONFIG;
    
    // Allow override via localStorage for testing
    const override = localStorage.getItem('rpi_config_override');
    if (override) {
      try {
        const parsed = JSON.parse(override);
        this.config = { ...this.config, ...parsed };
        logger.info('RPi Config: Using localStorage override', this.config);
      } catch (e) {
        logger.warn('RPi Config: Failed to parse localStorage override');
      }
    }
    
    logger.info(`RPi Config: Initialized for ${this.isRPi ? 'Raspberry Pi' : 'Desktop'}`, this.config);
  }

  /**
   * Detect if running on Raspberry Pi
   */
  private detectRPi(): boolean {
    // Check user agent
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('raspberry')) return true;
    
    // Check platform
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('arm') || platform.includes('linux arm')) return true;
    
    // Check screen resolution (RPi typically runs at 1920x1080 or 1280x720)
    const width = window.screen.width;
    const height = window.screen.height;
    const isTypicalRPiResolution = 
      (width === 1920 && height === 1080) ||
      (width === 1280 && height === 720) ||
      (width === 1024 && height === 600);
    
    // Check if Electron (desktop apps)
    const isElectron = typeof window !== 'undefined' && 
                       window.process?.type === 'renderer';
    
    // If Electron + typical resolution + Linux, likely RPi
    if (isElectron && isTypicalRPiResolution && platform.includes('linux')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get current configuration
   */
  public getConfig(): RPiConfig {
    return { ...this.config };
  }

  /**
   * Check if running on RPi
   */
  public isRaspberryPi(): boolean {
    return this.isRPi;
  }

  /**
   * Update config at runtime (for testing)
   */
  public updateConfig(updates: Partial<RPiConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('RPi Config: Updated', this.config);
  }

  /**
   * Force RPi mode (for testing)
   */
  public forceRPiMode(enabled: boolean): void {
    this.isRPi = enabled;
    this.config = enabled ? RPI_CONFIG : DESKTOP_CONFIG;
    logger.info(`RPi Config: Forced ${enabled ? 'RPi' : 'Desktop'} mode`);
  }

  /**
   * Get recommended CSS for performance
   */
  public getPerformanceCSS(): string {
    if (!this.isRPi) return '';
    
    return `
      * {
        /* Disable all animations on RPi */
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      
      /* Reduce blur/backdrop effects */
      *[class*="blur"],
      *[class*="glassmorphic"] {
        backdrop-filter: none !important;
        filter: none !important;
      }
      
      /* Simplify shadows */
      * {
        box-shadow: none !important;
        text-shadow: none !important;
      }
      
      /* Optimize text rendering */
      body {
        text-rendering: optimizeSpeed !important;
        font-smooth: never !important;
        -webkit-font-smoothing: antialiased !important;
      }
      
      /* Disable complex gradients */
      *[class*="gradient"] {
        background: #1a1a2e !important;
      }
    `;
  }

  /**
   * Apply performance CSS to document
   */
  public applyPerformanceCSS(): void {
    if (!this.config.disableAnimations) return;
    
    const styleId = 'rpi-performance-css';
    let style = document.getElementById(styleId);
    
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    
    style.textContent = this.getPerformanceCSS();
    logger.info('RPi Config: Applied performance CSS');
  }
}

// Export singleton
export const rpiConfig = new RPiConfigManager();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).rpiConfig = rpiConfig;
}

export default rpiConfig;

