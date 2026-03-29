/**
 * Unit tests for forbiddenPrayerTimes (makruh windows).
 *
 * The DST / timezone section validates that getCurrentForbiddenWindow correctly
 * interprets "now" in the masjid's IANA timezone rather than the device's
 * system timezone. This prevents a Raspberry Pi running in UTC from misreporting
 * forbidden-prayer windows during BST (UTC+1).
 *
 * Reference instant: 2026-03-29T05:50:00Z (UTC)
 *   • UTC wall clock      → 05:50
 *   • Europe/London (BST) → 06:50
 *
 * Forbidden window 1 runs from 05:30 (Fajr) to 07:00 (sunrise 06:45 + 15 min).
 * At 05:50 UTC (= 06:50 BST) both UTC and BST are inside that window.
 *
 * Edge case: 2026-03-29T06:10:00Z
 *   • UTC  → 06:10  (inside window 1: 05:30–07:00)
 *   • BST  → 07:10  (OUTSIDE window 1 — window ended at 07:00)
 * This exercises the bug where a UTC-process Pi would think it's forbidden when
 * the London masjid is no longer in a forbidden window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getForbiddenPrayerWindows, getCurrentForbiddenWindow } from './forbiddenPrayerTimes';
import type { PrayerTimes } from '@/api/models';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockPrayerTimes: PrayerTimes = {
  fajr: '05:30',
  sunrise: '06:45',
  zuhr: '12:15',
  asr: '15:30',
  maghrib: '18:20',
  isha: '19:45',
  fajrJamaat: '05:45',
  zuhrJamaat: '12:30',
  asrJamaat: '16:00',
  maghribJamaat: '18:25',
  ishaJamaat: '20:00',
};

// ---------------------------------------------------------------------------
// getForbiddenPrayerWindows
// ---------------------------------------------------------------------------

describe('getForbiddenPrayerWindows', () => {
  it('returns empty array for null', () => {
    expect(getForbiddenPrayerWindows(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(getForbiddenPrayerWindows(undefined)).toEqual([]);
  });

  it('returns three windows when all required times are present', () => {
    const windows = getForbiddenPrayerWindows(mockPrayerTimes);
    expect(windows).toHaveLength(3);
    expect(windows[0].label).toBe('After dawn until sun up');
    expect(windows[1].label).toBe('Sun at zenith');
    expect(windows[2].label).toBe('After Asr until sunset');
  });

  it('window 1 starts at Fajr', () => {
    const windows = getForbiddenPrayerWindows(mockPrayerTimes);
    expect(windows[0].start).toBe('05:30');
  });

  it('window 1 ends at sunrise + 15 minutes', () => {
    const windows = getForbiddenPrayerWindows(mockPrayerTimes);
    // Sunrise 06:45 + 15 min = 07:00
    expect(windows[0].end).toBe('07:00');
  });

  it('window 2 (zenith) starts 5 minutes before Zuhr', () => {
    const windows = getForbiddenPrayerWindows(mockPrayerTimes);
    // Zuhr 12:15 - 5 min = 12:10
    expect(windows[1].start).toBe('12:10');
    expect(windows[1].end).toBe('12:15');
  });

  it('window 3 spans Asr to Maghrib', () => {
    const windows = getForbiddenPrayerWindows(mockPrayerTimes);
    expect(windows[2].start).toBe('15:30');
    expect(windows[2].end).toBe('18:20');
  });

  it('skips window 1 when sunrise is missing', () => {
    const partial = { ...mockPrayerTimes, sunrise: undefined };
    const windows = getForbiddenPrayerWindows(partial as unknown as PrayerTimes);
    expect(windows.every((w) => w.label !== 'After dawn until sun up')).toBe(true);
  });

  it('skips window 1 when fajr is missing', () => {
    const partial = { ...mockPrayerTimes, fajr: undefined };
    const windows = getForbiddenPrayerWindows(partial as unknown as PrayerTimes);
    expect(windows.every((w) => w.label !== 'After dawn until sun up')).toBe(true);
  });

  it('skips window 2 when zuhr is missing', () => {
    const partial = { ...mockPrayerTimes, zuhr: undefined };
    const windows = getForbiddenPrayerWindows(partial as unknown as PrayerTimes);
    expect(windows.every((w) => w.label !== 'Sun at zenith')).toBe(true);
  });

  it('skips window 3 when asr is missing', () => {
    const partial = { ...mockPrayerTimes, asr: undefined };
    const windows = getForbiddenPrayerWindows(partial as unknown as PrayerTimes);
    expect(windows.every((w) => w.label !== 'After Asr until sunset')).toBe(true);
  });

  it('skips window 3 when maghrib is missing', () => {
    const partial = { ...mockPrayerTimes, maghrib: undefined };
    const windows = getForbiddenPrayerWindows(partial as unknown as PrayerTimes);
    expect(windows.every((w) => w.label !== 'After Asr until sunset')).toBe(true);
  });

  it('returns an empty array when prayer times object has no times', () => {
    const empty = {
      fajr: '', sunrise: '', zuhr: '', asr: '', maghrib: '', isha: '',
      fajrJamaat: '', zuhrJamaat: '', asrJamaat: '', maghribJamaat: '', ishaJamaat: '',
    } as PrayerTimes;
    const windows = getForbiddenPrayerWindows(empty);
    expect(windows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getCurrentForbiddenWindow — device-local (no timezone)
// ---------------------------------------------------------------------------

describe('getCurrentForbiddenWindow (device-local)', () => {
  it('returns null for null prayer times', () => {
    expect(getCurrentForbiddenWindow(null, new Date())).toBeNull();
  });

  it('returns null for undefined prayer times', () => {
    expect(getCurrentForbiddenWindow(undefined, new Date())).toBeNull();
  });

  it('returns null when current time is outside all windows', () => {
    // 10:00 — between the end of window 1 (07:00) and the start of window 2 (12:10)
    const now = new Date(2024, 0, 15, 10, 0, 0);
    expect(getCurrentForbiddenWindow(mockPrayerTimes, now)).toBeNull();
  });

  it('returns window 1 state at 06:00 (after Fajr, before sunrise+15)', () => {
    const now = new Date(2024, 0, 15, 6, 0, 0);
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result).not.toBeNull();
    expect(result?.isForbidden).toBe(true);
    expect(result?.reason).toBe('After dawn until sun up');
    expect(result?.endsAt).toBe('07:00');
  });

  it('returns window 1 state at exactly Fajr time (05:30)', () => {
    const now = new Date(2024, 0, 15, 5, 30, 0);
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result?.reason).toBe('After dawn until sun up');
  });

  it('returns null at exactly window 1 end time (07:00 — exclusive upper bound)', () => {
    const now = new Date(2024, 0, 15, 7, 0, 0);
    expect(getCurrentForbiddenWindow(mockPrayerTimes, now)).toBeNull();
  });

  it('returns window 2 (zenith) state at 12:10', () => {
    const now = new Date(2024, 0, 15, 12, 10, 0);
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe('Sun at zenith');
    expect(result?.endsAt).toBe('12:15');
  });

  it('returns null just before zenith window starts (12:09)', () => {
    const now = new Date(2024, 0, 15, 12, 9, 0);
    expect(getCurrentForbiddenWindow(mockPrayerTimes, now)).toBeNull();
  });

  it('returns window 3 (Asr–Maghrib) state at 16:00', () => {
    const now = new Date(2024, 0, 15, 16, 0, 0);
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe('After Asr until sunset');
    expect(result?.endsAt).toBe('18:20');
  });

  it('returns null at Maghrib time (18:20 — exclusive upper bound)', () => {
    const now = new Date(2024, 0, 15, 18, 20, 0);
    expect(getCurrentForbiddenWindow(mockPrayerTimes, now)).toBeNull();
  });

  it('returns null after Isha time', () => {
    const now = new Date(2024, 0, 15, 21, 0, 0);
    expect(getCurrentForbiddenWindow(mockPrayerTimes, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCurrentForbiddenWindow — timezone-aware (DST scenario)
// ---------------------------------------------------------------------------

describe('getCurrentForbiddenWindow (timezone-aware, DST)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[timezone] window 1 correctly detected at 06:00 BST (05:00 UTC)', () => {
    // 05:00 UTC = 06:00 BST — inside forbidden window 1 (05:30–07:00) in BST.
    // This would be 05:00 in UTC, which is BEFORE Fajr (05:30), so without
    // the timezone fix it would report "not forbidden".
    const now = new Date('2026-03-29T05:00:00.000Z');
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    expect(result?.reason).toBe('After dawn until sun up');
  });

  it('[timezone] window 1 NOT detected when UTC misidentifies time (edge-of-window bug)', () => {
    // THE CORE DST BUG:
    // 06:10 UTC = 07:10 BST — window 1 ENDS at 07:00 BST, so 07:10 is outside.
    // A UTC device would see 06:10 and incorrectly report "After dawn until sun up".
    // With the timezone fix (Europe/London), 07:10 BST is correctly outside the window.
    const now = new Date('2026-03-29T06:10:00.000Z');

    const withTz = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    expect(withTz).toBeNull(); // Correctly NOT forbidden at 07:10 BST

    // Without timezone (UTC): 06:10 is inside 05:30–07:00 → incorrectly forbidden.
    const withUtc = getCurrentForbiddenWindow(mockPrayerTimes, now, 'UTC');
    expect(withUtc?.reason).toBe('After dawn until sun up'); // Shows the UTC bug
  });

  it('[timezone] window 3 correctly detected at 16:00 BST (15:00 UTC)', () => {
    // 15:00 UTC = 16:00 BST — between Asr (15:30) and Maghrib (18:20) in BST.
    // UTC reading: 15:00 is also between Asr and Maghrib. (Same result here.)
    const now = new Date('2026-03-29T15:00:00.000Z');
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    expect(result?.reason).toBe('After Asr until sunset');
    expect(result?.endsAt).toBe('18:20');
  });

  it('[timezone] window 3 not detected before Asr in BST', () => {
    // 14:00 UTC = 15:00 BST. Asr starts at 15:30 BST → not yet forbidden.
    const now = new Date('2026-03-29T14:00:00.000Z');
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    expect(result).toBeNull();
  });

  it('[timezone] zenith window detected in BST', () => {
    // Zenith window: 12:10–12:15 BST = 11:10–11:15 UTC.
    const now = new Date('2026-03-29T11:12:00.000Z'); // 12:12 BST
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    expect(result?.reason).toBe('Sun at zenith');
  });

  it('[timezone] zenith window not detected 2 minutes before its BST start', () => {
    // Window starts at 12:10 BST = 11:10 UTC. At 11:08 UTC (12:08 BST): not forbidden.
    const now = new Date('2026-03-29T11:08:00.000Z');
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    expect(result).toBeNull();
  });

  it('[timezone] winter (no DST) — Europe/London == UTC, same result', () => {
    // January: no BST offset. UTC == London.
    const now = new Date('2026-01-15T06:00:00.000Z'); // 06:00 UTC = 06:00 London
    const withTz = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    const withUtc = getCurrentForbiddenWindow(mockPrayerTimes, now, 'UTC');
    // Both should agree — window 1 (05:30–07:00), so 06:00 is inside.
    expect(withTz?.reason).toBe('After dawn until sun up');
    expect(withUtc?.reason).toBe('After dawn until sun up');
  });

  it('[timezone] returns null outside all windows in BST', () => {
    // 08:00 BST (07:00 UTC) — between window 1 end (07:00) and window 2 start (12:10).
    const now = new Date('2026-03-29T07:30:00.000Z'); // 08:30 BST
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now, 'Europe/London');
    expect(result).toBeNull();
  });
});
