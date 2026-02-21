/**
 * Environment Configuration
 *
 * Centralised access to environment variables with validation.
 * Uses Vite's import.meta.env for build-time variable injection.
 */

export interface EnvironmentConfig {
  apiUrl: string;
  realtimeUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;

  // Sync intervals (ms)
  heartbeatInterval: number;
  /** Fast heartbeat interval used when there are pending command acknowledgements */
  heartbeatFastInterval: number;
  contentSyncInterval: number;
  prayerTimesSyncInterval: number;
  eventsSyncInterval: number;
  prayerStatusInterval: number;

  // Retry configuration
  maxRetries: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
}

const DEFAULTS = {
  PRODUCTION_API_URL: 'https://portal.masjidconnect.co.uk',
  PRODUCTION_REALTIME_URL: 'https://masjidconnect-realtime.fly.dev',
  DEV_API_URL: 'http://localhost:3001',
  DEV_REALTIME_URL: 'http://localhost:3002',

  HEARTBEAT_INTERVAL: 30_000,
  /** Used when pending command acks need to reach the server quickly */
  HEARTBEAT_FAST_INTERVAL: 5_000,
  CONTENT_SYNC_INTERVAL: 5 * 60_000,
  PRAYER_TIMES_SYNC_INTERVAL: 24 * 60 * 60_000,
  EVENTS_SYNC_INTERVAL: 30 * 60_000,
  PRAYER_STATUS_INTERVAL: 60_000,

  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1_000,
  MAX_RETRY_DELAY: 30_000,
};

function buildConfig(): EnvironmentConfig {
  const isDev = import.meta.env.DEV;

  let apiUrl = (import.meta.env.VITE_API_URL ?? '').trim()
    || (isDev ? DEFAULTS.DEV_API_URL : DEFAULTS.PRODUCTION_API_URL);

  let realtimeUrl = (import.meta.env.VITE_REALTIME_URL ?? '').trim()
    || (isDev ? DEFAULTS.DEV_REALTIME_URL : DEFAULTS.PRODUCTION_REALTIME_URL);

  // Strip trailing slashes
  apiUrl = apiUrl.replace(/\/+$/, '');
  realtimeUrl = realtimeUrl.replace(/\/+$/, '');

  // Force HTTPS on production domains
  if (apiUrl.includes('masjidconnect') && apiUrl.startsWith('http://')) {
    apiUrl = apiUrl.replace('http://', 'https://');
  }

  return {
    apiUrl,
    realtimeUrl,
    isDevelopment: isDev,
    isProduction: import.meta.env.PROD,
    heartbeatInterval: DEFAULTS.HEARTBEAT_INTERVAL,
    heartbeatFastInterval: DEFAULTS.HEARTBEAT_FAST_INTERVAL,
    contentSyncInterval: DEFAULTS.CONTENT_SYNC_INTERVAL,
    prayerTimesSyncInterval: DEFAULTS.PRAYER_TIMES_SYNC_INTERVAL,
    eventsSyncInterval: DEFAULTS.EVENTS_SYNC_INTERVAL,
    prayerStatusInterval: DEFAULTS.PRAYER_STATUS_INTERVAL,
    maxRetries: DEFAULTS.MAX_RETRIES,
    initialRetryDelay: DEFAULTS.INITIAL_RETRY_DELAY,
    maxRetryDelay: DEFAULTS.MAX_RETRY_DELAY,
  };
}

const config = buildConfig();
export default config;

export const {
  apiUrl,
  realtimeUrl,
  isDevelopment: isDevMode,
  isProduction,
  heartbeatInterval,
  heartbeatFastInterval,
  contentSyncInterval,
  prayerTimesSyncInterval,
  eventsSyncInterval,
  prayerStatusInterval,
  maxRetries,
  initialRetryDelay,
  maxRetryDelay,
} = config;

export { DEFAULTS };
