import localforage from 'localforage';
import { ScreenContent, PrayerTimes, PrayerStatus, Event, ApiCredentials, Schedule, EmergencyAlert } from '../api/models';

// Check if we're running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electron !== undefined;
};

// Access the Electron store through the contextBridge
const electronStore = isElectron() && window.electron?.store ? window.electron.store : null;

if (electronStore) {
  console.log('Electron store initialized successfully through preload bridge');
}

// Initialize DB
localforage.config({
  name: 'MasjidConnect',
  storeName: 'display_storage',
  description: 'MasjidConnect Display App Storage',
});

// Storage Keys
enum StorageKeys {
  SCREEN_CONTENT = 'screenContent',
  PRAYER_TIMES = 'prayerTimes',
  EVENTS = 'events',
  SCHEDULE = 'schedule',
  LAST_UPDATED = 'lastUpdated',
  API_KEY = 'masjid_api_key',
  SCREEN_ID = 'masjid_screen_id',
  EMERGENCY_ALERT = 'emergency_alert',
}

// Storage Service
class StorageService {
  // Generic save method that uses electron-store when available, falls back to localforage
  private async saveItem<T>(key: string, value: T): Promise<void> {
    // Log storage operation
    console.log(`StorageService: Saving ${key} using ${electronStore ? 'electron-store' : 'localforage'}`);
    
    // Save to electron-store if available
    if (electronStore) {
      try {
        electronStore.set(key, value);
        console.log(`Saved to electron-store: ${key}`);
      } catch (error) {
        console.error(`Error saving to electron-store: ${key}`, error);
        // Fall back to localforage on error
        await localforage.setItem(key, value);
      }
    } else {
      // Use localforage in browser environment
      await localforage.setItem(key, value);
    }
  }

  // Generic retrieve method that uses electron-store when available, falls back to localforage
  private async getItem<T>(key: string): Promise<T | null> {
    // Log retrieval operation
    console.log(`StorageService: Getting ${key} using ${electronStore ? 'electron-store' : 'localforage'}`);
    
    // Try electron-store first if available
    if (electronStore) {
      try {
        const value = electronStore.get(key, null);
        console.log(`Retrieved from electron-store: ${key}`, value ? 'found' : 'not found');
        return value;
      } catch (error) {
        console.error(`Error retrieving from electron-store: ${key}`, error);
        // Fall back to localforage on error
        return localforage.getItem<T>(key);
      }
    } else {
      // Use localforage in browser environment
      return localforage.getItem<T>(key);
    }
  }

  // Add TypeScript global window declaration
  private hasElectronStore(): boolean {
    return electronStore !== null;
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
    if (!Array.isArray(schedule) && schedule && 'data' in schedule && Array.isArray(schedule.data)) {
      console.log('Saving schedule with nested data structure', schedule);
      await this.saveItem(StorageKeys.SCHEDULE, schedule);
    } else if (Array.isArray(schedule)) {
      // If it's already an array, save it directly
      console.log('Saving schedule array', schedule);
      await this.saveItem(StorageKeys.SCHEDULE, schedule);
    } else {
      // Single schedule object
      console.log('Saving single schedule object', schedule);
      await this.saveItem(StorageKeys.SCHEDULE, schedule);
    }
    await this.updateLastUpdated(StorageKeys.SCHEDULE);
  }

