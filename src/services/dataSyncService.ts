import masjidDisplayClient, {
  POLLING_INTERVALS,
} from "../api/masjidDisplayClient";
import storageService from "./storageService";
import logger, { getLastError } from "../utils/logger";
import { isLowPowerDevice } from "../utils/performanceUtils";
import unifiedSSEService from "./unifiedSSEService";

class DataSyncService {
  private syncIntervals: Record<string, number | null> = {
    content: null,
    prayerTimes: null,
    events: null,
    schedule: null,
    heartbeat: null,
  };

  private lastSyncTime: Record<string, number> = {
    content: 0,
    prayerTimes: 0,
    events: 0,
    schedule: 0,
    heartbeat: 0,
  };

  private startTime: number = Date.now();
  // Flag to prevent multiple initialization calls
  private isInitialized: boolean = false;
  private lastHeartbeatTime: number = 0;
  private readonly MIN_HEARTBEAT_INTERVAL: number = 30000; // 30 seconds minimum between heartbeats

  // Track backoff status for APIs
  private backoffStatus: Record<
    string,
    { inBackoff: boolean; nextTry: number }
  > = {
    content: { inBackoff: false, nextTry: 0 },
    prayerTimes: { inBackoff: false, nextTry: 0 },
    events: { inBackoff: false, nextTry: 0 },
    schedule: { inBackoff: false, nextTry: 0 },
    heartbeat: { inBackoff: false, nextTry: 0 },
  };

  // Add throttling mechanism
  private lastSyncAttempts: Record<string, number> = {
    content: 0,
    prayerTimes: 0,
    events: 0,
    schedule: 0,
    heartbeat: 0,
  };

  private readonly MIN_SYNC_INTERVAL: Record<string, number>;

