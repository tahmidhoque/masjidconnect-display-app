/**
 * Prayer terminology helpers.
 *
 * The display app keeps stable identifiers (e.g. `fajr`, `zuhr`, `jummah`) and
 * renders user-facing labels from `displaySettings.terminology` when present.
 * When that map is missing (legacy content / offline cache), components must
 * fall back to their existing FE strings.
 */

import type { TerminologyKey } from '@/api/models';

export type TerminologyMap = Partial<Record<TerminologyKey, string>> | null | undefined;

/**
 * Resolve a single terminology field with a caller-provided fallback.
 * This keeps per-component legacy fallbacks (e.g. `Shuruq` vs `Sunrise`).
 */
export function resolveTerminology(
  terminology: TerminologyMap,
  key: TerminologyKey,
  fallbackValue: string,
): string {
  const raw = terminology?.[key];
  if (typeof raw !== 'string') return fallbackValue;

  const trimmed = raw.trim();
  if (!trimmed) return fallbackValue;
  return trimmed;
}

/** Portrait tomorrow-column header from terminology, or `Tomorrow's {jamaatLabel}`. */
export function resolveTomorrowColumnHeader(
  terminology: TerminologyMap,
  jamaatLabel: string,
): string {
  const custom = resolveTerminology(terminology, 'tomorrowColumn', '');
  if (custom) return custom;
  return `Tomorrow's ${jamaatLabel}`;
}

/**
 * Resolve a prayer row / phase name to the admin-configured label.
 *
 * On Fridays the Zuhr slot uses the `jummah` key so the in-prayer overlay
 * matches the prayer panel ("Jumuah" / custom Friday label, not "Zuhr").
 */
export function resolvePrayerDisplayName(
  prayerName: string | null | undefined,
  terminology: TerminologyMap,
  options?: { isJumuahToday?: boolean },
): string | null {
  if (!prayerName) return null;
  if (options?.isJumuahToday && prayerName === 'Zuhr') {
    return resolveTerminology(terminology, 'jummah', 'Jumuah');
  }
  const key = prayerRowNameToTerminologyKey(prayerName);
  return key ? resolveTerminology(terminology, key, prayerName) : prayerName;
}

/**
 * Map UI prayer row names / phase labels to stable terminology keys.
 *
 * Note: Friday-specific logic ("Jumu'ah") is handled at the call-site because
 * the UI may still use the underlying `Zuhr` row for layout.
 */
export function prayerRowNameToTerminologyKey(rowName: string): TerminologyKey | null {
  const normalized = rowName.trim().toLowerCase();
  const withoutApostrophes = normalized.replace(/[’']/g, '');

  if (withoutApostrophes === 'fajr') return 'fajr';
  if (withoutApostrophes === 'sunrise' || withoutApostrophes === 'shuruq') return 'sunrise';
  if (withoutApostrophes === 'zuhr') return 'zuhr';
  if (withoutApostrophes === 'asr') return 'asr';
  if (withoutApostrophes === 'maghrib') return 'maghrib';
  if (withoutApostrophes === 'isha') return 'isha';
  if (withoutApostrophes === 'jumuah') return 'jummah';

  return null;
}

/**
 * User-facing prayer name for announcements (silent phones, in-prayer, etc.).
 * Friday Zuhr uses the `jummah` terminology key when `isJumuah` is set.
 * Returns null when there is no prayer to name so callers can fall back to
 * a generic Jamaat label.
 */
export function resolveAnnouncementPrayerName(
  prayerName: string | null | undefined,
  terminology: TerminologyMap,
  isJumuah = false,
): string | null {
  if (isJumuah) {
    return resolveTerminology(terminology, 'jummah', 'Jumuah');
  }
  if (typeof prayerName !== 'string') return null;
  const trimmed = prayerName.trim();
  if (!trimmed) return null;
  const key = prayerRowNameToTerminologyKey(trimmed);
  if (!key) return trimmed;
  return resolveTerminology(terminology, key, trimmed);
}

