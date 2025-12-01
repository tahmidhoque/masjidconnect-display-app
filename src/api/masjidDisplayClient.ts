import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import localforage from "localforage";
import {
  ApiCredentials,
  HeartbeatRequest,
  HeartbeatResponse,
  ScreenContent,
  PrayerTimes,
  EventsResponse,
  ApiResponse,
  RequestPairingCodeResponse,
  CheckPairingStatusResponse,
  RequestPairingCodeRequest,
  CheckPairingStatusRequest,
  PairedCredentialsRequest,
  PairedCredentialsResponse,
  AnalyticsRequest,
  AnalyticsResponse,
  GitHubRelease,
  VersionInfo,
} from "./models";
import logger, { setLastError } from "../utils/logger";
import {
  createErrorResponse,
  normalizeApiResponse,
  validateApiResponse,
} from "../utils/apiErrorHandler";
import { withDeduplication } from "../utils/requestDeduplication";
import offlineStorage from "../services/offlineStorageService";
// Note: We'll dispatch errors via a callback to avoid circular dependencies
// The store will be passed to the client after initialization

// CORS proxy configuration for development
const USE_CORS_PROXY = process.env.REACT_APP_USE_CORS_PROXY === "true";
const CORS_PROXY_URL =
  process.env.REACT_APP_CORS_PROXY_URL ||
  "https://cors-anywhere.herokuapp.com/";

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  PRAYER_TIMES: 10 * 60 * 1000, // 10 minutes (was 1 hour)
  CONTENT: 5 * 60 * 1000, // 5 minutes
  EVENTS: 30 * 60 * 1000, // 30 minutes
};

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  HEARTBEAT: 2 * 60 * 1000, // 2 minutes
  CONTENT: 10 * 60 * 1000, // 10 minutes
  PRAYER_TIMES: 10 * 60 * 1000, // 10 minutes
  EVENTS: 30 * 60 * 1000, // 30 minutes
};

// Error retry settings (currently unused, kept for future use)
// const ERROR_RETRY = {
//   MAX_RETRIES: 3,
//   INITIAL_DELAY: 2000, // 2 seconds
//   MAX_DELAY: 30000, // 30 seconds
//   JITTER_FACTOR: 0.2 // ±20% jitter
// };

// Error backoff tracking
interface EndpointBackoff {
  failCount: number;
  nextRetry: number; // timestamp
  inBackoff: boolean;
}

// Storage keys for credentials
const STORAGE_KEYS = {
  API_KEY: "masjid_api_key",
  SCREEN_ID: "masjid_screen_id",
};

// Check if we're running in Electron
const isElectron = () => {
  return typeof window !== "undefined" && window.electron !== undefined;
};

// Access the Electron store through the contextBridge
const electronStore =
  isElectron() && window.electron?.store ? window.electron.store : null;

if (electronStore) {
  console.log("Electron store initialized successfully in API client");
}

// Cache interface
interface CacheItem<T> {
  data: T;
  expiry: number;
  timestamp: number; // Change to required property with default
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
    // Set the baseURL from environment or use default production URL
    let baseURL =
      process.env.REACT_APP_API_URL || "https://portal.masjidconnect.co.uk/api";

    // Remove any trailing slash for consistency
    baseURL = baseURL.replace(/\/$/, "");

    // Apply CORS proxy in development if enabled
    if (USE_CORS_PROXY && process.env.NODE_ENV === "development") {
      // Ensure we don't double-apply the CORS proxy
      if (!baseURL.includes(CORS_PROXY_URL)) {
        logger.info(`Using CORS proxy: ${CORS_PROXY_URL}${baseURL}`);
        baseURL = `${CORS_PROXY_URL}${baseURL}`;
      } else {
        logger.info(`CORS proxy already in baseURL: ${baseURL}`);
      }
    }

    this.baseURL = baseURL;

    // Log the baseURL for debugging using console directly to avoid circular dependency
    console.log("Initializing MasjidDisplayClient with baseURL:", this.baseURL);

