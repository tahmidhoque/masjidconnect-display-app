import masjidDisplayClient, { POLLING_INTERVALS } from '../api/masjidDisplayClient';
import storageService from './storageService';
import logger, { getLastError } from '../utils/logger';

class DataSyncService {
  private syncIntervals: Record<string, number | null> = {
    content: null,
    prayerStatus: null,
    prayerTimes: null,
    events: null,
    heartbeat: null
  };
  private lastSyncTime: Record<string, number> = {};
  private startTime: number = Date.now();
  // Flag to prevent multiple initialization calls
  private isInitialized: boolean = false;

  constructor() {}

  // Initialize the service
  public initialize(): void {
    // Guard against multiple initializations
    if (this.isInitialized) {
      logger.warn('DataSyncService already initialized, skipping');
      return;
    }
    
    logger.info('Initializing DataSyncService');
    this.isInitialized = true;
    this.setupNetworkListeners();
    
    // Start syncing if authenticated
    if (masjidDisplayClient.isAuthenticated()) {
      // Initial sync
      this.syncAllData();
      
      // Then start periodic syncs with proper intervals
      this.startAllSyncs();
    }
  }

  // Setup network status listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  // Handle coming back online
  private handleOnline = (): void => {
    logger.info('Network connection restored');
    if (masjidDisplayClient.isAuthenticated()) {
      // Sync immediately when coming back online
      this.syncAllData();
      this.startAllSyncs();
    }
  };

  // Handle going offline
  private handleOffline = (): void => {
    logger.warn('Network connection lost');
    this.stopAllSyncs();
  };

  // Start all sync processes
  private startAllSyncs(): void {
    // Log the intervals we're using
    logger.info('Starting all sync processes with intervals', {
      content: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes`,
      prayerStatus: `${POLLING_INTERVALS.PRAYER_STATUS / 1000} seconds`,
      prayerTimes: `${POLLING_INTERVALS.PRAYER_TIMES / (60 * 60 * 1000)} hours`,
      events: `${POLLING_INTERVALS.EVENTS / (60 * 1000)} minutes`,
      heartbeat: `${POLLING_INTERVALS.HEARTBEAT / 1000} seconds`
    });
    
    // Only start syncs if they're not already running
    if (this.syncIntervals.content === null) {
      this.startContentSync();
    }
    
    if (this.syncIntervals.prayerStatus === null) {
      this.startPrayerStatusSync();
    }
    
    if (this.syncIntervals.prayerTimes === null) {
      this.startPrayerTimesSync();
    }
    
    if (this.syncIntervals.events === null) {
      this.startEventsSync();
    }
    
    if (this.syncIntervals.heartbeat === null) {
      this.startHeartbeat();
    }
  }

  // Stop all sync processes
  private stopAllSyncs(): void {
    logger.info('Stopping all sync processes');
    this.stopContentSync();
    this.stopPrayerStatusSync();
    this.stopPrayerTimesSync();
    this.stopEventsSync();
    this.stopHeartbeat();
  }

  // Sync all data immediately
  public async syncAllData(): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) {
      logger.warn('Cannot sync data - offline or not authenticated', {
        online: navigator.onLine,
        authenticated: masjidDisplayClient.isAuthenticated()
      });
      return;
    }
    
    logger.info('Syncing all data immediately');
    
    // Use Promise.allSettled to ensure all sync attempts run even if some fail
    try {
      const results = await Promise.allSettled([
        this.syncContent(),
        this.syncPrayerStatus(),
        this.syncPrayerTimes(),
        this.syncEvents(),
        this.sendHeartbeat()
      ]);
      
      // Log results of each sync operation
      const syncResults = {
        content: results[0].status,
        prayerStatus: results[1].status,
        prayerTimes: results[2].status,
        events: results[3].status,
        heartbeat: results[4].status
      };
      
      // Check if any syncs failed
      const failedSyncs = results.filter(result => result.status === 'rejected');
      
      if (failedSyncs.length > 0) {
        logger.warn(`${failedSyncs.length} sync operations failed`, { syncResults });
        
        // Log detailed errors for each failed sync
        failedSyncs.forEach((result, index) => {
          if (result.status === 'rejected') {
            const syncType = ['content', 'prayerStatus', 'prayerTimes', 'events', 'heartbeat'][index];
            logger.error(`Failed to sync ${syncType}`, { error: result.reason });
          }
        });
      } else {
        logger.info('All data synced successfully', { syncResults });
      }
    } catch (error) {
      logger.error('Error in syncAllData', { error });
    }
  }

  // Content sync methods
  private startContentSync(): void {
    if (this.syncIntervals.content !== null) return;

    logger.debug('Starting content sync with interval', { 
      interval: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes` 
    });
    
    // Schedule periodic sync - don't sync immediately as it will be done in syncAllData
    this.syncIntervals.content = window.setInterval(() => {
      this.syncContent();
    }, POLLING_INTERVALS.CONTENT);
  }

  private stopContentSync(): void {
    if (this.syncIntervals.content !== null) {
      window.clearInterval(this.syncIntervals.content);
      this.syncIntervals.content = null;
      logger.debug('Stopped content sync');
    }
  }

