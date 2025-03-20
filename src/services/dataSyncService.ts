import masjidDisplayClient, { POLLING_INTERVALS } from '../api/masjidDisplayClient';
import storageService from './storageService';
import logger, { getLastError } from '../utils/logger';

class DataSyncService {
  private syncIntervals: Record<string, number | null> = {
    content: null,
    prayerStatus: null,
    prayerTimes: null,
    events: null,
    heartbeat: null,
    schedule: null
  };
  
  private lastSyncTime: Record<string, number> = {
    content: 0,
    prayerStatus: 0,
    prayerTimes: 0,
    events: 0,
    heartbeat: 0,
    schedule: 0
  };
  
  private startTime: number = Date.now();
  // Flag to prevent multiple initialization calls
  private isInitialized: boolean = false;
  private lastHeartbeatTime: number = 0;
  private readonly MIN_HEARTBEAT_INTERVAL: number = 30000; // 30 seconds minimum between heartbeats
  
  // Track backoff status for APIs
  private backoffStatus: Record<string, { inBackoff: boolean, nextTry: number }> = {
    heartbeat: { inBackoff: false, nextTry: 0 },
    content: { inBackoff: false, nextTry: 0 },
    prayerStatus: { inBackoff: false, nextTry: 0 },
    prayerTimes: { inBackoff: false, nextTry: 0 },
    events: { inBackoff: false, nextTry: 0 },
    schedule: { inBackoff: false, nextTry: 0 }
  };

  // Add throttling mechanism
  private lastSyncAttempts: Record<string, number> = {
    content: 0,
    prayerStatus: 0,
    prayerTimes: 0,
    events: 0,
    heartbeat: 0,
    schedule: 0
  };
  
  private readonly MIN_SYNC_INTERVAL: Record<string, number> = {
    content: 30 * 1000, // 30 seconds
    prayerStatus: 30 * 1000, // 30 seconds
    prayerTimes: 60 * 1000, // 1 minute
    schedule: 60 * 1000, // 1 minute
    events: 60 * 1000, // 1 minute
    heartbeat: 60 * 1000 // 1 minute
  };
  
