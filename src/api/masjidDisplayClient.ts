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
  CheckPairingStatusResponse
} from './models';
import logger, { setLastError } from '../utils/logger';

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  PRAYER_TIMES: 24 * 60 * 60 * 1000, // 24 hours
  CONTENT: 5 * 60 * 1000, // 5 minutes
  EVENTS: 30 * 60 * 1000, // 30 minutes
  PRAYER_STATUS: 30 * 1000, // 30 seconds
};

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  HEARTBEAT: 60 * 1000, // 60 seconds
  CONTENT: 5 * 60 * 1000, // 5 minutes
  PRAYER_STATUS: 30 * 1000, // 30 seconds
  PRAYER_TIMES: 24 * 60 * 60 * 1000, // 24 hours
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
      
      // Also store in localStorage for compatibility with AuthContext
      localStorage.setItem(STORAGE_KEYS.API_KEY, credentials.apiKey);
      localStorage.setItem(STORAGE_KEYS.SCREEN_ID, credentials.screenId);
      
      logger.info('Credentials saved to storage', { 
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
      
      // Also clear from localStorage
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
      localStorage.removeItem(STORAGE_KEYS.SCREEN_ID);
      
      logger.info('Credentials cleared from storage');
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

  // Generic fetch with cache and retry
  private async fetchWithCache<T>(
    endpoint: string, 
    options: AxiosRequestConfig = {}, 
    cacheTime: number = 0
  ): Promise<ApiResponse<T>> {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Check if a request to this endpoint is already in progress
    if (this.isLoading.get(endpoint)) {
      logger.debug(`Request to ${endpoint} already in progress, using cache if available`);
      
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
      logger.debug(`Using cached data for ${endpoint}`);
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
      logger.debug(`Making request to ${endpoint}`, { 
        method: options.method, 
        hasData: !!options.data,
        hasAuth: this.isAuthenticated(),
        withCredentials: options.withCredentials,
        url: this.baseURL + endpoint
      });
      
      const response = await this.client.request<any, AxiosResponse<T>>({
        url: endpoint,
        ...options,
      });
      
      logger.debug(`Response from ${endpoint}:`, {
        status: response.status,
        hasData: !!response.data
      });
      
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
      logger.error(`Error fetching ${endpoint}:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: error.config,
        isCorsError: error.message?.includes('CORS')
      });
      
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
    if (!this.isAuthenticated()) {
      logger.warn('Heartbeat called without authentication');
      return { success: false, error: 'Not authenticated' };
    }
    
    // Update metrics with current data
    const metrics = {
      ...status.metrics,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      lastError: this.lastError || status.metrics.lastError,
    };
    
    return this.fetchWithCache<HeartbeatResponse>(
      '/api/screen/heartbeat',
      {
        method: 'POST',
        data: {
          status: status.status,
          metrics,
        },
        withCredentials: false // Disable credentials for all requests
      },
      0 // No caching for heartbeat
    );
  }

  // Get screen content
  public async getScreenContent(): Promise<ApiResponse<ScreenContent>> {
    if (!this.isAuthenticated()) {
      logger.warn('getScreenContent called without authentication');
      return { success: false, error: 'Not authenticated' };
    }
    
    return this.fetchWithCache<ScreenContent>(
      '/api/screen/content',
      { 
        method: 'GET',
        withCredentials: false // Disable credentials for all requests
      },
      CACHE_EXPIRATION.CONTENT
    );
  }

  // Get prayer times
  public async getPrayerTimes(startDate?: string, endDate?: string): Promise<ApiResponse<PrayerTimes[]>> {
    if (!this.isAuthenticated()) {
      logger.warn('getPrayerTimes called without authentication');
      return { success: false, error: 'Not authenticated' };
    }
    
    let url = '/api/screen/prayer-times';
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return this.fetchWithCache<PrayerTimes[]>(
      url,
      { 
        method: 'GET',
        withCredentials: false // Disable credentials for all requests
      },
      CACHE_EXPIRATION.PRAYER_TIMES
    );
  }

  // Get prayer status
  public async getPrayerStatus(): Promise<ApiResponse<PrayerStatus>> {
    if (!this.isAuthenticated()) {
      logger.warn('getPrayerStatus called without authentication');
      return { success: false, error: 'Not authenticated' };
    }
    
    return this.fetchWithCache<PrayerStatus>(
      '/api/screen/prayer-status',
      { 
        method: 'GET',
        withCredentials: false // Disable credentials for all requests
      },
      CACHE_EXPIRATION.PRAYER_STATUS
    );
  }

  // Get events
  public async getEvents(count: number = 5): Promise<ApiResponse<EventsResponse>> {
    if (!this.isAuthenticated()) {
      logger.warn('getEvents called without authentication');
      return { success: false, error: 'Not authenticated' };
    }
    
    return this.fetchWithCache<EventsResponse>(
      `/api/screen/events?count=${count}`,
      { 
        method: 'GET',
        withCredentials: false // Disable credentials for all requests
      },
      CACHE_EXPIRATION.EVENTS
    );
  }

  // Request a pairing code
  public async requestPairingCode(deviceInfo: { deviceType: string, orientation: string }): Promise<ApiResponse<RequestPairingCodeResponse>> {
    return this.fetchWithCache<RequestPairingCodeResponse>(
      '/api/screens/unpaired',
      {
        method: 'POST',
        data: deviceInfo,
        withCredentials: false // Disable credentials for pairing requests
      },
      0 // No caching for pairing code
    );
  }

  // Check pairing status
  public async checkPairingStatus(pairingCode: string): Promise<boolean> {
    try {
      const response = await this.fetchWithCache<CheckPairingStatusResponse>(
        '/api/screens/unpaired/check',
        {
          method: 'POST',
          data: { pairingCode },
          withCredentials: false // Disable credentials for pairing requests
        },
        0 // No caching for pairing status
      );

      logger.debug('Pairing status check response', { response });

      if (response.success && response.data) {
        if (response.data.paired && response.data.apiKey && response.data.screenId) {
          // If paired, set the credentials
          await this.setCredentials({
            apiKey: response.data.apiKey,
            screenId: response.data.screenId,
          });
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error('Error checking pairing status', { error });
      return false;
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
}

// Create and export a singleton instance
const masjidDisplayClient = new MasjidDisplayClient();
export default masjidDisplayClient; 