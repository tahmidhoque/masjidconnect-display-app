import localforage from 'localforage';
import { ScreenContent, PrayerTimes, PrayerStatus, Event, ApiCredentials } from '../api/models';

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

  // Prayer Times
  async savePrayerTimes(prayerTimes: PrayerTimes[]): Promise<void> {
    await localforage.setItem(StorageKeys.PRAYER_TIMES, prayerTimes);
    await this.updateLastUpdated(StorageKeys.PRAYER_TIMES);
  }

  async getPrayerTimes(): Promise<PrayerTimes[] | null> {
    return localforage.getItem<PrayerTimes[]>(StorageKeys.PRAYER_TIMES);
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