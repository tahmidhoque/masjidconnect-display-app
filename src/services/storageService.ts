import localforage from "localforage";
import {
  ScreenContent,
  PrayerTimes,
  PrayerStatus,
  Event,
  ApiCredentials,
  Schedule,
  EmergencyAlert,
} from "../api/models";
import logger from "../utils/logger";

// Storage interface for consistent API across platforms
interface StorageAdapter {
  get<T>(key: string, defaultValue?: T): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// LocalForage-based storage adapter
class LocalForageAdapter implements StorageAdapter {
  constructor() {
    // Initialize LocalForage
    localforage.config({
      name: "MasjidConnect",
      storeName: "display_storage",
      description: "MasjidConnect Display App Storage",
      driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
    });
    logger.info("LocalForage storage adapter initialized");
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const value = await localforage.getItem<T>(key);
      return value !== null ? value : (defaultValue ?? null);
    } catch (error) {
      logger.error("LocalForageAdapter get error", { key, error });
      return defaultValue ?? null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await localforage.setItem(key, value);
    } catch (error) {
      logger.error("LocalForageAdapter set error", { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await localforage.removeItem(key);
    } catch (error) {
      logger.error("LocalForageAdapter delete error", { key, error });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await localforage.getItem(key);
      return value !== null;
    } catch (error) {
      logger.error("LocalForageAdapter has error", { key, error });
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await localforage.clear();
    } catch (error) {
      logger.error("LocalForageAdapter clear error", { error });
    }
  }

  async keys(): Promise<string[]> {
    try {
      return await localforage.keys();
    } catch (error) {
      logger.error("LocalForageAdapter keys error", { error });
      return [];
    }
  }
}

// Electron Store adapter
class ElectronStoreAdapter implements StorageAdapter {
  private electronStore: any;

  constructor() {
    // Check if we're running in Electron and have access to the store
    if (typeof window !== "undefined" && window.electron?.store) {
      this.electronStore = window.electron.store;
      logger.info("ElectronStore adapter initialized");
    } else {
      logger.warn("ElectronStore not available, using memory fallback");
      // Create memory fallback
      const memoryStore: Record<string, any> = {};
      this.electronStore = {
        get: (key: string, defaultValue?: any) =>
          key in memoryStore ? memoryStore[key] : defaultValue,
        set: (key: string, value: any) => {
          memoryStore[key] = value;
        },
        delete: (key: string) => {
          delete memoryStore[key];
        },
        has: (key: string) => key in memoryStore,
        clear: () => {
          Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
        },
        keys: () => Object.keys(memoryStore),
      };
    }
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const value = this.electronStore.get(key, defaultValue ?? null);
      return value;
    } catch (error) {
      logger.error("ElectronStoreAdapter get error", { key, error });
      return defaultValue ?? null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      this.electronStore.set(key, value);
    } catch (error) {
      logger.error("ElectronStoreAdapter set error", { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.electronStore.delete(key);
    } catch (error) {
      logger.error("ElectronStoreAdapter delete error", { key, error });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return this.electronStore.has(key);
    } catch (error) {
      logger.error("ElectronStoreAdapter has error", { key, error });
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      this.electronStore.clear();
    } catch (error) {
      logger.error("ElectronStoreAdapter clear error", { error });
    }
  }

  async keys(): Promise<string[]> {
    try {
      return this.electronStore.keys();
    } catch (error) {
      logger.error("ElectronStoreAdapter keys error", { error });
      return [];
    }
  }
}

// Storage Keys
enum StorageKeys {
  SCREEN_CONTENT = "screenContent",
  PRAYER_TIMES = "prayerTimes",
  EVENTS = "events",
  SCHEDULE = "schedule",
  LAST_UPDATED = "lastUpdated",
  API_KEY = "masjid_api_key",
  SCREEN_ID = "masjid_screen_id",
  EMERGENCY_ALERT = "emergency_alert",
}

// Storage Service
class StorageService {
  private primaryStorage: StorageAdapter;
  private fallbackStorage: StorageAdapter;
  private isElectron: boolean;

  constructor() {
    // Determine environment
    this.isElectron =
      typeof window !== "undefined" && window.electron !== undefined;

    if (this.isElectron) {
      logger.info("Initializing storage for Electron environment");
      // In Electron, use ElectronStore as primary with LocalForage as fallback
      this.primaryStorage = new ElectronStoreAdapter();
      this.fallbackStorage = new LocalForageAdapter();
    } else {
      logger.info("Initializing storage for web environment");
      // In browser, use only LocalForage
      this.primaryStorage = new LocalForageAdapter();
      this.fallbackStorage = this.primaryStorage; // No separate fallback needed
    }
  }

