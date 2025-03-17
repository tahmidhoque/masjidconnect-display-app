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
  private isDevelopment: boolean = false;
  private pollingInterval: number = 5000; // Default polling interval in ms
  private lastRequestTime: Record<string, number> = {}; // Track last request time for each endpoint
  private requestInProgress: Record<string, boolean> = {}; // Track if a request is in progress

  constructor() {
    // Check if we're in development mode
    // First try the NODE_ENV environment variable
    if (process.env.NODE_ENV === 'development') {
      this.isDevelopment = true;
    } 
    // If NODE_ENV is not set, check if we're using localhost
    else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      this.isDevelopment = false;
      console.log('Detected localhost, but not setting development mode');
    }
    
    // Log the current environment for debugging
    console.log('API Client - Current NODE_ENV:', process.env.NODE_ENV);
    console.log('API Client - isDevelopment:', this.isDevelopment);
    console.log('API Client - window.location.hostname:', window.location.hostname);
    
    // In development mode, use localhost if not specified
    if (this.isDevelopment && !process.env.REACT_APP_API_URL) {
      this.baseURL = 'http://localhost:3000';
    }
    
    console.log('ApiClient initialized with baseURL:', this.baseURL);
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      // Allow cross-origin requests in development
      withCredentials: false
    });

    // Add request interceptor to include authentication headers
    this.client.interceptors.request.use((config) => {
      console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
      
      if (this.credentials) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${this.credentials.apiKey}`;
        config.headers['X-Screen-ID'] = this.credentials.screenId;
      }
      return config;
    });

    // Add response interceptor for debugging
    this.client.interceptors.response.use(
      (response) => {
        console.log('API Response:', response.status, response.data);
        return response;
      },
      (error) => {
        console.error('API Error:', error);
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
      } catch (error) {
        console.error('Failed to parse stored credentials', error);
        localStorage.removeItem('masjidconnect_credentials');
      }
    }
  }

  public setCredentials(credentials: ApiCredentials): void {
    this.credentials = credentials;
    localStorage.setItem('masjidconnect_credentials', JSON.stringify(credentials));
  }

  public clearCredentials(): void {
    this.credentials = null;
    localStorage.removeItem('masjidconnect_credentials');
  }

  public isAuthenticated(): boolean {
    return this.credentials !== null;
  }

  /**
   * Step 1: Request a pairing code from the server
   * This creates a new screen record in the database with the generated pairing code
   */
  public async requestPairingCode(deviceInfo: { deviceType: string, orientation: string }): Promise<ApiResponse<RequestPairingCodeResponse>> {
    console.log('Requesting pairing code with device info:', deviceInfo);
    
    const endpoint = '/api/screens/unpaired';
    
    // Check if we've made this request recently (within the last 5 seconds)
    const now = Date.now();
    const minRequestInterval = 5000; // 5 seconds
    
    if (this.lastRequestTime[endpoint] && (now - this.lastRequestTime[endpoint] < minRequestInterval)) {
      console.log(`Request to ${endpoint} was made recently, debouncing...`);
      await new Promise(resolve => setTimeout(resolve, minRequestInterval));
    }
    
    // Check if a request is already in progress
    if (this.requestInProgress[endpoint]) {
      console.log(`Request to ${endpoint} is already in progress, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // If it's still in progress after waiting, return an error
      if (this.requestInProgress[endpoint]) {
        return {
          success: false,
          error: 'Another request is already in progress'
        };
      }
    }
    
    // Mark this request as in progress
    this.requestInProgress[endpoint] = true;
    
    // Add a delay to prevent too many requests
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const request: RequestPairingCodeRequest = {
        deviceType: deviceInfo.deviceType,
        orientation: deviceInfo.orientation
      };
      
      // Update the last request time
      this.lastRequestTime[endpoint] = now;
      
      // In development mode, we can simulate a successful response
      if (this.isDevelopment) {
        try {
          const response = await this.client.post<ApiResponse<RequestPairingCodeResponse>>('/api/screens/unpaired', request);
          
          // Update polling interval if provided in the response
          if (response.data.data?.checkInterval) {
            this.pollingInterval = response.data.data.checkInterval;
          }
          
          // Mark request as complete
          this.requestInProgress[endpoint] = false;
          return response.data;
        } catch (error) {
          console.warn('Failed to request pairing code from local server, using mock response instead:', error);
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Return a mock successful response
          const mockResponse: ApiResponse<RequestPairingCodeResponse> = {
            success: true,
            data: {
              pairingCode: Math.floor(100000 + Math.random() * 900000).toString(),
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
              checkInterval: 60000 // Check every 60 seconds
            }
          };
          
          // Set polling interval from mock response (with null check)
          if (mockResponse.data) {
            this.pollingInterval = mockResponse.data.checkInterval;
          }
          
          // Mark request as complete
          this.requestInProgress[endpoint] = false;
          return mockResponse;
        }
      }
      
      // In production, make the actual API call
      const response = await this.client.post<ApiResponse<RequestPairingCodeResponse>>('/api/screens/unpaired', request);
      
      // Update polling interval if provided in the response
      if (response.data.data?.checkInterval) {
        this.pollingInterval = response.data.data.checkInterval;
      }
      
      // Mark request as complete
      this.requestInProgress[endpoint] = false;
      return response.data;
    } catch (error) {
      console.error('Error requesting pairing code:', error);
      
      // Mark request as complete even if it failed
      this.requestInProgress[endpoint] = false;
      
      return {
        success: false,
        error: 'Failed to request pairing code'
      };
    }
  }

  /**
   * Step 3: Poll for pairing status
   * This checks if the code has been paired by an admin
   */
  public async checkPairingStatus(pairingCode: string): Promise<boolean> {
    console.log(`[API] Checking pairing status for code: ${pairingCode}`);
    console.log(`[API] Using isDevelopment: ${this.isDevelopment}`);
    
    const endpoint = `/api/screens/check-pairing-status/${pairingCode}`;
    
    // Check if we've made this request recently (within the last 2 seconds)
    const now = Date.now();
    const minRequestInterval = 2000; // 2 seconds
    
    if (this.lastRequestTime[endpoint] && (now - this.lastRequestTime[endpoint] < minRequestInterval)) {
      console.log(`Request to ${endpoint} was made recently, debouncing...`);
      await new Promise(resolve => setTimeout(resolve, minRequestInterval));
    }
    
    // Check if a request is already in progress
    if (this.requestInProgress[endpoint]) {
      console.log(`Request to ${endpoint} is already in progress, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // If it's still in progress after waiting, return false
      if (this.requestInProgress[endpoint]) {
        return false;
      }
    }
    
    // Mark this request as in progress
    this.requestInProgress[endpoint] = true;
    
    // Update the last request time
    this.lastRequestTime[endpoint] = now;
    
    // Add a small delay to prevent too many requests
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const request: CheckPairingStatusRequest = {
      pairingCode
    };
    
    try {
      if (this.isDevelopment) {
        // In development mode, try to connect to local server first
        try {
          const response = await axios.post<ApiResponse<CheckPairingStatusResponse>>(
            'http://localhost:3001/api/screens/check-pairing-status',
            request
          );
          
          console.log('[API] Pairing status response from local server:', response.data);
          
          if (response.data.success && response.data.data?.paired) {
            // Store the API key and screen ID
            if (response.data.data.apiKey && response.data.data.screenId) {
              localStorage.setItem('apiKey', response.data.data.apiKey);
              localStorage.setItem('screenId', response.data.data.screenId);
            }
            
            // Set the polling interval if provided
            if (response.data.data.checkAgainIn) {
              this.pollingInterval = response.data.data.checkAgainIn * 1000;
            }
            
            // Mark request as complete
            this.requestInProgress[endpoint] = false;
            return true;
          }
          
          // Update polling interval if provided
          if (response.data.data?.checkAgainIn) {
            this.pollingInterval = response.data.data.checkAgainIn * 1000;
          }
          
          // Mark request as complete
          this.requestInProgress[endpoint] = false;
          return false;
        } catch (error) {
          console.log('[API] Could not connect to local server, using mock response');
          
          // Simulate a network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Simulate a response
          const mockResponse: ApiResponse<CheckPairingStatusResponse> = {
            success: true,
            data: {
              paired: Math.random() > 0.95, // 5% chance of being paired (reduced to prevent frequent pairing)
              apiKey: Math.random() > 0.95 ? 'mock-api-key-' + Date.now() : undefined,
              screenId: Math.random() > 0.95 ? 'mock-screen-id-' + Date.now() : undefined,
              checkAgainIn: 60 // Check every 60 seconds
            }
          };
          
          console.log('[API] Mock pairing status response:', mockResponse);
          
          if (mockResponse.success && mockResponse.data?.paired) {
            // Store the API key and screen ID
            if (mockResponse.data.apiKey && mockResponse.data.screenId) {
              localStorage.setItem('apiKey', mockResponse.data.apiKey);
              localStorage.setItem('screenId', mockResponse.data.screenId);
            }
            
            // Set the polling interval if provided
            if (mockResponse.data && mockResponse.data.checkAgainIn) {
              this.pollingInterval = mockResponse.data.checkAgainIn * 1000;
            }
            
            // Mark request as complete
            this.requestInProgress[endpoint] = false;
            return true;
          }
          
          // Update polling interval if provided
          if (mockResponse.data && mockResponse.data.checkAgainIn) {
            this.pollingInterval = mockResponse.data.checkAgainIn * 1000;
          }
          
          // Mark request as complete
          this.requestInProgress[endpoint] = false;
          return false;
        }
      } else {
        // In production, make a real API call
        const response = await this.client.post<ApiResponse<CheckPairingStatusResponse>>('/api/screens/check-pairing-status', request);
        
        console.log('[API] Pairing status response:', response.data);
        
        if (response.data.success && response.data.data?.paired) {
          // Store the API key and screen ID
          if (response.data.data.apiKey && response.data.data.screenId) {
            localStorage.setItem('apiKey', response.data.data.apiKey);
            localStorage.setItem('screenId', response.data.data.screenId);
          }
          
          // Set the polling interval if provided
          if (response.data.data.checkAgainIn) {
            this.pollingInterval = response.data.data.checkAgainIn * 1000;
          }
          
          // Mark request as complete
          this.requestInProgress[endpoint] = false;
          return true;
        }
        
        // Update polling interval if provided
        if (response.data.data?.checkAgainIn) {
          this.pollingInterval = response.data.data.checkAgainIn * 1000;
        }
        
        // Mark request as complete
        this.requestInProgress[endpoint] = false;
        return false;
      }
    } catch (error) {
      console.error('[API] Error checking pairing status:', error);
      
      // Mark request as complete even if it failed
      this.requestInProgress[endpoint] = false;
      return false;
    }
  }

  /**
   * Get the recommended polling interval
   */
  public getPollingInterval(): number {
    return this.pollingInterval;
  }

  public async sendHeartbeat(status: HeartbeatRequest): Promise<ApiResponse<HeartbeatResponse>> {
    const response = await this.client.post<ApiResponse<HeartbeatResponse>>('/api/screen/heartbeat', status);
    return response.data;
  }

  public async getScreenContent(): Promise<ApiResponse<ScreenContent>> {
    const response = await this.client.get<ApiResponse<ScreenContent>>('/api/screen/content');
    return response.data;
  }

  public async getPrayerTimes(startDate?: string, endDate?: string): Promise<ApiResponse<PrayerTimes[]>> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await this.client.get<ApiResponse<PrayerTimes[]>>('/api/screen/prayer-times', { params });
    return response.data;
  }

  public async getEvents(count: number = 5): Promise<ApiResponse<EventsResponse>> {
    const response = await this.client.get<ApiResponse<EventsResponse>>('/api/screen/events', { params: { count } });
    return response.data;
  }

  public async getPrayerStatus(): Promise<ApiResponse<PrayerStatus>> {
    const response = await this.client.get<ApiResponse<PrayerStatus>>('/api/screen/prayer-status');
    return response.data;
  }

  public async getRequest<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  public async postRequest<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }
}

// Export a singleton instance
export default new ApiClient(); 