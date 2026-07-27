/**
 * Resolves jamaat phase timing from portal displaySettings (screen customisation).
 * See PRD: default + per-salah "Jamaat in progress" minutes vs post-jamaat delay.
 *
 * Note: `minutesAfterJamaatUntilNextPrayerBySalah` is a misnomer — it stores
 * per-salah *jamaat-in-progress* durations, not the post-jamaat delay.
 */

import type { DisplaySettings, SalahKey } from "@/api/models";
import { postJamaatSupplicationDurationMinutes } from "@/utils/displaySettingsSupplications";

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
 * Explicit "Jumuah" / "Jumu'ah" maps to `jumuah`. Plain Zuhr maps to `zuhr`.
 * Friday Zuhr → jumuah duration is handled in {@link jamaatPhaseMinutesForDisplayPrayer}.
 */
export function prayerNameToSalahKey(displayName: string): SalahKey | null {
  const n = displayName.trim().toLowerCase().replace(/[’']/g, "");
  if (n === "fajr") return "fajr";
  if (n === "zuhr") return "zuhr";
  if (n === "jumuah") return "jumuah";
  if (n === "asr") return "asr";
  if (n === "maghrib") return "maghrib";
  if (n === "isha") return "isha";
  return null;
}

/**
 * Resolves A + B total in-prayer window (minutes from scheduled jamaat time).
 */
export function postJamaatSupplicationWindowMinutes(
  settings: DisplaySettings | null | undefined,
): number {
  if (settings?.postJamaatSupplication?.enabled !== true) return 0;
  return postJamaatSupplicationDurationMinutes(settings);
}

export function totalJamaatPhaseWindowMinutes(
  settings: DisplaySettings | null | undefined,
  salahKey: SalahKey,
): number {
  return (
    jamaatPhaseMinutesForSalah(settings, salahKey) +
    postJamaatSupplicationWindowMinutes(settings) +
    postJamaatDelayMinutes(settings)
  );
}

/**
 * "Jamaat in progress" minutes for a formatted prayer row name (e.g. Fajr).
 * On Friday, the Zuhr slot uses the `jumuah` override (else default) — never the
 * weekday `zuhr` override, so mosques can set different lengths.
 * Unknown names (e.g. Sunrise) use defaultJamaatInProgressMinutes only.
 */
export function jamaatPhaseMinutesForDisplayPrayer(
  settings: DisplaySettings | null | undefined,
  displayName: string,
  options?: { isJumuahToday?: boolean },
): number {
  const normalised = displayName.trim().toLowerCase().replace(/[’']/g, "");
  const isFridayZuhrSlot =
    options?.isJumuahToday === true &&
    (normalised === "zuhr" || normalised === "jumuah");

  if (isFridayZuhrSlot) {
    const bySalah = settings?.minutesAfterJamaatUntilNextPrayerBySalah ?? {};
    if (typeof bySalah.jumuah === "number" && !Number.isNaN(bySalah.jumuah)) {
      return clampJamaatMinutes(bySalah.jumuah, DEFAULT_MINUTES);
    }
    return clampJamaatMinutes(
      settings?.defaultJamaatInProgressMinutes ?? DEFAULT_MINUTES,
      DEFAULT_MINUTES,
    );
  }

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
  options?: { isJumuahToday?: boolean },
): number {
  return (
    jamaatPhaseMinutesForDisplayPrayer(settings, displayName, options) +
    postJamaatSupplicationWindowMinutes(settings) +
    postJamaatDelayMinutes(settings)
  );
}
