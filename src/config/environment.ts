/**
 * Environment Configuration
 *
 * Centralised access to environment variables with validation.
 * Uses Vite's import.meta.env for build-time variable injection.
 */

export interface EnvironmentConfig {
  /** Default timezone when masjid timezone is not yet loaded (e.g. Europe/London for UK). */
  defaultMasjidTimezone: string;
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
  /** Offset from midnight UTC (ms) for once-daily sync, e.g. 3*60*60*1000 = 03:00 UTC */
  dailySyncOffsetMs: number;
  /** Offset from midnight UTC (ms) for once-daily update check, e.g. 4*60*60*1000 = 04:00 UTC */
  dailyUpdateCheckOffsetMs: number;

  // Retry configuration
  maxRetries: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
}

const DEFAULTS = {
  /** Default masjid timezone when not in content (UK deployments). */
  DEFAULT_MASJID_TIMEZONE: 'Europe/London',
  PRODUCTION_API_URL: 'https://portal.masjidconnect.co.uk',
  PRODUCTION_REALTIME_URL: 'https://masjidconnect-realtime.fly.dev',
  DEV_API_URL: 'http://localhost:3001',
  DEV_REALTIME_URL: 'http://localhost:3002',

  HEARTBEAT_INTERVAL: 30_000,
  /** Used when pending command acks need to reach the server quickly */
  HEARTBEAT_FAST_INTERVAL: 5_000,
  CONTENT_SYNC_INTERVAL: 24 * 60 * 60_000,
  PRAYER_TIMES_SYNC_INTERVAL: 24 * 60 * 60_000,
  EVENTS_SYNC_INTERVAL: 24 * 60 * 60_000,
  PRAYER_STATUS_INTERVAL: 60_000,
  /** 03:00 UTC — low-traffic time for once-daily fallback sync */
  DAILY_SYNC_OFFSET_MS: 3 * 60 * 60 * 1000,
  /** 04:00 UTC — 1 hour after daily sync for once-daily update check */
  DAILY_UPDATE_CHECK_OFFSET_MS: 4 * 60 * 60 * 1000,

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
    defaultMasjidTimezone: (import.meta.env.VITE_DEFAULT_MASJID_TIMEZONE ?? '').trim() || DEFAULTS.DEFAULT_MASJID_TIMEZONE,
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
    dailySyncOffsetMs: DEFAULTS.DAILY_SYNC_OFFSET_MS,
    dailyUpdateCheckOffsetMs: DEFAULTS.DAILY_UPDATE_CHECK_OFFSET_MS,
    maxRetries: DEFAULTS.MAX_RETRIES,
    initialRetryDelay: DEFAULTS.INITIAL_RETRY_DELAY,
    maxRetryDelay: DEFAULTS.MAX_RETRY_DELAY,
  };
}

const config = buildConfig();
export default config;

export const {
  defaultMasjidTimezone,
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
  dailySyncOffsetMs,
  dailyUpdateCheckOffsetMs,
  maxRetries,
  initialRetryDelay,
  maxRetryDelay,
} = config;

export { DEFAULTS };