  constructor() {
    const baseIntervals = {
      content: 10000,
      prayerTimes: 10000,
      events: 10000,
      schedule: 10000,
      heartbeat: 30000,
    };
    if (isLowPowerDevice()) {
      this.MIN_SYNC_INTERVAL = {
        content: baseIntervals.content * 2,
        prayerTimes: baseIntervals.prayerTimes * 2,
        events: baseIntervals.events * 2,
        schedule: baseIntervals.schedule * 2,
        heartbeat: baseIntervals.heartbeat * 2,
      };
    } else {
      this.MIN_SYNC_INTERVAL = baseIntervals;
    }
  }

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
      logger.warn("DataSyncService already initialized, skipping");
      return;
    }

    logger.info(
      "Initializing DataSyncService (Conservative Mode - Redux Controlled)",
    );
    this.isInitialized = true;
    this.setupNetworkListeners();

    // Check if we have valid auth credentials - both in the client and in localStorage
    const isClientAuthenticated = masjidDisplayClient.isAuthenticated();
    const hasLocalStorageCredentials = this.checkLocalStorageCredentials();

    logger.info("Auth status check", {
      clientAuthenticated: isClientAuthenticated,
      localStorageCredentials: hasLocalStorageCredentials,
    });

    // If we have credentials in localStorage but the client isn't authenticated,
    // try to set the credentials in the client
    if (!isClientAuthenticated && hasLocalStorageCredentials) {
      this.setCredentialsFromLocalStorage();
    }

    // IMPORTANT: Do NOT start automatic syncing - Redux will handle data updates
    // This prevents the rapid firing issue in Electron
    if (masjidDisplayClient.isAuthenticated()) {
      logger.info(
        "DataSyncService authenticated - Redux will handle data updates",
      );
      // Do initial sync only, no automatic intervals
      this.syncAllData(true); // Force refresh on initial load only
    } else {
      logger.warn("DataSyncService not authenticated, cannot start syncing");
    }
  }

  // Setup network status listeners
  private setupNetworkListeners(): void {
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  // Handle coming back online
  private handleOnline = (): void => {
    logger.info("Network connection restored");
    if (masjidDisplayClient.isAuthenticated()) {
      // Sync immediately when coming back online
      this.syncAllData();
      // this.startAllSyncs(); // Removed as per conservative mode
    }
  };

  // Handle going offline
  private handleOffline = (): void => {
    logger.warn("Network connection lost");
    this.stopAllSyncs();
  };

  // Start all sync processes
  private startAllSyncs(): void {
    // Log the intervals we're using
    logger.info("Starting all sync processes with intervals", {
      content: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes`,
      prayerTimes: `${POLLING_INTERVALS.PRAYER_TIMES / (60 * 60 * 1000)} hours`,
      schedule: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes`, // Use same interval as content
      events: `${POLLING_INTERVALS.EVENTS / (60 * 1000)} minutes`,
      heartbeat: `${POLLING_INTERVALS.HEARTBEAT / 1000} seconds`,
    });

    // Only start syncs if they're not already running
    if (this.syncIntervals.content === null) {
      this.startContentSync();
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
    logger.info("Stopping all sync processes");
    this.stopContentSync();
    this.stopPrayerTimesSync();
    this.stopScheduleSync();
    this.stopEventsSync();
    this.stopHeartbeat();
  }

  // ✅ FIXED: Prevent concurrent syncs and add proper queuing with bounds
  private syncInProgress = false;
  private pendingSyncRequest: {
    forceRefresh: boolean;
    resolve: () => void;
    reject: (error: any) => void;
  } | null = null;
  private syncQueueSize = 0;
  private readonly MAX_QUEUE_SIZE = 5; // Prevent unbounded queue growth

  // Sync all data immediately
  public async syncAllData(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) {
      logger.warn("Cannot sync data - offline or not authenticated", {
        online: navigator.onLine,
        authenticated: masjidDisplayClient.isAuthenticated(),
      });
      return;
    }

    // ✅ FIXED: Prevent concurrent syncs with bounded queue
    if (this.syncInProgress) {
      logger.debug("Sync already in progress, checking queue", {
        forceRefresh,
        queueSize: this.syncQueueSize,
      });

      // Reject if queue is full to prevent memory accumulation
      if (this.syncQueueSize >= this.MAX_QUEUE_SIZE) {
        logger.warn(
          "Sync queue full, rejecting request to prevent memory leak",
          {
            queueSize: this.syncQueueSize,
            maxSize: this.MAX_QUEUE_SIZE,
          },
        );
        return Promise.reject(
          new Error("Sync queue full - too many pending requests"),
        );
      }

      // Queue the request if it's a force refresh or no request is queued
      if (forceRefresh || !this.pendingSyncRequest) {
        this.syncQueueSize++;
        return new Promise<void>((resolve, reject) => {
          this.pendingSyncRequest = { forceRefresh, resolve, reject };
        });
      }
      return;
    }

    // Prevent excessive syncs with throttle mechanism
    const now = Date.now();
    const syncKey = "syncAllData";
    const lastSyncAll = this.lastSyncAttempts[syncKey] || 0;
    const minSyncAllInterval = 5000; // 5 seconds

    if (now - lastSyncAll < minSyncAllInterval && !forceRefresh) {
      logger.debug("Throttling syncAllData - too frequent calls");
      return;
    }

    this.syncInProgress = true;
    this.lastSyncAttempts[syncKey] = now;

    try {
      logger.info("Syncing all data immediately", { forceRefresh });

      // Only include heartbeat if we haven't sent one recently
      const includeHeartbeat =
        now - this.lastHeartbeatTime > this.MIN_HEARTBEAT_INTERVAL;

      // ✅ FIXED: Execute sequentially to prevent race conditions
      await this.syncContent(forceRefresh);
      await this.syncPrayerTimes(forceRefresh);
      await this.syncEvents(forceRefresh);
      await this.syncSchedule(forceRefresh);

      // Only add heartbeat if it's been long enough since the last one
      if (includeHeartbeat) {
        await this.sendHeartbeat();
      } else {
        logger.debug(
          "Skipping heartbeat in syncAllData - too soon since last heartbeat",
        );
      }

      logger.info("All data synced successfully");
    } catch (error) {
      logger.error("Error in syncAllData", { error });
    } finally {
      this.syncInProgress = false;

      // Process any pending sync request
      if (this.pendingSyncRequest) {
        const { forceRefresh: pendingForceRefresh, resolve } =
          this.pendingSyncRequest;
        this.pendingSyncRequest = null;
        this.syncQueueSize = Math.max(0, this.syncQueueSize - 1); // Decrement queue size safely

        // Execute the pending sync
        this.syncAllData(pendingForceRefresh)
          .then(resolve)
          .catch(() => resolve()); // Always resolve to prevent hanging
      }
    }
  }

  // Content sync methods
  private startContentSync(): void {
    if (this.syncIntervals.content !== null) return;

    logger.debug("Starting content sync with interval", {
      interval: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes`,
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
      logger.debug("Stopped content sync");
    }
  }

  private async syncContent(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    // Apply throttling unless it's a force refresh
    if (!forceRefresh && this.shouldThrottleSync("content")) {
      logger.debug("Throttling content sync - too frequent calls");
      return;
    }

    // Skip backoff check if force refresh
    if (!forceRefresh && this.backoffStatus.content.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.content.nextTry) {
        logger.debug(
          `Content sync in backoff until ${new Date(this.backoffStatus.content.nextTry).toISOString()}, skipping`,
        );
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.content.inBackoff = false;
        logger.debug("Content sync backoff period ended, retrying");
      }
    }

    try {
      logger.debug("Syncing content...", { forceRefresh });
      this.lastSyncTime.content = Date.now();

      // Fetch screen content
      const contentResponse =
        await masjidDisplayClient.getScreenContent(forceRefresh);
      if (contentResponse.success && contentResponse.data) {
        await storageService.saveScreenContent(contentResponse.data);
        logger.debug("Content sync completed successfully");
      } else {
        // Don't enter backoff mode if force refresh
        if (!forceRefresh) {
          // If server has an error, implement backoff
          this.backoffStatus.content.inBackoff = true;
          this.backoffStatus.content.nextTry = Date.now() + 5 * 60 * 1000; // Wait 5 minutes before next try
          logger.warn("Content sync failed, entering backoff mode", {
            error: contentResponse.error,
            backoffUntil: new Date(
              this.backoffStatus.content.nextTry,
            ).toISOString(),
          });
        } else {
          logger.warn("Force content sync failed", {
            error: contentResponse.error,
          });
        }
      }
    } catch (error) {
      // Don't enter backoff mode if force refresh
      if (!forceRefresh) {
        // Error occurred, implement backoff
        this.backoffStatus.content.inBackoff = true;
        this.backoffStatus.content.nextTry = Date.now() + 5 * 60 * 1000; // Wait 5 minutes before next try
        logger.error("Error syncing content, entering backoff mode", {
          error,
          backoffUntil: new Date(
            this.backoffStatus.content.nextTry,
          ).toISOString(),
        });
      } else {
        logger.error("Error during forced content sync", { error });
      }
    }
  }

  // Prayer times sync methods
  private startPrayerTimesSync(): void {
    if (this.syncIntervals.prayerTimes !== null) return;

    logger.debug("Starting prayer times sync with interval", {
      interval: `${POLLING_INTERVALS.PRAYER_TIMES / (60 * 60 * 1000)} hours`,
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
      logger.debug("Stopped prayer times sync");
    }
  }

  public async syncPrayerTimes(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) {
      logger.debug("Prayer times sync skipped - offline or not authenticated");
      return;
    }

    // Apply throttling unless it's a force refresh
    if (!forceRefresh && this.shouldThrottleSync("prayerTimes")) {
      logger.debug("Throttling prayer times refresh - too frequent calls");
      return;
    }

    // Skip backoff check if force refresh
    if (!forceRefresh && this.backoffStatus.prayerTimes.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.prayerTimes.nextTry) {
        logger.debug(
          `Prayer times sync in backoff until ${new Date(this.backoffStatus.prayerTimes.nextTry).toISOString()}, skipping`,
        );
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.prayerTimes.inBackoff = false;
        logger.debug("Prayer times backoff period ended, retrying");
      }
    }

    // Set up retry mechanism
    const maxRetries = forceRefresh ? 3 : 1; // More retries for forced refreshes
    let retryCount = 0;
    let success = false;

    while (!success && retryCount <= maxRetries) {
      try {
        // If this is a retry, log and add delay
        if (retryCount > 0) {
          logger.info(
            `Retrying prayer times sync (attempt ${retryCount}/${maxRetries})...`,
          );
          // Add a short delay between retries
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount),
          );
        } else {
          logger.info("Syncing prayer times...", { forceRefresh });
        }

        this.lastSyncTime.prayerTimes = Date.now();

        // Clear cache if force refresh or retry
        if (forceRefresh || retryCount > 0) {
          logger.info("Clearing prayer times cache before fetch");
          masjidDisplayClient.invalidateCache("prayerTimes");
        }

        // Get current date
        const today = new Date();
        const startDate = today.toISOString().split("T")[0];

        // Get date 7 days from now
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 7);
        const endDateString = endDate.toISOString().split("T")[0];

        // Fetch prayer times
        const prayerTimesResponse = await masjidDisplayClient.getPrayerTimes(
          startDate,
          endDateString,
          forceRefresh,
        );

        if (prayerTimesResponse.success && prayerTimesResponse.data) {
          logger.info("Prayer times data received successfully");

          // Always save the data exactly as received to avoid format issues
          await storageService.savePrayerTimes(prayerTimesResponse.data);

          // Notify success
          logger.info("Prayer times sync completed and saved to storage");

          // Dispatch a custom event to notify components about the updated prayer times
          const updateEvent = new CustomEvent("prayerTimesUpdated", {
            detail: { timestamp: Date.now() },
          });
          window.dispatchEvent(updateEvent);

          // Set success flag to exit retry loop
          success = true;
        } else {
          // Increment retry counter if we got a response but no data
          retryCount++;
          logger.warn(
            `Prayer times sync attempt ${retryCount} failed: No data received`,
            {
              error: prayerTimesResponse.error,
            },
          );

          // On last retry, set backoff
          if (retryCount > maxRetries && !forceRefresh) {
            this.backoffStatus.prayerTimes.inBackoff = true;
            this.backoffStatus.prayerTimes.nextTry = Date.now() + 5 * 60 * 1000; // Wait 5 minutes before next try
            logger.warn(
              "Prayer times sync exhausted retries, entering backoff mode",
              {
                backoffUntil: new Date(
                  this.backoffStatus.prayerTimes.nextTry,
                ).toISOString(),
              },
            );
          }
        }
      } catch (error) {
        // Increment retry counter on errors
        retryCount++;
        logger.error(`Prayer times sync attempt ${retryCount} error`, {
          error,
        });

        // On last retry, set backoff
        if (retryCount > maxRetries && !forceRefresh) {
          this.backoffStatus.prayerTimes.inBackoff = true;
          this.backoffStatus.prayerTimes.nextTry = Date.now() + 5 * 60 * 1000; // Wait 5 minutes before next try
          logger.error(
            "Prayer times sync exhausted retries, entering backoff mode",
            {
              error,
              backoffUntil: new Date(
                this.backoffStatus.prayerTimes.nextTry,
              ).toISOString(),
            },
          );
        }
      }
    }
  }

  // Events sync methods
  private startEventsSync(): void {
    if (this.syncIntervals.events !== null) return;

    logger.debug("Starting events sync with interval", {
      interval: `${POLLING_INTERVALS.EVENTS / (60 * 1000)} minutes`,
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
      logger.debug("Stopped events sync");
    }
  }

  private async syncEvents(forceRefresh: boolean = false): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) return;

    // Apply throttling unless it's a force refresh
    if (!forceRefresh && this.shouldThrottleSync("events")) {
      logger.debug("Throttling events sync - too frequent calls");
      return;
    }

    // Skip backoff check if force refresh
    if (!forceRefresh && this.backoffStatus.events.inBackoff) {
      const now = Date.now();
      if (now < this.backoffStatus.events.nextTry) {
        logger.debug(
          `Events sync in backoff until ${new Date(this.backoffStatus.events.nextTry).toISOString()}, skipping`,
        );
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.events.inBackoff = false;
        logger.debug("Events sync backoff period ended, retrying");
      }
    }

    try {
      logger.debug("Syncing events...", { forceRefresh });
      this.lastSyncTime.events = Date.now();

      // Fetch events
      const eventsResponse = await masjidDisplayClient.getEvents(
        10,
        forceRefresh,
      );
      if (eventsResponse.success && eventsResponse.data) {
        await storageService.saveEvents(eventsResponse.data.events);
        logger.debug("Events sync completed successfully");
      } else {
        // Don't enter backoff mode if force refresh
        if (!forceRefresh) {
          // If server has an error, implement backoff
          this.backoffStatus.events.inBackoff = true;
          this.backoffStatus.events.nextTry = Date.now() + 30 * 60 * 1000; // Wait 30 minutes before next try
          logger.warn("Events sync failed, entering backoff mode", {
            error: eventsResponse.error,
            backoffUntil: new Date(
              this.backoffStatus.events.nextTry,
            ).toISOString(),
          });
        } else {
          logger.warn("Force events sync failed", {
            error: eventsResponse.error,
          });
        }
      }
    } catch (error) {
      // Don't enter backoff mode if force refresh
      if (!forceRefresh) {
        // Error occurred, implement backoff
        this.backoffStatus.events.inBackoff = true;
        this.backoffStatus.events.nextTry = Date.now() + 30 * 60 * 1000; // Wait 30 minutes before next try
        logger.error("Error syncing events, entering backoff mode", {
          error,
          backoffUntil: new Date(
            this.backoffStatus.events.nextTry,
          ).toISOString(),
        });
      } else {
        logger.error("Error during forced events sync", { error });
      }
    }
  }

  // Heartbeat methods
  private startHeartbeat(): void {
    if (this.syncIntervals.heartbeat !== null) {
      // Don't start again if already running
      logger.debug("Heartbeat timer already running, skipping");
      return;
    }

    logger.debug("Starting heartbeat with interval", {
      interval: `${POLLING_INTERVALS.HEARTBEAT / 1000} seconds`,
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
      logger.debug("Stopped heartbeat");
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!navigator.onLine || !masjidDisplayClient.isAuthenticated()) {
      logger.debug("Skipping heartbeat - offline or not authenticated");
      return;
    }

    // Record time for tracking
    const now = Date.now();

    // Apply throttling for heartbeat - should check BEFORE updating lastSyncAttempts
    const lastAttempt = this.lastSyncAttempts.heartbeat || 0;
    const timeSinceLastAttempt = now - lastAttempt;
    const minInterval = this.MIN_SYNC_INTERVAL.heartbeat;

    if (timeSinceLastAttempt < minInterval) {
      logger.debug(
        `Throttling heartbeat - too frequent calls (${Math.round(timeSinceLastAttempt / 1000)}s < ${Math.round(minInterval / 1000)}s)`,
      );
      return;
    }

    // Update last attempt time AFTER throttle check
    this.lastSyncAttempts.heartbeat = now;

    // Check if we're in backoff mode for heartbeat
    if (this.backoffStatus.heartbeat.inBackoff) {
      if (now < this.backoffStatus.heartbeat.nextTry) {
        logger.debug(
          `Heartbeat in backoff until ${new Date(this.backoffStatus.heartbeat.nextTry).toISOString()}, skipping`,
        );
        return;
      } else {
        // Reset backoff since we passed the backoff time
        this.backoffStatus.heartbeat.inBackoff = false;
        logger.debug("Heartbeat backoff period ended, retrying");
      }
    }

    // Second check for time between heartbeat successful sends (not just attempts)
    const timeSinceLastHeartbeat = now - this.lastHeartbeatTime;
    if (timeSinceLastHeartbeat < this.MIN_HEARTBEAT_INTERVAL) {
      logger.debug(
        `Skipping heartbeat - too soon since last successful heartbeat (${Math.round(timeSinceLastHeartbeat / 1000)}s < ${Math.round(this.MIN_HEARTBEAT_INTERVAL / 1000)}s)`,
      );
      return;
    }

    try {
      logger.debug("Sending heartbeat...");

      // Calculate uptime
      const uptime = Math.floor((now - this.startTime) / 1000);

      // Get last error from logger if available
      const lastError = getLastError() || "";

      // Prepare heartbeat request according to the API guide
      const heartbeatRequest = {
        status: navigator.onLine ? ("ONLINE" as const) : ("OFFLINE" as const),
        metrics: {
          uptime: uptime,
          memoryUsage: this.getMemoryUsage(),
          lastError: lastError,
        },
      };

      // Send heartbeat to server
      logger.debug("Calling masjidDisplayClient.sendHeartbeat", {
        request: heartbeatRequest,
      });
      const response =
        await masjidDisplayClient.sendHeartbeat(heartbeatRequest);

      // Log full response for debugging
      logger.debug("Heartbeat response received", {
        success: response.success,
        hasData: !!response.data,
        data: response.data,
        hasPendingEvents: response.data?.hasPendingEvents,
        error: response.error,
      });

      if (response.success) {
        // Only update the successful time on success
        this.lastHeartbeatTime = now;
        this.lastSyncTime.heartbeat = now;
        logger.debug("Heartbeat sent successfully");

        // Check if backend has pending SSE events queued
        const hasPendingEvents = response.data?.hasPendingEvents === true;
        logger.info("Checking for pending SSE events", {
          hasPendingEvents,
          responseData: response.data,
        });

        if (hasPendingEvents) {
          // Log connection state before reconnection
          const connectionStatusBefore = unifiedSSEService.getConnectionStatus();
          logger.info(
            "Heartbeat response indicates pending SSE events - triggering reconnection",
            {
              hasPendingEvents,
              responseData: response.data,
              connectionStatusBefore,
            },
          );
          
          // Trigger SSE reconnection to process queued events
          try {
            unifiedSSEService.reconnect();
            logger.info("SSE reconnection triggered successfully", {
              connectionStatusBefore,
            });
            
            // Verify reconnection after a delay
            setTimeout(() => {
              const connectionStatusAfter = unifiedSSEService.getConnectionStatus();
              logger.info("SSE reconnection status check", {
                connectionStatusBefore,
                connectionStatusAfter,
                reconnected: connectionStatusAfter.connected,
              });
              
              if (connectionStatusAfter.connected) {
                logger.info("SSE reconnection verified - connection is now open");
              } else {
                logger.warn("SSE reconnection may have failed - connection not open", {
                  readyState: connectionStatusAfter.readyState,
                });
              }
            }, 2000); // Check after 2 seconds
          } catch (error) {
            logger.error("Error triggering SSE reconnection", {
              error,
              connectionStatusBefore,
            });
          }
        } else {
          logger.debug("No pending events detected in heartbeat response");
        }
      } else {
        // Implement backoff if heartbeat fails
        this.backoffStatus.heartbeat.inBackoff = true;
        this.backoffStatus.heartbeat.nextTry = now + 60 * 1000; // Wait 1 minute before next try
        logger.warn("Heartbeat failed, entering backoff mode", {
          error: response.error,
          backoffUntil: new Date(
            this.backoffStatus.heartbeat.nextTry,
          ).toISOString(),
        });
      }
    } catch (error) {
      // Implement backoff on error
      this.backoffStatus.heartbeat.inBackoff = true;
      this.backoffStatus.heartbeat.nextTry = now + 60 * 1000; // Wait 1 minute before next try
      logger.error("Error sending heartbeat, entering backoff mode", {
        error,
        backoffUntil: new Date(
          this.backoffStatus.heartbeat.nextTry,
        ).toISOString(),
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

    logger.debug("Starting schedule sync with interval", {
      interval: `${POLLING_INTERVALS.CONTENT / (60 * 1000)} minutes`, // Use same interval as content
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
      logger.debug("Stopped schedule sync");
    }
  }

  public async syncSchedule(forceRefresh: boolean = false): Promise<void> {
    // Check if we should throttle this sync request
    if (this.shouldThrottleSync("schedule") && !forceRefresh) {
      logger.debug(
        "dataSyncService: Throttling schedule sync due to minimum interval",
      );
      return;
    }

    // Skip sync if offline
    if (!navigator.onLine) {
      logger.debug("dataSyncService: Skipping schedule sync while offline");
      return;
    }

    // Check authentication
    const isAuthenticated = masjidDisplayClient.isAuthenticated();
    if (!isAuthenticated) {
      logger.debug(
        "dataSyncService: Skipping schedule sync, not authenticated",
      );
      return;
    }

    try {
      // Track sync attempt
      this.lastSyncAttempts.schedule = Date.now();

      logger.debug("dataSyncService: Syncing schedule data", {
        forceRefresh,
        online: navigator.onLine,
        authenticated: isAuthenticated,
      });

      // Check if we're in backoff
      if (this.backoffStatus.schedule.inBackoff) {
        const now = Date.now();
        if (now < this.backoffStatus.schedule.nextTry) {
          const waitTime = Math.ceil(
            (this.backoffStatus.schedule.nextTry - now) / 1000,
          );
          logger.debug(
            `dataSyncService: In backoff for schedule, waiting ${waitTime}s before retry`,
          );
          return;
        } else {
          // Exit backoff state
          this.backoffStatus.schedule.inBackoff = false;
          logger.debug("dataSyncService: Exiting backoff for schedule sync");
        }
      }

      // Fetch screen content which includes schedule
      logger.debug("dataSyncService: Calling getScreenContent");
      const response = await masjidDisplayClient.getScreenContent(forceRefresh);
      logger.debug("dataSyncService: getScreenContent response", {
        success: response.success,
        hasData: !!response.data,
        status: response?.status,
        error: response.error,
      });

      if (response.success && response.data) {
        logger.debug("dataSyncService: Response data keys", {
          keys: Object.keys(response.data),
        });

        // Check for schedule in response - could be directly in data or in a nested structure
        const schedule = response.data.schedule;
        const nestedData = (response.data as any).data;

        logger.debug("dataSyncService: Schedule structure check", {
          hasScheduleDirectly: !!schedule,
          hasNestedData: !!nestedData,
          nestedDataHasSchedule: nestedData ? !!nestedData.schedule : false,
        });

        // If we have a schedule directly or in the nested data
        if (schedule || (nestedData && nestedData.schedule)) {
          const scheduleData = schedule || nestedData.schedule;

          // Log the structure of the schedule data we found
          logger.debug("dataSyncService: Schedule data found", {
            type: typeof scheduleData,
            isObject: typeof scheduleData === "object",
            hasItems: !!scheduleData.items,
            itemsCount: scheduleData.items?.length || 0,
            keys: Object.keys(scheduleData),
          });

          // If we have items, check the first one to understand its structure
          if (scheduleData.items && scheduleData.items.length > 0) {
            const firstItem = scheduleData.items[0];
            logger.debug("dataSyncService: First schedule item", {
              keys: Object.keys(firstItem),
              hasContentItem: "contentItem" in firstItem,
              hasType: "type" in firstItem,
              hasTitle: "title" in firstItem,
            });
          }

          // Save schedule data to storage
          await storageService.saveSchedule(scheduleData);
          logger.info("dataSyncService: Schedule data saved successfully");

          // Update last sync time
          this.lastSyncTime.schedule = Date.now();
        } else {
          logger.warn("dataSyncService: No schedule data found in response");
        }
      } else {
        logger.error("dataSyncService: Failed to fetch schedule data", {
          error: response.error,
        });

        // Set backoff for failed requests
        const now = Date.now();
        this.backoffStatus.schedule.inBackoff = true;
        this.backoffStatus.schedule.nextTry = now + 60000; // Try again in 1 minute
      }
    } catch (error) {
      logger.error("dataSyncService: Error syncing schedule data", { error });

      // Set backoff for errors
      const now = Date.now();
      this.backoffStatus.schedule.inBackoff = true;
      this.backoffStatus.schedule.nextTry = now + 60000; // Try again in 1 minute
    }
  }

  // Helper to check if we have credentials in localStorage
  private checkLocalStorageCredentials(): boolean {
    const apiKey =
      localStorage.getItem("masjid_api_key") || localStorage.getItem("apiKey");
    const screenId =
      localStorage.getItem("masjid_screen_id") ||
      localStorage.getItem("screenId");
    return !!(apiKey && screenId);
  }

  // Helper to set credentials from localStorage to the client
  private setCredentialsFromLocalStorage(): void {
    try {
      const apiKey =
        localStorage.getItem("masjid_api_key") ||
        localStorage.getItem("apiKey");
      const screenId =
        localStorage.getItem("masjid_screen_id") ||
        localStorage.getItem("screenId");

      if (apiKey && screenId) {
        logger.info("Setting credentials from localStorage to client");
        masjidDisplayClient.setCredentials({ apiKey, screenId });
      }
    } catch (error) {
      logger.error("Error setting credentials from localStorage", { error });
    }
  }

  // Add a cleanup method to properly stop all intervals and reset state
  // Public cleanup method to ensure all resources are freed
  public cleanup(): void {
    logger.info(
      "DataSyncService: Starting cleanup of all intervals and resources",
    );

    // Stop all sync intervals
    this.stopAllSyncs();

    // Clear any pending sync requests
    if (this.pendingSyncRequest) {
      this.pendingSyncRequest.reject(new Error("Service shutting down"));
      this.pendingSyncRequest = null;
    }

    // Reset sync progress flag
    this.syncInProgress = false;

    // Clear backoff status
    Object.keys(this.backoffStatus).forEach((key) => {
      this.backoffStatus[key] = { inBackoff: false, nextTry: 0 };
    });

    // Clear last sync attempts
    Object.keys(this.lastSyncAttempts).forEach((key) => {
      this.lastSyncAttempts[key] = 0;
    });

    // Remove network listeners
    this.removeNetworkListeners();

    // Reset initialization flag
    this.isInitialized = false;

    logger.info("DataSyncService: Cleanup completed");
  }

  // Add method to remove network listeners
  private removeNetworkListeners(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }
}

const dataSyncService = new DataSyncService();
export default dataSyncService;
