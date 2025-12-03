import localforage from "localforage";
import logger from "../utils/logger";

/**
 * Interface for cached content with expiration metadata
 */
interface CachedContent {
  data: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Content type keys for different storage stores
 */
type ContentType =
  | "content"
  | "prayer-times"
  | "events"
  | "announcements"
  | "images";

/**
 * Enhanced Offline Storage Service
 *
 * Provides TTL-based caching with separate stores per content type.
 * Automatically handles expiration and cleanup of expired content.
 */
class OfflineStorageService {
  private stores: Record<ContentType, LocalForage> = {
    content: localforage.createInstance({
      name: "MasjidConnect",
      storeName: "content",
    }),
    "prayer-times": localforage.createInstance({
      name: "MasjidConnect",
      storeName: "prayer-times",
    }),
    events: localforage.createInstance({
      name: "MasjidConnect",
      storeName: "events",
    }),
    announcements: localforage.createInstance({
      name: "MasjidConnect",
      storeName: "announcements",
    }),
    images: localforage.createInstance({
      name: "MasjidConnect",
      storeName: "images",
    }),
  };

  /**
   * Store content with expiration
   *
   * @param type - Content type (content, prayer-times, events, announcements, images)
   * @param key - Unique key for the cached item
   * @param data - Data to cache
   * @param ttlSeconds - Time to live in seconds (default: 24 hours)
   */
  async storeContent(
    type: ContentType,
    key: string,
    data: any,
    ttlSeconds: number = 86400, // 24 hours default
  ): Promise<void> {
    try {
      const cached: CachedContent = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlSeconds * 1000,
      };

      await this.stores[type].setItem(key, cached);
      logger.debug(`[OfflineStorage] Stored ${type}/${key}`, {
        ttlSeconds,
        expiresAt: new Date(cached.expiresAt).toISOString(),
      });
    } catch (error) {
      logger.error(`[OfflineStorage] Error storing ${type}/${key}`, { error });
      throw error;
    }
  }

  /**
   * Retrieve content if not expired
   *
   * @param type - Content type
   * @param key - Unique key for the cached item
   * @returns Cached data or null if not found or expired
   */
  async getContent(type: ContentType, key: string): Promise<any | null> {
    try {
      const cached = await this.stores[type].getItem<CachedContent>(key);

      if (!cached) {
        logger.debug(`[OfflineStorage] No cache found for ${type}/${key}`);
        return null;
      }

      // Check if expired
      const now = Date.now();
      if (now > cached.expiresAt) {
        logger.debug(`[OfflineStorage] Cache expired for ${type}/${key}`, {
          expiredAt: new Date(cached.expiresAt).toISOString(),
          age: Math.round((now - cached.expiresAt) / 1000 / 60) + " minutes",
        });
        await this.stores[type].removeItem(key);
        return null;
      }

      logger.debug(`[OfflineStorage] Retrieved ${type}/${key}`, {
        age: Math.round((now - cached.timestamp) / 1000 / 60) + " minutes",
        expiresIn:
          Math.round((cached.expiresAt - now) / 1000 / 60) + " minutes",
      });

      return cached.data;
    } catch (error) {
      logger.error(`[OfflineStorage] Error retrieving ${type}/${key}`, {
        error,
      });
      return null;
    }
  }

  /**
   * Check if content exists and is not expired
   *
   * @param type - Content type
   * @param key - Unique key for the cached item
   * @returns true if content exists and is valid
   */
  async hasContent(type: ContentType, key: string): Promise<boolean> {
    try {
      const cached = await this.stores[type].getItem<CachedContent>(key);
      if (!cached) return false;

      const now = Date.now();
      if (now > cached.expiresAt) {
        await this.stores[type].removeItem(key);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`[OfflineStorage] Error checking ${type}/${key}`, { error });
      return false;
    }
  }

  /**
   * Remove a specific cached item
   *
   * @param type - Content type
   * @param key - Unique key for the cached item
   */
  async removeContent(type: ContentType, key: string): Promise<void> {
    try {
      await this.stores[type].removeItem(key);
      logger.debug(`[OfflineStorage] Removed ${type}/${key}`);
    } catch (error) {
      logger.error(`[OfflineStorage] Error removing ${type}/${key}`, { error });
    }
  }

  /**
   * Clear all content of a specific type
   *
   * @param type - Content type
   */
  async clearType(type: ContentType): Promise<void> {
    try {
      await this.stores[type].clear();
      logger.info(`[OfflineStorage] Cleared all ${type} content`);
    } catch (error) {
      logger.error(`[OfflineStorage] Error clearing ${type}`, { error });
    }
  }

  /**
   * Clear expired content from all stores
   */
  async clearExpiredContent(): Promise<void> {
    const now = Date.now();
    let totalRemoved = 0;

    for (const [storeName, store] of Object.entries(this.stores)) {
      try {
        const keys = await store.keys();
        let removedCount = 0;

        for (const key of keys) {
          const cached = await store.getItem<CachedContent>(key);
          if (cached && now > cached.expiresAt) {
            await store.removeItem(key);
            removedCount++;
            totalRemoved++;
          }
        }

        if (removedCount > 0) {
          logger.info(
            `[OfflineStorage] Removed ${removedCount} expired items from ${storeName}`,
          );
        }
      } catch (error) {
        logger.error(
          `[OfflineStorage] Error clearing expired content from ${storeName}`,
          { error },
        );
      }
    }

    if (totalRemoved > 0) {
      logger.info(
        `[OfflineStorage] Cleaned up ${totalRemoved} expired items total`,
      );
    }
  }

  /**
   * Get storage statistics
   *
   * @returns Storage statistics including item counts and estimated size
   */
  async getStorageStats(): Promise<{
    itemCount: number;
    estimatedSize: number;
    byType: Record<string, number>;
    expiredCount: number;
  }> {
    let totalItems = 0;
    let expiredCount = 0;
    const byType: Record<string, number> = {};
    const now = Date.now();

    for (const [storeName, store] of Object.entries(this.stores)) {
      try {
        const keys = await store.keys();
        let validCount = 0;
        let expiredInStore = 0;

        for (const key of keys) {
          const cached = await store.getItem<CachedContent>(key);
          if (cached) {
            if (now > cached.expiresAt) {
              expiredInStore++;
            } else {
              validCount++;
            }
          }
        }

        byType[storeName] = validCount;
        totalItems += validCount;
        expiredCount += expiredInStore;
      } catch (error) {
        logger.error(`[OfflineStorage] Error getting stats for ${storeName}`, {
          error,
        });
        byType[storeName] = 0;
      }
    }

    // Estimate size (rough approximation - ~10KB per item average)
    const estimatedSize = totalItems * 10000;

    return {
      itemCount: totalItems,
      estimatedSize,
      byType,
      expiredCount,
    };
  }

  /**
   * Clear all cached content from all stores
   */
  async clearAll(): Promise<void> {
    try {
      await Promise.all(
        Object.values(this.stores).map((store) => store.clear()),
      );
      logger.info("[OfflineStorage] Cleared all cached content");
    } catch (error) {
      logger.error("[OfflineStorage] Error clearing all content", { error });
      throw error;
    }
  }
}

// Export singleton instance
const offlineStorage = new OfflineStorageService();
export default offlineStorage;

