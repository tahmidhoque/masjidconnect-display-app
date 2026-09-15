/**
 * Normalise Friday Jumu'ah congregations from screen-content prayer rows.
 *
 * Newer APIs send `jumuahSessions[]` (one entry per congregation). Older
 * payloads only have the primary `jummahKhutbah` / `jummahJamaat` pair.
 * Displays must render every session when the array is present, and fall
 * back to the legacy fields when it is absent or empty.
 */

import type { JumuahSession } from '../api/models';

const DEFAULT_SESSION_LABEL = "Jumu'ah";

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Parse a single session object from the API. Returns null when jamaat is missing.
 */
function parseSession(raw: unknown): JumuahSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const jamaat = trimString(rec.jamaat);
  if (!jamaat) return null;
  const khutbahRaw = trimString(rec.khutbah);
  const label = trimString(rec.label) || DEFAULT_SESSION_LABEL;
  return {
    label,
    khutbah: khutbahRaw || null,
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

  const jamaat = trimString(rec.jummahJamaat);
  if (!jamaat) return [];
  const khutbah = trimString(rec.jummahKhutbah);
  return [
    {
      label: DEFAULT_SESSION_LABEL,
      khutbah: khutbah || null,
      jamaat,
    },
  ];
}
