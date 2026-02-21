/**
 * Sync Service
 * 
 * Manages data synchronisation between the display app and the backend.
 * Handles polling, caching, and dispatches Redux actions for state updates.
 * 
 * Features:
 * - Configurable polling intervals per data type
 * - Smart sync using /api/screen/sync endpoint
 * - Offline support with cached data
 * - Redux integration for state management
 * - Throttling to prevent excessive requests
 */

import apiClient, {
  ContentResponse,
  PrayerTimesResponse,
  EventsResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  SyncStatusResponse,
  RemoteCommand,
} from '../api/apiClient';
import credentialService from './credentialService';
import environment from '../config/environment';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Sync status for each data type
 */
export interface SyncStatus {
  lastSynced: Date | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Overall sync state
 */
export interface SyncState {
  content: SyncStatus;
  prayerTimes: SyncStatus;
  events: SyncStatus;
  heartbeat: SyncStatus;
}

/**
 * Sync result
 */
export interface SyncResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache?: boolean;
}

/**
 * Sync event types
 */
export type SyncEventType =
  | 'content:synced'
  | 'prayerTimes:synced'
  | 'events:synced'
  | 'heartbeat:sent'
  | 'command:received'
  | 'sync:error'
  | 'sync:started'
  | 'sync:completed';

export type SyncEventListener<T = unknown> = (data: T) => void;

// ============================================================================
// Sync Service Class
// ============================================================================

class SyncService {
  // Polling intervals
  private contentInterval: NodeJS.Timeout | null = null;
  private prayerTimesInterval: NodeJS.Timeout | null = null;
  private eventsInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Sync state
  private state: SyncState = {
    content: { lastSynced: null, isLoading: false, error: null },
    prayerTimes: { lastSynced: null, isLoading: false, error: null },
    events: { lastSynced: null, isLoading: false, error: null },
    heartbeat: { lastSynced: null, isLoading: false, error: null },
  };

  // Cached timestamps from sync status
  private lastKnownTimestamps: SyncStatusResponse | null = null;

  // Event listeners
  private listeners: Map<SyncEventType, Set<SyncEventListener>> = new Map();

  // State flags
  private isStarted: boolean = false;
  private isPaused: boolean = false;

  /**
   * Controls whether the HTTP heartbeat fallback is active.
   * Disabled when the WebSocket is connected (heartbeats go via WS instead).
   * Enabled when the WebSocket disconnects so the display stays visible in the admin.
   */
  private httpHeartbeatEnabled: boolean = true;