  // Helper method to check if a sync should be throttled
  private shouldThrottleSync(syncType: string): boolean {
    const now = Date.now();
    const lastAttempt = this.lastSyncAttempts[syncType] || 0;
    const minInterval = this.MIN_SYNC_INTERVAL[syncType] || 30000;
    
    // If it's too soon since the last attempt, throttle
    if (now - lastAttempt < minInterval) {
      return true;
    }
    
    // Update last attempt time
    this.lastSyncAttempts[syncType] = now;
    return false;
  }

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
      schedule: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes`, // Use same interval as content
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
    
    if (this.syncIntervals.schedule === null) {
      this.startScheduleSync();
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
    this.stopScheduleSync();
    this.stopEventsSync();
    this.stopHeartbeat();
  }

  // Sync all data immediately
  public async syncAllData(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) {
      logger.warn('Cannot sync data - offline or not authenticated', {
        online: navigator.onLine,
        authenticated: masjidDisplayClient.isAuthenticated()
      });
      return;
    }
    
    // Prevent excessive syncs with throttle mechanism
    const now = Date.now();
    const syncKey = 'syncAllData';
    const lastSyncAll = this.lastSyncAttempts[syncKey] || 0;
    const minSyncAllInterval = 5000; // 5 seconds
    
    if (now - lastSyncAll < minSyncAllInterval && !forceRefresh) {
      logger.debug('Throttling syncAllData - too frequent calls');
      return;
    }
    
    this.lastSyncAttempts[syncKey] = now;
    
    logger.info('Syncing all data immediately', { forceRefresh });
    
    // Only include heartbeat if we haven't sent one recently
    const includeHeartbeat = (now - this.lastHeartbeatTime) > this.MIN_HEARTBEAT_INTERVAL;
    
    const syncPromises = [
      this.syncContent(forceRefresh),
      this.syncPrayerStatus(forceRefresh),
      this.syncPrayerTimes(forceRefresh),
      this.syncEvents(forceRefresh),
      this.syncSchedule(forceRefresh)
    ];
    
    // Only add heartbeat if it's been long enough since the last one
    if (includeHeartbeat) {
      syncPromises.push(this.sendHeartbeat());
    } else {
      logger.debug('Skipping heartbeat in syncAllData - too soon since last heartbeat');
    }
    
    // Use Promise.allSettled to ensure all sync attempts run even if some fail
    try {
      const results = await Promise.allSettled(syncPromises);
      
      // Log results of each sync operation
      const syncResults: Record<string, string> = {
        content: results[0].status,
        prayerStatus: results[1].status,
        prayerTimes: results[2].status,
        events: results[3].status,
        schedule: results[4].status
      };
      
      if (includeHeartbeat) {
        syncResults.heartbeat = results[5].status;
      }
      
      // Check if any syncs failed
      const failedSyncs = results.filter(result => result.status === 'rejected');
      
      if (failedSyncs.length > 0) {
        logger.warn(`${failedSyncs.length} sync operations failed`, { syncResults });
        
        // Log detailed errors for each failed sync
        failedSyncs.forEach((result, index) => {
          if (result.status === 'rejected') {
            const syncTypes = ['content', 'prayerStatus', 'prayerTimes', 'events', 'schedule'];
            if (includeHeartbeat) syncTypes.push('heartbeat');
            
            const syncType = index < syncTypes.length ? syncTypes[index] : 'unknown';
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

  private async syncContent(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    // Apply throttling unless it's a force refresh
    if (!forceRefresh && this.shouldThrottleSync('content')) {
      logger.debug('Throttling content sync - too frequent calls');
      return;
    }

    // Skip backoff check if force refresh
    if (!forceRefresh && this.backoffStatus.content.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.content.nextTry) {
        logger.debug(`Content sync in backoff until ${new Date(this.backoffStatus.content.nextTry).toISOString()}, skipping`);
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.content.inBackoff = false;
        logger.debug('Content sync backoff period ended, retrying');
      }
    }

    try {
      logger.debug('Syncing content...', { forceRefresh });
      this.lastSyncTime.content = Date.now();

      // Fetch screen content
      const contentResponse = await masjidDisplayClient.getScreenContent(forceRefresh);
      if (contentResponse.success && contentResponse.data) {
        await storageService.saveScreenContent(contentResponse.data);
        logger.debug('Content sync completed successfully');
      } else {
        // Don't enter backoff mode if force refresh
        if (!forceRefresh) {
          // If server has an error, implement backoff
          this.backoffStatus.content.inBackoff = true;
          this.backoffStatus.content.nextTry = Date.now() + (5 * 60 * 1000); // Wait 5 minutes before next try
          logger.warn('Content sync failed, entering backoff mode', { 
            error: contentResponse.error, 
            backoffUntil: new Date(this.backoffStatus.content.nextTry).toISOString() 
          });
        } else {
          logger.warn('Force content sync failed', { error: contentResponse.error });
        }
      }
    } catch (error) {
      // Don't enter backoff mode if force refresh
      if (!forceRefresh) {
        // Error occurred, implement backoff
        this.backoffStatus.content.inBackoff = true;
        this.backoffStatus.content.nextTry = Date.now() + (5 * 60 * 1000); // Wait 5 minutes before next try
        logger.error('Error syncing content, entering backoff mode', { 
          error, 
          backoffUntil: new Date(this.backoffStatus.content.nextTry).toISOString() 
        });
      } else {
        logger.error('Error during forced content sync', { error });
      }
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

  public async syncPrayerStatus(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    // Apply throttling unless it's a force refresh
    if (!forceRefresh && this.shouldThrottleSync('prayerStatus')) {
      logger.debug('Throttling prayer status sync - too frequent calls');
      return;
    }

    // Skip backoff check if force refresh
    if (!forceRefresh && this.backoffStatus.prayerStatus.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.prayerStatus.nextTry) {
        logger.debug(`Prayer status sync in backoff until ${new Date(this.backoffStatus.prayerStatus.nextTry).toISOString()}, skipping`);
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.prayerStatus.inBackoff = false;
        logger.debug('Prayer status sync backoff period ended, retrying');
      }
    }

    try {
      logger.debug('Syncing prayer status...', { forceRefresh });
      this.lastSyncTime.prayerStatus = Date.now();

      // Fetch prayer status
      const prayerStatusResponse = await masjidDisplayClient.getPrayerStatus(forceRefresh);
      if (prayerStatusResponse.success && prayerStatusResponse.data) {
        await storageService.savePrayerStatus(prayerStatusResponse.data);
        logger.debug('Prayer status sync completed successfully');
      } else {
        // Don't enter backoff mode if force refresh
        if (!forceRefresh) {
          // If server has an error, implement backoff
          this.backoffStatus.prayerStatus.inBackoff = true;
          this.backoffStatus.prayerStatus.nextTry = Date.now() + (2 * 60 * 1000); // Wait 2 minutes before next try
          logger.warn('Prayer status sync failed, entering backoff mode', { 
            error: prayerStatusResponse.error, 
            backoffUntil: new Date(this.backoffStatus.prayerStatus.nextTry).toISOString() 
          });
        } else {
          logger.warn('Force prayer status sync failed', { error: prayerStatusResponse.error });
        }
      }
    } catch (error) {
      // Don't enter backoff mode if force refresh
      if (!forceRefresh) {
        // Error occurred, implement backoff
        this.backoffStatus.prayerStatus.inBackoff = true;
        this.backoffStatus.prayerStatus.nextTry = Date.now() + (2 * 60 * 1000); // Wait 2 minutes before next try
        logger.error('Error syncing prayer status, entering backoff mode', { 
          error, 
          backoffUntil: new Date(this.backoffStatus.prayerStatus.nextTry).toISOString() 
        });
      } else {
        logger.error('Error during forced prayer status sync', { error });
      }
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

  public async syncPrayerTimes(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    // Apply throttling unless it's a force refresh
    if (!forceRefresh && this.shouldThrottleSync('prayerTimes')) {
      logger.debug('Throttling prayer times sync - too frequent calls');
      return;
    }

    // Skip backoff check if force refresh
    if (!forceRefresh && this.backoffStatus.prayerTimes.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.prayerTimes.nextTry) {
        logger.debug(`Prayer times sync in backoff until ${new Date(this.backoffStatus.prayerTimes.nextTry).toISOString()}, skipping`);
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.prayerTimes.inBackoff = false;
        logger.debug('Prayer times backoff period ended, retrying');
      }
    }

    try {
      logger.debug('Syncing prayer times...', { forceRefresh });
      this.lastSyncTime.prayerTimes = Date.now();

      // Get current date
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      // Get date 7 days from now
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 7);
      const endDateString = endDate.toISOString().split('T')[0];

      // Fetch prayer times
      const prayerTimesResponse = await masjidDisplayClient.getPrayerTimes(startDate, endDateString, forceRefresh);
      
      if (prayerTimesResponse.success && prayerTimesResponse.data) {
        // Check if the data is in the new format
        const prayerTimesData = prayerTimesResponse.data;
        
        console.log('Prayer times data received:', prayerTimesData);
        
        // Determine if this is a single object with data array or already an array
        if (!Array.isArray(prayerTimesData) && 
            typeof prayerTimesData === 'object' && 
            prayerTimesData !== null && 
            'data' in prayerTimesData && 
            Array.isArray((prayerTimesData as any).data)) {
          // This is the new format - object with a data array
          console.log('Detected new prayer times format (object with data array)');
          await storageService.savePrayerTimes(prayerTimesData);
        } else if (Array.isArray(prayerTimesData)) {
          // This is the legacy format - just an array of prayer times
          console.log('Detected legacy prayer times format (array)');
          await storageService.savePrayerTimes(prayerTimesData);
        } else {
          // This is a single object without a data array - wrap it in an array
          console.log('Detected single prayer time object - wrapping in array');
          await storageService.savePrayerTimes([prayerTimesData]);
        }
        
        logger.debug('Prayer times sync completed successfully');
      } else {
        // Don't enter backoff mode if force refresh
        if (!forceRefresh) {
          // If server has an error, implement backoff
          this.backoffStatus.prayerTimes.inBackoff = true;
          this.backoffStatus.prayerTimes.nextTry = Date.now() + (5 * 60 * 1000); // Wait 5 minutes before next try
          logger.warn('Prayer times sync failed, entering backoff mode', { 
            error: prayerTimesResponse.error, 
            backoffUntil: new Date(this.backoffStatus.prayerTimes.nextTry).toISOString() 
          });
        } else {
          logger.warn('Force prayer times sync failed', { error: prayerTimesResponse.error });
        }
      }
    } catch (error) {
      // Don't enter backoff mode if force refresh
      if (!forceRefresh) {
        // Error occurred, implement backoff
        this.backoffStatus.prayerTimes.inBackoff = true;
        this.backoffStatus.prayerTimes.nextTry = Date.now() + (5 * 60 * 1000); // Wait 5 minutes before next try
        logger.error('Error syncing prayer times, entering backoff mode', { 
          error, 
          backoffUntil: new Date(this.backoffStatus.prayerTimes.nextTry).toISOString() 
        });
      } else {
        logger.error('Error during forced prayer times sync', { error });
      }
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

  private async syncEvents(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    // Apply throttling unless it's a force refresh
    if (!forceRefresh && this.shouldThrottleSync('events')) {
      logger.debug('Throttling events sync - too frequent calls');
      return;
    }

    // Skip backoff check if force refresh
    if (!forceRefresh && this.backoffStatus.events.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.events.nextTry) {
        logger.debug(`Events sync in backoff until ${new Date(this.backoffStatus.events.nextTry).toISOString()}, skipping`);
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.events.inBackoff = false;
        logger.debug('Events sync backoff period ended, retrying');
      }
    }

    try {
      logger.debug('Syncing events...', { forceRefresh });
      this.lastSyncTime.events = Date.now();

      // Fetch events
      const eventsResponse = await masjidDisplayClient.getEvents(10, forceRefresh);
      if (eventsResponse.success && eventsResponse.data) {
        await storageService.saveEvents(eventsResponse.data.events);
        logger.debug('Events sync completed successfully');
      } else {
        // Don't enter backoff mode if force refresh
        if (!forceRefresh) {
          // If server has an error, implement backoff
          this.backoffStatus.events.inBackoff = true;
          this.backoffStatus.events.nextTry = Date.now() + (30 * 60 * 1000); // Wait 30 minutes before next try
          logger.warn('Events sync failed, entering backoff mode', { 
            error: eventsResponse.error, 
            backoffUntil: new Date(this.backoffStatus.events.nextTry).toISOString() 
          });
        } else {
          logger.warn('Force events sync failed', { error: eventsResponse.error });
        }
      }
    } catch (error) {
      // Don't enter backoff mode if force refresh
      if (!forceRefresh) {
        // Error occurred, implement backoff
        this.backoffStatus.events.inBackoff = true;
        this.backoffStatus.events.nextTry = Date.now() + (30 * 60 * 1000); // Wait 30 minutes before next try
        logger.error('Error syncing events, entering backoff mode', { 
          error, 
          backoffUntil: new Date(this.backoffStatus.events.nextTry).toISOString() 
        });
      } else {
        logger.error('Error during forced events sync', { error });
      }
    }
  }

  // Heartbeat methods
  private startHeartbeat(): void {
    if (this.syncIntervals.heartbeat !== null) {
      // Don't start again if already running
      logger.debug('Heartbeat timer already running, skipping');
      return;
    }

    logger.debug('Starting heartbeat with interval', { 
      interval: `${POLLING_INTERVALS.HEARTBEAT / 1000} seconds` 
    });
    
    // Use a more reliable interval mechanism
    const heartbeatInterval = POLLING_INTERVALS.HEARTBEAT;
    
    // Schedule periodic heartbeat
    this.syncIntervals.heartbeat = window.setInterval(() => {
      this.sendHeartbeat();
    }, heartbeatInterval);
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

    // Apply throttling for heartbeat
    if (this.shouldThrottleSync('heartbeat')) {
      logger.debug('Throttling heartbeat - too frequent calls');
      return;
    }
    
    // Check if we're in backoff mode for heartbeat
    if (this.backoffStatus.heartbeat.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.heartbeat.nextTry) {
        logger.debug(`Heartbeat in backoff until ${new Date(this.backoffStatus.heartbeat.nextTry).toISOString()}, skipping`);
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.heartbeat.inBackoff = false;
        logger.debug('Heartbeat backoff period ended, retrying');
      }
    }
    
    // Record time to prevent too frequent heartbeats
    const now = Date.now();
    if (now - this.lastHeartbeatTime < this.MIN_HEARTBEAT_INTERVAL) {
      logger.debug('Skipping heartbeat - too soon since last heartbeat');
      return;
    }
    
    try {
      logger.debug('Sending heartbeat...');
      this.lastHeartbeatTime = now;
      this.lastSyncTime.heartbeat = now;
      
      // Calculate uptime
      const uptime = Math.floor((now - this.startTime) / 1000);
      
      // Get last error from logger if available
      const lastError = getLastError() || '';
      
      // Prepare heartbeat request according to the API guide
      const heartbeatRequest = {
        status: navigator.onLine ? 'ONLINE' as const : 'OFFLINE' as const,
        metrics: {
          uptime: uptime,
          memoryUsage: this.getMemoryUsage(),
          lastError: lastError
        }
      };
      
      // Send heartbeat to server
      const response = await masjidDisplayClient.sendHeartbeat(heartbeatRequest);
      
      if (response.success) {
        logger.debug('Heartbeat sent successfully');
      } else {
        // Implement backoff if heartbeat fails
        this.backoffStatus.heartbeat.inBackoff = true;
        this.backoffStatus.heartbeat.nextTry = now + (60 * 1000); // Wait 1 minute before next try
        logger.warn('Heartbeat failed, entering backoff mode', { 
          error: response.error, 
          backoffUntil: new Date(this.backoffStatus.heartbeat.nextTry).toISOString() 
        });
      }
    } catch (error) {
      // Implement backoff on error
      this.backoffStatus.heartbeat.inBackoff = true;
      this.backoffStatus.heartbeat.nextTry = now + (60 * 1000); // Wait 1 minute before next try
      logger.error('Error sending heartbeat, entering backoff mode', { 
        error, 
        backoffUntil: new Date(this.backoffStatus.heartbeat.nextTry).toISOString() 
      });
    }
  }

  // Get memory usage if available
  private getMemoryUsage(): number {
    if (window.performance && (window.performance as any).memory) {
      return (window.performance as any).memory.usedJSHeapSize || 0;
    }
    return 0;
  }

  // Schedule sync methods
  private startScheduleSync(): void {
    if (this.syncIntervals.schedule !== null) return;

    logger.debug('Starting schedule sync with interval', { 
      interval: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes` // Use same interval as content
    });
    
    // Schedule periodic sync - don't sync immediately as it will be done in syncAllData
    this.syncIntervals.schedule = window.setInterval(() => {
      this.syncSchedule();
    }, POLLING_INTERVALS.CONTENT);
  }

  private stopScheduleSync(): void {
    if (this.syncIntervals.schedule !== null) {
      window.clearInterval(this.syncIntervals.schedule);
      this.syncIntervals.schedule = null;
      logger.debug('Stopped schedule sync');
    }
  }

  public async syncSchedule(forceRefresh: boolean = false): Promise<void> {
    // Check if we should throttle this sync request
    if (this.shouldThrottleSync('schedule') && !forceRefresh) {
      logger.debug('dataSyncService: Throttling schedule sync due to minimum interval');
      return;
    }
    
    // Skip sync if offline
    if (!navigator.onLine) {
      logger.debug('dataSyncService: Skipping schedule sync while offline');
      return;
    }
    
    // Check authentication
    const isAuthenticated = masjidDisplayClient.isAuthenticated();
    if (!isAuthenticated) {
      logger.debug('dataSyncService: Skipping schedule sync, not authenticated');
      return;
    }
    
    try {
      // Track sync attempt
      this.lastSyncAttempts.schedule = Date.now();
      
      logger.info('dataSyncService: Syncing schedule data', { forceRefresh });
      console.log('DEBUG dataSyncService: Syncing schedule data', { 
        forceRefresh, 
        online: navigator.onLine,
        authenticated: isAuthenticated
      });
      
      // Check if we're in backoff
      if (this.backoffStatus.schedule.inBackoff) {
        const now = Date.now();
        if (now < this.backoffStatus.schedule.nextTry) {
          const waitTime = Math.ceil((this.backoffStatus.schedule.nextTry - now) / 1000);
          logger.debug(`dataSyncService: In backoff for schedule, waiting ${waitTime}s before retry`);
          return;
        } else {
          // Exit backoff state
          this.backoffStatus.schedule.inBackoff = false;
          logger.debug('dataSyncService: Exiting backoff for schedule sync');
        }
      }
      
      // Fetch screen content which includes schedule
      console.log('DEBUG dataSyncService: Calling getScreenContent');
      const response = await masjidDisplayClient.getScreenContent(forceRefresh);
      console.log('DEBUG dataSyncService: getScreenContent response', { 
        success: response.success,
        hasData: !!response.data,
        status: response.status,
        error: response.error
      });
      
      if (response.success && response.data) {
        console.log('DEBUG dataSyncService: Response data keys:', Object.keys(response.data));
        
        // Check for schedule in response - could be directly in data or in a nested structure
        const schedule = response.data.schedule;
        const nestedData = (response.data as any).data;
        
        console.log('DEBUG dataSyncService: Schedule structure check:', { 
          hasScheduleDirectly: !!schedule,
          hasNestedData: !!nestedData,
          nestedDataHasSchedule: nestedData ? !!nestedData.schedule : false
        });
        
        // If we have a schedule directly or in the nested data
        if (schedule || (nestedData && nestedData.schedule)) {
          const scheduleData = schedule || nestedData.schedule;
          
          // Log the structure of the schedule data we found
          console.log('DEBUG dataSyncService: Schedule data found:', {
            type: typeof scheduleData,
            isObject: typeof scheduleData === 'object',
            hasItems: !!scheduleData.items,
            itemsCount: scheduleData.items?.length || 0,
            keys: Object.keys(scheduleData)
          });
          
          // If we have items, check the first one to understand its structure
          if (scheduleData.items && scheduleData.items.length > 0) {
            const firstItem = scheduleData.items[0];
            console.log('DEBUG dataSyncService: First schedule item:', {
              keys: Object.keys(firstItem),
              hasContentItem: 'contentItem' in firstItem,
              hasType: 'type' in firstItem,
              hasTitle: 'title' in firstItem,
            });
          }
          
          // Save schedule data to storage
          await storageService.saveSchedule(scheduleData);
          logger.info('dataSyncService: Schedule data saved successfully');
          console.log('DEBUG dataSyncService: Schedule data saved successfully');
          
          // Update last sync time
          this.lastSyncTime.schedule = Date.now();
        } else {
          logger.warn('dataSyncService: No schedule data found in response');
          console.log('DEBUG dataSyncService: No schedule data found in response');
        }
      } else {
        logger.error('dataSyncService: Failed to fetch schedule data', { 
          error: response.error 
        });
        console.log('DEBUG dataSyncService: Failed to fetch schedule data', { 
          error: response.error 
        });
        
        // Set backoff for failed requests
        const now = Date.now();
        this.backoffStatus.schedule.inBackoff = true;
        this.backoffStatus.schedule.nextTry = now + 60000; // Try again in 1 minute
      }
    } catch (error) {
      console.error('Error in syncSchedule:', error);
      logger.error('dataSyncService: Error syncing schedule data', { error });
      
      // Set backoff for errors
      const now = Date.now();
      this.backoffStatus.schedule.inBackoff = true;
      this.backoffStatus.schedule.nextTry = now + 60000; // Try again in 1 minute
    }
  }

  // Clean up resources
  public cleanup(): void {
    this.stopAllSyncs();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

const dataSyncService = new DataSyncService();
export default dataSyncService; 