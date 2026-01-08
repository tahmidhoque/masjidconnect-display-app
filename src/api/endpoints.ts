/**
 * API Endpoints
 * 
 * Centralised endpoint definitions matching the backend API documentation.
 * All endpoints are relative to the base API URL.
 */

/**
 * Pairing endpoints - for device registration and authentication
 */
export const PAIRING_ENDPOINTS = {
  /**
   * Request a new pairing code
   * POST /api/screens/unpaired
   * Body: { deviceInfo: { ... } }
   * Response: { pairingCode: string, expiresAt: string }
   */
  REQUEST_PAIRING_CODE: '/api/screens/unpaired',
  
  /**
   * Check if pairing is complete
   * POST /api/screens/check-simple
   * Body: { pairingCode: string }
   * Response: { isPaired: boolean }
   */
  CHECK_PAIRING_STATUS: '/api/screens/check-simple',
  
  /**
   * Get credentials after pairing
   * POST /api/screens/paired-credentials
   * Body: { pairingCode: string }
   * Response: { apiKey: string, screenId: string, masjidId: string, ... }
   */
  GET_PAIRED_CREDENTIALS: '/api/screens/paired-credentials',
} as const;

/**
 * Screen endpoints - for authenticated screen operations
 * All require Authorization: Bearer <apiKey> header
 */
export const SCREEN_ENDPOINTS = {
  /**
   * Send heartbeat and receive pending commands
   * POST /api/screen/heartbeat
   * Body: { status, appVersion, metrics, ... }
   * Response: { success: boolean, commands: [...], serverTime: string }
   */
  HEARTBEAT: '/api/screen/heartbeat',
  
  /**
   * Get all screen content (announcements, media, etc.)
   * GET /api/screen/content
   * Response: { content: [...], lastUpdated: string }
   */
  GET_CONTENT: '/api/screen/content',
  
  /**
   * Get prayer times
   * GET /api/screen/prayer-times
   * Query: ?date=YYYY-MM-DD (optional, defaults to today)
   * Response: { prayerTimes: {...}, hijriDate: string, ... }
   */
  GET_PRAYER_TIMES: '/api/screen/prayer-times',
  
  /**
   * Get current prayer status
   * GET /api/screen/prayer-status
   * Response: { currentPrayer: string, nextPrayer: string, timeUntilNext: number }
   */
  GET_PRAYER_STATUS: '/api/screen/prayer-status',
  
  /**
   * Get upcoming events
   * GET /api/screen/events
   * Query: ?limit=10 (optional)
   * Response: { events: [...] }
   */
  GET_EVENTS: '/api/screen/events',
  
  /**
   * Check for updates (sync status)
   * GET /api/screen/sync
   * Response: { contentUpdated: string, prayerTimesUpdated: string, ... }
   */
  GET_SYNC_STATUS: '/api/screen/sync',
} as const;

/**
 * Build full endpoint URL
 * @param baseUrl - The base API URL
 * @param endpoint - The endpoint path
 * @returns Full URL
 */
export function buildUrl(baseUrl: string, endpoint: string): string {
  // Remove trailing slash from base URL
  const cleanBase = baseUrl.replace(/\/+$/, '');
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

/**
 * Build URL with query parameters
 * @param baseUrl - The base API URL
 * @param endpoint - The endpoint path
 * @param params - Query parameters
 * @returns Full URL with query string
 */
export function buildUrlWithParams(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  const url = buildUrl(baseUrl, endpoint);
  
  // Filter out undefined values
  const filteredParams = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  
  if (filteredParams.length === 0) {
    return url;
  }
  
  return `${url}?${filteredParams.join('&')}`;
}



