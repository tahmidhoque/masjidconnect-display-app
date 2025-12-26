/**
 * API Client
 * 
 * Clean axios-based HTTP client for REST API communication.
 * Handles authentication, retries, caching, and offline fallback.
 * 
 * Features:
 * - Automatic auth header injection
 * - Exponential backoff retry logic
 * - Response caching with IndexedDB
 * - Offline fallback support
 * - Request/response logging
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import localforage from 'localforage';
import credentialService from '../services/credentialService';
import environment from '../config/environment';
import logger from '../utils/logger';
import {
  PAIRING_ENDPOINTS,
  SCREEN_ENDPOINTS,
  buildUrl,
  buildUrlWithParams,
} from './endpoints';

// ============================================================================
// Types
// ============================================================================

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  fromCache?: boolean;
}

/**
 * Device info for pairing requests
 */
export interface DeviceInfo {
  name: string;
  type: string;
  platform: string;
  screenResolution: string;
  orientation: string;
  appVersion: string;
}

/**
 * Pairing code response
 */
export interface PairingCodeResponse {
  pairingCode: string;
  expiresAt: string;
}

/**
 * Pairing status response
 */
export interface PairingStatusResponse {
  isPaired: boolean;
}

/**
 * Paired credentials response
 */
export interface PairedCredentialsResponse {
  apiKey: string;
  screenId: string;
  masjidId: string;
  masjidName: string;
  screenName: string;
  orientation: string;
}

/**
 * Heartbeat request
 */
export interface HeartbeatRequest {
  status: 'online' | 'offline' | 'error';
  appVersion: string;
  currentView?: string;
  metrics?: {
    uptime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

/**
 * Remote command from backend
 */
export interface RemoteCommand {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Heartbeat response
 */
export interface HeartbeatResponse {
  success: boolean;
  serverTime: string;
  commands?: RemoteCommand[];
}

/**
 * Content response
 */
export interface ContentResponse {
  content: unknown[];
  lastUpdated: string;
  schedule?: unknown;
}

/**
 * Prayer times response
 */
export interface PrayerTimesResponse {
  prayerTimes: Record<string, string>;
  hijriDate: string;
  gregorianDate: string;
  lastUpdated: string;
}

/**
 * Prayer status response
 */
export interface PrayerStatusResponse {
  currentPrayer: string | null;
  nextPrayer: string;
  timeUntilNext: number;
  isJumuah: boolean;
}

/**
 * Events response
 */
export interface EventsResponse {
  events: unknown[];
  lastUpdated: string;
}

/**
 * Sync status response
 */
export interface SyncStatusResponse {
  contentUpdated: string;
  prayerTimesUpdated: string;
  eventsUpdated: string;
  scheduleUpdated: string;
}

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_KEYS = {
  CONTENT: 'cache_content',
  PRAYER_TIMES: 'cache_prayer_times',
  EVENTS: 'cache_events',
  SYNC_STATUS: 'cache_sync_status',
} as const;

const CACHE_TTL = {
  CONTENT: 5 * 60 * 1000, // 5 minutes
  PRAYER_TIMES: 24 * 60 * 60 * 1000, // 24 hours
  EVENTS: 30 * 60 * 1000, // 30 minutes
  SYNC_STATUS: 60 * 1000, // 1 minute
} as const;

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private axiosInstance: AxiosInstance;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: environment.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Setup interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();

    // Listen for online/offline events
    this.setupNetworkListeners();

    logger.info('[ApiClient] Initialised', {
      baseURL: environment.apiUrl,
    });
  }

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Add auth header if we have credentials
        const authHeader = credentialService.getAuthHeader();
        if (authHeader && !config.url?.includes('/screens/unpaired') && 
            !config.url?.includes('/screens/check-simple') &&
            !config.url?.includes('/screens/paired-credentials')) {
          config.headers.set('Authorization', authHeader);
        }

        // Add screen ID header for authenticated requests
        const screenId = credentialService.getScreenId();
        if (screenId) {
          config.headers.set('X-Screen-ID', screenId);
        }

        logger.debug('[ApiClient] Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          hasAuth: !!authHeader,
        });

