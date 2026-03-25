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
  RemoteCommand,
} from '../api/apiClient';
import credentialService from './credentialService';
import storageService from './storageService';
import remoteControlService from './remoteControlService';
import environment, { defaultMasjidTimezone } from '../config/environment';
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
  // Intervals (heartbeat only; content/events/prayer are WebSocket-driven + once-daily)
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private dailySyncTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private dailySyncIntervalId: ReturnType<typeof setInterval> | null = null;
  private dailyUpdateCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private dailyUpdateCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  // Sync state
  private state: SyncState = {
    content: { lastSynced: null, isLoading: false, error: null },
    prayerTimes: { lastSynced: null, isLoading: false, error: null },
    events: { lastSynced: null, isLoading: false, error: null },
    heartbeat: { lastSynced: null, isLoading: false, error: null },
  };

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

  /**
   * Coalesce concurrent syncs of the same type — callers await a single in-flight request
   * instead of receiving `{ success: false, error: 'Sync already in progress' }`.
   */
  private contentSyncInFlight: Promise<SyncResult<ContentResponse>> | null = null;
  private prayerTimesSyncInFlight: Promise<SyncResult<PrayerTimesResponse>> | null = null;
  private eventsSyncInFlight: Promise<SyncResult<EventsResponse>> | null = null;

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

    // Heartbeat (HTTP fallback when WebSocket disconnected)
    this.startHeartbeatInterval();

    // Once-daily fallback sync — content/events/prayer are otherwise WebSocket-driven
    this.scheduleDailySync();

    // Once-daily update check — Pi: device update script; Hosted: PWA service worker
    this.scheduleDailyUpdateCheck();
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
   * Clear all intervals and timeouts.
   * Also stops remote device update polling so stop() is authoritative.
   */
  private clearAllIntervals(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.dailySyncTimeoutId) {
      clearTimeout(this.dailySyncTimeoutId);
      this.dailySyncTimeoutId = null;
    }
    if (this.dailySyncIntervalId) {
      clearInterval(this.dailySyncIntervalId);
      this.dailySyncIntervalId = null;
    }
    if (this.dailyUpdateCheckTimeoutId) {
      clearTimeout(this.dailyUpdateCheckTimeoutId);
      this.dailyUpdateCheckTimeoutId = null;
    }
    if (this.dailyUpdateCheckIntervalId) {
      clearInterval(this.dailyUpdateCheckIntervalId);
      this.dailyUpdateCheckIntervalId = null;
    }
    remoteControlService.clearDeviceUpdatePolling();
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

  /**
   * Schedule once-daily sync at configured offset (e.g. 03:00 UTC).
   * Content, events, and prayer times are otherwise fetched only via WebSocket invalidation.
   */
  private scheduleDailySync(): void {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const offsetMs = environment.dailySyncOffsetMs;

    const startOfTodayUTC = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    );
    let nextSyncAt = startOfTodayUTC + offsetMs;
    if (nextSyncAt <= now) {
      nextSyncAt += ONE_DAY_MS;
    }
    const msUntil = nextSyncAt - now;

    this.dailySyncTimeoutId = setTimeout(() => {
      this.dailySyncTimeoutId = null;
      if (!this.isStarted) return;
      this.runDailySync();
      if (!this.isStarted) return;
      this.dailySyncIntervalId = setInterval(() => this.runDailySync(), ONE_DAY_MS);
    }, msUntil);

    logger.info('[SyncService] Daily sync scheduled', {
      inMs: msUntil,
      nextAt: new Date(nextSyncAt).toISOString(),
    });
  }

  /** Run full sync with forceRefresh (used by once-daily fallback). */
  private runDailySync(): void {
    if (!this.isStarted || this.isPaused) return;
    logger.info('[SyncService] Running once-daily fallback sync');
    void this.syncAll({ forceRefresh: true });
  }

  /**
   * Schedule once-daily update check at configured offset (e.g. 04:00 UTC).
   * Pi: triggers device update script; Hosted: checks PWA service worker.
   */
  private scheduleDailyUpdateCheck(): void {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const offsetMs = environment.dailyUpdateCheckOffsetMs;

    const startOfTodayUTC = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    );
    let nextCheckAt = startOfTodayUTC + offsetMs;
    if (nextCheckAt <= now) {
      nextCheckAt += ONE_DAY_MS;
    }
    const msUntil = nextCheckAt - now;

    this.dailyUpdateCheckTimeoutId = setTimeout(() => {
      this.dailyUpdateCheckTimeoutId = null;
      if (!this.isStarted) return;
      this.runDailyUpdateCheck();
      if (!this.isStarted) return;
      this.dailyUpdateCheckIntervalId = setInterval(
        () => this.runDailyUpdateCheck(),
        ONE_DAY_MS,
      );
    }, msUntil);

    logger.info('[SyncService] Daily update check scheduled', {
      inMs: msUntil,
      nextAt: new Date(nextCheckAt).toISOString(),
    });
  }

  /** Run update check (used by once-daily scheduler). */
  private runDailyUpdateCheck(): void {
    if (!this.isStarted || this.isPaused) return;
    logger.info('[SyncService] Running once-daily update check');
    remoteControlService.triggerUpdateCheck();
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
   * Sync all data types.
   * @param options.forceRefresh - When true, bypass cache and always fetch (e.g. daily fallback, content:invalidate).
   */
  public async syncAll(options?: { forceRefresh?: boolean }): Promise<void> {
    if (this.isPaused) {
      logger.debug('[SyncService] Sync skipped - paused');
      return;
    }

    const forceRefresh = options?.forceRefresh === true;

    // Run syncs in parallel
    await Promise.all([
      this.syncContent({ forceRefresh }),
      this.syncPrayerTimes(undefined, { forceRefresh }),
      this.syncEvents({ forceRefresh }),
    ]);
  }

  /**
   * Sync content from server.
   * @param options.forceRefresh - When true, bypass "content changed" check and clear content cache so we always fetch (e.g. after content:invalidate).
   */
  public async syncContent(options?: { forceRefresh?: boolean }): Promise<SyncResult<ContentResponse>> {
    if (this.contentSyncInFlight) {
      logger.debug('[SyncService] Content sync coalesced — awaiting in-flight');
      return this.contentSyncInFlight;
    }

    const promise = this.runSyncContent(options);
    this.contentSyncInFlight = promise;
    void promise.finally(() => {
      if (this.contentSyncInFlight === promise) {
        this.contentSyncInFlight = null;
      }
    });
    return promise;
  }

  private async runSyncContent(options?: { forceRefresh?: boolean }): Promise<SyncResult<ContentResponse>> {
    const forceRefresh = options?.forceRefresh === true;

    this.updateState('content', { isLoading: true, error: null });

    try {
      // Clear content cache before force-refresh so we never return stale data on network failure
      if (forceRefresh) {
        await apiClient.clearContentCache();
      }
      // No sync-status polling — fetch when called (daily fallback or WebSocket invalidation)
      const response = await apiClient.getContent(
        forceRefresh ? { cacheBust: true, forceNetwork: true } : undefined
      );

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
   * Sync prayer times from server.
   * Uses masjid timezone when provided (or from storage) so dates align with
   * mosque local time, not device time (critical for Pi in UTC).
   * @param options.forceRefresh - Bypass HTTP/local cache for this fetch (e.g. content:invalidate, force refresh).
   */
  public async syncPrayerTimes(
    timezoneOverride?: string,
    options?: { forceRefresh?: boolean },
  ): Promise<SyncResult<PrayerTimesResponse>> {
    if (this.prayerTimesSyncInFlight) {
      logger.debug('[SyncService] Prayer times sync coalesced — awaiting in-flight');
      return this.prayerTimesSyncInFlight;
    }

    const promise = this.runSyncPrayerTimes(timezoneOverride, options);
    this.prayerTimesSyncInFlight = promise;
    void promise.finally(() => {
      if (this.prayerTimesSyncInFlight === promise) {
        this.prayerTimesSyncInFlight = null;
      }
    });
    return promise;
  }

  private async runSyncPrayerTimes(
    timezoneOverride?: string,
    options?: { forceRefresh?: boolean },
  ): Promise<SyncResult<PrayerTimesResponse>> {
    this.updateState('prayerTimes', { isLoading: true, error: null });

    try {
      let timezone = timezoneOverride;
      if (!timezone) {
        const screenContent = await storageService.get<{ masjid?: { timezone?: string }; data?: { masjid?: { timezone?: string } } }>('screenContent');
        timezone = screenContent?.masjid?.timezone ?? screenContent?.data?.masjid?.timezone ?? defaultMasjidTimezone;
      }
      const forceRefresh = options?.forceRefresh === true;
      const response = await apiClient.getPrayerTimes(undefined, timezone, {
        cacheBust: forceRefresh,
        forceNetwork: forceRefresh,
      });

      if (response.success && response.data) {
        this.updateState('prayerTimes', {
          isLoading: false,
          lastSynced: new Date(),
          error: null,
        });

        this.emitEvent('prayerTimes:synced', response.data);
        window.dispatchEvent(new CustomEvent('prayerTimesUpdated'));
        logger.debug('[SyncService] Prayer times synced successfully', {
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
   * Sync events from server.
   * @param options.forceRefresh - Clear events cache and bypass stale HTTP cache (e.g. content:invalidate type events).
   */
  public async syncEvents(options?: { forceRefresh?: boolean }): Promise<SyncResult<EventsResponse>> {
    if (this.eventsSyncInFlight) {
      logger.debug('[SyncService] Events sync coalesced — awaiting in-flight');
      return this.eventsSyncInFlight;
    }

    const promise = this.runSyncEvents(options);
    this.eventsSyncInFlight = promise;
    void promise.finally(() => {
      if (this.eventsSyncInFlight === promise) {
        this.eventsSyncInFlight = null;
      }
    });
    return promise;
  }

  private async runSyncEvents(options?: { forceRefresh?: boolean }): Promise<SyncResult<EventsResponse>> {
    this.updateState('events', { isLoading: true, error: null });

    try {
      const forceRefresh = options?.forceRefresh === true;
      if (forceRefresh) {
        await apiClient.clearEventsCache();
      }
      const response = await apiClient.getEvents(
        forceRefresh ? { cacheBust: true, forceNetwork: true } : undefined,
      );

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

    // Clear API cache
    await apiClient.clearCache();

    // Perform full sync with forceRefresh
    await this.syncAll({ forceRefresh: true });
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
