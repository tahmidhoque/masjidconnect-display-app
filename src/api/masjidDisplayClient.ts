import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import localforage from 'localforage';
import {
  ApiCredentials,
  HeartbeatRequest,
  HeartbeatResponse,
  ScreenContent,
  PrayerTimes,
  PrayerStatus,
  EventsResponse,
  ApiResponse,
  RequestPairingCodeResponse,
  CheckPairingStatusResponse,
  RequestPairingCodeRequest,
  CheckPairingStatusRequest,
  PairedCredentialsRequest,
  PairedCredentialsResponse
} from './models';
import logger, { setLastError } from '../utils/logger';

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  PRAYER_TIMES: 10 * 60 * 1000, // 10 minutes (was 1 hour)
  CONTENT: 5 * 60 * 1000, // 5 minutes
  EVENTS: 30 * 60 * 1000, // 30 minutes
  PRAYER_STATUS: 60 * 1000, // 60 seconds (was 15 seconds)
};

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  HEARTBEAT: 2 * 60 * 1000, // 2 minutes (was 60 seconds)
  CONTENT: 10 * 60 * 1000, // 10 minutes (was 5 minutes)
  PRAYER_STATUS: 60 * 1000, // 60 seconds (was 15 seconds)
  PRAYER_TIMES: 10 * 60 * 1000, // 10 minutes (was 1 hour)
  EVENTS: 30 * 60 * 1000, // 30 minutes
};

// Error retry settings
const ERROR_RETRY = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 2000, // 2 seconds
  MAX_DELAY: 30000, // 30 seconds
  JITTER_FACTOR: 0.2 // ±20% jitter
};

// Error backoff tracking
interface EndpointBackoff {
  failCount: number;
  nextRetry: number; // timestamp
  inBackoff: boolean;
}

// Storage keys for credentials
const STORAGE_KEYS = {
  API_KEY: 'masjid_api_key',
  SCREEN_ID: 'masjid_screen_id',
};

// Cache interface
interface CacheItem<T> {
  data: T;
  expiry: number;
}

// Add debounce helper
const debounceMap = new Map<string, number>();
function shouldDebounceLog(key: string, intervalMs: number = 10000): boolean {
  const now = Date.now();
  const lastTime = debounceMap.get(key) || 0;
  
  if (now - lastTime < intervalMs) {
    return true; // Debounce this log
  }
  
  // Update last time
  debounceMap.set(key, now);
  return false; // Don't debounce
}

class MasjidDisplayClient {
  private client: AxiosInstance;
  private credentials: ApiCredentials | null = null;
  private baseURL: string;
  private cache: Map<string, CacheItem<any>> = new Map();
  private lastError: string | null = null;
  private startTime: number = Date.now();
  private online: boolean = navigator.onLine;
  private requestQueue: Array<() => Promise<void>> = [];
  private endpointBackoffs: Map<string, EndpointBackoff> = new Map();
  private isLoading: Map<string, boolean> = new Map();
  private authInitialized: boolean = false;

