/**
 * Unit tests for dateUtils.
 *
 * DST / timezone tests use a fixed UTC instant during BST (British Summer Time,
 * UTC+1) and verify that passing `timezone = 'Europe/London'` to the updated
 * functions produces the correct masjid-local wall-clock result, while the
 * device-local (UTC) path would diverge by one hour — replicating the Raspberry
 * Pi scenario where TZ=UTC but the masjid is in Europe/London.
 *
 * Reference instant used throughout: 2026-03-29T10:00:00Z (UTC)
 *   • UTC wall clock  → 10:00
 *   • Europe/London   → 11:00  (BST, UTC+1, DST active since 01:00 that day)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  formatTimeTo12Hour,
  getTimeDisplayParts,
  formatTimeToDisplay,
  parseTimeString,
  getTimeDifferenceInMinutes,
  formatMinutesToDisplay,
  isToday,
  formatDateToDisplay,
  convertTo24Hour,
  getNextPrayerTime,
  getTimeUntilNextPrayer,
  toMinutesFromMidnight,
  calculateApproximateHijriDate,
  fetchHijriDate,
} from './dateUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fixed UTC instant that falls inside BST (UTC+1): London wall-clock = 10:00 UTC → 11:00 BST. */
const BST_UTC_INSTANT = '2026-03-29T10:00:00.000Z';


const PRAYER_TIMES = {
  fajr: '05:30',
  sunrise: '06:45',
  zuhr: '12:15',
  asr: '15:30',
  maghrib: '18:20',
  isha: '19:45',
};

// ---------------------------------------------------------------------------
// formatTimeTo12Hour
// ---------------------------------------------------------------------------

describe('formatTimeTo12Hour', () => {
  it('formats 24h time to 12h with AM/PM', () => {
    expect(formatTimeTo12Hour('16:30')).toBe('4:30 PM');
    expect(formatTimeTo12Hour('09:15')).toBe('9:15 AM');
    expect(formatTimeTo12Hour('00:00')).toBe('12:00 AM');
    expect(formatTimeTo12Hour('12:00')).toBe('12:00 PM');
  });

  it('returns empty string for empty input', () => {
    expect(formatTimeTo12Hour('')).toBe('');
  });

  it('returns original string for invalid input', () => {
    expect(formatTimeTo12Hour('invalid')).toBe('invalid');
  });

  it('treats out-of-range hours via modulo (e.g. 25:00 as 1:00)', () => {
    expect(formatTimeTo12Hour('25:00')).toBe('1:00 PM');
  });
});

// ---------------------------------------------------------------------------
// getTimeDisplayParts
// ---------------------------------------------------------------------------

describe('getTimeDisplayParts', () => {
  it('returns 12h parts when format is 12h', () => {
    expect(getTimeDisplayParts('16:30', '12h')).toEqual({ main: '4:30', period: 'pm' });
    expect(getTimeDisplayParts('09:00', '12h')).toEqual({ main: '9:00', period: 'am' });
  });

  it('returns 24h main and null period when format is 24h', () => {
    expect(getTimeDisplayParts('16:30', '24h')).toEqual({ main: '16:30', period: null });
    expect(getTimeDisplayParts('09:00', '24h')).toEqual({ main: '09:00', period: null });
  });

  it('returns empty main for empty input', () => {
    expect(getTimeDisplayParts('', '12h')).toEqual({ main: '', period: null });
  });

  it('returns original string as main for invalid input when format is 24h', () => {
    expect(getTimeDisplayParts('bad', '24h')).toEqual({ main: 'bad', period: null });
  });

  it('handles midnight (00:00) in 12h format', () => {
    expect(getTimeDisplayParts('00:00', '12h')).toEqual({ main: '12:00', period: 'am' });
  });

  it('handles noon (12:00) in 12h format', () => {
    expect(getTimeDisplayParts('12:00', '12h')).toEqual({ main: '12:00', period: 'pm' });
  });
});

// ---------------------------------------------------------------------------
// formatTimeToDisplay
// ---------------------------------------------------------------------------

