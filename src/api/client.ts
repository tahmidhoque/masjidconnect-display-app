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
    
    try {
      const request: RequestPairingCodeRequest = {
        deviceType: deviceInfo.deviceType,
        orientation: deviceInfo.orientation
      };
      
      // In development mode, we can simulate a successful response
      if (this.isDevelopment) {
        try {
          const response = await this.client.post<ApiResponse<RequestPairingCodeResponse>>('/api/screens/unpaired', request);
          
          // Update polling interval if provided in the response
          if (response.data.data?.checkInterval) {
            this.pollingInterval = response.data.data.checkInterval;
          }
          
          return response.data;
        } catch (error) {
          console.warn('Failed to request pairing code from local server, using mock response instead:', error);
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Return a mock successful response
          const mockResponse: ApiResponse<RequestPairingCodeResponse> = {
            success: true,
            data: {
              pairingCode: Math.floor(100000 + Math.random() * 900000).toString(),
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
              checkInterval: 5000
            }
          };
          
          // Set polling interval from mock response (with null check)
          if (mockResponse.data) {
            this.pollingInterval = mockResponse.data.checkInterval;
          }
          return mockResponse;
        }
      }
      
      // In production, make the actual API call
      const response = await this.client.post<ApiResponse<RequestPairingCodeResponse>>('/api/screens/unpaired', request);
      
      // Update polling interval if provided in the response
      if (response.data.data?.checkInterval) {
        this.pollingInterval = response.data.data.checkInterval;
      }
      
      return response.data;
    } catch (error) {
      console.error('Error requesting pairing code:', error);
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
            
            return true;
          }
          
          return false;
        } catch (error) {
          console.log('[API] Could not connect to local server, using mock response');
          
          // Simulate a network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Simulate a response
          const mockResponse: ApiResponse<CheckPairingStatusResponse> = {
            success: true,
            data: {
              paired: Math.random() > 0.8, // 20% chance of being paired
              apiKey: Math.random() > 0.8 ? 'mock-api-key-' + Date.now() : undefined,
              screenId: Math.random() > 0.8 ? 'mock-screen-id-' + Date.now() : undefined,
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
            
            return true;
          }
          
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
          
          return true;
        }
        
        return false;
      }
    } catch (error) {
      console.error('[API] Error checking pairing status:', error);
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