  // Verify database health on app startup
  async verifyDatabaseHealth(): Promise<void> {
    logger.info("Verifying database health...");
    try {
      // Try to get the current database version
      const testRequest = indexedDB.open("MasjidConnect");

      testRequest.onsuccess = (event) => {
        const target = event.target as IDBOpenDBRequest | null;
        if (!target?.result) {
          logger.error(
            "Database verification failed: No result from IndexedDB",
          );
          return;
        }
        const db = target.result;
        const version = db.version;
        logger.info("Current database version is", { version });

        // Check if object store exists
        if (!db.objectStoreNames.contains("display_storage")) {
          logger.warn(
            "display_storage object store NOT found! Database may need reset.",
          );
        } else {
          logger.info("display_storage object store verified.");
        }

        db.close();
      };

      testRequest.onerror = (event) => {
        const target = event.target as IDBOpenDBRequest | null;
        const error =
          target?.error || testRequest.error || "Unknown database error";
        logger.error("Error verifying database:", {
          error: error instanceof Error ? error.message : String(error),
        });
        logger.info("Consider clearing database if issues persist.");
      };
    } catch (error) {
      logger.error("Exception during database health check:", { error });
    }
  }

  // Generic save method that tries primary storage first then falls back
  private async saveItem<T>(key: string, value: T): Promise<void> {
    try {
      await this.primaryStorage.set(key, value);
      logger.info(`Saved ${key} to primary storage`);
    } catch (error) {
      logger.error(`Error saving to primary storage: ${key}`, { error });
      try {
        // Try fallback storage
        await this.fallbackStorage.set(key, value);
        logger.info(`Saved ${key} to fallback storage`);
      } catch (fallbackError) {
        logger.error(`Error saving to fallback storage: ${key}`, {
          error: fallbackError,
        });
        throw new Error(`Failed to save ${key} to any storage`);
      }
    }
  }

  // Generic retrieve method that tries primary storage first then falls back
  private async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = await this.primaryStorage.get<T>(key);
      if (value !== null) {
        logger.info(`Retrieved ${key} from primary storage`);
        return value;
      }

      // Try fallback if primary returns null
      const fallbackValue = await this.fallbackStorage.get<T>(key);
      if (fallbackValue !== null) {
        logger.info(`Retrieved ${key} from fallback storage`);
        // Sync back to primary for next time
        this.primaryStorage.set(key, fallbackValue).catch((err) =>
          logger.error(`Error syncing ${key} back to primary storage`, {
            error: err,
          }),
        );
        return fallbackValue;
      }

      logger.info(`${key} not found in any storage`);
      return null;
    } catch (error) {
      logger.error(`Error retrieving ${key} from primary storage`, { error });

      try {
        // Try fallback on error
        const fallbackValue = await this.fallbackStorage.get<T>(key);
        if (fallbackValue !== null) {
          logger.info(
            `Retrieved ${key} from fallback storage after primary error`,
          );
          return fallbackValue;
        }
        return null;
      } catch (fallbackError) {
        logger.error(`Error retrieving ${key} from fallback storage`, {
          error: fallbackError,
        });
        return null;
      }
    }
  }

  // Screen Content
  async saveScreenContent(content: ScreenContent): Promise<void> {
    await this.saveItem(StorageKeys.SCREEN_CONTENT, content);
    await this.updateLastUpdated(StorageKeys.SCREEN_CONTENT);
  }

  async getScreenContent(): Promise<ScreenContent | null> {
    return this.getItem<ScreenContent>(StorageKeys.SCREEN_CONTENT);
  }

  // Schedule
  async saveSchedule(schedule: Schedule[] | Schedule): Promise<void> {
    // Check if schedule is an array or a single object
    // If it's a single object with a data property that's an array, store that object directly
    if (
      !Array.isArray(schedule) &&
      schedule &&
      "data" in schedule &&
      Array.isArray(schedule.data)
    ) {
      logger.info("Saving schedule with nested data structure");
      await this.saveItem(StorageKeys.SCHEDULE, schedule);
    } else if (Array.isArray(schedule)) {
      // If it's already an array, save it directly
      logger.info("Saving schedule array");
      await this.saveItem(StorageKeys.SCHEDULE, schedule);
    } else {
      // Single schedule object
      logger.info("Saving single schedule object");
      await this.saveItem(StorageKeys.SCHEDULE, schedule);
    }
    await this.updateLastUpdated(StorageKeys.SCHEDULE);
  }

  async getSchedule(): Promise<Schedule[] | Schedule | null> {
    try {
      logger.info("Retrieving schedule from storage");
      const result = await this.getItem<Schedule[] | Schedule>(
        StorageKeys.SCHEDULE,
      );

      // Log structure for debugging
      if (result) {
        logger.debug("Schedule retrieved from storage:", {
          type: typeof result,
          isArray: Array.isArray(result),
          hasData: !!(result && "data" in result),
          keys: result && typeof result === "object" ? Object.keys(result) : [],
        });
      }

      return result;
    } catch (error) {
      logger.error("Error retrieving schedule from storage:", { error });
      return null;
    }
  }