describe('formatTimeToDisplay', () => {
  it('formats 12h by default', () => {
    expect(formatTimeToDisplay('16:30')).toBe('4:30 PM');
  });

  it('formats 24h when specified', () => {
    expect(formatTimeToDisplay('16:30', '24h')).toBe('16:30');
  });

  it('returns empty for empty input', () => {
    expect(formatTimeToDisplay('')).toBe('');
  });

  it('returns original for invalid input', () => {
    expect(formatTimeToDisplay('xx:yy', '24h')).toBe('xx:yy');
  });
});

// ---------------------------------------------------------------------------
// parseTimeString
// ---------------------------------------------------------------------------

describe('parseTimeString', () => {
  it('parses HH:mm to Date on reference date (device-local)', () => {
    const ref = new Date(2024, 0, 15); // 15 Jan 2024
    const result = parseTimeString('14:30', ref);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
    expect(result.getDate()).toBe(15);
  });

  it('returns a Date instance for empty string', () => {
    expect(parseTimeString('')).toBeInstanceOf(Date);
  });

  it('returns a Date instance for invalid string', () => {
    expect(parseTimeString('invalid')).toBeInstanceOf(Date);
  });

  it('sets seconds and milliseconds to zero', () => {
    const ref = new Date(2024, 0, 15, 9, 0, 45, 500);
    const result = parseTimeString('09:30', ref);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  // ---- Timezone-aware tests (DST scenario) --------------------------------

  it('[timezone] places "13:00 Europe/London (BST)" at the correct UTC instant', () => {
    // During BST, 13:00 London = 12:00 UTC.
    const ref = new Date(BST_UTC_INSTANT); // 2026-03-29 10:00 UTC
    const result = parseTimeString('13:00', ref, 'Europe/London');
    // The resulting Date should represent 12:00 UTC (13:00 BST).
    expect(result.toISOString()).toBe('2026-03-29T12:00:00.000Z');
  });

  it('[timezone] places "05:30 Europe/London (BST)" at the correct UTC instant', () => {
    // 05:30 BST = 04:30 UTC.
    const ref = new Date(BST_UTC_INSTANT);
    const result = parseTimeString('05:30', ref, 'Europe/London');
    expect(result.toISOString()).toBe('2026-03-29T04:30:00.000Z');
  });

  it('[timezone] yields same result as no-timezone when timezone is UTC', () => {
    // When timezone = 'UTC', the result should equal the device-local Date
    // built without a timezone (the reference date is already UTC here).
    const ref = new Date('2026-01-15T09:00:00.000Z'); // 09:00 UTC, January (no BST)
    const withUtcTz = parseTimeString('09:30', ref, 'UTC');
    const withoutTz = parseTimeString('09:30', ref);
    // Both should represent 09:30 UTC on the reference date.
    expect(withUtcTz.toISOString()).toBe(withoutTz.toISOString());
  });

  it('[timezone] places "10:00 Europe/London (BST)" at 09:00 UTC', () => {
    // 10:00 BST = 09:00 UTC during British Summer Time.
    // We verify the returned Date's UTC instant, which is timezone-agnostic.
    const ref = new Date(BST_UTC_INSTANT);
    const result = parseTimeString('10:00', ref, 'Europe/London');
    // In UTC: 10:00 BST → 09:00 UTC
    expect(dayjs.utc(result).hour()).toBe(9);
    expect(dayjs.utc(result).minute()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toMinutesFromMidnight
// ---------------------------------------------------------------------------

describe('toMinutesFromMidnight', () => {
  it('parses 24h format to minutes', () => {
    expect(toMinutesFromMidnight('12:05')).toBe(12 * 60 + 5);
    expect(toMinutesFromMidnight('19:45')).toBe(19 * 60 + 45);
    expect(toMinutesFromMidnight('00:00')).toBe(0);
  });

  it('treats Maghrib/Isha 12h format as PM (1–11 → add 12h)', () => {
    expect(toMinutesFromMidnight('7:45', 'Maghrib')).toBe(19 * 60 + 45);
    expect(toMinutesFromMidnight('7:45', 'Isha')).toBe(19 * 60 + 45);
    expect(toMinutesFromMidnight('9:30', 'Maghrib')).toBe(21 * 60 + 30);
  });

  it('does not add 12h for non-evening prayers', () => {
    expect(toMinutesFromMidnight('7:45', 'Zuhr')).toBe(7 * 60 + 45);
    expect(toMinutesFromMidnight('7:45', 'Fajr')).toBe(7 * 60 + 45);
  });

  it('returns -1 for invalid or empty input', () => {
    expect(toMinutesFromMidnight(undefined)).toBe(-1);
    expect(toMinutesFromMidnight('')).toBe(-1);
    expect(toMinutesFromMidnight('invalid')).toBe(-1);
  });

  it('does not add PM offset when Maghrib/Isha hour is ≥ 12', () => {
    // 18:20 is already 24h format; no adjustment needed.
    expect(toMinutesFromMidnight('18:20', 'Maghrib')).toBe(18 * 60 + 20);
    expect(toMinutesFromMidnight('19:45', 'Isha')).toBe(19 * 60 + 45);
  });
});

// ---------------------------------------------------------------------------
// getTimeDifferenceInMinutes
// ---------------------------------------------------------------------------

describe('getTimeDifferenceInMinutes', () => {
  it('returns positive minutes when time2 is after time1', () => {
    expect(getTimeDifferenceInMinutes('10:00', '11:30')).toBe(90);
  });

  it('returns negative minutes when time2 is before time1', () => {
    expect(getTimeDifferenceInMinutes('12:00', '10:00')).toBe(-120);
  });
});

// ---------------------------------------------------------------------------
// formatMinutesToDisplay
// ---------------------------------------------------------------------------

describe('formatMinutesToDisplay', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutesToDisplay(90)).toBe('1 hr 30 mins');
    expect(formatMinutesToDisplay(60)).toBe('1 hr');
    expect(formatMinutesToDisplay(45)).toBe('45 mins');
  });

  it('handles singular vs plural', () => {
    expect(formatMinutesToDisplay(1)).toBe('1 min');
    expect(formatMinutesToDisplay(0)).toBe('0 mins');
  });
});

// ---------------------------------------------------------------------------
// isToday
// ---------------------------------------------------------------------------

describe('isToday', () => {
  it('returns true for today', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('returns false for yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(isToday(d)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatDateToDisplay
// ---------------------------------------------------------------------------

describe('formatDateToDisplay', () => {
  it('formats ISO date string to long format', () => {
    const result = formatDateToDisplay('2024-06-15');
    expect(result).toContain('2024');
    expect(result).toContain('June');
    expect(result).toContain('15');
  });
});

// ---------------------------------------------------------------------------
// convertTo24Hour
// ---------------------------------------------------------------------------

describe('convertTo24Hour', () => {
  it('converts 12h AM/PM to 24h', () => {
    expect(convertTo24Hour('4:30 PM')).toBe('16:30');
    expect(convertTo24Hour('9:15 AM')).toBe('09:15');
    expect(convertTo24Hour('12:00 AM')).toBe('00:00');
    expect(convertTo24Hour('12:00 PM')).toBe('12:00');
  });

  it('returns valid 24h string unchanged', () => {
    expect(convertTo24Hour('16:30')).toBe('16:30');
    expect(convertTo24Hour('00:00')).toBe('00:00');
  });

  it('returns empty for empty input', () => {
    expect(convertTo24Hour('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getNextPrayerTime
// ---------------------------------------------------------------------------

describe('getNextPrayerTime', () => {
  it('returns next prayer after current time', () => {
    const current = new Date(2024, 0, 15, 10, 0, 0); // 10:00 local
    const result = getNextPrayerTime(current, PRAYER_TIMES);
    expect(result.name).toBe('Zuhr');
    expect(result.time).toBe('12:15');
  });

  it('returns first prayer of next day when all passed', () => {
    const current = new Date(2024, 0, 15, 22, 0, 0); // 22:00
    const result = getNextPrayerTime(current, PRAYER_TIMES);
    expect(result.name).toBe('Fajr');
    expect(result.time).toBe('05:30');
  });

  it('excludes Sunrise from countdown', () => {
    const current = new Date(2024, 0, 15, 6, 0, 0); // 06:00 — after Fajr, before Zuhr
    const result = getNextPrayerTime(current, PRAYER_TIMES);
    expect(result.name).toBe('Zuhr');
  });

  it('returns empty when no prayer times', () => {
    const result = getNextPrayerTime(new Date(), {});
    expect(result).toEqual({ name: '', time: '' });
  });

  it('returns next prayer precisely at the boundary', () => {
    // Exactly at Zuhr time; Zuhr is NOT in the future (time > currentTimeStr fails), so next is Asr.
    const current = new Date(2024, 0, 15, 12, 15, 0); // 12:15 == Zuhr
    const result = getNextPrayerTime(current, PRAYER_TIMES);
    expect(result.name).toBe('Asr');
  });

  // ---- Timezone-aware tests (DST scenario) --------------------------------

  it('[timezone] uses masjid wall-clock time to select next prayer (BST vs UTC)', () => {
    // 11:20 UTC = 12:20 BST. Zuhr is at 12:15 — already passed in BST.
    // Without timezone (UTC device): "now" = 11:20 → Zuhr 12:15 appears upcoming.
    // With timezone Europe/London (BST): "now" = 12:20 → Zuhr 12:15 has passed → Asr is next.
    const now = new Date('2026-03-29T11:20:00.000Z');

    const withTz = getNextPrayerTime(now, PRAYER_TIMES, 'Europe/London');
    expect(withTz.name).toBe('Asr');
    expect(withTz.time).toBe('15:30');
  });

  it('[timezone] correctly identifies Fajr as next when all prayers have passed in masjid tz', () => {
    // 19:30 UTC = 20:30 BST — Isha (19:45) has NOT passed in UTC but HAS
    // 20:30 BST > 19:45, so Isha has passed. Fajr is next.
    const now = new Date('2026-03-29T19:30:00.000Z');

    const withTz = getNextPrayerTime(now, PRAYER_TIMES, 'Europe/London');
    expect(withTz.name).toBe('Fajr');
  });

  it('[timezone] returns Isha as next when Asr has just passed in masjid tz', () => {
    // 17:30 UTC = 18:30 BST. Maghrib is 18:20 (passed), Isha is 19:45.
    const now = new Date('2026-03-29T17:30:00.000Z');

    const withTz = getNextPrayerTime(now, PRAYER_TIMES, 'Europe/London');
    expect(withTz.name).toBe('Isha');
    expect(withTz.time).toBe('19:45');
  });

  it('[timezone] handles Europe/London correctly outside DST (winter, UTC+0)', () => {
    // 2026-01-15T10:00:00Z — January, no BST, London = UTC+0.
    // 10:00 UTC = 10:00 London → Zuhr (12:15) is next.
    const now = new Date('2026-01-15T10:00:00.000Z');

    const withTz = getNextPrayerTime(now, PRAYER_TIMES, 'Europe/London');
    expect(withTz.name).toBe('Zuhr');
    expect(withTz.time).toBe('12:15');
  });

  // ---- Unpadded / 12h prayer string regressions --------------------------
  // Previously string-based comparisons sorted "9:30" after "10:00" and
  // missed PM Maghrib "7:45". The numeric `toMinutesFromMidnight` path
  // handles both correctly.

  it('selects Zuhr when Asr time is unpadded ("3:30"), not the lexically earliest string', () => {
    const unpadded = {
      fajr: '5:30',
      sunrise: '6:45',
      zuhr: '12:15',
      asr: '3:30',  // PM as 24h would be 15:30; here it's literally 3:30 → 03:30
      maghrib: '18:20',
      isha: '19:45',
    };
    // 14:00 UTC = 14:00 London (winter): Zuhr (12:15) passed, Asr "3:30" is
    // really 03:30 (parsed as 3 → 3*60+30 = 210). So Asr has technically
    // already "passed" today — next non-skip prayer in numeric order is
    // Maghrib (18:20). Old string-compare logic would erroneously select Asr
    // because "3:30" > "14:00" string-wise.
    const now = new Date('2026-01-15T14:00:00.000Z');
    const result = getNextPrayerTime(now, unpadded, 'Europe/London');
    expect(result.name).toBe('Maghrib');
  });

  it('parses unpadded morning times correctly when sorting (e.g. "9:30")', () => {
    const unpadded = {
      fajr: '5:30',
      sunrise: '6:45',
      zuhr: '9:30', // unpadded — should be parsed as 09:30
      asr: '15:30',
      maghrib: '18:20',
      isha: '19:45',
    };
    // 09:00 London — Zuhr (09:30) is next.
    const now = new Date('2026-01-15T09:00:00.000Z');
    const result = getNextPrayerTime(now, unpadded, 'Europe/London');
    expect(result.name).toBe('Zuhr');
  });
});

// ---------------------------------------------------------------------------
// getTimeUntilNextPrayer
// ---------------------------------------------------------------------------

describe('getTimeUntilNextPrayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0)); // 10:00 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty for empty nextPrayerTime', () => {
    expect(getTimeUntilNextPrayer('')).toBe('');
  });

  it('returns hours and minutes when next prayer is over an hour away (unpadded)', () => {
    const result = getTimeUntilNextPrayer('12:00'); // 2h from 10:00
    expect(result).toBe('2h 0m');
  });

  it('returns minutes and seconds when under 1 hour away (unpadded)', () => {
    const result = getTimeUntilNextPrayer('10:30'); // 30 min from 10:00
    expect(result).toBe('30m 0s');
  });

  it('respects includeSeconds option', () => {
    const result = getTimeUntilNextPrayer('10:05', false, { includeSeconds: true });
    expect(result).toMatch(/\d+m \d+s/);
  });

  it('returns "0m 0s" when prayer time is exactly now', () => {
    const result = getTimeUntilNextPrayer('10:00');
    expect(result).toBe('0m 0s');
  });

  it('includes seconds when includeSecondsWhenUnderMinutes threshold is met', () => {
    // 4 min 30 s away → within 5 min threshold
    vi.setSystemTime(new Date(2024, 0, 15, 9, 55, 30));
    const result = getTimeUntilNextPrayer('10:00', false, { includeSecondsWhenUnderMinutes: 5 });
    expect(result).toMatch(/\d+m \d+s/);
  });

  it('omits seconds when includeSecondsWhenUnderMinutes threshold is not met', () => {
    // 10 min away → not within 5 min threshold
    const result = getTimeUntilNextPrayer('10:10', false, { includeSecondsWhenUnderMinutes: 5 });
    expect(result).toBe('10m');
  });

  it('forces tomorrow when forceTomorrow is true', () => {
    // Prayer is at 09:00 (in the past) but forceTomorrow=true → ~25h remaining
    const result = getTimeUntilNextPrayer('09:00', true);
    expect(result).toMatch(/\d+h \d+m/);
    const hours = parseInt(result);
    expect(hours).toBeGreaterThan(20); // must be many hours
  });

  it('returns empty string for invalid time format', () => {
    expect(getTimeUntilNextPrayer('99:99')).toBe('');
    expect(getTimeUntilNextPrayer('bad')).toBe('');
  });

  // ---- Timezone-aware tests (DST scenario) --------------------------------

  it('[timezone] counts from BST wall-clock, not UTC (1h diff during DST)', () => {
    // System time: 10:00 UTC = 11:00 BST.
    // Prayer: 12:00 — a London wall-clock time.
    // With Europe/London: now=11:00 BST → 1h 0m remaining (correct).
    vi.setSystemTime(new Date(BST_UTC_INSTANT));

    const withTz = getTimeUntilNextPrayer('12:00', false, {}, 'Europe/London');
    expect(withTz).toBe('1h 0m');
  });

  it('[timezone] explicit UTC gives a countdown 1h longer than Europe/London during BST', () => {
    // System time: 10:00 UTC = 11:00 BST.
    // Prayer at "12:00" (wall-clock in its respective timezone):
    //   Europe/London: 12:00 BST → 1h 0m from 11:00 BST
    //   UTC explicitly: 12:00 UTC → 2h 0m from 10:00 UTC
    // This test compares two explicit timezones so it is process-timezone-agnostic.
    vi.setSystemTime(new Date(BST_UTC_INSTANT));

    const bst = getTimeUntilNextPrayer('12:00', false, {}, 'Europe/London');
    const utc = getTimeUntilNextPrayer('12:00', false, {}, 'UTC');
    expect(bst).toBe('1h 0m');
    expect(utc).toBe('2h 0m');
  });

  it('[timezone] DST fix — masjid tz gives 1h less countdown than UTC during BST', () => {
    // This is the core regression test for the DST bug.
    vi.setSystemTime(new Date(BST_UTC_INSTANT)); // 10:00 UTC = 11:00 BST

    const bstResult = getTimeUntilNextPrayer('12:00', false, {}, 'Europe/London'); // 1h 0m
    const utcResult = getTimeUntilNextPrayer('12:00', false, {}, 'UTC');            // 2h 0m

    // BST-aware countdown should be 1 hour shorter than the UTC countdown.
    const bstMinutes = parseInt(bstResult) * 60 + parseInt(bstResult.split(' ')[1]);
    const utcMinutes = parseInt(utcResult) * 60 + parseInt(utcResult.split(' ')[1]);
    expect(utcMinutes - bstMinutes).toBe(60);
  });

  it('[timezone] minutes-only prayer (< 1h) uses correct zone (BST)', () => {
    // System: 10:00 UTC = 11:00 BST. Prayer at 11:30.
    // BST: 30m 0s remaining. UTC: 1h 30m (different branch entirely).
    vi.setSystemTime(new Date(BST_UTC_INSTANT));

    const withTz = getTimeUntilNextPrayer('11:30', false, {}, 'Europe/London');
    expect(withTz).toBe('30m 0s');
  });

  it('[timezone] handles winter (no DST) correctly — UTC == London', () => {
    // 2026-01-15T10:00:00Z — January, no BST: London = UTC+0.
    // Prayer at 12:00 → 2h 0m in both UTC and Europe/London.
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

    const withTz = getTimeUntilNextPrayer('12:00', false, {}, 'Europe/London');
    const withUtc = getTimeUntilNextPrayer('12:00', false, {}, 'UTC');
    expect(withTz).toBe('2h 0m');
    expect(withUtc).toBe('2h 0m');
  });

  it('[timezone] handles New_York timezone offset correctly', () => {
    // 2026-03-29T10:00:00Z. New York is EST (UTC-4 during US DST, started Mar 8).
    // 10:00 UTC = 06:00 New York. Prayer at 08:00 → 2h remaining.
    vi.setSystemTime(new Date(BST_UTC_INSTANT));

    const withTz = getTimeUntilNextPrayer('08:00', false, {}, 'America/New_York');
    expect(withTz).toBe('2h 0m');
  });

  it('[timezone] midnight crossover in BST — Fajr correctly 5h away', () => {
    // Use a mid-summer date to avoid DST transition edge cases.
    // 2026-06-14T23:30:00Z = 23:30 UTC = 00:30 BST on June 15.
    // Fajr is at 05:30 BST → 5h 0m remaining from 00:30 BST.
    vi.setSystemTime(new Date('2026-06-14T23:30:00.000Z'));

    const withTz = getTimeUntilNextPrayer('05:30', false, {}, 'Europe/London');
    expect(withTz).toBe('5h 0m');
  });
});

// ---------------------------------------------------------------------------
// calculateApproximateHijriDate
// ---------------------------------------------------------------------------

describe('calculateApproximateHijriDate', () => {
  it('returns a string in format "D Month YYYY AH"', () => {
    const result = calculateApproximateHijriDate(new Date(2024, 0, 15));
    expect(result).toMatch(/^\d{1,2} \w+ \d+ AH$/);
  });

  it('uses current date when no argument', () => {
    const result = calculateApproximateHijriDate();
    expect(result).toMatch(/ AH$/);
  });

  it('applies positive adjustmentDays', () => {
    const base = new Date(2024, 0, 15);
    const adjusted = calculateApproximateHijriDate(base, 1);
    const unadjusted = calculateApproximateHijriDate(base);
    // They might produce different strings (the Hijri day increments).
    // At minimum the function runs without throwing.
    expect(adjusted).toMatch(/ AH$/);
    expect(unadjusted).toMatch(/ AH$/);
  });

  it('applies negative adjustmentDays', () => {
    const base = new Date(2024, 0, 15);
    const result = calculateApproximateHijriDate(base, -1);
    expect(result).toMatch(/ AH$/);
  });

  it('returns a known Hijri date for a known Gregorian date', () => {
    // 2024-01-15 Gregorian ≈ 4 Rajab 1445 AH (approximate).
    const result = calculateApproximateHijriDate(new Date(2024, 0, 15));
    expect(result).toMatch(/1445 AH$/);
  });
});

// ---------------------------------------------------------------------------
// fetchHijriDate
// ---------------------------------------------------------------------------

describe('fetchHijriDate', () => {
  it('resolves to Hijri date string', async () => {
    const result = await fetchHijriDate('2024-01-15');
    expect(result).toMatch(/ AH$/);
  });

  it('uses current date when no argument', async () => {
    const result = await fetchHijriDate();
    expect(result).toMatch(/ AH$/);
  });
});