  constructor() {
    logger.info('[SyncService] Created');
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start all sync intervals
   */
  public start(): void {
    if (this.isStarted) {
      logger.debug('[SyncService] Already started');
      return;
    }

    if (!credentialService.hasCredentials()) {
      logger.warn('[SyncService] Cannot start - no credentials');
      return;
    }

    logger.info('[SyncService] Starting sync intervals');
    this.isStarted = true;
    this.isPaused = false;

    // Perform initial sync
    this.performInitialSync();

    // Start intervals
    this.startHeartbeatInterval();
    this.startContentInterval();
    this.startPrayerTimesInterval();
    this.startEventsInterval();
  }

  /**
   * Stop all sync intervals
   */
  public stop(): void {
    if (!this.isStarted) {
      logger.debug('[SyncService] Already stopped');
      return;
    }

    logger.info('[SyncService] Stopping sync intervals');
    this.isStarted = false;

    this.clearAllIntervals();
  }

  /**
   * Pause syncing (e.g., when offline)
   */
  public pause(): void {
    if (this.isPaused) return;
    logger.info('[SyncService] Pausing sync');
    this.isPaused = true;
  }

  /**
   * Enable or disable the HTTP heartbeat fallback.
   *
   * Call with `false` when the WebSocket connects (heartbeats travel over WS).
   * Call with `true` when the WebSocket disconnects so the display remains visible
   * in the admin and can still receive queued commands via HTTP.
   */
  public setHttpHeartbeatEnabled(enabled: boolean): void {
    if (this.httpHeartbeatEnabled === enabled) return;
    this.httpHeartbeatEnabled = enabled;
    logger.info('[SyncService] HTTP heartbeat fallback', { enabled });
  }

  /**
   * Resume syncing
   */
  public resume(): void {
    if (!this.isPaused) return;
    logger.info('[SyncService] Resuming sync');
    this.isPaused = false;

    // Trigger immediate sync on resume
    this.syncAll();
  }

  /**
   * Clear all intervals
   */
  private clearAllIntervals(): void {
    if (this.contentInterval) {
      clearInterval(this.contentInterval);
      this.contentInterval = null;
    }
    if (this.prayerTimesInterval) {
      clearInterval(this.prayerTimesInterval);
      this.prayerTimesInterval = null;
    }
    if (this.eventsInterval) {
      clearInterval(this.eventsInterval);
      this.eventsInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ==========================================================================
  // Interval Setup
  // ==========================================================================

  private startHeartbeatInterval(): void {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (!this.isPaused) {
        this.sendHeartbeat();
      }
    }, environment.heartbeatInterval);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  private startContentInterval(): void {
    // Sync content every 5 minutes
    this.contentInterval = setInterval(() => {
      if (!this.isPaused) {
        this.syncContent();
      }
    }, environment.contentSyncInterval);
  }

  private startPrayerTimesInterval(): void {
    // Sync prayer times daily (but check more frequently for updates)
    this.prayerTimesInterval = setInterval(() => {
      if (!this.isPaused) {
        this.syncPrayerTimes();
      }
    }, environment.prayerTimesSyncInterval);
  }

  private startEventsInterval(): void {
    // Sync events every 30 minutes
    this.eventsInterval = setInterval(() => {
      if (!this.isPaused) {
        this.syncEvents();
      }
    }, environment.eventsSyncInterval);
  }

  // ==========================================================================
  // Sync Methods
  // ==========================================================================

  /**
   * Perform initial sync of all data
   */
  private async performInitialSync(): Promise<void> {
    logger.info('[SyncService] Performing initial sync');
    this.emitEvent('sync:started', null);

    await this.syncAll();

    this.emitEvent('sync:completed', null);
    logger.info('[SyncService] Initial sync completed');
  }

  /**
   * Sync all data types
   */
  public async syncAll(): Promise<void> {
    if (this.isPaused) {
      logger.debug('[SyncService] Sync skipped - paused');
      return;
    }

    // Run syncs in parallel
    await Promise.all([
      this.syncContent(),
      this.syncPrayerTimes(),
      this.syncEvents(),
    ]);
  }

  /**
   * Sync content from server
   */
  public async syncContent(): Promise<SyncResult<ContentResponse>> {
    if (this.state.content.isLoading) {
      logger.debug('[SyncService] Content sync already in progress');
      return { success: false, error: 'Sync already in progress' };
    }

    this.updateState('content', { isLoading: true, error: null });

    try {
      // Check if content has changed using sync endpoint
      const shouldSync = await this.checkIfContentChanged();
      if (!shouldSync) {
        logger.debug('[SyncService] Content unchanged, skipping sync');
        this.updateState('content', { isLoading: false });
        return { success: true, fromCache: true };
      }

      const response = await apiClient.getContent();

      if (response.success && response.data) {
        this.updateState('content', {
          isLoading: false,
          lastSynced: new Date(),
          error: null,
        });

        this.emitEvent('content:synced', response.data);
        logger.info('[SyncService] Content synced successfully', {
          fromCache: response.fromCache,
        });

        return {
          success: true,
          data: response.data,
          fromCache: response.fromCache,
        };
      } else {
        throw new Error(response.error || 'Failed to fetch content');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateState('content', { isLoading: false, error: errorMessage });
      this.emitEvent('sync:error', { type: 'content', error: errorMessage });
      logger.error('[SyncService] Content sync failed', { error: errorMessage });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync prayer times from server
   */
  public async syncPrayerTimes(): Promise<SyncResult<PrayerTimesResponse>> {
    if (this.state.prayerTimes.isLoading) {
      logger.debug('[SyncService] Prayer times sync already in progress');
      return { success: false, error: 'Sync already in progress' };
    }

    this.updateState('prayerTimes', { isLoading: true, error: null });

    try {
      const response = await apiClient.getPrayerTimes();

      if (response.success && response.data) {
        this.updateState('prayerTimes', {
          isLoading: false,
          lastSynced: new Date(),
          error: null,
        });

        this.emitEvent('prayerTimes:synced', response.data);
        logger.info('[SyncService] Prayer times synced successfully', {
          fromCache: response.fromCache,
        });

        return {
          success: true,
          data: response.data,
          fromCache: response.fromCache,
        };
      } else {
        throw new Error(response.error || 'Failed to fetch prayer times');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateState('prayerTimes', { isLoading: false, error: errorMessage });
      this.emitEvent('sync:error', { type: 'prayerTimes', error: errorMessage });
      logger.error('[SyncService] Prayer times sync failed', { error: errorMessage });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync events from server
   */
  public async syncEvents(): Promise<SyncResult<EventsResponse>> {
    if (this.state.events.isLoading) {
      logger.debug('[SyncService] Events sync already in progress');
      return { success: false, error: 'Sync already in progress' };
    }

    this.updateState('events', { isLoading: true, error: null });

    try {
      const response = await apiClient.getEvents();

      if (response.success && response.data) {
        this.updateState('events', {
          isLoading: false,
          lastSynced: new Date(),
          error: null,
        });

        this.emitEvent('events:synced', response.data);
        logger.info('[SyncService] Events synced successfully', {
          fromCache: response.fromCache,
        });

        return {
          success: true,
          data: response.data,
          fromCache: response.fromCache,
        };
      } else {
        throw new Error(response.error || 'Failed to fetch events');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateState('events', { isLoading: false, error: errorMessage });
      this.emitEvent('sync:error', { type: 'events', error: errorMessage });
      logger.error('[SyncService] Events sync failed', { error: errorMessage });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send heartbeat to server via HTTP.
   *
   * This is the fallback path — only active when the WebSocket is disconnected.
   * When the WebSocket is connected, `httpHeartbeatEnabled` is false and this
   * method returns immediately without making any network request.
   */
  public async sendHeartbeat(): Promise<SyncResult<HeartbeatResponse>> {
    if (!this.httpHeartbeatEnabled) {
      logger.debug('[SyncService] HTTP heartbeat skipped — WebSocket connected');
      return { success: true };
    }

    if (this.state.heartbeat.isLoading) {
      return { success: false, error: 'Heartbeat in progress' };
    }

    this.updateState('heartbeat', { isLoading: true, error: null });

    try {
      const request: HeartbeatRequest = {
        status: 'online',
        appVersion: '1.0.0', // TODO: Get from environment
        currentView: 'display',
        metrics: {
          uptime: performance.now(),
          memoryUsage: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
        },
      };

      const response = await apiClient.sendHeartbeat(request);

      if (response.success && response.data) {
        this.updateState('heartbeat', {
          isLoading: false,
          lastSynced: new Date(),
          error: null,
        });

        // Process any commands received
        if (response.data.commands && response.data.commands.length > 0) {
          this.processCommands(response.data.commands);
        }

        this.emitEvent('heartbeat:sent', response.data);
        logger.debug('[SyncService] Heartbeat sent successfully');

        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || 'Heartbeat failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateState('heartbeat', { isLoading: false, error: errorMessage });
      logger.error('[SyncService] Heartbeat failed', { error: errorMessage });

      return { success: false, error: errorMessage };
    }
  }

  // ==========================================================================
  // Smart Sync
  // ==========================================================================

  /**
   * Check if content has changed using the sync endpoint
   */
  private async checkIfContentChanged(): Promise<boolean> {
    try {
      const response = await apiClient.getSyncStatus();

      if (!response.success || !response.data) {
        // If we can't check, assume we need to sync
        return true;
      }

      const newTimestamps = response.data;

      // First sync or no previous timestamps
      if (!this.lastKnownTimestamps) {
        this.lastKnownTimestamps = newTimestamps;
        return true;
      }

      // Check if content has changed
      const contentChanged =
        newTimestamps.contentUpdated !== this.lastKnownTimestamps.contentUpdated;

      if (contentChanged) {
        this.lastKnownTimestamps = newTimestamps;
      }

      return contentChanged;
    } catch (error) {
      logger.debug('[SyncService] Could not check sync status, proceeding with sync');
      return true;
    }
  }

  // ==========================================================================
  // Command Processing
  // ==========================================================================

  /**
   * Process commands received from heartbeat
   */
  private processCommands(commands: RemoteCommand[]): void {
    logger.info('[SyncService] Processing commands', { count: commands.length });

    commands.forEach((command) => {
      this.emitEvent('command:received', command);
    });
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  private updateState(key: keyof SyncState, update: Partial<SyncStatus>): void {
    this.state[key] = { ...this.state[key], ...update };
  }

  /**
   * Get current sync state
   */
  public getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Check if any sync is in progress
   */
  public isSyncing(): boolean {
    return (
      this.state.content.isLoading ||
      this.state.prayerTimes.isLoading ||
      this.state.events.isLoading ||
      this.state.heartbeat.isLoading
    );
  }

  // ==========================================================================
  // Event Subscription
  // ==========================================================================

  /**
   * Subscribe to a sync event
   */
  public on<T = unknown>(event: SyncEventType, listener: SyncEventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(listener as SyncEventListener);

    return () => {
      this.listeners.get(event)?.delete(listener as SyncEventListener);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent<T>(event: SyncEventType, data: T): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    eventListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        logger.error('[SyncService] Error in event listener', { event, error });
      }
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Force a full refresh of all data
   */
  public async forceRefresh(): Promise<void> {
    logger.info('[SyncService] Forcing full refresh');

    // Clear cached timestamps to force sync
    this.lastKnownTimestamps = null;

    // Clear API cache
    await apiClient.clearCache();

    // Perform full sync
    await this.syncAll();
  }

  /**
   * Get time since last sync for a data type
   */
  public getTimeSinceLastSync(key: keyof SyncState): number | null {
    const lastSynced = this.state[key].lastSynced;
    if (!lastSynced) return null;
    return Date.now() - lastSynced.getTime();
  }

  /**
   * Check if service is running
   */
  public isRunning(): boolean {
    return this.isStarted && !this.isPaused;
  }
}

// Export singleton instance
const syncService = new SyncService();
export default syncService;
