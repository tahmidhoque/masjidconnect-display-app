import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  PairingRequest,
  RequestPairingCodeRequest,
  RequestPairingCodeResponse,
  CheckPairingStatusRequest,
  CheckPairingStatusResponse,
  PairingResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  ScreenContent,
  PrayerTimes,
  PrayerStatus,
  EventsResponse,
  ApiResponse
} from './models';

export interface ApiCredentials {
  apiKey: string;
  screenId: string;
}

class ApiClient {
  private client: AxiosInstance;
  private credentials: ApiCredentials | null = null;
  private baseURL: string = process.env.REACT_APP_API_URL || 'https://api.masjidconnect.com';
  private pollingInterval: number = 5000; // Default polling interval in ms
  private lastRequestTime: Record<string, number> = {}; // Track last request time for each endpoint
  private requestInProgress: Record<string, boolean> = {}; // Track if a request is in progress

  constructor() {
    // Always use the configured API URL from .env
    if (process.env.REACT_APP_API_URL) {
      this.baseURL = process.env.REACT_APP_API_URL;
      console.log(`[API] Using configured API URL from .env: ${this.baseURL}`);
    } else {
      // Fallback to a default URL if not configured
      console.log(`[API] No API URL configured in .env, using default: ${this.baseURL}`);
    }
    
    // Log the final API URL for debugging
    console.log(`[API] Final API URL: ${this.baseURL}`);
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      // Don't set Content-Type globally as it should only be set for POST/PUT requests
      withCredentials: true // Set to true for CORS requests with credentials
    });

    // Add request interceptor to include authentication headers
    this.client.interceptors.request.use((config) => {
      console.log(`[API] Making ${config.method?.toUpperCase()} request to: ${config.url}`, config.data);
      
      // Set Content-Type header only for POST/PUT requests
      if (config.method?.toLowerCase() === 'post' || config.method?.toLowerCase() === 'put') {
        config.headers = config.headers || {};
        config.headers['Content-Type'] = 'application/json';
      }
      
      // Add authentication headers if we have credentials
      if (this.credentials) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${this.credentials.apiKey}`;
        config.headers['X-Screen-ID'] = this.credentials.screenId;
      }
      
      // Log the complete headers for debugging
      console.log(`[API] Request headers:`, config.headers);
      
      return config;
    });

    // Add response interceptor for debugging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API] Response (${response.status}):`, response.data);
        // Log CORS-related headers for debugging
        console.log(`[API] Response headers:`, response.headers);
        return response;
      },
      (error) => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`[API] Error Response (${error.response.status}):`, error.response.data);
          // Log CORS-related headers for debugging
          console.error(`[API] Error Response headers:`, error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('[API] No response received:', error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('[API] Request setup error:', error.message);
        }
        
        // Special handling for CORS errors
        if (error.message && error.message.includes('CORS')) {
          console.error('[API] CORS error detected. Check that the server allows this origin and that all required headers are present.');
          console.error('[API] Origin:', window.location.origin);
          console.error('[API] Request URL:', error.config?.url);
          console.error('[API] Request method:', error.config?.method);
          console.error('[API] Request headers:', error.config?.headers);
        }
        
        console.error('[API] Full error:', error);
        return Promise.reject(error);
      }
    );

    // Load credentials from localStorage if available
    this.loadCredentials();
  }

  private loadCredentials(): void {
    const storedCredentials = localStorage.getItem('masjidconnect_credentials');
    if (storedCredentials) {
      try {
        this.credentials = JSON.parse(storedCredentials);
        console.log('[API] Loaded credentials from localStorage:', { 
          apiKey: this.credentials?.apiKey ? this.credentials.apiKey.substring(0, 5) + '...' : 'undefined',
          screenId: this.credentials?.screenId || 'undefined'
        });
      } catch (error) {
        console.error('Failed to parse stored credentials', error);
        localStorage.removeItem('masjidconnect_credentials');
      }
    } else {
      // Also check for individual apiKey and screenId items
      const apiKey = localStorage.getItem('apiKey');
      const screenId = localStorage.getItem('screenId');
      
      if (apiKey && screenId) {
        this.credentials = { apiKey, screenId };
        console.log('[API] Loaded credentials from individual localStorage items:', { 
          apiKey: apiKey.substring(0, 5) + '...',
          screenId
        });
        
        // Store in the standard format for consistency
        this.setCredentials(this.credentials);
      }
    }
  }

  public setCredentials(credentials: ApiCredentials): void {
    this.credentials = credentials;
    localStorage.setItem('masjidconnect_credentials', JSON.stringify(credentials));
    // Also store individually for backward compatibility
    localStorage.setItem('apiKey', credentials.apiKey);
    localStorage.setItem('screenId', credentials.screenId);
    console.log('[API] Credentials set and stored in localStorage');
  }

  public clearCredentials(): void {
    this.credentials = null;
    localStorage.removeItem('masjidconnect_credentials');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('screenId');
    console.log('[API] Credentials cleared from localStorage');
  }

  public isAuthenticated(): boolean {
    return this.credentials !== null;
  }

  /**
   * Step 1: Request a pairing code from the server
   * This creates a new screen record in the database with the generated pairing code
   * 
   * According to the Screen Pairing Guide, the response should be:
   * {
   *   "pairingCode": "123456",
   *   "expiresAt": "2023-04-01T12:15:00Z",
   *   "checkInterval": 5000
   * }
   */
  public async requestPairingCode(deviceInfo: { deviceType: string, orientation: string }): Promise<ApiResponse<RequestPairingCodeResponse>> {
    console.log('[API] Requesting pairing code with device info:', deviceInfo);
    console.log('[API] Using base URL:', this.baseURL);
    
    const endpoint = '/api/screens/unpaired';
    console.log('[API] Full endpoint URL:', `${this.baseURL}${endpoint}`);
    
    // Check if we've made this request recently (within the last 10 seconds)
    const requestTime = Date.now();
    const minRequestInterval = 10000; // 10 seconds
    
    if (this.lastRequestTime[endpoint] && (requestTime - this.lastRequestTime[endpoint] < minRequestInterval)) {
      console.log(`[API] Request to ${endpoint} was made too recently, waiting at least ${minRequestInterval}ms between requests`);
      await new Promise(resolve => setTimeout(resolve, minRequestInterval - (requestTime - this.lastRequestTime[endpoint])));
    }
    
    // Check if a request is already in progress
    if (this.requestInProgress[endpoint]) {
      console.log(`[API] Request to ${endpoint} is already in progress, waiting...`);
      
      // Wait for the existing request to complete (up to 10 seconds)
      let waitTime = 0;
      const checkInterval = 100; // ms
      const maxWaitTime = 10000; // ms
      
      while (this.requestInProgress[endpoint] && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
      }
      
      // If it's still in progress after waiting, return an error
      if (this.requestInProgress[endpoint]) {
        return {
          success: false,
          error: 'Another request is already in progress and timed out'
        };
      }
    }
    
    // Mark this request as in progress
    this.requestInProgress[endpoint] = true;
    
    try {
      const request: RequestPairingCodeRequest = {
        deviceType: deviceInfo.deviceType,
        orientation: deviceInfo.orientation
      };
      
      // Update the last request time
      this.lastRequestTime[endpoint] = requestTime;
      
      // For the unpaired endpoint, create a special Axios instance without withCredentials
      // This is because the unpaired endpoint might not support credentials-based CORS
      const unpairedClient = axios.create({
        baseURL: this.baseURL,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        },
        // Important: Set withCredentials to false for this specific endpoint
        withCredentials: false
      });
      
      // Log the request details for debugging
      console.log(`[API] Making POST request to ${this.baseURL}${endpoint} with data:`, JSON.stringify(request));
      console.log(`[API] Request headers:`, {
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      });
      
      // Make the actual API call using the special client
      const response = await unpairedClient.post<any>(endpoint, request);
      
      console.log('[API] Raw pairing code response:', response);
      console.log('[API] Response data structure:', JSON.stringify(response.data, null, 2));
      console.log('[API] Response data type:', typeof response.data);
      console.log('[API] Response data keys:', Object.keys(response.data));
      console.log('[API] Direct pairing code from response:', response.data.pairingCode);
      
      // Check if response is valid
      if (!response || !response.data) {
        console.error('[API] Invalid response structure:', response);
        this.requestInProgress[endpoint] = false;
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
      // Get the response data directly - according to the guide, it should be a simple object
      const responseData = response.data;
      
      // Validate the pairing code and expiration date
      if (!responseData.pairingCode) {
        console.error('[API] Missing pairing code in response:', responseData);
        this.requestInProgress[endpoint] = false;
        return {
          success: false,
          error: 'Invalid response: Missing pairing code'
        };
      }
      
      // Handle different expiration formats
      let expiresAt = responseData.expiresAt;
      if (!expiresAt && responseData.expiresIn) {
        // If we have expiresIn (milliseconds), calculate expiresAt
        const expirationTime = new Date(Date.now() + responseData.expiresIn);
        expiresAt = expirationTime.toISOString();
        console.log(`[API] Calculated expiresAt from expiresIn: ${expiresAt}`);
      }
      
      if (!expiresAt) {
        console.error('[API] Missing expiration time in response:', responseData);
        this.requestInProgress[endpoint] = false;
        return {
          success: false,
          error: 'Invalid response: Missing expiration time'
        };
      }
      
      console.log('[API] Valid pairing code received:', responseData.pairingCode);
      
      // Update polling interval if provided in the response
      if (responseData.checkInterval) {
        console.log(`[API] Setting polling interval to ${responseData.checkInterval}ms`);
        this.pollingInterval = responseData.checkInterval || this.pollingInterval;
      }
      
      // Mark request as complete
      this.requestInProgress[endpoint] = false;
      
      // Return the API response in the expected format
      return {
        success: true,
        data: {
          pairingCode: responseData.pairingCode,
          expiresAt: expiresAt,
          checkInterval: responseData.checkInterval || 5000
        }
      };
    } catch (error: any) {
      console.error('[API] Error requesting pairing code:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to request pairing code';
      
      if (error.response) {
        console.error('[API] Error response data:', error.response.data);
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText || 'Unknown error'}`;
      } else if (error.request) {
        console.error('[API] No response received for request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        errorMessage = `Request error: ${error.message || 'Unknown error'}`;
      }
      
      // Mark request as complete even if it failed
      this.requestInProgress[endpoint] = false;
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Step 3: Poll for pairing status
   * This checks if the code has been paired by an admin
   * 
   * According to the Screen Pairing Guide, the response should be:
   * - If not paired: { "paired": false, "checkAgainIn": 5000 }
   * - If paired: { "paired": true, "apiKey": "generated-api-key", "screenId": "screen-id" }
   */
  public async checkPairingStatus(pairingCode: string): Promise<boolean> {
    console.log(`[API] Checking pairing status for code: ${pairingCode}`);
    
    // Don't check if no pairing code is provided
    if (!pairingCode) {
      console.error('[API] No pairing code provided for status check');
      return false;
    }
    
    const endpoint = '/api/screens/unpaired/check'; // Using the endpoint from the guide
    console.log('[API] Full endpoint URL:', `${this.baseURL}${endpoint}`);
    
    // Check if we've made this request recently (within the last 2 seconds)
    const currentTime = Date.now();
    const minRequestInterval = 2000; // 2 seconds
    
    if (this.lastRequestTime[endpoint] && (currentTime - this.lastRequestTime[endpoint] < minRequestInterval)) {
      console.log(`[API] Request to ${endpoint} was made too recently, waiting at least ${minRequestInterval}ms between requests`);
      await new Promise(resolve => setTimeout(resolve, minRequestInterval - (currentTime - this.lastRequestTime[endpoint])));
    }
    
    // Check if a request is already in progress
    if (this.requestInProgress[endpoint]) {
      console.log(`[API] Request to ${endpoint} is already in progress, waiting...`);
      
      // Wait for the existing request to complete (up to 5 seconds)
      let waitTime = 0;
      const checkInterval = 100; // ms
      const maxWaitTime = 5000; // ms
      
      while (this.requestInProgress[endpoint] && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
      }
      
      // If it's still in progress after waiting, return false
      if (this.requestInProgress[endpoint]) {
        console.log(`[API] Request to ${endpoint} timed out waiting for previous request`);
        return false;
      }
    }
    
    // Mark this request as in progress
    this.requestInProgress[endpoint] = true;
    
    // Update the last request time
    this.lastRequestTime[endpoint] = currentTime;
    
    const request: CheckPairingStatusRequest = {
      pairingCode
    };
    
    try {
      // For the unpaired check endpoint, create a special Axios instance without withCredentials
      // This is because the unpaired endpoints might not support credentials-based CORS
      const unpairedClient = axios.create({
        baseURL: this.baseURL,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        },
        // Important: Set withCredentials to false for this specific endpoint
        withCredentials: false
      });
      
      // Log the request details for debugging
      console.log(`[API] Making POST request to ${this.baseURL}${endpoint} to check pairing status`);
      console.log(`[API] Request headers:`, {
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      });
      
      // Make the actual API call using the special client
      const response = await unpairedClient.post<any>(endpoint, request);
      
      console.log('[API] Raw pairing status response:', response);
      console.log('[API] Response data structure:', JSON.stringify(response.data, null, 2));
      
      // Check if response is valid
      if (!response || !response.data) {
        console.error('[API] Invalid pairing status response structure:', response);
        this.requestInProgress[endpoint] = false;
        return false;
      }
      
      // Get the response data directly - according to the guide, it should be a simple object
      const responseData = response.data;
      console.log('[API] Parsed response data:', responseData);
      
      // Check if the device is paired - the guide says to look for paired: true
      if (responseData.paired === true) {
        console.log('[API] Device has been successfully paired!');
        
        // Store the API key and screen ID
        if (responseData.apiKey && responseData.screenId) {
          console.log('[API] Storing credentials:', { 
            apiKey: responseData.apiKey.substring(0, 5) + '...',
            screenId: responseData.screenId
          });
          
          localStorage.setItem('apiKey', responseData.apiKey);
          localStorage.setItem('screenId', responseData.screenId);
          
          // Also store in masjidconnect_credentials format for consistency
          this.setCredentials({
            apiKey: responseData.apiKey,
            screenId: responseData.screenId
          });
        } else {
          console.error('[API] Missing credentials in successful pairing response:', responseData);
        }
        
        // Set the polling interval if provided
        if (responseData.checkAgainIn) {
          console.log(`[API] Setting polling interval to ${responseData.checkAgainIn}ms`);
          this.pollingInterval = responseData.checkAgainIn || this.pollingInterval;
        }
        
        // Mark request as complete
        this.requestInProgress[endpoint] = false;
        return true;
      }
      
      // Not paired yet - the guide says to look for paired: false
      if (responseData.paired === false) {
        console.log('[API] Device not yet paired, continuing to poll');
        
        // Update polling interval if provided
        if (responseData.checkAgainIn) {
          console.log(`[API] Setting polling interval to ${responseData.checkAgainIn}ms`);
          this.pollingInterval = responseData.checkAgainIn || this.pollingInterval;
        }
        
        // Mark request as complete
        this.requestInProgress[endpoint] = false;
        return false;
      }
      
      // If we get here, the response format is unexpected
      console.error('[API] Unexpected response format:', responseData);
      this.requestInProgress[endpoint] = false;
      return false;
    } catch (error: any) {
      console.error('[API] Error checking pairing status:', error);
      
      // Check for CORS errors
      if (error.message && error.message.includes('CORS')) {
        console.error('[API] CORS error detected in checkPairingStatus. Check server configuration.');
        console.error('[API] Origin:', window.location.origin);
        console.error('[API] Request URL:', `${this.baseURL}${endpoint}`);
      }
      
      // Check if this is a 404 error (invalid or expired pairing code)
      if (error.response && error.response.status === 404) {
        console.error('[API] Pairing code is invalid or expired');
        
        // Don't clear the stored pairing code automatically
        // This was causing a loop of new code requests
        // Let the UI handle expired codes more gracefully
        
        // Mark request as complete
        this.requestInProgress[endpoint] = false;
        
        // Return false to indicate not paired
        return false;
      }
      
      // Provide more detailed error information
      if (error.response) {
        console.error(`[API] Server returned error (${error.response.status}):`, error.response.data);
      } else if (error.request) {
        console.error('[API] No response received from server');
      } else {
        console.error(`[API] Request error: ${error.message || 'Unknown error'}`);
      }
      
      // Mark request as complete even if it failed
      this.requestInProgress[endpoint] = false;
      return false;
    }
  }

  /**
   * Get the current polling interval
   */
  public getPollingInterval(): number {
    return this.pollingInterval;
  }

  public async sendHeartbeat(status: HeartbeatRequest): Promise<ApiResponse<HeartbeatResponse>> {
    try {
      console.log('[API] Sending heartbeat');
      
      // Verify we have credentials before making authenticated requests
      if (!this.credentials) {
        console.error('[API] Cannot send heartbeat: No authentication credentials');
        return {
          success: false,
          error: 'Authentication required. Please pair the device first.'
        };
      }
      
      // Create explicit config with headers for this request
      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.apiKey}`,
          'X-Screen-ID': this.credentials.screenId
        }
      };
      
      console.log('[API] Making authenticated request to /api/screen/heartbeat');
      const response = await this.client.post<any>('/api/screen/heartbeat', status, config);
      
      if (!response || !response.data) {
        console.error('[API] Invalid response structure:', response);
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[API] Error sending heartbeat:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to send heartbeat';
      
      if (error.response) {
        console.error('[API] Error response data:', error.response.data);
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText || 'Unknown error'}`;
        
        // Special handling for 401/403 errors
        if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = 'Authentication failed. Please pair the device again.';
          // Clear invalid credentials
          this.clearCredentials();
        }
      } else if (error.request) {
        console.error('[API] No response received for request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        errorMessage = `Request error: ${error.message || 'Unknown error'}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  public async getScreenContent(): Promise<ApiResponse<ScreenContent>> {
    try {
      console.log('[API] Fetching screen content');
      
      // Verify we have credentials before making authenticated requests
      if (!this.credentials) {
        console.error('[API] Cannot fetch screen content: No authentication credentials');
        return {
          success: false,
          error: 'Authentication required. Please pair the device first.'
        };
      }
      
      // Create explicit config with headers for this request
      const config: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiKey}`,
          'X-Screen-ID': this.credentials.screenId
        }
      };
      
      console.log('[API] Making authenticated request to /api/screen/content');
      const response = await this.client.get<any>('/api/screen/content', config);
      
      if (!response || !response.data) {
        console.error('[API] Invalid response structure:', response);
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[API] Error fetching screen content:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to fetch screen content';
      
      if (error.response) {
        console.error('[API] Error response data:', error.response.data);
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText || 'Unknown error'}`;
        
        // Special handling for 401/403 errors
        if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = 'Authentication failed. Please pair the device again.';
          // Clear invalid credentials
          this.clearCredentials();
        }
      } else if (error.request) {
        console.error('[API] No response received for request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        errorMessage = `Request error: ${error.message || 'Unknown error'}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  public async getPrayerTimes(startDate?: string, endDate?: string): Promise<ApiResponse<PrayerTimes[]>> {
    try {
      console.log('[API] Fetching prayer times');
      
      // Verify we have credentials before making authenticated requests
      if (!this.credentials) {
        console.error('[API] Cannot fetch prayer times: No authentication credentials');
        return {
          success: false,
          error: 'Authentication required. Please pair the device first.'
        };
      }
      
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      // Create explicit config with headers for this request
      const config: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiKey}`,
          'X-Screen-ID': this.credentials.screenId
        },
        params
      };
      
      console.log('[API] Making authenticated request to /api/screen/prayer-times');
      const response = await this.client.get<any>('/api/screen/prayer-times', config);
      
      if (!response || !response.data) {
        console.error('[API] Invalid response structure:', response);
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[API] Error fetching prayer times:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to fetch prayer times';
      
      if (error.response) {
        console.error('[API] Error response data:', error.response.data);
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText || 'Unknown error'}`;
        
        // Special handling for 401/403 errors
        if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = 'Authentication failed. Please pair the device again.';
          // Clear invalid credentials
          this.clearCredentials();
        }
      } else if (error.request) {
        console.error('[API] No response received for request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        errorMessage = `Request error: ${error.message || 'Unknown error'}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  public async getEvents(count: number = 5): Promise<ApiResponse<EventsResponse>> {
    try {
      console.log('[API] Fetching events');
      
      // Verify we have credentials before making authenticated requests
      if (!this.credentials) {
        console.error('[API] Cannot fetch events: No authentication credentials');
        return {
          success: false,
          error: 'Authentication required. Please pair the device first.'
        };
      }
      
      // Create explicit config with headers for this request
      const config: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiKey}`,
          'X-Screen-ID': this.credentials.screenId
        },
        params: { count }
      };
      
      console.log('[API] Making authenticated request to /api/screen/events');
      const response = await this.client.get<any>('/api/screen/events', config);
      
      if (!response || !response.data) {
        console.error('[API] Invalid response structure:', response);
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[API] Error fetching events:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to fetch events';
      
      if (error.response) {
        console.error('[API] Error response data:', error.response.data);
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText || 'Unknown error'}`;
        
        // Special handling for 401/403 errors
        if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = 'Authentication failed. Please pair the device again.';
          // Clear invalid credentials
          this.clearCredentials();
        }
      } else if (error.request) {
        console.error('[API] No response received for request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        errorMessage = `Request error: ${error.message || 'Unknown error'}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  public async getPrayerStatus(): Promise<ApiResponse<PrayerStatus>> {
    try {
      console.log('[API] Fetching prayer status');
      
      // Verify we have credentials before making authenticated requests
      if (!this.credentials) {
        console.error('[API] Cannot fetch prayer status: No authentication credentials');
        return {
          success: false,
          error: 'Authentication required. Please pair the device first.'
        };
      }
      
      // Create explicit config with headers for this request
      const config: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiKey}`,
          'X-Screen-ID': this.credentials.screenId
        }
      };
      
      console.log('[API] Making authenticated request to /api/screen/prayer-status');
      const response = await this.client.get<any>('/api/screen/prayer-status', config);
      
      if (!response || !response.data) {
        console.error('[API] Invalid response structure:', response);
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[API] Error fetching prayer status:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to fetch prayer status';
      
      if (error.response) {
        console.error('[API] Error response data:', error.response.data);
        errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || error.response.statusText || 'Unknown error'}`;
        
        // Special handling for 401/403 errors
        if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = 'Authentication failed. Please pair the device again.';
          // Clear invalid credentials
          this.clearCredentials();
        }
      } else if (error.request) {
        console.error('[API] No response received for request:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        errorMessage = `Request error: ${error.message || 'Unknown error'}`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  public async getRequest<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      console.log(`[API] Making generic GET request to: ${url}`);
      
      // Merge provided config with authentication headers if we have credentials
      let requestConfig = { ...config };
      
      if (this.credentials) {
        requestConfig.headers = {
          ...(requestConfig.headers || {}),
          'Authorization': `Bearer ${this.credentials.apiKey}`,
          'X-Screen-ID': this.credentials.screenId
        };
      }
      
      console.log(`[API] Request config:`, requestConfig);
      const response = await this.client.get<T>(url, requestConfig);
      return response.data;
    } catch (error: any) {
      console.error(`[API] Error in GET request to ${url}:`, error);
      
      // Check for CORS errors
      if (error.message && error.message.includes('CORS')) {
        console.error('[API] CORS error detected in getRequest. Check server configuration.');
      }
      
      throw error;
    }
  }

  public async postRequest<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      console.log(`[API] Making generic POST request to: ${url}`);
      
      // Merge provided config with authentication headers if we have credentials
      let requestConfig = { ...config };
      
      if (this.credentials) {
        requestConfig.headers = {
          ...(requestConfig.headers || {}),
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.apiKey}`,
          'X-Screen-ID': this.credentials.screenId
        };
      } else if (!requestConfig.headers || !requestConfig.headers['Content-Type']) {
        // Ensure Content-Type is set for POST requests
        requestConfig.headers = {
          ...(requestConfig.headers || {}),
          'Content-Type': 'application/json'
        };
      }
      
      console.log(`[API] Request config:`, requestConfig);
      const response = await this.client.post<T>(url, data, requestConfig);
      return response.data;
    } catch (error: any) {
      console.error(`[API] Error in POST request to ${url}:`, error);
      
      // Check for CORS errors
      if (error.message && error.message.includes('CORS')) {
        console.error('[API] CORS error detected in postRequest. Check server configuration.');
      }
      
      throw error;
    }
  }
}

// Export a singleton instance
export default new ApiClient(); 