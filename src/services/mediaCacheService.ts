/**
 * Media Cache Service
 *
 * Downloads Supabase Storage public assets once and serves them from the
 * Cache API (plus in-memory blob: URLs) so always-on kiosks do not re-hit
 * Cached Egress on every carousel cycle or remount.
 *
 * Only URLs under `/storage/v1/object/public/` are cached. Other hosts
 * (CDN demos, relative paths) pass through unchanged.
 */

import logger from '@/utils/logger';

const CACHE_NAME = 'masjidconnect-media-v1';
const META_KEY = 'masjidconnect-media-meta-v1';
/** Soft budget for cached media on the Pi (LRU eviction when exceeded). */
const MAX_BYTES = 450 * 1024 * 1024;
/** How long to keep revoked blob: URLs alive so React can finish remounting. */
const BLOB_REVOKE_GRACE_MS = 60_000;
/** Cap parallel downloads — large videos must not saturate Pi RAM/network. */
const PREFETCH_CONCURRENCY = 2;
/** Throttle lastAccess meta writes to localStorage. */
const META_TOUCH_THROTTLE_MS = 30_000;

interface CacheMetaEntry {
  url: string;
  size: number;
  lastAccess: number;
}

interface CacheMeta {
  entries: CacheMetaEntry[];
}

function emptyMeta(): CacheMeta {
  return { entries: [] };
}

function readMeta(): CacheMeta {
  try {
    if (typeof localStorage === 'undefined') return emptyMeta();
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw) as CacheMeta;
    if (!parsed || !Array.isArray(parsed.entries)) return emptyMeta();
    return {
      entries: parsed.entries.filter(
        (e) =>
          e &&
          typeof e.url === 'string' &&
          typeof e.size === 'number' &&
          typeof e.lastAccess === 'number',
      ),
    };
  } catch {
    return emptyMeta();
  }
}

function writeMeta(meta: CacheMeta): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    logger.warn('[MediaCache] Failed to persist meta', { error: String(err) });
  }
}

/**
 * Walks JSON-like payloads and collects http(s) string values that look like
 * media URLs (used after content sync to prefetch carousel assets).
 */
export function collectHttpUrls(value: unknown, out: Set<string> = new Set()): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
      trimmed.length < 2048
    ) {
      out.add(trimmed);
    }
    return [...out];
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHttpUrls(item, out);
    return [...out];
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectHttpUrls(v, out);
    }
  }
  return [...out];
}

async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const idx = next;
        next += 1;
        await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
}

class MediaCacheService {
  private readonly blobUrls = new Map<string, string>();
  private readonly inflight = new Map<string, Promise<string>>();
  private readonly pendingRevokes = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastTouchWrite = new Map<string, number>();
  /** Soft-fail window: avoid re-fetching a broken URL every remount, but allow recovery. */
  private readonly failedUntil = new Map<string, number>();
  private static readonly FAIL_COOLDOWN_MS = 5 * 60_000;

