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
  private baseURL: string = process.env.REACT_APP_API_URL || 'https://api.masjidconnect.com';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include authentication headers
    this.client.interceptors.request.use((config) => {
      if (this.credentials) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${this.credentials.apiKey}`;
        config.headers['X-Screen-ID'] = this.credentials.screenId;
      }
      return config;
    });

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
    const response = await this.client.post<ApiResponse<PairingResponse>>('/api/screens/pair', pairingData);
    return response.data;
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