  async getSchedule(): Promise<Schedule[] | Schedule | null> {
    try {
      console.log('StorageService: Retrieving schedule from storage');
      const result = await this.getItem<Schedule[] | Schedule>(StorageKeys.SCHEDULE);
      
      // Add more detailed debugging to see the structure
      console.log('StorageService: Schedule retrieved from storage:', {
        type: typeof result,
        isNull: result === null,
        isArray: Array.isArray(result),
        hasItems: !!(result && 'items' in result && (result as Schedule).items),
        itemsCount: !!(result && 'items' in result) ? (result as Schedule).items?.length || 0 : 'N/A',
        isNested: !!(result && 'data' in result),
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : []
      });
      
      // Directly inspect the database to verify the data
      try {
        console.log('🔍 DIRECT STORAGE INSPECTION');
        // Get all keys from localForage
        const keys = await localforage.keys();
        console.log('🔍 Available keys in storage:', keys);
        
        // Check if our key exists
        if (keys.includes(StorageKeys.SCHEDULE)) {
          console.log('🔍 SCHEDULE key found in storage');
        } else {
          console.log('🔍 SCHEDULE key NOT found in storage!');
        }
        
        // Check raw database
        const dbRequest = indexedDB.open('MasjidConnect', 1);
        dbRequest.onsuccess = (event) => {
          // @ts-ignore
          const db = event.target.result;
          console.log('🔍 Available object stores:', Array.from(db.objectStoreNames));
          
          if (db.objectStoreNames.contains('display_storage')) {
            console.log('🔍 display_storage object store found');
            try {
              const transaction = db.transaction('display_storage', 'readonly');
              const store = transaction.objectStore('display_storage');
              const scheduleRequest = store.get(StorageKeys.SCHEDULE);
              
              scheduleRequest.onsuccess = () => {
                const data = scheduleRequest.result;
                console.log('🔍 Raw data from IndexedDB for SCHEDULE:', data);
                console.log('🔍 Has data?', !!data);
                if (data) {
                  console.log('🔍 Data type:', typeof data);
                  console.log('🔍 Keys:', Object.keys(data));
                  console.log('🔍 Is array?', Array.isArray(data));
                  console.log('🔍 Has items?', !!(data.items));
                  console.log('🔍 Items count:', data.items?.length);
                }
              };
              
              scheduleRequest.onerror = function(this: IDBRequest) {
                console.error('🔍 Error reading SCHEDULE from IndexedDB:', this.error);
              };
            } catch (error: unknown) {
              console.error('🔍 Error during IndexedDB inspection:', error);
            }
          } else {
            console.log('🔍 display_storage object store NOT found!');
          }
        };
        
        dbRequest.onerror = function(this: IDBRequest) {
          console.error('🔍 Error opening IndexedDB for inspection:', this.error);
        };
      } catch (error: unknown) {
        console.error('🔍 Error during storage inspection:', error);
      }
      
      if (result) {
        // If it's a Schedule object with an 'items' property, log the first item
        if ('items' in result && Array.isArray(result.items) && result.items.length > 0) {
          console.log('StorageService: First schedule item:', {
            hasContentItem: 'contentItem' in result.items[0],
            contentItemKeys: 'contentItem' in result.items[0] 
              ? Object.keys(result.items[0].contentItem) 
              : 'No contentItem',
            itemKeys: Object.keys(result.items[0])
          });
          
          // Add a force refresh mechanism in case of potential stale data
          console.log('🔍 CHECKING IF DATA MIGHT BE STALE OR CORRUPTED');
          let potentiallyCorrupted = false;
          
          // Check for common indicators of corrupted data
          if ('items' in result && Array.isArray(result.items)) {
            for (let i = 0; i < result.items.length; i++) {
              const item = result.items[i];
              if (!item || typeof item !== 'object') {
                console.log(`🔍 Invalid item at index ${i}:`, item);
                potentiallyCorrupted = true;
                break;
              }
              
              if (!('contentItem' in item) || !item.contentItem) {
                console.log(`🔍 Item at index ${i} missing contentItem:`, item);
                potentiallyCorrupted = true;
                break;
              }
            }
          }
          
          if (potentiallyCorrupted) {
            console.log('🔍 POTENTIALLY CORRUPTED DATA DETECTED! Consider clearing storage.');
          } else {
            console.log('🔍 Data structure looks valid.');
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('StorageService: Error retrieving schedule from storage:', error);
      return null;
    }
  }

  // Prayer Times
  async savePrayerTimes(prayerTimes: PrayerTimes[] | PrayerTimes): Promise<void> {
    // Check if prayerTimes is an array or a single object
    // If it's a single object with a data property that's an array, store that object directly
    if (!Array.isArray(prayerTimes) && prayerTimes && 'data' in prayerTimes && Array.isArray(prayerTimes.data)) {
      console.log('Saving prayer times with nested data structure', prayerTimes);
      await this.saveItem(StorageKeys.PRAYER_TIMES, prayerTimes);
    } else if (Array.isArray(prayerTimes)) {
      // If it's already an array, save it directly
      console.log('Saving prayer times array', prayerTimes);
      await this.saveItem(StorageKeys.PRAYER_TIMES, prayerTimes);
    } else {
      // Single prayer time object, convert to array
      console.log('Saving single prayer time object as array', prayerTimes);
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
    if (electronStore) {
      electronStore.set(StorageKeys.API_KEY, credentials.apiKey);
      electronStore.set(StorageKeys.SCREEN_ID, credentials.screenId);
    } else {
      localStorage.setItem(StorageKeys.API_KEY, credentials.apiKey);
      localStorage.setItem(StorageKeys.SCREEN_ID, credentials.screenId);
    }
  }

  async getCredentials(): Promise<ApiCredentials | null> {
    let apiKey: string | null = null;
    let screenId: string | null = null;
    
    if (electronStore) {
      apiKey = electronStore.get(StorageKeys.API_KEY, null);
      screenId = electronStore.get(StorageKeys.SCREEN_ID, null);
    } else {
      apiKey = localStorage.getItem(StorageKeys.API_KEY);
      screenId = localStorage.getItem(StorageKeys.SCREEN_ID);
    }
    
    if (apiKey && screenId) {
      return { apiKey, screenId };
    }
    
    return null;
  }

  async clearCredentials(): Promise<void> {
    if (electronStore) {
      electronStore.delete(StorageKeys.API_KEY);
      electronStore.delete(StorageKeys.SCREEN_ID);
    } else {
      localStorage.removeItem(StorageKeys.API_KEY);
      localStorage.removeItem(StorageKeys.SCREEN_ID);
    }
  }

  // Last Updated Timestamps
  private async updateLastUpdated(key: string): Promise<void> {
    const lastUpdated = await this.getLastUpdated() || {};
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
    if (electronStore) {
      electronStore.delete(StorageKeys.EMERGENCY_ALERT);
    } else {
      await localforage.removeItem(StorageKeys.EMERGENCY_ALERT);
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    if (electronStore) {
      electronStore.clear();
    } else {
      await localforage.clear();
    }
    // Clear credentials regardless of storage method
    localStorage.removeItem(StorageKeys.API_KEY);
    localStorage.removeItem(StorageKeys.SCREEN_ID);
  }

  // Check if storage is empty (first run)
  async isStorageEmpty(): Promise<boolean> {
    if (electronStore) {
      const keys = electronStore.keys();
      return keys.length === 0 || (keys.length <= 2 && keys.every(k => 
        k === StorageKeys.API_KEY || k === StorageKeys.SCREEN_ID));
    } else {
      const keys = await localforage.keys();
      return keys.length === 0;
    }
  }
}

// Create and export a singleton instance
const storageService = new StorageService();
export default storageService; 