        return config;
      },
      (error: AxiosError) => {
        logger.error('[ApiClient] Request error', { error: error.message });
        return Promise.reject(error);
      }
    );
  }

  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('[ApiClient] Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error: AxiosError) => {
        // Handle specific error codes
        if (error.response?.status === 401) {
          logger.warn('[ApiClient] Unauthorized - credentials may be invalid');
          // Don't clear credentials here - let the auth flow handle it
        } else if (error.response?.status === 429) {
          logger.warn('[ApiClient] Rate limited');
        }

        return Promise.reject(error);
      }
    );
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.info('[ApiClient] Network online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logger.info('[ApiClient] Network offline');
    });
  }

  // ==========================================================================
  // Core Request Methods
  // ==========================================================================

  /**
   * Make a request with retry logic and exponential backoff
   */
  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    maxRetries: number = environment.maxRetries
  ): Promise<ApiResponse<T>> {
    let lastError: AxiosError | Error | null = null;
    let delay = environment.initialRetryDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(config);
        return {
          success: true,
          data: response.data,
          statusCode: response.status,
        };
      } catch (error) {
        lastError = error as AxiosError | Error;
        const axiosError = error as AxiosError;

        // Don't retry on certain status codes
        const status = axiosError.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          logger.warn('[ApiClient] Non-retryable error', { status, url: config.url });
          break;
        }

        // Don't retry if offline
        if (!this.isOnline) {
          logger.warn('[ApiClient] Offline, not retrying');
          break;
        }

        // Retry with backoff
        if (attempt < maxRetries) {
          logger.debug('[ApiClient] Retrying request', {
            attempt: attempt + 1,
            maxRetries,
            delay,
            url: config.url,
          });
          await this.sleep(delay);
          delay = Math.min(delay * 2, environment.maxRetryDelay);
        }
      }
    }

    // All retries failed
    const axiosError = lastError as AxiosError;
    return {
      success: false,
      error: axiosError?.message || 'Request failed',
      statusCode: axiosError?.response?.status,
    };
  }

  /**
   * Make a GET request with caching and offline fallback
   */
  private async getWithCache<T>(
    endpoint: string,
    cacheKey: string,
    ttl: number,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    const url = params
      ? buildUrlWithParams('', endpoint, params)
      : endpoint;

    // Try network first if online
    if (this.isOnline) {
      const response = await this.requestWithRetry<T>({
        method: 'GET',
        url,
      });

      if (response.success && response.data) {
        // Cache the response in apiClient's cache
        await this.cacheData(cacheKey, response.data, ttl);
        
        // CRITICAL FIX: Also save to storageService so Redux can access it
        await this.saveToStorageService(cacheKey, response.data);
        
        return response;
      }

      // Network failed, try cache
      logger.warn('[ApiClient] Network request failed, trying cache', { url });
    }

    // Try cache
    const cached = await this.getCachedData<T>(cacheKey);
    if (cached) {
      logger.info('[ApiClient] Using cached data', { cacheKey });
      return {
        success: true,
        data: cached,
        fromCache: true,
      };
    }

    // No cache available
    return {
      success: false,
      error: this.isOnline ? 'Request failed and no cache available' : 'Offline and no cache available',
    };
  }

  /**
   * Save data to storageService for Redux integration
   * CRITICAL: This bridges the gap between apiClient cache and storageService
   */
  private async saveToStorageService(cacheKey: string, data: unknown): Promise<void> {
    try {
      // Dynamically import to avoid circular dependency
      const { default: storageService } = await import('../services/storageService');
      
      // Map cache keys to storage methods
      if (cacheKey === CACHE_KEYS.CONTENT) {
        // CRITICAL FIX: Content response needs special handling
        // The API returns a wrapped response: { success, data: {...actual content...}, error, timestamp }
        // We need to extract the actual content and save nested data separately
        const wrappedResponse = data as any;
        
        // Unwrap the response to get actual content - handle both wrapped and unwrapped formats
        const contentResponse = wrappedResponse.data || wrappedResponse;
        
        // Save the actual content (not the wrapper)
        await storageService.saveScreenContent(contentResponse);
        logger.debug('[ApiClient] Saved screen content to storageService');
        
        // CRITICAL: Extract and save schedule separately for Redux
        // Schedule might be in the content response or nested in ScreenContent
        if (contentResponse.schedule) {
          await storageService.saveSchedule(contentResponse.schedule);
          logger.debug('[ApiClient] Extracted and saved schedule separately', {
            hasItems: !!contentResponse.schedule.items,
            itemCount: contentResponse.schedule.items?.length || 0,
          });
        }
        
        // Also extract and save prayer times if present in content
        if (contentResponse.prayerTimes) {
          await storageService.savePrayerTimes(contentResponse.prayerTimes);
          logger.debug('[ApiClient] Extracted and saved prayer times from content');
        }
        
        // Extract and save events if present
        if (contentResponse.events) {
          await storageService.saveEvents(contentResponse.events);
          logger.debug('[ApiClient] Extracted and saved events from content');
        }
      } else if (cacheKey.startsWith(CACHE_KEYS.PRAYER_TIMES)) {
        await storageService.savePrayerTimes(data as any);
        logger.debug('[ApiClient] Saved prayer times to storageService');
      } else if (cacheKey === CACHE_KEYS.EVENTS) {
        await storageService.saveEvents(data as any);
        logger.debug('[ApiClient] Saved events to storageService');
      }
    } catch (error) {
      logger.error('[ApiClient] Failed to save to storageService', { cacheKey, error });
      // Don't throw - this is a non-critical operation
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Cache Methods
  // ==========================================================================

  private async cacheData<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const cached: CachedData<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      await localforage.setItem(key, cached);
      logger.debug('[ApiClient] Data cached', { key });
    } catch (error) {
      logger.error('[ApiClient] Failed to cache data', { key, error });
    }
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await localforage.getItem<CachedData<T>>(key);
      if (!cached) return null;

      // Check if expired
      const age = Date.now() - cached.timestamp;
      if (age > cached.ttl) {
        logger.debug('[ApiClient] Cache expired', { key, age, ttl: cached.ttl });
        // Don't delete - still useful as fallback
      }

      return cached.data;
    } catch (error) {
      logger.error('[ApiClient] Failed to get cached data', { key, error });
      return null;
    }
  }

  // ==========================================================================
  // Pairing API Methods
  // ==========================================================================

  /**
   * Request a new pairing code
   */
  public async requestPairingCode(deviceInfo: DeviceInfo): Promise<ApiResponse<PairingCodeResponse>> {
    logger.info('[ApiClient] Requesting pairing code');

    return this.requestWithRetry<PairingCodeResponse>({
      method: 'POST',
      url: PAIRING_ENDPOINTS.REQUEST_PAIRING_CODE,
      data: { deviceInfo },
    });
  }

  /**
   * Check if pairing is complete
   */
  public async checkPairingStatus(pairingCode: string): Promise<ApiResponse<PairingStatusResponse>> {
    logger.debug('[ApiClient] Checking pairing status');

    return this.requestWithRetry<PairingStatusResponse>({
      method: 'POST',
      url: PAIRING_ENDPOINTS.CHECK_PAIRING_STATUS,
      data: { pairingCode },
    });
  }

  /**
   * Get credentials after successful pairing
   */
  public async getPairedCredentials(pairingCode: string): Promise<ApiResponse<PairedCredentialsResponse>> {
    logger.info('[ApiClient] Fetching paired credentials');

    const response = await this.requestWithRetry<PairedCredentialsResponse>({
      method: 'POST',
      url: PAIRING_ENDPOINTS.GET_PAIRED_CREDENTIALS,
      data: { pairingCode },
    });

    // If successful, save credentials
    if (response.success && response.data) {
      // Handle nested data structure: response.data.data may contain the actual credentials
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = response.data as any;
      const credentialsData = rawData.data || rawData;

      logger.info('[ApiClient] Extracting credentials from paired-credentials response', {
        hasNestedData: !!rawData.data,
        credentialsDataKeys: Object.keys(credentialsData || {}),
        hasApiKey: !!credentialsData?.apiKey,
        hasScreenId: !!credentialsData?.screenId,
        hasMasjidId: !!credentialsData?.masjidId,
      });

      const { apiKey, screenId, masjidId, masjidName, screenName, orientation } = credentialsData;

      // Validate required fields
      if (!apiKey) {
        logger.error('[ApiClient] API response missing apiKey', { credentialsData });
        return {
          success: false,
          error: 'Pairing response missing apiKey',
        };
      }

      if (!screenId) {
        logger.error('[ApiClient] API response missing screenId', { credentialsData });
        return {
          success: false,
          error: 'Pairing response missing screenId',
        };
      }

      // Save credentials via credential service
      credentialService.saveCredentials({ apiKey, screenId, masjidId });

      // Log warning if masjidId is missing (required for WebSocket)
      if (!masjidId) {
        logger.warn('[ApiClient] No masjidId in paired-credentials response - WebSocket may fail to connect');
      }

      // Return normalised response with extracted credentials
      return {
        success: true,
        data: {
          apiKey,
          screenId,
          masjidId: masjidId || '',
          masjidName: masjidName || '',
          screenName: screenName || '',
          orientation: orientation || 'LANDSCAPE',
        },
      };
    }

    return response;
  }

  // ==========================================================================
  // Screen API Methods (Authenticated)
  // ==========================================================================

  /**
   * Send heartbeat to the server
   */
  public async sendHeartbeat(request: HeartbeatRequest): Promise<ApiResponse<HeartbeatResponse>> {
    if (!credentialService.hasCredentials()) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    return this.requestWithRetry<HeartbeatResponse>({
      method: 'POST',
      url: SCREEN_ENDPOINTS.HEARTBEAT,
      data: request,
    });
  }

  /**
   * Get screen content
   */
  public async getContent(): Promise<ApiResponse<ContentResponse>> {
    if (!credentialService.hasCredentials()) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    return this.getWithCache<ContentResponse>(
      SCREEN_ENDPOINTS.GET_CONTENT,
      CACHE_KEYS.CONTENT,
      CACHE_TTL.CONTENT
    );
  }

  /**
   * Get prayer times
   */
  public async getPrayerTimes(date?: string): Promise<ApiResponse<PrayerTimesResponse>> {
    if (!credentialService.hasCredentials()) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    return this.getWithCache<PrayerTimesResponse>(
      SCREEN_ENDPOINTS.GET_PRAYER_TIMES,
      `${CACHE_KEYS.PRAYER_TIMES}_${date || 'today'}`,
      CACHE_TTL.PRAYER_TIMES,
      date ? { date } : undefined
    );
  }

  /**
   * Get prayer status
   */
  public async getPrayerStatus(): Promise<ApiResponse<PrayerStatusResponse>> {
    if (!credentialService.hasCredentials()) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Prayer status shouldn't be cached for long
    return this.requestWithRetry<PrayerStatusResponse>({
      method: 'GET',
      url: SCREEN_ENDPOINTS.GET_PRAYER_STATUS,
    });
  }

  /**
   * Get events
   */
  public async getEvents(limit?: number): Promise<ApiResponse<EventsResponse>> {
    if (!credentialService.hasCredentials()) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    return this.getWithCache<EventsResponse>(
      SCREEN_ENDPOINTS.GET_EVENTS,
      CACHE_KEYS.EVENTS,
      CACHE_TTL.EVENTS,
      limit ? { limit } : undefined
    );
  }

  /**
   * Get sync status (to check if content has changed)
   */
  public async getSyncStatus(): Promise<ApiResponse<SyncStatusResponse>> {
    if (!credentialService.hasCredentials()) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    return this.getWithCache<SyncStatusResponse>(
      SCREEN_ENDPOINTS.GET_SYNC_STATUS,
      CACHE_KEYS.SYNC_STATUS,
      CACHE_TTL.SYNC_STATUS
    );
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clear all cached data
   */
  public async clearCache(): Promise<void> {
    try {
      await Promise.all([
        localforage.removeItem(CACHE_KEYS.CONTENT),
        localforage.removeItem(CACHE_KEYS.PRAYER_TIMES),
        localforage.removeItem(CACHE_KEYS.EVENTS),
        localforage.removeItem(CACHE_KEYS.SYNC_STATUS),
      ]);
      logger.info('[ApiClient] Cache cleared');
    } catch (error) {
      logger.error('[ApiClient] Failed to clear cache', { error });
    }
  }

  /**
   * Check if authenticated
   */
  public isAuthenticated(): boolean {
    return credentialService.hasCredentials();
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Update base URL (useful for testing)
   */
  public setBaseUrl(url: string): void {
    this.axiosInstance.defaults.baseURL = url;
    logger.info('[ApiClient] Base URL updated', { url });
  }
}

// Export singleton instance
const apiClient = new ApiClient();
export default apiClient;

