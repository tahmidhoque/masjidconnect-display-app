import logger from '@/utils/logger';

/** Workbox runtime cache name for portal API responses (see vite.config.ts). */
const WORKBOX_API_CACHE = 'api-cache';

/**
 * Delete the service worker's API response cache.
 * Force-refreshes must purge this layer — Workbox NetworkFirst can otherwise
 * serve a stale `/api/screen/content` body even when apiClient cache-busts.
 */
export async function purgeApiServiceWorkerCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;

  try {
    const deleted = await caches.delete(WORKBOX_API_CACHE);
    if (deleted) {
      logger.debug('[Cache] Purged Workbox api-cache');
    }
  } catch (error) {
    logger.warn('[Cache] Failed to purge Workbox api-cache', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
