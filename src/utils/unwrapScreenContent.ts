import type { ScreenContent } from '@/api/models';

/**
 * Normalise the screen content API envelope to the inner payload the display stores in Redux.
 * The HTTP client may return `{ success, data: { layout, schedule, ... } }` or the inner object.
 */
export function unwrapScreenContentPayload(data: unknown): ScreenContent | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    return record.data as ScreenContent;
  }
  return data as ScreenContent;
}
