/**
 * Authoritative content helpers for a live screen-content refetch.
 *
 * Display-side defensive only — not an entitlement gate. When Cloud/Portal
 * omits or empties premium lists after Full → Free, a successful network
 * payload must replace persisted Full carousel residue (Redux + LocalForage).
 * Failed / cached fetches keep offline data.
 */

import type { Event, Schedule, ScheduledPlaylistAssignment, ScreenContent } from '../api/models';

/** Empty schedule written to storage so boot cache cannot revive Full slides. */
export const EMPTY_SCHEDULE: Schedule = {
  id: 'cleared-schedule',
  name: 'Schedule',
  items: [],
};

type ContentRecord = Record<string, unknown> & {
  data?: Record<string, unknown>;
};

function asRecord(value: unknown): ContentRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as ContentRecord;
}

/**
 * True when `key` exists on the content envelope or its nested `data` object.
 * Distinguishes "API omitted the field" from "API sent null/[]".
 */
export function contentHasKey(content: unknown, key: string): boolean {
  const rec = asRecord(content);
  if (!rec) return false;
  if (Object.prototype.hasOwnProperty.call(rec, key)) return true;
  const nested = asRecord(rec.data);
  return Boolean(nested && Object.prototype.hasOwnProperty.call(nested, key));
}

/**
 * Schedule lookup — same historical paths as contentSlice / apiClient.
 * Returns `{ hasKey, raw }` so callers can treat omit vs empty separately.
 */
export function pickScheduleField(content: unknown): { hasKey: boolean; raw: unknown } {
  const rec = asRecord(content);
  if (!rec) return { hasKey: false, raw: undefined };
  const nested = asRecord(rec.data);
  const assigned = asRecord(rec.assignedSchedule);

  const hasKey =
    contentHasKey(rec, 'schedule') ||
    contentHasKey(rec, 'playlist') ||
    Boolean(assigned && Object.prototype.hasOwnProperty.call(assigned, 'schedule'));

  const raw =
    rec.schedule ??
    nested?.schedule ??
    rec.playlist ??
    assigned?.schedule ??
    nested?.playlist;

  return { hasKey, raw };
}

/**
 * True when the schedule payload is omitted, null, or has no items.
 */
export function isEmptySchedulePayload(raw: unknown): boolean {
  if (raw == null) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw !== 'object') return true;
  const obj = raw as { items?: unknown; data?: unknown };
  if (Array.isArray(obj.items)) return obj.items.length === 0;
  if (Array.isArray(obj.data)) return obj.data.length === 0;
  return false;
}

/**
 * Events lookup on the content envelope (`events` or `data.events`).
 */
export function pickEventsField(content: unknown): { hasKey: boolean; events: Event[] } {
  const rec = asRecord(content);
  const hasKey = contentHasKey(rec, 'events');
  if (!hasKey) return { hasKey: false, events: [] };

  const nested = asRecord(rec?.data);
  const raw = rec?.events ?? nested?.events;
  if (Array.isArray(raw)) return { hasKey: true, events: raw as Event[] };
  const wrapped = asRecord(raw);
  if (Array.isArray(wrapped?.data)) return { hasKey: true, events: wrapped.data as Event[] };
  return { hasKey: true, events: [] };
}

/**
 * Playlist assignments — key-present signal matches contentSlice.
 */
export function pickScheduledPlaylistsField(content: unknown): {
  hasKey: boolean;
  playlists: ScheduledPlaylistAssignment[] | null;
} {
  const rec = asRecord(content);
  const hasKey = contentHasKey(rec, 'scheduledPlaylists');
  if (!hasKey) return { hasKey: false, playlists: null };

  const nested = asRecord(rec?.data);
  const raw = rec?.scheduledPlaylists ?? nested?.scheduledPlaylists;
  if (Array.isArray(raw) && raw.length > 0) {
    return { hasKey: true, playlists: raw as ScheduledPlaylistAssignment[] };
  }
  return { hasKey: true, playlists: null };
}

/**
 * Normalise an events payload (array, `{ events }`, or `{ data }`) to a list.
 */
export function normaliseEventsList(raw: unknown): Event[] {
  if (Array.isArray(raw)) return raw as Event[];
  const rec = asRecord(raw);
  if (Array.isArray(rec?.events)) return rec.events as Event[];
  if (Array.isArray(rec?.data)) return rec.data as Event[];
  return [];
}

const EMERGENCY_PAYLOAD_KEYS = [
  'emergency',
  'emergencyAlert',
  'currentAlert',
  'activeEmergency',
] as const;

/**
 * Detect an explicit emergency clear on the content envelope.
 * Omitted keys must not dismiss a live WebSocket alert.
 */
export function pickEmergencyFromContent(content: unknown): {
  hasKey: boolean;
  shouldClear: boolean;
} {
  const rec = asRecord(content);
  if (!rec) return { hasKey: false, shouldClear: false };

  const nested = asRecord(rec.data);
  let hasKey = false;
  let raw: unknown;
  for (const key of EMERGENCY_PAYLOAD_KEYS) {
    if (contentHasKey(rec, key)) {
      hasKey = true;
      raw = rec[key] ?? nested?.[key];
      break;
    }
  }
  if (!hasKey) return { hasKey: false, shouldClear: false };

  if (raw == null) return { hasKey: true, shouldClear: true };
  if (typeof raw === 'boolean') return { hasKey: true, shouldClear: !raw };
  if (Array.isArray(raw)) return { hasKey: true, shouldClear: raw.length === 0 };

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const action = typeof obj.action === 'string' ? obj.action.trim().toLowerCase() : '';
    if (action === 'clear' || action === 'hide' || action === 'cancel') {
      return { hasKey: true, shouldClear: true };
    }
    const hasAlert =
      typeof obj.title === 'string' &&
      obj.title.trim() !== '' &&
      typeof obj.message === 'string' &&
      obj.message.trim() !== '';
    return { hasKey: true, shouldClear: !hasAlert };
  }

  return { hasKey: true, shouldClear: false };
}

/**
 * Resolve carousel lists from a live (non-cache) content payload.
 * Omitted or empty lists become empty so Redux/storage cannot keep Full slides.
 */
export function resolveAuthoritativeCarousel(content: ScreenContent): {
  /** Null when the live payload still has items — caller must normalise `scheduleRaw`. */
  emptySchedule: Schedule | null;
  scheduleRaw: unknown;
  scheduledPlaylists: ScheduledPlaylistAssignment[] | null;
  eventsFromContent: { hasKey: boolean; events: Event[] };
} {
  const scheduleField = pickScheduleField(content);
  const playlistsField = pickScheduledPlaylistsField(content);
  const eventsFromContent = pickEventsField(content);
  const scheduleRaw = scheduleField.hasKey ? scheduleField.raw : null;

  return {
    emptySchedule: isEmptySchedulePayload(scheduleRaw) ? EMPTY_SCHEDULE : null,
    scheduleRaw,
    scheduledPlaylists: playlistsField.hasKey ? playlistsField.playlists : null,
    eventsFromContent,
  };
}