  private async syncContent(): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    try {
      logger.debug('Syncing content...');
      this.lastSyncTime.content = Date.now();

      // Fetch screen content
      const contentResponse = await masjidDisplayClient.getScreenContent();
      if (contentResponse.success && contentResponse.data) {
        await storageService.saveScreenContent(contentResponse.data);
      }

      logger.debug('Content sync completed successfully');
    } catch (error) {
      logger.error('Error syncing content', { error });
    }
  }

  // Prayer status sync methods
  private startPrayerStatusSync(): void {
    if (this.syncIntervals.prayerStatus !== null) return;

    logger.debug('Starting prayer status sync with interval', { 
      interval: `${POLLING_INTERVALS.PRAYER_STATUS / 1000} seconds` 
    });
    
    // Schedule periodic sync - don't sync immediately as it will be done in syncAllData
    this.syncIntervals.prayerStatus = window.setInterval(() => {
      this.syncPrayerStatus();
    }, POLLING_INTERVALS.PRAYER_STATUS);
  }

  private stopPrayerStatusSync(): void {
    if (this.syncIntervals.prayerStatus !== null) {
      window.clearInterval(this.syncIntervals.prayerStatus);
      this.syncIntervals.prayerStatus = null;
      logger.debug('Stopped prayer status sync');
    }
  }

  private async syncPrayerStatus(): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    try {
      logger.debug('Syncing prayer status...');
      this.lastSyncTime.prayerStatus = Date.now();

      // Fetch prayer status
      const prayerStatusResponse = await masjidDisplayClient.getPrayerStatus();
      if (prayerStatusResponse.success && prayerStatusResponse.data) {
        await storageService.savePrayerStatus(prayerStatusResponse.data);
      }

      logger.debug('Prayer status sync completed successfully');
    } catch (error) {
      logger.error('Error syncing prayer status', { error });
    }
  }

  // Prayer times sync methods
  private startPrayerTimesSync(): void {
    if (this.syncIntervals.prayerTimes !== null) return;

    logger.debug('Starting prayer times sync with interval', { 
      interval: `${POLLING_INTERVALS.PRAYER_TIMES / (60 * 60 * 1000)} hours` 
    });
    
    // Schedule periodic sync - don't sync immediately as it will be done in syncAllData
    this.syncIntervals.prayerTimes = window.setInterval(() => {
      this.syncPrayerTimes();
    }, POLLING_INTERVALS.PRAYER_TIMES);
  }

  private stopPrayerTimesSync(): void {
    if (this.syncIntervals.prayerTimes !== null) {
      window.clearInterval(this.syncIntervals.prayerTimes);
      this.syncIntervals.prayerTimes = null;
      logger.debug('Stopped prayer times sync');
    }
  }

  private async syncPrayerTimes(): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    try {
      logger.debug('Syncing prayer times...');
      this.lastSyncTime.prayerTimes = Date.now();

      // Fetch prayer times for the next 7 days
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const prayerTimesResponse = await masjidDisplayClient.getPrayerTimes(startDate, endDate);
      if (prayerTimesResponse.success && prayerTimesResponse.data) {
        await storageService.savePrayerTimes(prayerTimesResponse.data);
      }

      logger.debug('Prayer times sync completed successfully');
    } catch (error) {
      logger.error('Error syncing prayer times', { error });
    }
  }

  // Events sync methods
  private startEventsSync(): void {
    if (this.syncIntervals.events !== null) return;

    logger.debug('Starting events sync with interval', { 
      interval: `${POLLING_INTERVALS.EVENTS / (60 * 1000)} minutes` 
    });
    
    // Schedule periodic sync - don't sync immediately as it will be done in syncAllData
    this.syncIntervals.events = window.setInterval(() => {
      this.syncEvents();
    }, POLLING_INTERVALS.EVENTS);
  }

  private stopEventsSync(): void {
    if (this.syncIntervals.events !== null) {
      window.clearInterval(this.syncIntervals.events);
      this.syncIntervals.events = null;
      logger.debug('Stopped events sync');
    }
  }

  private async syncEvents(): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    try {
      logger.debug('Syncing events...');
      this.lastSyncTime.events = Date.now();

      // Fetch events
      const eventsResponse = await masjidDisplayClient.getEvents(10);
      if (eventsResponse.success && eventsResponse.data) {
        await storageService.saveEvents(eventsResponse.data.events);
      }

      logger.debug('Events sync completed successfully');
    } catch (error) {
      logger.error('Error syncing events', { error });
    }
  }

  // Heartbeat methods
  private startHeartbeat(): void {
    if (this.syncIntervals.heartbeat !== null) return;

    logger.debug('Starting heartbeat with interval', { 
      interval: `${POLLING_INTERVALS.HEARTBEAT / 1000} seconds` 
    });
    
    // Schedule periodic heartbeat - don't send immediately as it will be done in syncAllData
    this.syncIntervals.heartbeat = window.setInterval(() => {
      this.sendHeartbeat();
    }, POLLING_INTERVALS.HEARTBEAT);
  }

  private stopHeartbeat(): void {
    if (this.syncIntervals.heartbeat !== null) {
      window.clearInterval(this.syncIntervals.heartbeat);
      this.syncIntervals.heartbeat = null;
      logger.debug('Stopped heartbeat');
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    try {
      this.lastSyncTime.heartbeat = Date.now();
      
      // Calculate uptime in seconds
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      
      // Send heartbeat
      await masjidDisplayClient.sendHeartbeat({
        status: 'ONLINE',
        metrics: {
          uptime,
          memoryUsage: this.getMemoryUsage(),
          lastError: getLastError() || '',
        },
      });
      
      logger.debug('Heartbeat sent successfully');
    } catch (error) {
      logger.error('Error sending heartbeat', { error });
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
    this.stopAllSyncs();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

export default new DataSyncService(); 