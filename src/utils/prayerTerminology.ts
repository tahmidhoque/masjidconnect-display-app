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

