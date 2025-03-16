import apiClient from '../api/client';
import storageService from './storageService';
import { ScreenContent, PrayerTimes, PrayerStatus, Event } from '../api/models';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minute

class DataSyncService {
  private syncIntervalId: number | null = null;
  private heartbeatIntervalId: number | null = null;
  private lastSyncTime: number = 0;
  private lastHeartbeatTime: number = 0;
  private startTime: number = Date.now();

  constructor() {}

  // Initialize the service
  public initialize(): void {
    this.setupNetworkListeners();
    
    // Start syncing if authenticated
    if (apiClient.isAuthenticated()) {
      this.startSync();
      this.startHeartbeat();
    }
  }

  // Setup network status listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  // Handle coming back online
  private handleOnline = (): void => {
    console.log('Network connection restored');
    if (apiClient.isAuthenticated()) {
      // Sync immediately when coming back online
      this.syncData();
      this.startSync();
      this.startHeartbeat();
    }
  };

  // Handle going offline
  private handleOffline = (): void => {
    console.log('Network connection lost');
    this.stopSync();
    this.stopHeartbeat();
  };

  // Start periodic sync
  public startSync(): void {
    if (this.syncIntervalId !== null) return;

    // Initial sync immediately
    this.syncData();

    // Then schedule periodic sync
    this.syncIntervalId = window.setInterval(() => {
      this.syncData();
    }, SYNC_INTERVAL);
  }

  // Stop periodic sync
  public stopSync(): void {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // Start heartbeat
  public startHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) return;

    // Initial heartbeat immediately
    this.sendHeartbeat();

    // Then schedule periodic heartbeat
    this.heartbeatIntervalId = window.setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  // Stop heartbeat
  public stopHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      window.clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  // Sync all data
  public async syncData(): Promise<void> {
    if (!navigator.onLine || !apiClient.isAuthenticated()) return;

    try {
      console.log('Syncing data...');
      this.lastSyncTime = Date.now();

      // Fetch screen content (this includes today's prayer times)
      const contentResponse = await apiClient.getScreenContent();
      if (contentResponse.success && contentResponse.data) {
        await storageService.saveScreenContent(contentResponse.data);
      }

      // Fetch prayer status
      const prayerStatusResponse = await apiClient.getPrayerStatus();
      if (prayerStatusResponse.success && prayerStatusResponse.data) {
        await storageService.savePrayerStatus(prayerStatusResponse.data);
      }

      // Fetch events
      const eventsResponse = await apiClient.getEvents(10);
      if (eventsResponse.success && eventsResponse.data) {
        await storageService.saveEvents(eventsResponse.data.events);
      }

      // Fetch prayer times for the next 7 days
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const prayerTimesResponse = await apiClient.getPrayerTimes(startDate, endDate);
      if (prayerTimesResponse.success && prayerTimesResponse.data) {
        await storageService.savePrayerTimes(prayerTimesResponse.data);
      }

      console.log('Data sync completed successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  }

  // Send heartbeat to server
  private async sendHeartbeat(): Promise<void> {
    if (!navigator.onLine || !apiClient.isAuthenticated()) return;

    try {
      this.lastHeartbeatTime = Date.now();
      
      // Calculate uptime in seconds
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      
      // Send heartbeat
      await apiClient.sendHeartbeat({
        status: 'ONLINE',
        metrics: {
          uptime,
          memoryUsage: this.getMemoryUsage(),
          lastError: '',
        },
      });
      
      console.log('Heartbeat sent successfully');
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  // Get memory usage if available
  private getMemoryUsage(): number {
    if (window.performance && (window.performance as any).memory) {
      return (window.performance as any).memory.usedJSHeapSize || 0;
    }
    return 0;
  }

  // Clean up resources
  public cleanup(): void {
    this.stopSync();
    this.stopHeartbeat();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

export default new DataSyncService(); 