/**
 * Resolves a remote media URL through mediaCacheService so Supabase Storage
 * assets are served from a local blob: URL after the first download.
 */

import { useEffect, useMemo, useState } from 'react';
import mediaCacheService from '@/services/mediaCacheService';

/**
 * Returns `remoteUrl` immediately, then swaps to a cached blob: URL when ready.
 * Non-cacheable URLs (or null/undefined) pass through unchanged.
 */
export function useCachedMediaUrl(
  remoteUrl: string | null | undefined,
): string | null | undefined {
  const [localUrl, setLocalUrl] = useState<string | null | undefined>(remoteUrl);

  useEffect(() => {
    if (remoteUrl == null || remoteUrl === '') {
      setLocalUrl(remoteUrl);
      return;
    }

    let cancelled = false;
    setLocalUrl(remoteUrl);

    void mediaCacheService.getLocalUrl(remoteUrl).then((resolved) => {
      if (!cancelled) setLocalUrl(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [remoteUrl]);

  return localUrl;
}

/**
 * Resolves many remote URLs into a Map of remote → local (blob or original).
 * Keys are remote URLs; values start as remote and update when cache hits.
 */
export function useCachedMediaUrlMap(remoteUrls: readonly string[]): Map<string, string> {
  const stableKey = useMemo(() => {
    const unique = [...new Set(remoteUrls.filter(Boolean))];
    unique.sort();
    return unique.join('\0');
  }, [remoteUrls]);

  const urls = useMemo(
    () => (stableKey ? stableKey.split('\0') : []),
    [stableKey],
  );

  const [map, setMap] = useState<Map<string, string>>(() => {
    const initial = new Map<string, string>();
    for (const u of urls) initial.set(u, u);
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    const next = new Map<string, string>();
    for (const u of urls) next.set(u, u);
    setMap(new Map(next));

    if (urls.length === 0) return;

    void (async () => {
      await Promise.all(
        urls.map(async (u) => {
          try {
            const resolved = await mediaCacheService.getLocalUrl(u);
            next.set(u, resolved);
          } catch {
            // getLocalUrl is defensive; keep remote URL on unexpected throw.
            next.set(u, u);
          }
        }),
      );
      if (!cancelled) setMap(new Map(next));
    })();

    return () => {
      cancelled = true;
    };
  }, [stableKey, urls]);

  return map;
}
