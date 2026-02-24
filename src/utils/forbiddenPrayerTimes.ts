/**
 * Forbidden (makruh) times for voluntary (nafl) prayer.
 *
 * Based on agreed rulings: dawn until ~15 min after sunrise; sun at zenith until Zuhr;
 * from Asr until sunset. Obligatory and qada prayers are not affected.
 * @see https://islamqa.info/en/answers/48998/forbidden-prayer-times
 */

import dayjs from "dayjs";
import type { PrayerTimes } from "@/api/models";
import { parseTimeString } from "./dateUtils";

/** Minutes after sunrise when the first forbidden window ends (IslamQA: 12–15 min; we use 15). */
const SUNRISE_BUFFER_MINUTES = 15;

/** Minutes before Zuhr when the zenith-forbidden window starts (approximation for solar noon). */
const ZENITH_WINDOW_MINUTES_BEFORE_ZUHR = 5;

export interface ForbiddenWindow {
  start: string;
  end: string;
  label: string;
}

export interface CurrentForbiddenState {
  isForbidden: true;
  reason: string;
  endsAt: string;
}

/**
 * Returns the three forbidden prayer time windows for the given day.
 * Missing times are skipped; no window is returned if start or end is invalid.
 */
export function getForbiddenPrayerWindows(
  today: PrayerTimes | null | undefined,
): ForbiddenWindow[] {
  if (!today) return [];

  const windows: ForbiddenWindow[] = [];

  // Window 1: From dawn (Fajr) until sunrise + 15 minutes
  const fajr = today.fajr?.trim();
  const sunrise = today.sunrise?.trim();
  if (fajr && sunrise) {
    try {
      const sunrisePlus15 = dayjs(parseTimeString(sunrise))
        .add(SUNRISE_BUFFER_MINUTES, "minute")
        .format("HH:mm");
      windows.push({
        start: fajr,
        end: sunrisePlus15,
        label: "After dawn until sun up",
      });
    } catch {
      // Skip this window if parsing fails
    }
  }

  // Window 2: Solar noon until Zuhr (approximate: Zuhr - 5 min to Zuhr)
  const zuhr = today.zuhr?.trim();
  if (zuhr) {
    try {
      const zenithStart = dayjs(parseTimeString(zuhr))
        .subtract(ZENITH_WINDOW_MINUTES_BEFORE_ZUHR, "minute")
        .format("HH:mm");
      windows.push({
        start: zenithStart,
        end: zuhr,
        label: "Sun at zenith",
      });
    } catch {
      // Skip
    }
  }

  // Window 3: From Asr until Maghrib (sunset)
  const asr = today.asr?.trim();
  const maghrib = today.maghrib?.trim();
  if (asr && maghrib) {
    windows.push({
      start: asr,
      end: maghrib,
      label: "After Asr until sunset",
    });
  }

  return windows;
}

/**
 * Checks if the current time falls within any forbidden window.
 * Returns state with reason and endsAt when in a forbidden period, or null otherwise.
 */
export function getCurrentForbiddenWindow(
  today: PrayerTimes | null | undefined,
  now: Date,
): CurrentForbiddenState | null {
  const windows = getForbiddenPrayerWindows(today);
  if (windows.length === 0) return null;

  const nowDayjs = dayjs(now);
  const nowHHmm = nowDayjs.format("HH:mm");

  for (const w of windows) {
    // Same-day comparison: start <= now < end (string compare works for HH:mm)
    if (nowHHmm >= w.start && nowHHmm < w.end) {
      return {
        isForbidden: true,
        reason: w.label,
        endsAt: w.end,
      };
    }
  }

  return null;
}
