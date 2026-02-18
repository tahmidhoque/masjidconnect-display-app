/**
 * Storage Service
 *
 * Persistent key-value storage using LocalForage (IndexedDB with localStorage fallback).
 */

import localforage from 'localforage';
import logger from '../utils/logger';

localforage.config({
  name: 'MasjidConnect',
  storeName: 'display_storage',
  description: 'MasjidConnect Display App Storage',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

class StorageService {
  async get<T>(key: string, defaultValue?: T): Promise<T | null> {
    try {
      const value = await localforage.getItem<T>(key);
      return value !== null ? value : (defaultValue ?? null);
    } catch (err) {
      logger.error('[Storage] get error', { key, error: String(err) });
      return defaultValue ?? null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await localforage.setItem(key, value);
    } catch (err) {
      logger.error('[Storage] set error', { key, error: String(err) });
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await localforage.removeItem(key);
    } catch (err) {
      logger.error('[Storage] remove error', { key, error: String(err) });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return (await localforage.getItem(key)) !== null;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await localforage.clear();
    } catch (err) {
      logger.error('[Storage] clear error', { error: String(err) });
    }
  }

  async keys(): Promise<string[]> {
    try {
      return await localforage.keys();
    } catch {
      return [];
    }
  }
}

const storageService = new StorageService();
export default storageService;
