/**
 * Resolves jamaat phase timing from portal displaySettings (screen customisation).
 * See PRD: default + per-salah "Jamaat in progress" minutes vs post-jamaat delay.
 */

import type { DisplaySettings, SalahKey } from "@/api/models";

const DEFAULT_MINUTES = 10;

function clampJamaatMinutes(value: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(5, Math.min(30, value));
}

/**
 * Minutes the UI stays on "Jamaat in progress" for the given salah (5–30).
 * Per-salah override wins; else defaultJamaatInProgressMinutes; else 10.
 */
export function jamaatPhaseMinutesForSalah(
  settings: DisplaySettings | null | undefined,
  salahKey: SalahKey,
): number {
  const bySalah = settings?.minutesAfterJamaatUntilNextPrayerBySalah ?? {};
  const specific = bySalah[salahKey];
  if (typeof specific === "number" && !Number.isNaN(specific)) {
    return clampJamaatMinutes(specific, DEFAULT_MINUTES);
  }
  return clampJamaatMinutes(
    settings?.defaultJamaatInProgressMinutes ?? DEFAULT_MINUTES,
    DEFAULT_MINUTES,
  );
}

/**
 * Minutes after the "Jamaat in progress" segment for the "In progress" sub-phase
 * and before next-prayer countdown/highlight advances (5–30).
 */
export function postJamaatDelayMinutes(
  settings: DisplaySettings | null | undefined,
): number {
  return clampJamaatMinutes(
    settings?.minutesAfterJamaatUntilNextPrayer ?? DEFAULT_MINUTES,
    DEFAULT_MINUTES,
  );
}

/**
 * Map display prayer name (FormattedPrayerTime / phase hooks) to API salah key.
 * Jumuah shares Zuhr row — PRD maps to zuhr.
 */
export function prayerNameToSalahKey(displayName: string): SalahKey | null {
  const n = displayName.trim().toLowerCase();
  if (n === "fajr") return "fajr";
  if (n === "zuhr" || n === "jumuah") return "zuhr";
  if (n === "asr") return "asr";
  if (n === "maghrib") return "maghrib";
  if (n === "isha") return "isha";
  return null;
}

/**
 * Resolves A + B total in-prayer window (minutes from scheduled jamaat time).
 */
export function totalJamaatPhaseWindowMinutes(
  settings: DisplaySettings | null | undefined,
  salahKey: SalahKey,
): number {
  return jamaatPhaseMinutesForSalah(settings, salahKey) + postJamaatDelayMinutes(settings);
}

/**
 * "Jamaat in progress" minutes for a formatted prayer row name (e.g. Fajr).
 * Unknown names (e.g. Sunrise) use defaultJamaatInProgressMinutes only.
 */
export function jamaatPhaseMinutesForDisplayPrayer(
  settings: DisplaySettings | null | undefined,
  displayName: string,
): number {
  const key = prayerNameToSalahKey(displayName);
  if (key == null) {
    return clampJamaatMinutes(
      settings?.defaultJamaatInProgressMinutes ?? DEFAULT_MINUTES,
      DEFAULT_MINUTES,
    );
  }
  return jamaatPhaseMinutesForSalah(settings, key);
}

export function totalJamaatPhaseWindowForDisplayPrayer(
  settings: DisplaySettings | null | undefined,
  displayName: string,
): number {
  return jamaatPhaseMinutesForDisplayPrayer(settings, displayName) + postJamaatDelayMinutes(settings);
}
