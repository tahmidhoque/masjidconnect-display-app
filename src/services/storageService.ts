import localforage from 'localforage';
import { ScreenContent, PrayerTimes, PrayerStatus, Event, ApiCredentials, Schedule } from '../api/models';

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
  PRAYER_STATUS = 'prayerStatus',
  EVENTS = 'events',
  SCHEDULE = 'schedule',
  LAST_UPDATED = 'lastUpdated',
  API_KEY = 'masjid_api_key',
  SCREEN_ID = 'masjid_screen_id',
}

// Storage Service
class StorageService {
  // Screen Content
  async saveScreenContent(content: ScreenContent): Promise<void> {
    await localforage.setItem(StorageKeys.SCREEN_CONTENT, content);
    await this.updateLastUpdated(StorageKeys.SCREEN_CONTENT);
  }

  async getScreenContent(): Promise<ScreenContent | null> {
    return localforage.getItem<ScreenContent>(StorageKeys.SCREEN_CONTENT);
  }

  // Schedule
  async saveSchedule(schedule: Schedule[] | Schedule): Promise<void> {
    // Check if schedule is an array or a single object
    // If it's a single object with a data property that's an array, store that object directly
    if (!Array.isArray(schedule) && schedule && 'data' in schedule && Array.isArray(schedule.data)) {
      console.log('Saving schedule with nested data structure', schedule);
      await localforage.setItem(StorageKeys.SCHEDULE, schedule);
    } else if (Array.isArray(schedule)) {
      // If it's already an array, save it directly
      console.log('Saving schedule array', schedule);
      await localforage.setItem(StorageKeys.SCHEDULE, schedule);
    } else {
      // Single schedule object
      console.log('Saving single schedule object', schedule);
      await localforage.setItem(StorageKeys.SCHEDULE, schedule);
    }
    await this.updateLastUpdated(StorageKeys.SCHEDULE);
  }

  async getSchedule(): Promise<Schedule[] | Schedule | null> {
    try {
      console.log('StorageService: Retrieving schedule from storage');
      const result = await localforage.getItem<Schedule[] | Schedule>(StorageKeys.SCHEDULE);
      
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
      await localforage.setItem(StorageKeys.PRAYER_TIMES, prayerTimes);
    } else if (Array.isArray(prayerTimes)) {
      // If it's already an array, save it directly
      console.log('Saving prayer times array', prayerTimes);
      await localforage.setItem(StorageKeys.PRAYER_TIMES, prayerTimes);
    } else {
      // Single prayer time object, convert to array
      console.log('Saving single prayer time object as array', prayerTimes);
      await localforage.setItem(StorageKeys.PRAYER_TIMES, [prayerTimes]);
    }
    await this.updateLastUpdated(StorageKeys.PRAYER_TIMES);
  }

  async getPrayerTimes(): Promise<PrayerTimes[] | PrayerTimes | null> {
    const result = await localforage.getItem<PrayerTimes[] | PrayerTimes>(StorageKeys.PRAYER_TIMES);
    console.log('Retrieved prayer times from storage:', result);
    return result;
  }

  // Prayer Status
  async savePrayerStatus(prayerStatus: PrayerStatus): Promise<void> {
    await localforage.setItem(StorageKeys.PRAYER_STATUS, prayerStatus);
    await this.updateLastUpdated(StorageKeys.PRAYER_STATUS);
  }

  async getPrayerStatus(): Promise<PrayerStatus | null> {
    return localforage.getItem<PrayerStatus>(StorageKeys.PRAYER_STATUS);
  }

  // Events
  async saveEvents(events: Event[]): Promise<void> {
    await localforage.setItem(StorageKeys.EVENTS, events);
    await this.updateLastUpdated(StorageKeys.EVENTS);
  }

  async getEvents(): Promise<Event[] | null> {
    return localforage.getItem<Event[]>(StorageKeys.EVENTS);
  }

  // Credentials
  async saveCredentials(credentials: ApiCredentials): Promise<void> {
    await localStorage.setItem(StorageKeys.API_KEY, credentials.apiKey);
    await localStorage.setItem(StorageKeys.SCREEN_ID, credentials.screenId);
  }

  async getCredentials(): Promise<ApiCredentials | null> {
    const apiKey = localStorage.getItem(StorageKeys.API_KEY);
    const screenId = localStorage.getItem(StorageKeys.SCREEN_ID);
    
    if (apiKey && screenId) {
      return { apiKey, screenId };
    }
    
    return null;
  }

  async clearCredentials(): Promise<void> {
    localStorage.removeItem(StorageKeys.API_KEY);
    localStorage.removeItem(StorageKeys.SCREEN_ID);
  }

  // Last Updated Timestamps
  private async updateLastUpdated(key: string): Promise<void> {
    const lastUpdated = await this.getLastUpdated() || {};
    lastUpdated[key] = new Date().toISOString();
    await localforage.setItem(StorageKeys.LAST_UPDATED, lastUpdated);
  }

  async getLastUpdated(): Promise<Record<string, string> | null> {
    return localforage.getItem<Record<string, string>>(StorageKeys.LAST_UPDATED);
  }

  // Clear all data
  async clearAll(): Promise<void> {
    await localforage.clear();
    localStorage.removeItem(StorageKeys.API_KEY);
    localStorage.removeItem(StorageKeys.SCREEN_ID);
  }

  // Check if storage is empty (first run)
  async isStorageEmpty(): Promise<boolean> {
    const keys = await localforage.keys();
    return keys.length === 0;
  }
}

const storageService = new StorageService();
export default storageService; 