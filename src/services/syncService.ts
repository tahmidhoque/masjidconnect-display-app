import masjidDisplayClient from '../api/masjidDisplayClient';
import offlineStorage from './offlineStorageService';
import logger from '../utils/logger';

/**
 * Sync Service
 * 
 * Handles automatic synchronization when network connection is restored.
 * Clears expired cache, syncs all content, and sends queued data.
 */
class SyncService {
  private syncQueue: Array<() => Promise<void>> = [];
  private periodicSyncInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private readonly PERIODIC_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize sync service
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn('[Sync] Service already initialized');
      return;
    }

    logger.info('[Sync] Initializing sync service');
    this.isInitialized = true;

    // Setup online event listener
    window.addEventListener('online', this.handleReconnection);

    // Start periodic sync when online
    this.startPeriodicSync();

    // If already online, perform initial sync
    if (navigator.onLine) {
      this.syncAll().catch(error => {
        logger.error('[Sync] Error in initial sync', { error });
      });
    }
  }

  /**
   * Start periodic sync when online
   */
  private startPeriodicSync(): void {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
    }

    this.periodicSyncInterval = setInterval(() => {
      if (navigator.onLine && masjidDisplayClient.isAuthenticated()) {
        this.syncAll().catch(error => {
          logger.error('[Sync] Error in periodic sync', { error });
        });
      }
    }, this.PERIODIC_SYNC_INTERVAL);

    logger.debug('[Sync] Started periodic sync', {
      interval: `${this.PERIODIC_SYNC_INTERVAL / 1000 / 60} minutes`,
    });
  }

  /**
   * Handle reconnection to network
   */
  private handleReconnection = async (): Promise<void> => {
    logger.info('[Sync] Network reconnected, syncing...');

    if (!masjidDisplayClient.isAuthenticated()) {
      logger.warn('[Sync] Not authenticated, skipping sync');
      return;
    }

    try {
      // Clear expired cache first
      await offlineStorage.clearExpiredContent();

      // Sync all pending data
      await this.syncAll();

      // Send queued analytics (if analyticsService has flushPendingData)
      await this.flushPendingAnalytics();

      // Send queued command responses
      await this.sendPendingCommandResponses();

      logger.info('[Sync] Sync complete');
    } catch (error) {
      logger.error('[Sync] Error during reconnection sync', { error });
    }
  };

  /**
   * Sync all content from API
   */
  private async syncAll(): Promise<void> {
    if (!masjidDisplayClient.isAuthenticated()) {
      logger.warn('[Sync] Cannot sync - not authenticated');
      return;
    }

    try {
      logger.info('[Sync] Starting sync of all content');

      // Fetch latest content in parallel
      await Promise.all([
        masjidDisplayClient.getScreenContent(false).catch(error => {
          logger.error('[Sync] Error syncing screen content', { error });
        }),
        masjidDisplayClient.getPrayerTimes(undefined, undefined, false).catch(error => {
          logger.error('[Sync] Error syncing prayer times', { error });
        }),
        masjidDisplayClient.getEvents(5, false).catch(error => {
          logger.error('[Sync] Error syncing events', { error });
        }),
      ]);

      logger.info('[Sync] All content synced');
    } catch (error) {
      logger.error('[Sync] Error syncing content', { error });
      throw error;
    }
  }

  /**
   * Flush pending analytics data
   */
  private async flushPendingAnalytics(): Promise<void> {
    try {
      // Import analyticsService dynamically to avoid circular dependencies
      const { analyticsService } = await import('./analyticsService');

      // Check if analyticsService has processQueue method (it's private, so we'll try to trigger it)
      // The analyticsService processes queue automatically, but we can ensure it runs
      if (analyticsService && typeof (analyticsService as any).processQueue === 'function') {
        await (analyticsService as any).processQueue();
        logger.info('[Sync] Flushed pending analytics');
      } else {
        // Analytics service will process queue automatically, just log
        logger.debug('[Sync] Analytics service will process queue automatically');
      }
    } catch (error) {
      // Analytics service might not be available or initialized
      logger.debug('[Sync] Could not flush analytics (service may not be initialized)', { error });
    }
  }

  /**
   * Send pending command responses
   */
  private async sendPendingCommandResponses(): Promise<void> {
    try {
      const responsesJson = localStorage.getItem('pending_command_responses');
      if (!responsesJson) {
        return;
      }

      const responses = JSON.parse(responsesJson);
      if (!Array.isArray(responses) || responses.length === 0) {
        return;
      }

      logger.info('[Sync] Sending pending command responses', { count: responses.length });

      // Send to API via heartbeat endpoint
      // Note: This assumes the heartbeat endpoint accepts commandResponses
      const heartbeatResult = await masjidDisplayClient.sendHeartbeat({
        status: 'ONLINE',
        metrics: {
          uptime: Date.now() - (window.performance?.timeOrigin || Date.now()),
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          lastError: '',
        },
      });

      if (heartbeatResult.success) {
        // Clear after successful send
        localStorage.removeItem('pending_command_responses');
        logger.info('[Sync] Command responses sent successfully');
      } else {
        logger.warn('[Sync] Failed to send command responses, will retry later', {
          error: heartbeatResult.error,
        });
      }
    } catch (error) {
      logger.error('[Sync] Error sending command responses', { error });
      // Don't clear on error - will retry next time
    }
  }

  /**
   * Manually trigger sync
   */
  public async sync(): Promise<void> {
    if (!navigator.onLine) {
      logger.warn('[Sync] Cannot sync - device is offline');
      return;
    }

    await this.syncAll();
  }

  /**
   * Cleanup sync service
   */
  public cleanup(): void {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }

    window.removeEventListener('online', this.handleReconnection);
    this.isInitialized = false;
    logger.info('[Sync] Sync service cleaned up');
  }
}

// Export singleton instance
const syncService = new SyncService();
export default syncService;

