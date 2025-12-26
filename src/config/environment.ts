/**
 * Environment Configuration
 * 
 * Centralised access to environment variables with validation.
 * This module ensures all required environment variables are present
 * and provides type-safe access throughout the application.
 */

import logger from '../utils/logger';

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  // API Configuration
  apiUrl: string;
  realtimeUrl: string;
  authToken: string; // WebSocket authentication token
  
  // Development Options
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Feature Flags
  enableCorsProxy: boolean;
  corsProxyUrl: string;
  
  // Timeouts and Intervals (in milliseconds)
  heartbeatInterval: number;
  contentSyncInterval: number;
  prayerTimesSyncInterval: number;
  eventsSyncInterval: number;
  prayerStatusInterval: number;
  
  // Retry Configuration
  maxRetries: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
}

/**
 * Default configuration values
 */
const DEFAULTS = {
  // Production URLs
  PRODUCTION_API_URL: 'https://portal.masjidconnect.co.uk',
  PRODUCTION_REALTIME_URL: 'wss://realtime.masjidconnect.co.uk',
  
  // Development URLs
  DEV_API_URL: 'http://localhost:3001',
  DEV_REALTIME_URL: 'ws://localhost:3002',
  
  // CORS Proxy (development only)
  CORS_PROXY_URL: 'http://localhost:8080',
  
  // Intervals (in milliseconds)
  HEARTBEAT_INTERVAL: 30 * 1000, // 30 seconds
  CONTENT_SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
  PRAYER_TIMES_SYNC_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  EVENTS_SYNC_INTERVAL: 30 * 60 * 1000, // 30 minutes
  PRAYER_STATUS_INTERVAL: 60 * 1000, // 60 seconds
  
  // Retry Configuration
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30 * 1000, // 30 seconds
};

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, defaultValue?: string): string {
  // Check for React app env vars
  const value = process.env[`REACT_APP_${key}`] || process.env[key] || defaultValue;
  
  if (value === undefined) {
    logger.warn(`[Environment] Missing environment variable: ${key}`);
  }
  
  return value || '';
}

/**
 * Parse boolean environment variable
 */
function getBoolEnvVar(key: string, defaultValue: boolean = false): boolean {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse numeric environment variable
 */
function getNumEnvVar(key: string, defaultValue: number): number {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Determine if running in development mode
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || 
         process.env.REACT_APP_ENV === 'development';
}

/**
 * Build the environment configuration
 */
function buildConfig(): EnvironmentConfig {
  const isDev = isDevelopment();
  
  // Get API URL with appropriate defaults
  let apiUrl = getEnvVar(
    'API_URL',
    isDev ? DEFAULTS.DEV_API_URL : DEFAULTS.PRODUCTION_API_URL
  );
  
  // Get Realtime URL with appropriate defaults
  let realtimeUrl = getEnvVar(
    'REALTIME_URL',
    isDev ? DEFAULTS.DEV_REALTIME_URL : DEFAULTS.PRODUCTION_REALTIME_URL
  );
  
  // Get WebSocket auth token
  const authToken = getEnvVar('AUTH_TOKEN', '');
  
  // Ensure URLs don't have trailing slashes
  apiUrl = apiUrl.replace(/\/+$/, '');
  realtimeUrl = realtimeUrl.replace(/\/+$/, '');
  
  // CRITICAL: Ensure production API URLs use HTTPS to avoid redirect issues
  // When a server redirects HTTP → HTTPS, browsers strip the Authorization header
  // which causes 401 errors. Always use HTTPS for production URLs.
  if (apiUrl.includes('masjidconnect.co.uk') && apiUrl.startsWith('http://')) {
    logger.warn('[Environment] Converting API URL from HTTP to HTTPS to avoid redirect issues');
    apiUrl = apiUrl.replace('http://', 'https://');
  }
  
  // Also fix portal.masjidconnect.com and similar production domains
  if (apiUrl.includes('masjidconnect.com') && apiUrl.startsWith('http://')) {
    logger.warn('[Environment] Converting API URL from HTTP to HTTPS to avoid redirect issues');
    apiUrl = apiUrl.replace('http://', 'https://');
  }
  
  // Build configuration
  const config: EnvironmentConfig = {
    apiUrl,
    realtimeUrl,
    authToken,
    
    isDevelopment: isDev,
    isProduction: !isDev,
    
    enableCorsProxy: getBoolEnvVar('ENABLE_CORS_PROXY', false),
    corsProxyUrl: getEnvVar('CORS_PROXY_URL', DEFAULTS.CORS_PROXY_URL),
    
    heartbeatInterval: getNumEnvVar('HEARTBEAT_INTERVAL', DEFAULTS.HEARTBEAT_INTERVAL),
    contentSyncInterval: getNumEnvVar('CONTENT_SYNC_INTERVAL', DEFAULTS.CONTENT_SYNC_INTERVAL),
    prayerTimesSyncInterval: getNumEnvVar('PRAYER_TIMES_SYNC_INTERVAL', DEFAULTS.PRAYER_TIMES_SYNC_INTERVAL),
    eventsSyncInterval: getNumEnvVar('EVENTS_SYNC_INTERVAL', DEFAULTS.EVENTS_SYNC_INTERVAL),
    prayerStatusInterval: getNumEnvVar('PRAYER_STATUS_INTERVAL', DEFAULTS.PRAYER_STATUS_INTERVAL),
    
    maxRetries: getNumEnvVar('MAX_RETRIES', DEFAULTS.MAX_RETRIES),
    initialRetryDelay: getNumEnvVar('INITIAL_RETRY_DELAY', DEFAULTS.INITIAL_RETRY_DELAY),
    maxRetryDelay: getNumEnvVar('MAX_RETRY_DELAY', DEFAULTS.MAX_RETRY_DELAY),
  };
  
  return config;
}

/**
 * Validate the configuration
 */
function validateConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];
  
  // Validate URLs
  if (!config.apiUrl) {
    errors.push('API URL is required (REACT_APP_API_URL)');
  }
  
  if (!config.realtimeUrl) {
    errors.push('Realtime URL is required (REACT_APP_REALTIME_URL)');
  }
  
  if (!config.authToken) {
    logger.warn('[Environment] WebSocket auth token not set (REACT_APP_AUTH_TOKEN)');
  }
  
  // Log validation results
  if (errors.length > 0) {
    logger.error('[Environment] Configuration validation failed:', { errors });
  } else {
    logger.info('[Environment] Configuration validated successfully', {
      apiUrl: config.apiUrl,
      realtimeUrl: config.realtimeUrl,
      isDevelopment: config.isDevelopment,
    });
  }
}

// Build and validate configuration
const config = buildConfig();
validateConfig(config);

// Export the configuration
export default config;

// Export individual values for convenience
export const {
  apiUrl,
  realtimeUrl,
  authToken,
  isDevelopment: isDevMode,
  isProduction,
  enableCorsProxy,
  corsProxyUrl,
  heartbeatInterval,
  contentSyncInterval,
  prayerTimesSyncInterval,
  eventsSyncInterval,
  prayerStatusInterval,
  maxRetries,
  initialRetryDelay,
  maxRetryDelay,
} = config;

// Export defaults for testing
export { DEFAULTS };

