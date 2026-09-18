/**
 * Resolves jamaat phase timing from portal displaySettings (screen customisation).
 * See PRD: default + per-salah "Jamaat in progress" minutes vs post-jamaat delay.
 */

import type { DisplaySettings, SalahKey } from "@/api/models";
import { postJamaatSupplicationDurationMinutes } from "@/utils/displaySettingsSupplications";

const DEFAULT_MINUTES = 10;

/** Classic silent-phones overlay lead (300s) when Portal `silencePhones*` is omitted. */
export const DEFAULT_JAMAAT_LEAD_MIN = 5;
export const DEFAULT_SILENCE_PHONES_SECONDS = 300;
export const SILENCE_PHONES_SECONDS_MIN = 60;
export const SILENCE_PHONES_SECONDS_MAX = 600;

/** Portal-allowed Client A pre-jamaat countdown chrome durations (seconds). */
export const PRE_JAMAAT_COUNTDOWN_SECONDS = [30, 60, 90, 120] as const;

export type PreJamaatCountdownSeconds = (typeof PRE_JAMAAT_COUNTDOWN_SECONDS)[number];

const DEFAULT_PRE_JAMAAT_SECONDS: PreJamaatCountdownSeconds = 60;

function isPreJamaatCountdownSeconds(value: unknown): value is PreJamaatCountdownSeconds {
  return (
    typeof value === "number" &&
    (PRE_JAMAAT_COUNTDOWN_SECONDS as readonly number[]).includes(value)
  );
}

/**
 * Clamp Portal `silencePhonesSecondsBeforeJamaat` into 60–600. Invalid → 300.
 */
export function clampSilencePhonesSeconds(
  value: unknown,
  fallback: number = DEFAULT_SILENCE_PHONES_SECONDS,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(
    SILENCE_PHONES_SECONDS_MIN,
    Math.min(SILENCE_PHONES_SECONDS_MAX, Math.round(value)),
  );
}

/**
 * Minutes before jamaat that the silent-phones overlay starts.
 *
 * Independent of Client A `preJamaatCountdown*` (countdown chrome only).
 * - omit / `silencePhonesEnabled` not false → ON, 300s (classic 5 min)
 * - `silencePhonesEnabled: false` → overlay off
 * - `silencePhonesSecondsBeforeJamaat` present → that many seconds (clamped 60–600)
 *
 * `#39` wrongly drove this from `preJamaatCountdownEnabled`. Portal always sends
 * that flag as `false`, which zeroed the lead and hid the overlay for default masjids.
 */
export function silencePhonesLeadMinutes(
  settings: DisplaySettings | null | undefined,
): number {
  if (settings?.silencePhonesEnabled === false) {
    return 0;
  }
  if (typeof settings?.silencePhonesSecondsBeforeJamaat === "number") {
    return clampSilencePhonesSeconds(settings.silencePhonesSecondsBeforeJamaat) / 60;
  }
  return DEFAULT_JAMAAT_LEAD_MIN;
}

/**
 * Minutes before jamaat that Client A countdown chrome flips to the Jamaat target.
 * Overlay timing must use `silencePhonesLeadMinutes` — do not call this for jamaat-soon.
 *
 * - Settings absent → 5 (older payloads)
 * - `preJamaatCountdownEnabled: false` → 0 (Portal schema default / chrome off)
 * - enabled → Portal seconds (30/60/90/120); missing seconds → 60s
 */
export function preJamaatLeadMinutes(
  settings: DisplaySettings | null | undefined,
): number {
  if (settings?.preJamaatCountdownEnabled === undefined) {
    return DEFAULT_JAMAAT_LEAD_MIN;
  }
  if (settings.preJamaatCountdownEnabled !== true) {
    return 0;
  }
  const seconds = isPreJamaatCountdownSeconds(settings.preJamaatCountdownSeconds)
    ? settings.preJamaatCountdownSeconds
    : DEFAULT_PRE_JAMAAT_SECONDS;
  return seconds / 60;
}

function clampJamaatMinutes(value: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(5, Math.min(30, value));
}

function readBySalahOverride(
  bySalah: Partial<Record<SalahKey, number>>,
  key: SalahKey,
): number | undefined {
  const specific = bySalah[key];
  if (typeof specific === "number" && !Number.isNaN(specific)) return specific;
  return undefined;
}

/**
 * Minutes the UI stays on "Jamaat in progress" for the given salah (5–30).
 * Per-salah override wins; else defaultJamaatInProgressMinutes; else 10.
 * `jumuah` falls back to `zuhr` when the Friday key is absent (older payloads).
 */
export function jamaatPhaseMinutesForSalah(
  settings: DisplaySettings | null | undefined,
  salahKey: SalahKey,
): number {
  const bySalah = settings?.minutesAfterJamaatUntilNextPrayerBySalah ?? {};
  const specific = readBySalahOverride(bySalah, salahKey);
  if (specific !== undefined) {
    return clampJamaatMinutes(specific, DEFAULT_MINUTES);
  }
  if (salahKey === "jumuah") {
    const zuhrFallback = readBySalahOverride(bySalah, "zuhr");
    if (zuhrFallback !== undefined) {
      return clampJamaatMinutes(zuhrFallback, DEFAULT_MINUTES);
    }
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
 * Friday labels (`Jumuah` / `Jummah` / apostrophe variants) map to `jumuah`.
 */
export function prayerNameToSalahKey(displayName: string): SalahKey | null {
  const n = displayName.trim().toLowerCase().replace(/[’']/g, "");
  if (n === "fajr") return "fajr";
  if (n === "zuhr") return "zuhr";
  if (n === "jumuah" || n === "jummah") return "jumuah";
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
 * Unknown names (e.g. Sunrise) use defaultJamaatInProgressMinutes only.
 * Pass `isJumuah: true` for Friday Zuhr so the distinct `jumuah` key is used.
 */
export function jamaatPhaseMinutesForDisplayPrayer(
  settings: DisplaySettings | null | undefined,
  displayName: string,
  options?: { isJumuah?: boolean },
): number {
  const key = options?.isJumuah ? "jumuah" : prayerNameToSalahKey(displayName);
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
  options?: { isJumuah?: boolean },
): number {
  return (
    jamaatPhaseMinutesForDisplayPrayer(settings, displayName, options) +
    postJamaatSupplicationWindowMinutes(settings) +
    postJamaatDelayMinutes(settings)
  );
}