    // Initialize the axios client
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      withCredentials: false, // Do not send cookies for cross-site requests
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Set up request interceptor
    this.client.interceptors.request.use((config) => {
      // Add authentication headers if we have credentials
      if (this.credentials) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${this.credentials.apiKey}`;
        config.headers["X-Screen-ID"] = this.credentials.screenId;

        // Always set Content-Type header to ensure consistency
        config.headers["Content-Type"] = "application/json";
        config.headers["Accept"] = "application/json";

        // Log authentication headers for debugging
        logger.debug("Request with auth headers", {
          url: config.url,
          hasApiKey: !!this.credentials.apiKey,
          hasScreenId: !!this.credentials.screenId,
          apiKeyLength: this.credentials.apiKey?.length || 0,
          screenIdLength: this.credentials.screenId?.length || 0,
          withCredentials: config.withCredentials,
        });
      } else {
        logger.warn("Request without auth credentials", { url: config.url });
      }

      return config;
    });

    // Set up response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleApiError(error);
        return Promise.reject(error);
      },
    );

    // Set up network listeners
    this.setupNetworkListeners();

    // Load credentials from storage
    this.loadCredentials().then(() => {
      this.authInitialized = true;
      logger.info("Auth initialization complete", {
        isAuthenticated: this.isAuthenticated(),
      });
    });
  }

  // Set up network status listeners
  private setupNetworkListeners(): void {
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  // Handle coming back online
  private handleOnline = (): void => {
    logger.info("Network connection restored");
    this.online = true;
    this.processQueue();
  };

  // Handle going offline
  private handleOffline = (): void => {
    logger.warn("Network connection lost");
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
        logger.error("Error processing queued request", { error });
      }
    }
  }

  // Handle API errors and implement backoff for specific endpoints
  private handleApiError(error: any): void {
    // Extract error details
    const status = error.response?.status;
    const message = error.message || "Unknown error";
    const url = error.config?.url || "unknown endpoint";
    const endpoint = url.replace(this.baseURL, "").replace(CORS_PROXY_URL, "");

    // Check if this is a CORS error
    const isCorsError =
      message.includes("CORS") ||
      message.includes("NetworkError") ||
      message.includes("Network Error") ||
      (error.name === "TypeError" && message.includes("Network")) ||
      (!status && !navigator.onLine);

    if (isCorsError) {
      logger.error(`CORS error accessing ${url}`, {
        message,
        config: error.config,
        solution: "Backend needs to enable CORS headers",
        corsProxyEnabled: USE_CORS_PROXY,
        baseUrl: this.baseURL,
        headers: error.config?.headers,
      });

      // Legacy support - still emit event for existing CORS notification
      const corsErrorEvent = new CustomEvent("api:corserror", {
        detail: {
          endpoint: endpoint,
          message,
          baseUrl: this.baseURL,
          fullUrl: url,
          timestamp: new Date().toISOString(),
        },
      });
      window.dispatchEvent(corsErrorEvent);

      return;
    }

    // Handle other types of errors
    if (status === 401) {
      logger.warn(`Authentication error: ${message}`);

      // Legacy support - still emit event for existing auth error detection
      const authErrorEvent = new CustomEvent("api:autherror", {
        detail: { status, message },
      });
      window.dispatchEvent(authErrorEvent);
    } else if (status === 404) {
      logger.warn(`Resource not found: ${url}`);
    } else if (status >= 500) {
      logger.error(`Server error (${status}): ${message}`);
    } else if (status === 429) {
      logger.warn(`Rate limited: Too many requests to ${endpoint}`);
    } else if (!status && !navigator.onLine) {
      logger.warn(`Device appears to be offline when accessing ${endpoint}`);
    } else if (!status) {
      logger.error(`Failed to connect to API server: ${message}`);
    } else {
      logger.error(`API error: ${message}`, { status, url });
    }

    // Store the most recent error (legacy support)
    setLastError(`${message} (${status || "network error"})`);
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
        logger.info("Credentials loaded from storage", {
          apiKeyLength: apiKey.length,
          screenIdLength: screenId.length,
        });
      } else {
        logger.warn("No credentials found in storage");
      }
    } catch (error) {
      logger.error("Error loading credentials", { error });
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
      localStorage.setItem("apiKey", credentials.apiKey);
      localStorage.setItem("screenId", credentials.screenId);

      // 3. JSON format for additional compatibility
      localStorage.setItem(
        "masjidconnect_credentials",
        JSON.stringify(credentials),
      );

      logger.info("Credentials saved to storage in all formats", {
        apiKeyLength: credentials.apiKey.length,
        screenIdLength: credentials.screenId.length,
      });
    } catch (error) {
      logger.error("Error saving credentials", { error });
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
      localStorage.removeItem("apiKey");
      localStorage.removeItem("screenId");

      // 3. JSON format
      localStorage.removeItem("masjidconnect_credentials");

      // 4. Authentication state flags
      localStorage.removeItem("isPaired");

      logger.info("Credentials cleared from all storage");
    } catch (error) {
      logger.error("Error clearing credentials", { error });
    }
  }

  // Check if authenticated
  public isAuthenticated(): boolean {
    // Only check after auth initialization is complete
    if (!this.authInitialized) {
      logger.warn(
        "Auth not yet initialized, returning false for isAuthenticated",
      );
      return false;
    }

    const hasCredentials = this.credentials !== null;

    // Log authentication status for debugging
    if (!hasCredentials) {
      logger.warn("Not authenticated: credentials are null");
    } else if (!this.credentials?.apiKey || !this.credentials?.screenId) {
      logger.warn("Incomplete credentials", {
        hasApiKey: !!this.credentials?.apiKey,
        hasScreenId: !!this.credentials?.screenId,
      });
    }

    return (
      hasCredentials &&
      !!this.credentials?.apiKey &&
      !!this.credentials?.screenId
    );
  }

  // Wait for authentication to be initialized
  public async waitForAuthInitialization(
    timeoutMs: number = 10000,
  ): Promise<boolean> {
    if (this.authInitialized) {
      return this.isAuthenticated();
    }

    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkAuth = () => {
        if (this.authInitialized) {
          resolve(this.isAuthenticated());
          return;
        }

        if (Date.now() - startTime >= timeoutMs) {
          logger.warn("Auth initialization timeout, proceeding without auth");
          resolve(false);
          return;
        }

        setTimeout(checkAuth, 100); // Check every 100ms
      };

      checkAuth();
    });
  }

  // Debug method to check credentials
  public logCredentialsStatus(): void {
    logger.info("Credentials status", {
      inMemory: !!this.credentials,
      hasApiKey: !!this.credentials?.apiKey,
      hasScreenId: !!this.credentials?.screenId,
      localStorageApiKey: !!localStorage.getItem(STORAGE_KEYS.API_KEY),
      localStorageScreenId: !!localStorage.getItem(STORAGE_KEYS.SCREEN_ID),
      authInitialized: this.authInitialized,
    });
  }

  /**
   * Fetch with offline support - tries network first, falls back to offline storage cache
   *
   * @param endpoint - API endpoint
   * @param cacheKey - Key for offline storage cache
   * @param cacheTTL - Time to live in seconds (default: 24 hours)
   * @param contentType - Type of content for offline storage ('content', 'prayer-times', 'events', 'announcements', 'images')
   * @returns API response with data from network or cache
   */
  async fetchWithOfflineSupport<T>(
    endpoint: string,
    cacheKey: string,
    cacheTTL: number = 86400, // 24 hours default
    contentType:
      | "content"
      | "prayer-times"
      | "events"
      | "announcements"
      | "images" = "content",
  ): Promise<ApiResponse<T>> {
    try {
      // Try network first
      const response = await this.fetchWithCache<T>(
        endpoint,
        { method: "GET" },
        cacheTTL * 1000, // Convert to milliseconds
      );

      // Cache successful response in offline storage
      if (response.success && response.data) {
        await offlineStorage.storeContent(
          contentType,
          cacheKey,
          response.data,
          cacheTTL,
        );
        logger.debug(
          `[API] Cached ${contentType}/${cacheKey} for offline use`,
          {
            ttl: cacheTTL,
            endpoint,
          },
        );
      }

      return response;
    } catch (error) {
      logger.warn(
        `[API] Network request failed, trying cache for ${endpoint}`,
        { error },
      );

      // Fallback to offline storage cache
      const cachedData = await offlineStorage.getContent(contentType, cacheKey);

      if (cachedData) {
        logger.info(`[API] Serving from cache: ${cacheKey}`);
        return normalizeApiResponse({
          data: cachedData,
          success: true,
          cached: true,
          offlineFallback: true,
        });
      }

      // No cached data available
      const errorMessage = `No cached data available for ${endpoint}`;
      logger.error(errorMessage);
      return createErrorResponse(errorMessage);
    }
  }

  // Fetch with cache
  private async fetchWithCache<T>(
    endpoint: string,
    options: AxiosRequestConfig = {},
    cacheTime: number = 0,
  ): Promise<ApiResponse<T>> {
    // Ensure endpoint doesn't start with a slash to avoid URL path issues
    const normalizedEndpoint = endpoint.replace(/^\//, "");

    const cacheKey = `${normalizedEndpoint}:${JSON.stringify(options)}`;
    const now = Date.now();

    // Check if we have a valid cache entry
    const cachedItem = this.cache.get(cacheKey);
    const isExpired = !cachedItem || now > cachedItem.expiry;

    // Log cache status for debugging
    logger.debug(`Cache status for ${normalizedEndpoint}:`, {
      hasCachedItem: !!cachedItem,
      isExpired: isExpired,
      timeSinceExpiry: cachedItem
        ? Math.round((now - cachedItem.expiry) / 1000) + "s"
        : "N/A",
      isOffline: !navigator.onLine,
    });

    // Force refresh if explicitly requested by setting cache time to 0
    const forceRefresh = cacheTime === 0;

    // If offline, always use cache regardless of expiration
    if (!navigator.onLine && cachedItem) {
      logger.info(
        `Using cached data for ${normalizedEndpoint} because device is offline`,
        {
          cached: true,
          expired: isExpired,
          offlineMode: true,
          dataAge:
            Math.round((now - cachedItem.timestamp) / 1000 / 60) + " minutes",
        },
      );
      return normalizeApiResponse({
        data: cachedItem.data,
        success: true,
        cached: true,
        offlineFallback: true,
        timestamp: cachedItem.timestamp,
      });
    }

    // If we have a non-expired cache entry and not forcing a refresh, use it
    if (cachedItem && !isExpired && !forceRefresh) {
      logger.debug(`Using cached data for ${normalizedEndpoint}`, {
        cached: true,
        expiry: new Date(cachedItem.expiry).toISOString(),
        timeLeft: Math.floor((cachedItem.expiry - now) / 1000) + "s",
      });
      return normalizeApiResponse({
        data: cachedItem.data,
        success: true,
        cached: true,
        timestamp: cachedItem.timestamp,
      });
    }

    // Otherwise, fetch from network with deduplication
    try {
      // Mark this endpoint as loading
      this.isLoading.set(normalizedEndpoint, true);

      // Signal to debug console that we're making a fresh network request
      logger.info(
        `Making fresh network request for ${normalizedEndpoint} (cache expired or force refresh)`,
        {
          isExpired,
          forceRefresh,
          currentTime: new Date().toISOString(),
        },
      );

      // Use request deduplication to prevent multiple simultaneous calls to the same endpoint
      const deduplicationKey = `${normalizedEndpoint}:${JSON.stringify(options)}`;
      const response = await withDeduplication(
        deduplicationKey,
        () => this.fetchWithRetry<T>(normalizedEndpoint, options, cacheTime),
        {
          ttl: 5000, // 5 second deduplication window
          forceRefresh: forceRefresh,
          skipCache: true, // Use our own caching mechanism
        },
      );

      // If success, update cache with current timestamp
      if (response.success && response.data) {
        this.cache.set(cacheKey, {
          data: response.data,
          expiry: now + cacheTime,
          timestamp: now,
        });

        // Reset backoff for this endpoint
        this.resetBackoff(normalizedEndpoint);

        // Add timestamp to the response
        response.timestamp = now;
      }

      return validateApiResponse(response);
    } catch (error: any) {
      // Handle error
      const errorMessage = `Failed to fetch ${normalizedEndpoint}: ${error.message || "Unknown error"}`;
      logger.error(errorMessage, { error });

      // If we have a cached item, return it even if expired as a fallback
      if (cachedItem) {
        const cacheAge = Math.round((now - cachedItem.timestamp) / 1000 / 60);
        logger.info(
          `Falling back to cached data for ${normalizedEndpoint} due to fetch error`,
          {
            cached: true,
            expired: isExpired,
            cacheAge: `${cacheAge} minutes old`,
            error: error.message || "Unknown error",
          },
        );

        return normalizeApiResponse({
          data: cachedItem.data,
          success: true,
          cached: true,
          offlineFallback: true,
          cacheAge,
          timestamp: cachedItem.timestamp,
        });
      }

      // No cached data available, return error
      setLastError(errorMessage);
      return createErrorResponse(errorMessage);
    } finally {
      // Mark this endpoint as no longer loading
      this.isLoading.set(normalizedEndpoint, false);
    }
  }

  // Fetch with exponential backoff retry
  private async fetchWithRetry<T>(
    endpoint: string,
    options: AxiosRequestConfig = {},
    cacheTime: number = 0,
    retries: number = 0,
  ): Promise<ApiResponse<T>> {
    const maxRetries = 3;
    let retryDelay = 1000; // Start with 1 second

    // Ensure endpoint doesn't start with a slash to avoid URL path issues
    const normalizedEndpoint = endpoint.replace(/^\//, "");

    const cacheKey = `${normalizedEndpoint}-${JSON.stringify(options)}`;

    // Mark this endpoint as loading
    this.isLoading.set(normalizedEndpoint, true);

    try {
      if (!shouldDebounceLog(`request-${normalizedEndpoint}`)) {
        logger.debug(`Making request to ${normalizedEndpoint}`, {
          method: options.method,
          hasData: !!options.data,
          hasAuth: this.isAuthenticated(),
          withCredentials: options.withCredentials,
          url: `${this.baseURL}/${normalizedEndpoint}`,
        });
      }

      const response = await this.client.request<any, AxiosResponse<T>>({
        url: normalizedEndpoint,
        ...options,
      });

      if (!shouldDebounceLog(`response-${normalizedEndpoint}`)) {
        logger.debug(`Response from ${normalizedEndpoint}:`, {
          status: response?.status,
          hasData: !!response.data,
        });
      }

      // Check if response.data is HTML (common error response)
      if (
        typeof response.data === "string" &&
        response.data.trim().startsWith("<")
      ) {
        logger.error(
          `Received HTML response instead of JSON from ${normalizedEndpoint}`,
          {
            status: response.status,
            contentType: response.headers?.["content-type"],
            preview: response.data.substring(0, 200),
          },
        );
        throw new Error(
          `API returned HTML instead of JSON. This usually indicates a server error or incorrect URL.`,
        );
      }

      const result: ApiResponse<T> = normalizeApiResponse({
        success: true,
        data: response.data,
      });

      // Cache the response if cacheTime > 0
      if (cacheTime > 0) {
        this.cache.set(cacheKey, {
          data: result,
          expiry: Date.now() + cacheTime,
          timestamp: Date.now(), // Add timestamp to the cache item
        });
      }

      // Reset backoff for this endpoint after successful request
      this.resetBackoff(normalizedEndpoint);

      // Mark this endpoint as no longer loading
      this.isLoading.set(normalizedEndpoint, false);

      return result;
    } catch (error: any) {
      // Only log errors that aren't debounced
      if (!shouldDebounceLog(`error-${normalizedEndpoint}`)) {
        logger.error(`Error fetching ${normalizedEndpoint}:`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          config: error.config,
          isCorsError: error.message?.includes("CORS"),
        });
      }

      // Mark this endpoint as no longer loading
      this.isLoading.set(normalizedEndpoint, false);

      // Handle unauthorized responses (invalid token)
      if (error.response?.status === 401) {
        // If we're making an authorized request and get 401, the token is likely invalid
        const wasAuthorized =
          this.isAuthenticated() &&
          (options.headers?.["Authorization"] ||
            options.headers?.["authorization"] ||
            !!this.credentials);

        if (wasAuthorized) {
          logger.warn("Received 401 with auth token, clearing credentials", {
            endpoint,
          });
          // clear credentials as they appear to be invalid
          await this.clearCredentials();

          return createErrorResponse(
            "Authentication failed. Please re-authenticate.",
          );
        }
      }

      // If we've reached max retries, throw the error
      if (retries >= maxRetries) {
        // Return expired cache as fallback if available
        const cached = this.cache.get(cacheKey);
        if (cached) {
          logger.warn(
            `Error fetching ${normalizedEndpoint}, using expired cache`,
          );
          return cached.data;
        }

        // If this is a network error and we're offline, return a more specific error
        if (!navigator.onLine) {
          return createErrorResponse(
            "Device is offline. Please check your internet connection.",
          );
        }

        return createErrorResponse(error.message || "Unknown error");
      }

      // If rate limited (429) or server error (5xx), retry with backoff
      if (
        error.response?.status === 429 ||
        (error.response?.status >= 500 && error.response?.status < 600)
      ) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
        const delay = retryDelay * jitter;

        logger.info(
          `Retrying ${normalizedEndpoint} in ${Math.round(delay)}ms (attempt ${retries + 1}/${maxRetries})`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));

        retryDelay *= 2; // Double the delay for next retry
        return this.fetchWithRetry<T>(
          normalizedEndpoint,
          options,
          cacheTime,
          retries + 1,
        );
      }

      // For other errors, don't retry
      // Return expired cache as fallback if available
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.warn(
          `Error fetching ${normalizedEndpoint}, using expired cache`,
        );
        return cached.data;
      }

      return createErrorResponse(error.message || "Unknown error");
    }
  }

  // Send heartbeat to server
  public async sendHeartbeat(
    status: HeartbeatRequest,
  ): Promise<ApiResponse<HeartbeatResponse>> {
    // Wait for authentication to be initialized before making API calls
    const isAuthReady = await this.waitForAuthInitialization();

    // Check if we're authenticated
    if (!isAuthReady) {
      logger.warn(
        "sendHeartbeat called without authentication - auth not ready",
      );
      return createErrorResponse("Not authenticated");
    }

    try {
      // Use the correct endpoint from the integration guide
      // Remove any leading slash to ensure consistent handling with baseURL
      const endpoint = "api/screen/heartbeat".replace(/^\//, "");

      const payload: any = {
        screenId: this.credentials!.screenId,
        status: status.status,
        deviceInfo: status.metrics,
      };

      // Include command acknowledgements if present in the request
      if ((status as any).commandAcknowledgements) {
        payload.commandAcknowledgements = (
          status as any
        ).commandAcknowledgements;
      }

      // Log detailed information about the request
      logger.debug("Preparing heartbeat request", {
        endpoint,
        fullUrl: `${this.baseURL}/${endpoint}`,
        corsProxyEnabled: USE_CORS_PROXY,
        environment: process.env.NODE_ENV,
        screenId: this.credentials?.screenId,
      });

      // Use consistent options with other API calls
      const options = {
        method: "POST",
        data: payload,
        timeout: 30000, // 30 second timeout
      };

      // Use fetchWithCache with 0 cache time to ensure consistent CORS and auth handling
      const result = await this.fetchWithCache<HeartbeatResponse>(
        endpoint,
        options,
        0,
      );

      if (!result.success) {
        logger.warn("Heartbeat response not successful", {
          error: result.error,
        });
      } else {
        logger.debug("Heartbeat response successful");
      }

      return validateApiResponse(result);
    } catch (error: any) {
      // Enhanced error logging with CORS-specific details
      const isCorsError =
        error.message?.includes("CORS") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("Network Error");

      logger.error("Error sending heartbeat", {
        error,
        message: error.message,
        isCorsError,
        corsProxyEnabled: USE_CORS_PROXY,
        baseUrl: this.baseURL,
        status: error.response?.status,
        headers: error.config?.headers,
      });

      return createErrorResponse(
        "Failed to send heartbeat: " +
          (isCorsError ? "CORS policy error" : error.message),
      );
    }
  }

  // Send analytics data to server (comprehensive heartbeat system)
  public async sendAnalyticsData(
    analyticsRequest: AnalyticsRequest,
  ): Promise<ApiResponse<AnalyticsResponse>> {
    // Wait for authentication to be initialized before making API calls
    const isAuthReady = await this.waitForAuthInitialization();

    // Check if we're authenticated
    if (!isAuthReady) {
      logger.warn(
        "sendAnalyticsData called without authentication - auth not ready",
      );
      return createErrorResponse("Not authenticated");
    }

    try {
      // Use the analytics endpoint as specified in the documentation
      const endpoint = "api/displays/heartbeat".replace(/^\//, "");

      // Log detailed information about the request
      logger.debug("Preparing analytics request", {
        endpoint,
        type: analyticsRequest.type,
        fullUrl: `${this.baseURL}/${endpoint}`,
        corsProxyEnabled: USE_CORS_PROXY,
        environment: process.env.NODE_ENV,
        screenId: this.credentials?.screenId,
      });

      // Use consistent options with other API calls
      const options = {
        method: "POST",
        data: analyticsRequest,
        timeout: 30000, // 30 second timeout
      };

      // Use fetchWithCache with 0 cache time to ensure consistent CORS and auth handling
      const result = await this.fetchWithCache<AnalyticsResponse>(
        endpoint,
        options,
        0,
      );

      if (!result.success) {
        logger.warn("Analytics response not successful", {
          error: result.error,
          type: analyticsRequest.type,
        });
      } else {
        logger.debug("Analytics response successful", {
          type: analyticsRequest.type,
        });
      }

      return validateApiResponse(result);
    } catch (error: any) {
      // Enhanced error logging with CORS-specific details
      const isCorsError =
        error.message?.includes("CORS") ||
        error.message?.includes("NetworkError") ||
        error.message?.includes("Network Error");

      logger.error("Error sending analytics data", {
        error,
        type: analyticsRequest.type,
        message: error.message,
        isCorsError,
        corsProxyEnabled: USE_CORS_PROXY,
        baseUrl: this.baseURL,
        status: error.response?.status,
        headers: error.config?.headers,
      });

      return createErrorResponse(
        "Failed to send analytics data: " +
          (isCorsError ? "CORS policy error" : error.message),
      );
    }
  }

  // Get screen content
  public async getScreenContent(
    forceRefresh: boolean = false,
  ): Promise<ApiResponse<ScreenContent>> {
    // Wait for authentication to be initialized before making API calls
    const isAuthReady = await this.waitForAuthInitialization();

    if (!isAuthReady) {
      logger.warn(
        "Screen content request: Authentication not ready, trying fallback from storage",
      );

      // Try to get from offline storage as fallback
      const cachedContent = await offlineStorage.getContent(
        "content",
        "screen-content",
      );
      if (cachedContent) {
        logger.info("Using cached screen content due to auth not ready");
        return normalizeApiResponse({
          data: cachedContent,
          success: true,
          cached: true,
          offlineFallback: true,
        });
      }

      // Fallback to legacy localforage storage
      try {
        const storedContent =
          await localforage.getItem<ScreenContent>("screenContent");
        if (storedContent) {
          logger.info("Using stored screen content from legacy storage");
          return normalizeApiResponse({
            data: storedContent,
            success: true,
            cached: true,
            offlineFallback: true,
          });
        }
      } catch (error) {
        logger.error("Error retrieving stored screen content as fallback", {
          error,
        });
      }

      return createErrorResponse(
        "Authentication not ready and no cached data available",
      );
    }

    // Use offline support method (handles both online and offline cases)
    if (forceRefresh) {
      // Force refresh - bypass cache
      try {
        const result = await this.fetchWithCache<ScreenContent>(
          "/api/screens/content",
          { method: "GET" },
          CACHE_EXPIRATION.CONTENT,
        );

        // Cache successful response
        if (result.success && result.data) {
          await offlineStorage.storeContent(
            "content",
            "screen-content",
            result.data,
            3600,
          ); // 1 hour TTL
        }

        return validateApiResponse(result);
      } catch (error) {
        logger.error("Error fetching screen content", { error });
        // Fallback to cache on error
        const cachedContent = await offlineStorage.getContent(
          "content",
          "screen-content",
        );
        if (cachedContent) {
          return normalizeApiResponse({
            data: cachedContent,
            success: true,
            cached: true,
            offlineFallback: true,
          });
        }
        return createErrorResponse("Failed to fetch screen content");
      }
    }

    // Use offline support with 1 hour TTL
    return this.fetchWithOfflineSupport<ScreenContent>(
      "/api/screens/content",
      "screen-content",
      3600, // 1 hour
      "content",
    );
  }

  // Get prayer times
  public async getPrayerTimes(
    startDate?: string,
    endDate?: string,
    forceRefresh: boolean = false,
  ): Promise<ApiResponse<PrayerTimes[]>> {
    // Wait for authentication to be initialized before making API calls
    const isAuthReady = await this.waitForAuthInitialization();

    // Build query parameters for cache key
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const cacheKey = `prayer-times${params.toString() ? `-${params.toString()}` : ""}`;

    if (!isAuthReady) {
      logger.warn(
        "Prayer times request: Authentication not ready, trying fallback from storage",
      );

      // Try to get from offline storage as fallback
      const cachedTimes = await offlineStorage.getContent(
        "prayer-times",
        cacheKey,
      );
      if (cachedTimes) {
        logger.info("Using cached prayer times due to auth not ready");
        return {
          data: cachedTimes,
          success: true,
          cached: true,
          offlineFallback: true,
        };
      }

      // Fallback to legacy storage
      try {
        let storedTimes: PrayerTimes[] | null = null;
        if (electronStore) {
          storedTimes = electronStore.get("prayerTimes", null);
        }
        if (!storedTimes) {
          storedTimes = await localforage.getItem<PrayerTimes[]>("prayerTimes");
        }
        if (storedTimes) {
          return {
            data: storedTimes,
            success: true,
            cached: true,
            offlineFallback: true,
          };
        }
      } catch (error) {
        logger.error("Error retrieving stored prayer times as fallback", {
          error,
        });
      }

      return {
        success: false,
        error: "Authentication not ready and no cached data available",
        cached: false,
        data: null,
      };
    }

    // Use offline support method
    if (forceRefresh) {
      // Force refresh - bypass cache
      try {
        const result = await this.fetchWithCache<PrayerTimes[]>(
          `/api/screen/prayer-times?${params.toString()}`,
          { method: "GET" },
          CACHE_EXPIRATION.PRAYER_TIMES,
        );

        // Cache successful response (7 days TTL for prayer times)
        if (result.success && result.data) {
          await offlineStorage.storeContent(
            "prayer-times",
            cacheKey,
            result.data,
            7 * 24 * 60 * 60,
          ); // 7 days
        }

        return result;
      } catch (error) {
        logger.error("Error fetching prayer times", { error });
        // Fallback to cache on error
        const cachedTimes = await offlineStorage.getContent(
          "prayer-times",
          cacheKey,
        );
        if (cachedTimes) {
          return {
            data: cachedTimes,
            success: true,
            cached: true,
            offlineFallback: true,
          };
        }
        return createErrorResponse("Failed to fetch prayer times");
      }
    }

    // Use offline support with 7 days TTL for prayer times
    return this.fetchWithOfflineSupport<PrayerTimes[]>(
      `/api/screen/prayer-times?${params.toString()}`,
      cacheKey,
      7 * 24 * 60 * 60, // 7 days
      "prayer-times",
    );
  }

  // Get events
  public async getEvents(
    count: number = 5,
    forceRefresh: boolean = false,
  ): Promise<ApiResponse<EventsResponse>> {
    // Wait for authentication to be initialized before making API calls
    const isAuthReady = await this.waitForAuthInitialization();

    const cacheKey = `events-${count}`;

    if (!isAuthReady) {
      logger.warn(
        "Events request: Authentication not ready, trying fallback from storage",
      );

      // Try to get from offline storage as fallback
      const cachedEvents = await offlineStorage.getContent("events", cacheKey);
      if (cachedEvents) {
        logger.info("Using cached events due to auth not ready");
        return {
          data: cachedEvents,
          success: true,
          cached: true,
          offlineFallback: true,
        };
      }

      // Fallback to legacy storage
      try {
        const storedEvents =
          await localforage.getItem<EventsResponse>("events");
        if (storedEvents) {
          logger.info("Using stored events from legacy storage");
          return {
            data: storedEvents,
            success: true,
            cached: true,
            offlineFallback: true,
          };
        }
      } catch (error) {
        logger.error("Error retrieving stored events as fallback", { error });
      }

      return createErrorResponse(
        "Authentication not ready and no cached data available",
      );
    }

    // Use offline support method
    if (forceRefresh) {
      // Force refresh - bypass cache
      try {
        const result = await this.fetchWithCache<EventsResponse>(
          `/api/events?count=${count}`,
          { method: "GET" },
          CACHE_EXPIRATION.EVENTS,
        );

        // Cache successful response (24 hours TTL for events)
        if (result.success && result.data) {
          await offlineStorage.storeContent(
            "events",
            cacheKey,
            result.data,
            24 * 60 * 60,
          ); // 24 hours
        }

        return result;
      } catch (error) {
        logger.error("Error fetching events", { error });
        // Fallback to cache on error
        const cachedEvents = await offlineStorage.getContent(
          "events",
          cacheKey,
        );
        if (cachedEvents) {
          return {
            data: cachedEvents,
            success: true,
            cached: true,
            offlineFallback: true,
          };
        }
        return createErrorResponse("Failed to fetch events");
      }
    }

    // Use offline support with 24 hours TTL for events
    return this.fetchWithOfflineSupport<EventsResponse>(
      `/api/events?count=${count}`,
      cacheKey,
      24 * 60 * 60, // 24 hours
      "events",
    );
  }

  // Request a pairing code
  public async requestPairingCode(deviceInfo: {
    deviceType: string;
    orientation: string;
  }): Promise<ApiResponse<RequestPairingCodeResponse>> {
    try {
      // Use the correct endpoint from the integration guide
      const endpoint = "/api/screens/unpaired";

      const payload: RequestPairingCodeRequest = {
        deviceInfo: {
          deviceId: this.generateDeviceId(),
          model: deviceInfo.deviceType,
          platform: "Web",
        },
      };

      const options = {
        method: "POST",
        data: payload,
        withCredentials: false,
      };

      const result = await this.fetchWithRetry<RequestPairingCodeResponse>(
        endpoint,
        options,
      );
      return validateApiResponse(result);
    } catch (error) {
      logger.error("Error requesting pairing code", { error });
      return createErrorResponse("Failed to request pairing code");
    }
  }

  // Generate a consistent device ID
  private generateDeviceId(): string {
    // Use a stored ID if we have one
    const storedId = localStorage.getItem("device_id");
    if (storedId) return storedId;

    // Generate a new one if we don't
    const newId = "web-" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("device_id", newId);
    return newId;
  }

  // Check pairing status
  public async checkPairingStatus(pairingCode: string): Promise<boolean> {
    try {
      // Use the correct endpoint from the integration guide
      const endpoint = "/api/screens/check-simple";

      const payload: CheckPairingStatusRequest = {
        pairingCode: pairingCode,
      };

      const options = {
        method: "POST",
        data: payload,
        withCredentials: false,
      };

      const result = await this.fetchWithRetry<CheckPairingStatusResponse>(
        endpoint,
        options,
      );

      // Log the full response for debugging
      logger.info("Received check-simple response", {
        data: result.data,
        success: result.success,
      });

      if (result.success && result.data) {
        // Check for both paired and isPaired properties (API returns "paired" but our interface expects "isPaired")
        const isPaired =
          result.data.isPaired === true || result.data.paired === true;
        const screenId = result.data.screenId;
        const apiKey = result.data.apiKey;
        const masjidId = result.data.masjidId;

        logger.info("Extracted pairing info from response", {
          isPaired,
          hasScreenId: !!screenId,
          hasApiKey: !!apiKey,
        });

        // Debug logging for condition check
        logger.info("Checking pairing conditions", {
          isPaired,
          screenId,
          conditionMet: isPaired && screenId,
          apiKeyPresent: !!apiKey,
        });

        if (isPaired && screenId) {
          // If the API response includes the apiKey directly, use it
          if (apiKey) {
            logger.info(
              "API key included in check-simple response, setting credentials directly",
            );

            const credentials: ApiCredentials = {
              apiKey: apiKey,
              screenId: screenId,
            };

            // Set the credentials immediately
            await this.setCredentials(credentials);

            // Set isPaired flag in localStorage for other components to detect
            localStorage.setItem("isPaired", "true");

            // Also store masjidId if available
            if (masjidId) {
              localStorage.setItem("masjid_id", masjidId);
            }

            // Dispatch a custom event to notify components about authentication
            logger.info("Dispatching auth event for components to detect");
            try {
              const authEvent = new CustomEvent("masjidconnect:authenticated", {
                detail: { apiKey, screenId },
              });
              window.dispatchEvent(authEvent);
            } catch (error) {
              logger.error("Error dispatching auth event", { error });
            }

            return true;
          } else {
            // Otherwise, get the full credentials using the paired-credentials endpoint
            logger.info(
              "Pairing successful, fetching credentials from paired-credentials endpoint",
            );
            try {
              await this.fetchPairedCredentials(pairingCode);

              // Set isPaired flag in localStorage for other components to detect
              localStorage.setItem("isPaired", "true");

              logger.info("paired-credentials call completed successfully");
              return true;
            } catch (error) {
              logger.error("Failed to fetch paired credentials", { error });
              return false;
            }
          }
        }
      }

      return false;
    } catch (error) {
      logger.error("Error checking pairing status", { error });
      return false;
    }
  }

  // Get credentials after successful pairing
  private async fetchPairedCredentials(pairingCode: string): Promise<void> {
    try {
      const endpoint = "/api/screens/paired-credentials";

      const payload: PairedCredentialsRequest = {
        pairingCode: pairingCode,
        deviceInfo: {
          deviceId: this.generateDeviceId(),
          model: navigator.userAgent,
          platform: "Web",
        },
      };

      const options = {
        method: "POST",
        data: payload,
        withCredentials: false,
      };

      const result = await this.fetchWithRetry<PairedCredentialsResponse>(
        endpoint,
        options,
      );

      logger.info("paired-credentials response received", {
        success: result.success,
        hasData: !!result.data,
        data: result.data,
      });

      if (result.success && result.data) {
        // Handle nested data structure: result.data.data contains the actual credentials
        const credentialsData = (result.data as any).data || result.data;

        logger.info("Extracting credentials from paired-credentials response", {
          hasNestedData: !!(result.data as any).data,
          credentialsDataKeys: Object.keys(credentialsData || {}),
          rawApiKey: credentialsData?.apiKey,
          rawScreenId: credentialsData?.screenId,
        });

        const credentials: ApiCredentials = {
          apiKey: credentialsData.apiKey,
          screenId: credentialsData.screenId,
        };

        logger.info("Setting credentials from paired-credentials", {
          hasApiKey: !!credentials.apiKey,
          hasScreenId: !!credentials.screenId,
          apiKeyLength: credentials.apiKey?.length || 0,
          screenIdLength: credentials.screenId?.length || 0,
        });

        await this.setCredentials(credentials);
        logger.info("Successfully set credentials after pairing");

        // Dispatch authentication event
        try {
          const authEvent = new CustomEvent("masjidconnect:authenticated", {
            detail: {
              apiKey: credentials.apiKey,
              screenId: credentials.screenId,
            },
          });
          window.dispatchEvent(authEvent);
          logger.info(
            "Dispatched authentication event after paired-credentials",
          );
        } catch (error) {
          logger.error(
            "Error dispatching auth event after paired-credentials",
            { error },
          );
        }
      } else {
        logger.error("Failed to fetch credentials after pairing", { result });
      }
    } catch (error) {
      logger.error("Error fetching paired credentials", { error });
    }
  }

  // Get polling interval
  public getPollingInterval(): number {
    return 5000; // Default to 5 seconds for pairing checks
  }

  // Clean up resources
  public cleanup(): void {
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
  }

  // Invalidate all caches
  public invalidateAllCaches(): void {
    logger.info("Invalidating all caches");
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

  /**
   * Manually test the emergency alert system
   * @returns {Promise<boolean>} Success status
   */
  async testEmergencyAlert(): Promise<boolean> {
    try {
      console.log("🚨 Testing emergency alert system with a local alert");
      // Dispatch a custom event to simulate the SSE alert
      const testAlertData = {
        id: "test-alert-" + Date.now(),
        title: "Test Emergency Alert",
        message:
          "This is a test of the emergency alert system from the API client. If you can see this, the alert rendering is working.",
        color: "#e74c3c", // Red
        expiresAt: new Date(Date.now() + 30000).toISOString(), // 30 seconds from now
        createdAt: new Date().toISOString(),
        masjidId: "test-masjid",
      };

      // Create a new MessageEvent
      const testEvent = new MessageEvent("EMERGENCY_ALERT", {
        data: JSON.stringify(testAlertData),
        origin: window.location.origin,
      });

      // Dispatch the event to the window
      window.dispatchEvent(testEvent);

      // Also try the global event target approach
      const globalEventTarget = document.createDocumentFragment();
      globalEventTarget.dispatchEvent(
        new CustomEvent("EMERGENCY_ALERT", {
          detail: testAlertData,
        }),
      );

      return true;
    } catch (error) {
      console.error("Error testing emergency alert:", error);
      return false;
    }
  }

  /**
   * Fetch latest version information from GitHub Releases
   * @param includePrerelease Whether to include pre-release versions
   * @returns Latest version information
   */
  public async getLatestVersion(
    includePrerelease: boolean = false,
  ): Promise<ApiResponse<VersionInfo>> {
    try {
      const owner = "masjidSolutions";
      const repo = "masjidconnect-display-app";

      // Use GitHub API to fetch releases
      const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;

      logger.info("Fetching latest version from GitHub", { includePrerelease });

      // Fetch all releases
      const response = await axios.get<GitHubRelease[]>(githubApiUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        timeout: 10000,
      });

      if (!response.data || response.data.length === 0) {
        return createErrorResponse("No releases found");
      }

      // Filter releases based on prerelease preference
      const releases = includePrerelease
        ? response.data
        : response.data.filter((r) => !r.prerelease);

      if (releases.length === 0) {
        return createErrorResponse("No stable releases found");
      }

      // Get the latest release (first in the list)
      const latestRelease = releases[0];

      // Extract download URLs for ARM architectures
      const downloadUrls: { armv7l?: string; arm64?: string } = {};

      latestRelease.assets.forEach((asset) => {
        if (asset.name.includes("armv7l") && asset.name.endsWith(".deb")) {
          downloadUrls.armv7l = asset.browser_download_url;
        } else if (
          asset.name.includes("arm64") &&
          asset.name.endsWith(".deb")
        ) {
          downloadUrls.arm64 = asset.browser_download_url;
        }
      });

      // Parse version from tag_name (remove 'v' prefix if present)
      const version = latestRelease.tag_name.replace(/^v/, "");

      const versionInfo: VersionInfo = {
        version,
        releaseNotes: latestRelease.body || "",
        publishedAt: latestRelease.published_at,
        isPrerelease: latestRelease.prerelease,
        downloadUrls,
        assets: latestRelease.assets,
      };

      logger.info("Latest version fetched successfully", { version });

      return normalizeApiResponse({
        success: true,
        data: versionInfo,
      });
    } catch (error: any) {
      logger.error("Error fetching latest version", { error: error.message });

      // Check if it's a rate limit error
      if (error.response?.status === 403) {
        return createErrorResponse(
          "GitHub API rate limit exceeded. Please try again later.",
        );
      }

      return createErrorResponse(
        "Failed to fetch latest version: " + error.message,
      );
    }
  }

  /**
   * Check if an update is available
   * @param currentVersion The current version of the application
   * @param includePrerelease Whether to check for pre-release versions
   * @returns Update availability information
   */
  public async checkForUpdate(
    currentVersion: string,
    includePrerelease: boolean = false,
  ): Promise<
    ApiResponse<{ updateAvailable: boolean; latestVersion?: VersionInfo }>
  > {
    try {
      const result = await this.getLatestVersion(includePrerelease);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to check for updates",
          data: null,
          cached: false,
        };
      }

      const latestVersionInfo = result.data;

      // Import version comparison utility
      const { isNewerVersion } = await import("../utils/versionManager");

      const updateAvailable = isNewerVersion(
        latestVersionInfo.version,
        currentVersion,
      );

      logger.info("Update check completed", {
        currentVersion,
        latestVersion: latestVersionInfo.version,
        updateAvailable,
      });

      return normalizeApiResponse({
        success: true,
        data: {
          updateAvailable,
          latestVersion: updateAvailable ? latestVersionInfo : undefined,
        },
      });
    } catch (error: any) {
      logger.error("Error checking for update", { error: error.message });
      return createErrorResponse(
        "Failed to check for update: " + error.message,
      );
    }
  }
}

// Create and export a singleton instance
const masjidDisplayClient = new MasjidDisplayClient();
export default masjidDisplayClient;
