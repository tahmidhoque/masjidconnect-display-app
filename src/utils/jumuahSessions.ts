/**
 * Normalise Friday Jumu'ah congregations from screen-content prayer rows.
 *
 * Newer APIs send `jumuahSessions[]` (one entry per congregation). Older
 * payloads only have the primary `jummahKhutbah` / `jummahJamaat` pair.
 * Displays must render every session when the array is present, and fall
 * back to the legacy fields when it is absent or empty.
 *
 * `jamaat` is optional (portal #228): khutbah-only sessions send `jamaat: null`
 * or an empty string. Those must still be shown, without fabricating a Jamaat time.
 */

import type { JumuahSession } from '../api/models';

const DEFAULT_SESSION_LABEL = "Jumu'ah";

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * True when a Jumu'ah clock field is a non-empty string.
 * Null, undefined, non-strings, and blank/whitespace are treated as absent.
 */
export function hasJumuahClockTime(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalClockTime(value: unknown): string | null {
  const trimmed = trimString(value);
  return trimmed || null;
}

/**
 * Parse a single session object from the API.
 * Returns null when neither khutbah nor jamaat is present.
 */
function parseSession(raw: unknown): JumuahSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const jamaat = optionalClockTime(rec.jamaat);
  const khutbah = optionalClockTime(rec.khutbah);
  if (!jamaat && !khutbah) return null;
  const label = trimString(rec.label) || DEFAULT_SESSION_LABEL;
  return {
    label,
    khutbah,
    jamaat,
  };
}

/**
 * Build the display session list from a prayer-times day row (or any object
 * that may carry `jumuahSessions` plus the legacy jummah fields).
 *
 * Prefer a non-empty `jumuahSessions[]`. Otherwise synthesise one session
 * from `jummahJamaat` / `jummahKhutbah` so older caches keep working.
 */
export function normaliseJumuahSessions(day: unknown): JumuahSession[] {
  if (!day || typeof day !== 'object') return [];
  const rec = day as Record<string, unknown>;

  if (Array.isArray(rec.jumuahSessions)) {
    const fromArray = rec.jumuahSessions
      .map(parseSession)
      .filter((session): session is JumuahSession => session !== null);
    if (fromArray.length > 0) return fromArray;
  }

  const jamaat = optionalClockTime(rec.jummahJamaat);
  const khutbah = optionalClockTime(rec.jummahKhutbah);
  if (!jamaat && !khutbah) return [];
  return [
    {
      label: DEFAULT_SESSION_LABEL,
      khutbah,
      jamaat,
    },
  ];
}
