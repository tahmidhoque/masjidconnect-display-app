import logger from './logger';

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

interface RequestCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Request deduplication and caching utility
 * Prevents multiple simultaneous requests to the same endpoint
 * and provides intelligent caching with TTL
 */
class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private cache = new Map<string, RequestCacheEntry<any>>();
  
  // Default cache TTL in milliseconds
  private readonly DEFAULT_TTL = 30000; // 30 seconds
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  constructor() {
    // Periodic cleanup of expired cache entries
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Execute a request with deduplication and caching
   */
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>,
    options: {
      ttl?: number;
      forceRefresh?: boolean;
      skipCache?: boolean;
    } = {}
  ): Promise<T> {
    const { ttl = this.DEFAULT_TTL, forceRefresh = false, skipCache = false } = options;
    
    // Check cache first (unless force refresh or skip cache)
    if (!forceRefresh && !skipCache) {
      const cached = this.getFromCache<T>(key);
      if (cached) {
        logger.debug('Request deduplicator: Cache hit', { key });
        return cached;
      }
    }

    // Check if there's already a pending request for this key
    const pending = this.pendingRequests.get(key);
    if (pending) {
      logger.debug('Request deduplicator: Using pending request', { key });
      return pending.promise;
    }

    // Create new request
    logger.debug('Request deduplicator: Creating new request', { key });
    
    const promise = requestFn()
      .then((result) => {
        // Cache the result (unless skipCache is true)
        if (!skipCache) {
          this.setCache(key, result, ttl);
        }
        
        // Remove from pending requests
        this.pendingRequests.delete(key);
        
        logger.debug('Request deduplicator: Request completed', { key });
        return result;
      })
      .catch((error) => {
        // Remove from pending requests on error
        this.pendingRequests.delete(key);
        logger.error('Request deduplicator: Request failed', { key, error });
        throw error;
      });

    // Store as pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    // Enforce cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = Math.ceil(this.MAX_CACHE_SIZE * 0.2); // Remove 20%
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(sortedEntries[i][0]);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(key: string): void {
    this.cache.delete(key);
    logger.debug('Request deduplicator: Cache invalidated', { key });
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidateCachePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;
    
    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    logger.debug('Request deduplicator: Cache pattern invalidated', { pattern: pattern.toString(), count });
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Request deduplicator: Cache cleared');
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;
    let pendingExpiredCount = 0;

    // Clean up expired cache entries
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    // Clean up old pending requests (in case they get stuck)
    for (const [key, pending] of Array.from(this.pendingRequests.entries())) {
      if (now - pending.timestamp > 60000) { // 1 minute timeout
        this.pendingRequests.delete(key);
        pendingExpiredCount++;
      }
    }

    if (expiredCount > 0 || pendingExpiredCount > 0) {
      logger.debug('Request deduplicator: Cleanup completed', {
        expiredCacheEntries: expiredCount,
        expiredPendingRequests: pendingExpiredCount,
        totalCacheSize: this.cache.size,
        totalPendingRequests: this.pendingRequests.size,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheEntries: Array.from(this.cache.keys()),
      pendingKeys: Array.from(this.pendingRequests.keys()),
    };
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator();

// Helper function for common API request patterns
export const withDeduplication = <T>(
  endpoint: string,
  requestFn: () => Promise<T>,
  options?: {
    ttl?: number;
    forceRefresh?: boolean;
    skipCache?: boolean;
  }
): Promise<T> => {
  return requestDeduplicator.deduplicate(endpoint, requestFn, options);
};

export default requestDeduplicator; 