  // Prayer Times
  async savePrayerTimes(
    prayerTimes: PrayerTimes[] | PrayerTimes,
  ): Promise<void> {
    // Check if prayerTimes is an array or a single object
    // If it's a single object with a data property that's an array, store that object directly
    if (
      !Array.isArray(prayerTimes) &&
      prayerTimes &&
      "data" in prayerTimes &&
      Array.isArray(prayerTimes.data)
    ) {
      logger.info("Saving prayer times with nested data structure");
      await this.saveItem(StorageKeys.PRAYER_TIMES, prayerTimes);
    } else if (Array.isArray(prayerTimes)) {
      // If it's already an array, save it directly
      logger.info("Saving prayer times array");
      await this.saveItem(StorageKeys.PRAYER_TIMES, prayerTimes);
    } else {
      // Single prayer time object, convert to array
      logger.info("Saving single prayer time object as array");
      await this.saveItem(StorageKeys.PRAYER_TIMES, [prayerTimes]);
    }
    await this.updateLastUpdated(StorageKeys.PRAYER_TIMES);
  }

  async getPrayerTimes(): Promise<PrayerTimes[] | PrayerTimes | null> {
    return this.getItem<PrayerTimes[] | PrayerTimes>(StorageKeys.PRAYER_TIMES);
  }

  // Events
  async saveEvents(events: Event[]): Promise<void> {
    await this.saveItem(StorageKeys.EVENTS, events);
    await this.updateLastUpdated(StorageKeys.EVENTS);
  }

  async getEvents(): Promise<Event[] | null> {
    return this.getItem<Event[]>(StorageKeys.EVENTS);
  }

  // Credentials
  async saveCredentials(credentials: ApiCredentials): Promise<void> {
    await this.saveItem(StorageKeys.API_KEY, credentials.apiKey);
    await this.saveItem(StorageKeys.SCREEN_ID, credentials.screenId);
  }

  async getCredentials(): Promise<ApiCredentials | null> {
    const apiKey = await this.getItem<string>(StorageKeys.API_KEY);
    const screenId = await this.getItem<string>(StorageKeys.SCREEN_ID);

    if (apiKey && screenId) {
      return { apiKey, screenId };
    }

    return null;
  }

  async clearCredentials(): Promise<void> {
    await this.primaryStorage.delete(StorageKeys.API_KEY);
    await this.primaryStorage.delete(StorageKeys.SCREEN_ID);

    // Also clear from fallback if different
    if (this.fallbackStorage !== this.primaryStorage) {
      await this.fallbackStorage.delete(StorageKeys.API_KEY);
      await this.fallbackStorage.delete(StorageKeys.SCREEN_ID);
    }
  }

  private async updateLastUpdated(key: string): Promise<void> {
    const lastUpdated = (await this.getLastUpdated()) || {};
    lastUpdated[key] = new Date().toISOString();
    await this.saveItem(StorageKeys.LAST_UPDATED, lastUpdated);
  }

  async getLastUpdated(): Promise<Record<string, string> | null> {
    return this.getItem<Record<string, string>>(StorageKeys.LAST_UPDATED);
  }

  // Emergency Alert
  async saveEmergencyAlert(alert: EmergencyAlert): Promise<void> {
    await this.saveItem(StorageKeys.EMERGENCY_ALERT, alert);
  }

  async getEmergencyAlert(): Promise<EmergencyAlert | null> {
    return this.getItem<EmergencyAlert>(StorageKeys.EMERGENCY_ALERT);
  }

  async removeEmergencyAlert(): Promise<void> {
    try {
      await this.primaryStorage.delete(StorageKeys.EMERGENCY_ALERT);

      // Also remove from fallback if different
      if (this.fallbackStorage !== this.primaryStorage) {
        await this.fallbackStorage.delete(StorageKeys.EMERGENCY_ALERT);
      }
    } catch (error) {
      logger.error("Error removing emergency alert", { error });
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    try {
      await this.primaryStorage.clear();
      logger.info("Primary storage cleared");

      // Clear fallback if different
      if (this.fallbackStorage !== this.primaryStorage) {
        await this.fallbackStorage.clear();
        logger.info("Fallback storage cleared");
      }
    } catch (error) {
      logger.error("Error clearing storage", { error });
    }
  }

  // Check if storage is empty
  async isStorageEmpty(): Promise<boolean> {
    try {
      const primaryKeys = await this.primaryStorage.keys();

      // If primary has keys, not empty
      if (primaryKeys.length > 0) {
        return false;
      }

      // Check fallback if different
      if (this.fallbackStorage !== this.primaryStorage) {
        const fallbackKeys = await this.fallbackStorage.keys();
        return fallbackKeys.length === 0;
      }

      return true;
    } catch (error) {
      logger.error("Error checking if storage is empty", { error });
      return true; // Assume empty on error
    }
  }
}

// Export as singleton
export default new StorageService();