  constructor() {
    // Set the baseURL from environment or use default
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    
    // Log the baseURL for debugging using console directly to avoid circular dependency
    console.log('Initializing MasjidDisplayClient with baseURL:', this.baseURL);
    
    // Initialize the axios client
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      withCredentials: false // Default to false for all requests
    });

    // Set up request interceptor
    this.client.interceptors.request.use((config) => {
      // Add authentication headers if we have credentials
      if (this.credentials) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${this.credentials.apiKey}`;
        config.headers['X-Screen-ID'] = this.credentials.screenId;
        
        // Set Content-Type header only for POST/PUT requests
        if (config.method?.toLowerCase() === 'post' || config.method?.toLowerCase() === 'put') {
          config.headers['Content-Type'] = 'application/json';
        }
        
        // Log authentication headers for debugging
        logger.debug('Request with auth headers', { 
          url: config.url,
          hasApiKey: !!this.credentials.apiKey,
          hasScreenId: !!this.credentials.screenId,
          apiKeyLength: this.credentials.apiKey?.length || 0,
          screenIdLength: this.credentials.screenId?.length || 0,
          withCredentials: config.withCredentials
        });
      } else {
        logger.warn('Request without auth credentials', { url: config.url });
      }
      
      return config;
    });

    // Set up response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );

    // Set up network listeners
    this.setupNetworkListeners();

    // Load credentials from storage
    this.loadCredentials().then(() => {
      this.authInitialized = true;
      logger.info('Auth initialization complete', { isAuthenticated: this.isAuthenticated() });
    });
  }

  // Set up network status listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  // Handle coming back online
  private handleOnline = (): void => {
    logger.info('Network connection restored');
    this.online = true;
    this.processQueue();
  };

  // Handle going offline
  private handleOffline = (): void => {
    logger.warn('Network connection lost');
    this.online = false;
  };

  // Process queued requests when back online
  private async processQueue(): Promise<void> {
    if (!this.online || this.requestQueue.length === 0) return;

    logger.info(`Processing ${this.requestQueue.length} queued requests`);
    
    // Process all queued requests
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    
    for (const request of queue) {
      try {
        await request();
      } catch (error) {
        logger.error('Error processing queued request', { error });
      }
    }
  }

  // Handle API errors and implement backoff for specific endpoints
  private handleApiError(error: any): void {
    if (!error || !error.config) {
      logger.error('Unknown error without config', { error: error?.message });
      this.lastError = 'Unknown error';
      setLastError(this.lastError);
      return;
    }

    const endpoint = error.config.url || 'unknown';
    
    // Track consecutive failures for this endpoint
    const backoff = this.endpointBackoffs.get(endpoint) || { 
      failCount: 0, 
      nextRetry: 0,
      inBackoff: false
    };
    
    backoff.failCount++;
    
    if (error.response) {
      const status = error.response.status;
      
      // Calculate backoff time based on failure count (exponential backoff)
      if (status === 429 || status >= 500) {
        const retryAfter = error.response.headers?.['retry-after'];
        if (retryAfter) {
          // Use server's retry-after if available
          backoff.nextRetry = Date.now() + (parseInt(retryAfter, 10) * 1000);
        } else {
          // Calculate exponential backoff
          const delay = Math.min(
            ERROR_RETRY.INITIAL_DELAY * Math.pow(2, backoff.failCount - 1),
            ERROR_RETRY.MAX_DELAY
          );
          
          // Add jitter
          const jitter = 1 + (Math.random() * ERROR_RETRY.JITTER_FACTOR * 2 - ERROR_RETRY.JITTER_FACTOR);
          backoff.nextRetry = Date.now() + (delay * jitter);
        }
        
        backoff.inBackoff = true;
        logger.warn(`Endpoint ${endpoint} in backoff until ${new Date(backoff.nextRetry).toISOString()}`, { 
          status, 
          failCount: backoff.failCount 
        });
      }
      
      // Handle specific status codes
      switch (status) {
        case 401:
          logger.error('Authentication error. Need to re-authenticate.', { status });
          this.clearCredentials();
          break;
        case 429:
          logger.warn('Rate limit exceeded. Implementing backoff.', { status, nextRetry: backoff.nextRetry });
          break;
        default:
          logger.error(`API error: ${status}`, { status, data: error.response.data });
      }
      
      // Store last error for heartbeat
      this.lastError = `API error ${status}: ${error.response.data?.message || 'Unknown error'}`;
      setLastError(this.lastError);
    } else if (error.request) {
      // Network or timeout error
      backoff.failCount = Math.min(backoff.failCount, ERROR_RETRY.MAX_RETRIES); // Cap at max retries
      const delay = Math.min(
        ERROR_RETRY.INITIAL_DELAY * Math.pow(2, backoff.failCount - 1),
        ERROR_RETRY.MAX_DELAY
      );
      backoff.nextRetry = Date.now() + delay;
      backoff.inBackoff = true;
      
      logger.error('No response received', { 
        request: error.request,
        failCount: backoff.failCount,
        nextRetry: new Date(backoff.nextRetry).toISOString()
      });
      this.lastError = 'Network error: No response received';
      setLastError(this.lastError);
    } else {
      logger.error('Request setup error', { message: error.message });
      this.lastError = `Request error: ${error.message}`;
      setLastError(this.lastError);
    }
    
    // Update the backoff for this endpoint
    this.endpointBackoffs.set(endpoint, backoff);
    
    // Reset backoff if we hit the max retries
    if (backoff.failCount > ERROR_RETRY.MAX_RETRIES) {
      logger.warn(`Max retries reached for ${endpoint}, resetting backoff but will use longer intervals`);
      backoff.failCount = ERROR_RETRY.MAX_RETRIES; // Keep at max for longer delays
      backoff.inBackoff = false; // Allow requests but they'll still use longer delays
      this.endpointBackoffs.set(endpoint, backoff);
    }
  }

  // Check if an endpoint is in backoff
  private isInBackoff(endpoint: string): boolean {
    const backoff = this.endpointBackoffs.get(endpoint);
    if (!backoff || !backoff.inBackoff) return false;
    
    // Check if we're past the backoff time
    if (Date.now() > backoff.nextRetry) {
      // Reset backoff state but keep count for next failure
      backoff.inBackoff = false;
      this.endpointBackoffs.set(endpoint, backoff);
      return false;
    }
    
    return true;
  }

  // Reset backoff for an endpoint after successful request
  private resetBackoff(endpoint: string): void {
    this.endpointBackoffs.delete(endpoint);
  }

  // Load credentials from storage
  private async loadCredentials(): Promise<void> {
    try {
      // Try LocalForage first
      let apiKey = await localforage.getItem<string>(STORAGE_KEYS.API_KEY);
      let screenId = await localforage.getItem<string>(STORAGE_KEYS.SCREEN_ID);
      
      // If not found, try localStorage as fallback
      if (!apiKey) apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
      if (!screenId) screenId = localStorage.getItem(STORAGE_KEYS.SCREEN_ID);
      
      if (apiKey && screenId) {
        this.credentials = { apiKey, screenId };
        logger.info('Credentials loaded from storage', { 
          apiKeyLength: apiKey.length, 
          screenIdLength: screenId.length 
        });
      } else {
        logger.warn('No credentials found in storage');
      }
    } catch (error) {
      logger.error('Error loading credentials', { error });
    }
  }

  // Set credentials and save to storage
  public async setCredentials(credentials: ApiCredentials): Promise<void> {
    this.credentials = credentials;
    
    try {
      // Store in localforage
      await localforage.setItem(STORAGE_KEYS.API_KEY, credentials.apiKey);
      await localforage.setItem(STORAGE_KEYS.SCREEN_ID, credentials.screenId);
      
      // Store in ALL possible formats used by different parts of the application
      // 1. Original format used by AuthContext
      localStorage.setItem(STORAGE_KEYS.API_KEY, credentials.apiKey);
      localStorage.setItem(STORAGE_KEYS.SCREEN_ID, credentials.screenId);
      
      // 2. Alternative formats used by other components
      localStorage.setItem('apiKey', credentials.apiKey);
      localStorage.setItem('screenId', credentials.screenId);
      
      // 3. JSON format for additional compatibility
      localStorage.setItem('masjidconnect_credentials', JSON.stringify(credentials));
      
      logger.info('Credentials saved to storage in all formats', { 
        apiKeyLength: credentials.apiKey.length, 
        screenIdLength: credentials.screenId.length 
      });
    } catch (error) {
      logger.error('Error saving credentials', { error });
    }
  }

  // Clear credentials from memory and storage
  public async clearCredentials(): Promise<void> {
    this.credentials = null;
    
    try {
      // Clear from localforage
      await localforage.removeItem(STORAGE_KEYS.API_KEY);
      await localforage.removeItem(STORAGE_KEYS.SCREEN_ID);
      
      // Clear ALL formats from localStorage
      // 1. Original format used by AuthContext
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
      localStorage.removeItem(STORAGE_KEYS.SCREEN_ID);
      
      // 2. Alternative formats used by other components
      localStorage.removeItem('apiKey');
      localStorage.removeItem('screenId');
      
      // 3. JSON format
      localStorage.removeItem('masjidconnect_credentials');
      
      // 4. Authentication state flags
      localStorage.removeItem('isPaired');
      
      logger.info('Credentials cleared from all storage');
    } catch (error) {
      logger.error('Error clearing credentials', { error });
    }
  }

  // Check if authenticated
  public isAuthenticated(): boolean {
    // Only check after auth initialization is complete
    if (!this.authInitialized) {
      logger.warn('Auth not yet initialized, returning false for isAuthenticated');
      return false;
    }
    
    const hasCredentials = this.credentials !== null;
    
    // Log authentication status for debugging
    if (!hasCredentials) {
      logger.warn('Not authenticated: credentials are null');
    } else if (!this.credentials?.apiKey || !this.credentials?.screenId) {
      logger.warn('Incomplete credentials', {
        hasApiKey: !!this.credentials?.apiKey,
        hasScreenId: !!this.credentials?.screenId
      });
    }
    
    return hasCredentials && !!this.credentials?.apiKey && !!this.credentials?.screenId;
  }

  // Debug method to check credentials
  public logCredentialsStatus(): void {
    logger.info('Credentials status', {
      inMemory: !!this.credentials,
      hasApiKey: !!this.credentials?.apiKey,
      hasScreenId: !!this.credentials?.screenId,
      localStorageApiKey: !!localStorage.getItem(STORAGE_KEYS.API_KEY),
      localStorageScreenId: !!localStorage.getItem(STORAGE_KEYS.SCREEN_ID),
      authInitialized: this.authInitialized
    });
  }

  // Fetch with cache
  private async fetchWithCache<T>(
    endpoint: string, 
    options: AxiosRequestConfig = {}, 
    cacheTime: number = 0
  ): Promise<ApiResponse<T>> {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Skip cache if cacheTime is 0 (force refresh)
    if (cacheTime <= 0) {
      if (!shouldDebounceLog(`skip-cache-${endpoint}`)) {
        logger.debug(`Skipping cache for ${endpoint} (forced refresh)`);
      }
      return this.fetchWithRetry<T>(endpoint, options);
    }
    
    // Check if a request to this endpoint is already in progress
    if (this.isLoading.get(endpoint)) {
      if (!shouldDebounceLog(`loading-${endpoint}`)) {
        logger.debug(`Request to ${endpoint} already in progress, using cache if available`);
      }
      
      // Return cached data if available
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
      
      // Wait for a brief moment and then retry
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.fetchWithCache<T>(endpoint, options, cacheTime);
    }
    
    // Check if endpoint is in backoff
    if (this.isInBackoff(endpoint)) {
      logger.warn(`Endpoint ${endpoint} is in backoff, using cache instead`);
      
      // Return cached data if available
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
      
      return {
        success: false,
        error: 'Service temporarily unavailable, in backoff mode'
      };
    }
    
    // Return cached data if valid and available
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      if (!shouldDebounceLog(`use-cache-${endpoint}`)) {
        logger.debug(`Using cached data for ${endpoint}`);
      }
      return cached.data;
    }
    
    // If offline, return expired cache as fallback if available
    if (!this.online) {
      if (cached) {
        logger.info(`Offline: Using expired cache for ${endpoint}`);
        return cached.data;
      }
      
      // Queue the request for when we're back online
      return new Promise((resolve, reject) => {
        this.requestQueue.push(async () => {
          try {
            const result = await this.fetchWithCache<T>(endpoint, options, cacheTime);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    // Fetch with retry
    return this.fetchWithRetry<T>(endpoint, options, cacheTime);
  }
  
  // Fetch with exponential backoff retry
  private async fetchWithRetry<T>(
    endpoint: string, 
    options: AxiosRequestConfig = {}, 
    cacheTime: number = 0,
    retries: number = 0
  ): Promise<ApiResponse<T>> {
    const maxRetries = 3;
    let retryDelay = 1000; // Start with 1 second
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Mark this endpoint as loading
    this.isLoading.set(endpoint, true);
    
    try {
      if (!shouldDebounceLog(`request-${endpoint}`)) {
        logger.debug(`Making request to ${endpoint}`, { 
          method: options.method, 
          hasData: !!options.data,
          hasAuth: this.isAuthenticated(),
          withCredentials: options.withCredentials,
          url: this.baseURL + endpoint
        });
      }
      
      const response = await this.client.request<any, AxiosResponse<T>>({
        url: endpoint,
        ...options,
      });
      
      if (!shouldDebounceLog(`response-${endpoint}`)) {
        logger.debug(`Response from ${endpoint}:`, {
          status: response.status,
          hasData: !!response.data
        });
      }
      
      const result: ApiResponse<T> = {
        success: true,
        data: response.data,
      };
      
      // Cache the response if cacheTime > 0
      if (cacheTime > 0) {
        this.cache.set(cacheKey, {
          data: result,
          expiry: Date.now() + cacheTime,
        });
      }
      
      // Reset backoff for this endpoint after successful request
      this.resetBackoff(endpoint);
      
      // Mark this endpoint as no longer loading
      this.isLoading.set(endpoint, false);
      
      return result;
    } catch (error: any) {
      // Only log errors that aren't debounced
      if (!shouldDebounceLog(`error-${endpoint}`)) {
        logger.error(`Error fetching ${endpoint}:`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          config: error.config,
          isCorsError: error.message?.includes('CORS')
        });
      }
      
      // Mark this endpoint as no longer loading
      this.isLoading.set(endpoint, false);
      
      // Handle unauthorized responses (invalid token)
      if (error.response?.status === 401) {
        // If we're making an authorized request and get 401, the token is likely invalid
        const wasAuthorized = this.isAuthenticated() && 
                              (options.headers?.['Authorization'] || 
                               options.headers?.['authorization'] ||
                               !!this.credentials);
                               
        if (wasAuthorized) {
          logger.warn('Received 401 with auth token, clearing credentials', { endpoint });
          // clear credentials as they appear to be invalid
          await this.clearCredentials();
          
          return {
            success: false,
            error: 'Authentication failed. Please re-authenticate.',
            status: 401
          };
        }
      }
      
      // If we've reached max retries, throw the error
      if (retries >= maxRetries) {
        // Return expired cache as fallback if available
        const cached = this.cache.get(cacheKey);
        if (cached) {
          logger.warn(`Error fetching ${endpoint}, using expired cache`);
          return cached.data;
        }
        
        // If this is a network error and we're offline, return a more specific error
        if (!navigator.onLine) {
          return {
            success: false,
            error: 'Device is offline. Please check your internet connection.',
            status: 0
          };
        }
        
        return {
          success: false,
          error: error.message || 'Unknown error',
          status: error.response?.status
        };
      }
      
      // If rate limited (429) or server error (5xx), retry with backoff
      if (
        error.response?.status === 429 || 
        (error.response?.status >= 500 && error.response?.status < 600)
      ) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
        const delay = retryDelay * jitter;
        
        logger.info(`Retrying ${endpoint} in ${Math.round(delay)}ms (attempt ${retries + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retryDelay *= 2; // Double the delay for next retry
        return this.fetchWithRetry<T>(endpoint, options, cacheTime, retries + 1);
      }
      
      // For other errors, don't retry
      // Return expired cache as fallback if available
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.warn(`Error fetching ${endpoint}, using expired cache`);
        return cached.data;
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error',
        status: error.response?.status
      };
    }
  }

  // Send heartbeat to server
  public async sendHeartbeat(status: HeartbeatRequest): Promise<ApiResponse<HeartbeatResponse>> {
    // Check if we're authenticated
    if (!this.isAuthenticated()) {
      logger.warn('sendHeartbeat called without authentication');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Use the correct endpoint from the integration guide
      const endpoint = '/api/screen/heartbeat';
      
      const payload = {
        screenId: this.credentials!.screenId,
        status: status.status,
        deviceInfo: status.metrics
      };

      const options = {
        method: 'POST',
        data: payload
      };

      const result = await this.fetchWithRetry<HeartbeatResponse>(endpoint, options);
      return result;
    } catch (error) {
      logger.error('Error sending heartbeat', { error });
      return { success: false, error: 'Failed to send heartbeat' };
    }
  }

  // Get screen content
  public async getScreenContent(forceRefresh: boolean = false): Promise<ApiResponse<ScreenContent>> {
    if (!this.isAuthenticated()) {
      logger.warn('getScreenContent called without authentication');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Use the correct endpoint from the integration guide
      const endpoint = `/api/screen/content?screenId=${this.credentials!.screenId}`;
      
      return this.fetchWithCache<ScreenContent>(
        endpoint, 
        {}, 
        forceRefresh ? 0 : CACHE_EXPIRATION.CONTENT
      );
    } catch (error) {
      logger.error('Error fetching screen content', { error });
      return { success: false, error: 'Failed to fetch screen content' };
    }
  }

  // Get prayer times
  public async getPrayerTimes(startDate?: string, endDate?: string, forceRefresh: boolean = false): Promise<ApiResponse<PrayerTimes[]>> {
    if (!this.isAuthenticated()) {
      logger.warn('getPrayerTimes called without authentication');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Use the correct endpoint from the integration guide
      const endpoint = `/api/screen/prayer-times?screenId=${this.credentials!.screenId}`;
      
      return this.fetchWithCache<PrayerTimes[]>(
        endpoint, 
        {}, 
        forceRefresh ? 0 : CACHE_EXPIRATION.PRAYER_TIMES
      );
    } catch (error) {
      logger.error('Error fetching prayer times', { error });
      return { success: false, error: 'Failed to fetch prayer times' };
    }
  }

  // Get prayer status
  public async getPrayerStatus(forceRefresh: boolean = false): Promise<ApiResponse<PrayerStatus>> {
    if (!this.isAuthenticated()) {
      logger.warn('getPrayerStatus called without authentication');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Use the correct endpoint from the integration guide
      const endpoint = `/api/screen/prayer-status?screenId=${this.credentials!.screenId}`;
      
      return this.fetchWithCache<PrayerStatus>(
        endpoint, 
        {}, 
        forceRefresh ? 0 : CACHE_EXPIRATION.PRAYER_STATUS
      );
    } catch (error) {
      logger.error('Error fetching prayer status', { error });
      return { success: false, error: 'Failed to fetch prayer status' };
    }
  }

  // Get events
  public async getEvents(count: number = 5, forceRefresh: boolean = false): Promise<ApiResponse<EventsResponse>> {
    if (!this.isAuthenticated()) {
      logger.warn('getEvents called without authentication');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Use the correct endpoint from the integration guide
      const endpoint = `/api/screen/events?screenId=${this.credentials!.screenId}`;
      
      return this.fetchWithCache<EventsResponse>(
        endpoint, 
        {}, 
        forceRefresh ? 0 : CACHE_EXPIRATION.EVENTS
      );
    } catch (error) {
      logger.error('Error fetching events', { error });
      return { success: false, error: 'Failed to fetch events' };
    }
  }

  // Request a pairing code
  public async requestPairingCode(deviceInfo: { deviceType: string, orientation: string }): Promise<ApiResponse<RequestPairingCodeResponse>> {
    try {
      // Use the correct endpoint from the integration guide
      const endpoint = '/api/screens/unpaired';
      
      const payload: RequestPairingCodeRequest = {
        deviceInfo: {
          deviceId: this.generateDeviceId(),
          model: deviceInfo.deviceType,
          platform: 'Web'
        }
      };

      const options = {
        method: 'POST',
        data: payload,
        withCredentials: false
      };

      const result = await this.fetchWithRetry<RequestPairingCodeResponse>(endpoint, options);
      return result;
    } catch (error) {
      logger.error('Error requesting pairing code', { error });
      return { success: false, error: 'Failed to request pairing code' };
    }
  }

  // Generate a consistent device ID
  private generateDeviceId(): string {
    // Use a stored ID if we have one
    const storedId = localStorage.getItem('device_id');
    if (storedId) return storedId;
    
    // Generate a new one if we don't
    const newId = 'web-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', newId);
    return newId;
  }

  // Check pairing status
  public async checkPairingStatus(pairingCode: string): Promise<boolean> {
    try {
      // Use the correct endpoint from the integration guide
      const endpoint = '/api/screens/check-simple';
      
      const payload: CheckPairingStatusRequest = {
        pairingCode: pairingCode
      };

      const options = {
        method: 'POST',
        data: payload,
        withCredentials: false
      };

      const result = await this.fetchWithRetry<CheckPairingStatusResponse>(endpoint, options);
      
      // Log the full response for debugging
      logger.info('Received check-simple response', { 
        data: result.data, 
        success: result.success 
      });
      
      if (result.success && result.data) {
        // Check for both paired and isPaired properties (API returns "paired" but our interface expects "isPaired")
        const isPaired = result.data.isPaired === true || result.data.paired === true;
        const screenId = result.data.screenId;
        const apiKey = result.data.apiKey;
        const masjidId = result.data.masjidId;
        
        logger.info('Extracted pairing info from response', { 
          isPaired, 
          hasScreenId: !!screenId, 
          hasApiKey: !!apiKey 
        });
        
        if (isPaired && screenId) {
          // If the API response includes the apiKey directly, use it
          if (apiKey) {
            logger.info('API key included in check-simple response, setting credentials directly');
            
            const credentials: ApiCredentials = {
              apiKey: apiKey,
              screenId: screenId
            };
            
            // Set the credentials immediately
            await this.setCredentials(credentials);
            
            // Set isPaired flag in localStorage for other components to detect
            localStorage.setItem('isPaired', 'true');
            
            // Also store masjidId if available
            if (masjidId) {
              localStorage.setItem('masjid_id', masjidId);
            }
            
            // Dispatch a custom event to notify components about authentication
            logger.info('Dispatching auth event for components to detect');
            try {
              const authEvent = new CustomEvent('masjidconnect:authenticated', {
                detail: { apiKey, screenId }
              });
              window.dispatchEvent(authEvent);
            } catch (error) {
              logger.error('Error dispatching auth event', { error });
            }
            
            return true;
          } else {
            // Otherwise, get the full credentials using the paired-credentials endpoint
            logger.info('Pairing successful, fetching credentials from paired-credentials endpoint');
            await this.fetchPairedCredentials(pairingCode);
            
            // Set isPaired flag in localStorage for other components to detect
            localStorage.setItem('isPaired', 'true');
            
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Error checking pairing status', { error });
      return false;
    }
  }

  // Get credentials after successful pairing
  private async fetchPairedCredentials(pairingCode: string): Promise<void> {
    try {
      const endpoint = '/api/screens/paired-credentials';
      
      const payload: PairedCredentialsRequest = {
        pairingCode: pairingCode,
        deviceInfo: {
          deviceId: this.generateDeviceId(),
          model: navigator.userAgent,
          platform: 'Web'
        }
      };

      const options = {
        method: 'POST',
        data: payload,
        withCredentials: false
      };

      const result = await this.fetchWithRetry<PairedCredentialsResponse>(endpoint, options);
      
      if (result.success && result.data) {
        const credentials: ApiCredentials = {
          apiKey: result.data.apiKey,
          screenId: result.data.screenId
        };
        
        await this.setCredentials(credentials);
        logger.info('Successfully set credentials after pairing');
      } else {
        logger.error('Failed to fetch credentials after pairing', { result });
      }
    } catch (error) {
      logger.error('Error fetching paired credentials', { error });
    }
  }

  // Get polling interval
  public getPollingInterval(): number {
    return 5000; // Default to 5 seconds for pairing checks
  }

  // Clean up resources
  public cleanup(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  // Invalidate all caches
  public invalidateAllCaches(): void {
    logger.info('Invalidating all caches');
    this.cache.clear();
  }
  
  // Invalidate specific endpoint cache
  public invalidateCache(endpoint: string): void {
    logger.info(`Invalidating cache for ${endpoint}`);
    
    // Find and remove all cache entries that start with this endpoint
    for (const cacheKey of Array.from(this.cache.keys())) {
      if (cacheKey.startsWith(endpoint)) {
        this.cache.delete(cacheKey);
      }
    }
  }
}

// Create and export a singleton instance
const masjidDisplayClient = new MasjidDisplayClient();
export default masjidDisplayClient; 