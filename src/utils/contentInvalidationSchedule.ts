import type { ContentInvalidationPayload } from '@/types/realtime';

/**
 * Layout/settings refetch delay — lets the admin DB commit and any edge cache
 * settle before the display reads /api/screen/content (avoids off-by-one updates).
 */
const LAYOUT_SETTLE_MS = 400;

/** Trailing debounce for bursty content invalidations (schedule, content items, etc.). */
const CONTENT_TRAILING_MS = 600;

/** Types that must not refetch on the leading edge (stale-read race with save). */
const TRAILING_ONLY_TYPES = new Set<ContentInvalidationPayload['type']>([
  'display_layout',
  'display_settings',
]);

export type InvalidationCoalesceState = {
  burstGuardId: ReturnType<typeof setTimeout>;
  trailingId: ReturnType<typeof setTimeout> | null;
};

export function getInvalidationTrailingMs(
  type: ContentInvalidationPayload['type'],
): number {
  if (TRAILING_ONLY_TYPES.has(type)) {
    return LAYOUT_SETTLE_MS;
  }
  return CONTENT_TRAILING_MS;
}

export function usesTrailingOnlyInvalidation(
  type: ContentInvalidationPayload['type'],
): boolean {
  return TRAILING_ONLY_TYPES.has(type);
}

/**
 * Coalesce key — include entityId so distinct layouts do not share one timer.
 */
export function invalidationCoalesceKey(
  type: ContentInvalidationPayload['type'],
  entityId?: string | null,
): string {
  if (entityId) return `${type}:${entityId}`;
  return type;
}

/**
 * Invalidation scheduler.
 * - Layout/settings: trailing-only after settle delay (no immediate leading fetch).
 * - Other types: leading-edge refetch, then optional trailing refetch on bursts.
 */
export function scheduleInvalidationRefetch(
  map: Map<string, InvalidationCoalesceState>,
  type: ContentInvalidationPayload['type'],
  runRefetch: () => void,
  coalesceKey: string = type,
): void {
  const trailingMs = getInvalidationTrailingMs(type);
  const trailingOnly = usesTrailingOnlyInvalidation(type);
  const existing = map.get(coalesceKey);

  if (trailingOnly) {
    if (existing?.burstGuardId) clearTimeout(existing.burstGuardId);
    if (existing?.trailingId) clearTimeout(existing.trailingId);
    const timerId = setTimeout(() => {
      map.delete(coalesceKey);
      runRefetch();
    }, trailingMs);
    map.set(coalesceKey, { burstGuardId: timerId, trailingId: null });
    return;
  }

  if (!existing) {
    runRefetch();
    const burstGuardId = setTimeout(() => {
      const state = map.get(coalesceKey);
      if (!state || state.trailingId) return;
      map.delete(coalesceKey);
    }, trailingMs);
    map.set(coalesceKey, { burstGuardId, trailingId: null });
    return;
  }

  if (existing.trailingId) clearTimeout(existing.trailingId);
  const trailingId = setTimeout(() => {
    map.delete(coalesceKey);
    runRefetch();
  }, trailingMs);
  map.set(coalesceKey, { ...existing, trailingId });
}

export function clearInvalidationCoalesceMap(
  map: Map<string, InvalidationCoalesceState>,
): void {
  map.forEach((state) => {
    clearTimeout(state.burstGuardId);
    if (state.trailingId) clearTimeout(state.trailingId);
  });
  map.clear();
}