  /**
   * True when the URL is a Supabase Storage public object (our egress hot path).
   */
  isCacheable(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.pathname.includes('/storage/v1/object/public/');
    } catch {
      return false;
    }
  }

  /**
   * Returns a stable blob: URL for a cacheable remote asset, or the original
   * URL when caching is unavailable / not applicable.
   */
  async getLocalUrl(remoteUrl: string): Promise<string> {
    const url = remoteUrl.trim();
    if (!url || !this.isCacheable(url)) return remoteUrl;

    this.cancelPendingRevoke(url);

    const existing = this.blobUrls.get(url);
    if (existing) {
      this.touchMeta(url);
      return existing;
    }

    const failUntil = this.failedUntil.get(url);
    if (failUntil != null) {
      if (Date.now() < failUntil) return url;
      this.failedUntil.delete(url);
    }

    const pending = this.inflight.get(url);
    if (pending) return pending;

    // Register the promise before any await so concurrent callers coalesce.
    let settle!: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      settle = resolve;
    });
    this.inflight.set(url, promise);

    void this.fetchAndCache(url)
      .then(settle)
      .catch((err) => {
        logger.warn('[MediaCache] Unexpected fetchAndCache error', {
          url,
          error: String(err),
        });
        settle(url);
      })
      .finally(() => {
        this.inflight.delete(url);
      });

    return promise;
  }

  /**
   * Prefetch a set of URLs in the background and drop cache entries that are
   * no longer referenced by the active playlist/content.
   *
   * Empty `urls` does **not** wipe the cache — a text-only playlist must not
   * discard previously downloaded assets that may return on the next sync.
   */
  async prefetchAndRetain(urls: string[]): Promise<void> {
    const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
    const cacheable = unique.filter((u) => this.isCacheable(u));

    await mapPool(cacheable, PREFETCH_CONCURRENCY, async (u) => {
      await this.getLocalUrl(u);
    });

    if (cacheable.length > 0) {
      await this.retain(cacheable);
    }
  }

  /**
   * Remove cached assets that are not in `keepUrls`.
   * Cache API + meta are purged immediately; in-memory blob: URLs are revoked
   * after a grace period so the carousel can finish swapping slides.
   */
  async retain(keepUrls: string[]): Promise<void> {
    const keep = new Set(keepUrls.filter((u) => this.isCacheable(u)));
    if (keep.size === 0) {
      // Never wipe the entire media cache when the keep-set is empty.
      return;
    }

    const meta = readMeta();
    const toRemove = meta.entries.filter((e) => !keep.has(e.url));
    if (toRemove.length === 0) return;

    const cache = await this.openCache();
    for (const entry of toRemove) {
      if (cache) {
        try {
          await cache.delete(entry.url);
        } catch {
          /* best-effort */
        }
      }
      this.scheduleBlobRevoke(entry.url);
    }

    meta.entries = meta.entries.filter((e) => keep.has(e.url));
    writeMeta(meta);
    logger.debug('[MediaCache] Retained active URLs', {
      kept: meta.entries.length,
      removed: toRemove.length,
    });
  }

  /** Test-only: clear in-memory state between unit tests. */
  __resetForTests(): void {
    for (const timer of this.pendingRevokes.values()) {
      clearTimeout(timer);
    }
    this.pendingRevokes.clear();
    for (const blob of this.blobUrls.values()) {
      if (blob.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(blob);
        } catch {
          /* no-op */
        }
      }
    }
    this.blobUrls.clear();
    this.inflight.clear();
    this.lastTouchWrite.clear();
    this.failedUntil.clear();
  }

  private cancelPendingRevoke(url: string): void {
    const timer = this.pendingRevokes.get(url);
    if (timer) {
      clearTimeout(timer);
      this.pendingRevokes.delete(url);
    }
  }

  private scheduleBlobRevoke(url: string): void {
    this.cancelPendingRevoke(url);
    const blob = this.blobUrls.get(url);
    if (!blob || blob === url) {
      this.blobUrls.delete(url);
      return;
    }

    const timer = setTimeout(() => {
      this.pendingRevokes.delete(url);
      const current = this.blobUrls.get(url);
      if (current === blob) {
        try {
          URL.revokeObjectURL(blob);
        } catch {
          /* no-op */
        }
        this.blobUrls.delete(url);
      }
    }, BLOB_REVOKE_GRACE_MS);

    this.pendingRevokes.set(url, timer);
  }

  private async openCache(): Promise<Cache | null> {
    if (typeof caches === 'undefined') return null;
    try {
      return await caches.open(CACHE_NAME);
    } catch (err) {
      logger.warn('[MediaCache] Cache API unavailable', { error: String(err) });
      return null;
    }
  }

  private createBlobUrl(blob: Blob): string | null {
    try {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return null;
      }
      return URL.createObjectURL(blob);
    } catch (err) {
      logger.warn('[MediaCache] createObjectURL failed', { error: String(err) });
      return null;
    }
  }

  /**
   * Remember a successful blob resolution.
   */
  private remember(url: string, resolved: string): string {
    this.failedUntil.delete(url);
    this.blobUrls.set(url, resolved);
    return resolved;
  }

  private rememberFailure(url: string): string {
    this.failedUntil.set(url, Date.now() + MediaCacheService.FAIL_COOLDOWN_MS);
    return url;
  }

  private async fetchAndCache(url: string): Promise<string> {
    const cache = await this.openCache();

    if (cache) {
      try {
        const cached = await cache.match(url);
        if (cached) {
          const blob = await cached.blob();
          const blobUrl = this.createBlobUrl(blob);
          if (blobUrl) {
            this.touchMeta(url, blob.size);
            return this.remember(url, blobUrl);
          }
        }
      } catch (err) {
        logger.warn('[MediaCache] Failed to read cache entry', {
          url,
          error: String(err),
        });
      }
    }

    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) {
        logger.warn('[MediaCache] Fetch failed — using remote URL', {
          url,
          status: response.status,
        });
        return this.rememberFailure(url);
      }

      const clone = response.clone();
      const blob = await response.blob();
      const size = blob.size;

      if (cache) {
        try {
          await this.ensureCapacity(cache, size);
          await cache.put(url, clone);
        } catch (err) {
          logger.warn('[MediaCache] Failed to store in Cache API', {
            url,
            error: String(err),
          });
        }
      }

      const blobUrl = this.createBlobUrl(blob);
      if (!blobUrl) {
        return this.rememberFailure(url);
      }

      this.upsertMeta(url, size);
      logger.debug('[MediaCache] Cached media asset', { url, size });
      return this.remember(url, blobUrl);
    } catch (err) {
      logger.warn('[MediaCache] Network error — using remote URL', {
        url,
        error: String(err),
      });
      return this.rememberFailure(url);
    }
  }

  private touchMeta(url: string, size?: number): void {
    const now = Date.now();
    const lastWrite = this.lastTouchWrite.get(url) ?? 0;
    // Always update size when provided; otherwise throttle lastAccess writes.
    if (typeof size !== 'number' && now - lastWrite < META_TOUCH_THROTTLE_MS) {
      return;
    }

    const meta = readMeta();
    const idx = meta.entries.findIndex((e) => e.url === url);
    if (idx >= 0) {
      meta.entries[idx].lastAccess = now;
      if (typeof size === 'number') meta.entries[idx].size = size;
    } else if (typeof size === 'number') {
      meta.entries.push({ url, size, lastAccess: now });
    } else {
      return;
    }
    this.lastTouchWrite.set(url, now);
    writeMeta(meta);
  }

  private upsertMeta(url: string, size: number): void {
    const meta = readMeta();
    const idx = meta.entries.findIndex((e) => e.url === url);
    const now = Date.now();
    if (idx >= 0) {
      meta.entries[idx] = { url, size, lastAccess: now };
    } else {
      meta.entries.push({ url, size, lastAccess: now });
    }
    this.lastTouchWrite.set(url, now);
    writeMeta(meta);
  }

  /** Evict least-recently-used entries until `needed` bytes fit under MAX_BYTES. */
  private async ensureCapacity(cache: Cache, needed: number): Promise<void> {
    const meta = readMeta();
    let total = meta.entries.reduce((sum, e) => sum + (e.size || 0), 0);
    if (total + needed <= MAX_BYTES) return;

    // Skip eviction if a single asset exceeds the budget — still try to store it.
    if (needed > MAX_BYTES) {
      logger.warn('[MediaCache] Asset larger than cache budget', { needed, max: MAX_BYTES });
      return;
    }

    meta.entries.sort((a, b) => a.lastAccess - b.lastAccess);
    while (total + needed > MAX_BYTES && meta.entries.length > 0) {
      const victim = meta.entries.shift();
      if (!victim) break;
      total -= victim.size || 0;
      try {
        await cache.delete(victim.url);
      } catch {
        /* best-effort */
      }
      this.scheduleBlobRevoke(victim.url);
      logger.debug('[MediaCache] Evicted LRU entry', { url: victim.url, size: victim.size });
    }
    writeMeta(meta);
  }
}

const mediaCacheService = new MediaCacheService();
export default mediaCacheService;
