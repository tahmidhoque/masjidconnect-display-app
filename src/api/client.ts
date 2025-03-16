import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  PairingRequest,
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
  private baseURL: string = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  private isDevelopment: boolean = process.env.NODE_ENV === 'development';

  constructor() {
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

  public async checkUnpairedScreens(): Promise<ApiResponse<any>> {
    const response = await this.client.get<ApiResponse<any>>('/api/screens/unpaired');
    return response.data;
  }

  public async pairScreen(pairingData: PairingRequest): Promise<ApiResponse<PairingResponse>> {
    // In development mode, we can still try to connect to the local server first
    if (this.isDevelopment) {
      console.log('DEV MODE: Attempting to connect to local server with code:', pairingData.pairingCode);
      
      try {
        // Try to connect to the local server first
        const endpoint = '/api/screens/pair';
        console.log(`Making pairing request to: ${this.baseURL}${endpoint}`);
        
        const response = await this.client.post<ApiResponse<PairingResponse>>(endpoint, pairingData);
        console.log('Pairing response from local server:', response.data);
        return response.data;
      } catch (error) {
        console.warn('Failed to connect to local server, using mock response instead:', error);
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Log the request for debugging
        console.log('Using mock response for pairing request:', pairingData);
        
        // Return a mock successful response
        return {
          success: true,
          data: {
            screen: {
              id: 'mock-screen-id-' + Date.now(),
              name: 'Development Screen',
              apiKey: 'mock-api-key-' + Math.random().toString(36).substring(2, 15),
            }
          }
        };
      }
    }
    
    // In production, make the actual API call
    try {
      const response = await this.client.post<ApiResponse<PairingResponse>>('/api/screens/pair', pairingData);
      return response.data;
    } catch (error) {
      console.error('API Error in pairScreen:', error);
      return {
        success: false,
        error: 'Failed to connect to the server. Please check your internet connection.'
      };
    }
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