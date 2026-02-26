/**
 * Unit tests for forbiddenPrayerTimes (makruh windows).
 */

import { describe, it, expect } from 'vitest';
import { getForbiddenPrayerWindows, getCurrentForbiddenWindow } from './forbiddenPrayerTimes';
import type { PrayerTimes } from '@/api/models';

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

describe('getForbiddenPrayerWindows', () => {
  it('returns empty array for null or undefined', () => {
    expect(getForbiddenPrayerWindows(null)).toEqual([]);
    expect(getForbiddenPrayerWindows(undefined)).toEqual([]);
  });

  it('returns three windows when all required times present', () => {
    const windows = getForbiddenPrayerWindows(mockPrayerTimes);
    expect(windows.length).toBe(3);
    expect(windows[0].label).toBe('After dawn until sun up');
    expect(windows[0].start).toBe('05:30');
    expect(windows[1].label).toBe('Sun at zenith');
    expect(windows[2].label).toBe('After Asr until sunset');
    expect(windows[2].start).toBe('15:30');
    expect(windows[2].end).toBe('18:20');
  });

  it('first window end is sunrise + 15 min', () => {
    const windows = getForbiddenPrayerWindows(mockPrayerTimes);
    expect(windows[0].end).toBe('07:00'); // 06:45 + 15 min
  });

  it('skips windows when times missing', () => {
    const partial = { ...mockPrayerTimes, sunrise: undefined };
    const windows = getForbiddenPrayerWindows(partial as PrayerTimes);
    expect(windows.length).toBeLessThan(3);
  });
});

describe('getCurrentForbiddenWindow', () => {
  it('returns null when no windows', () => {
    expect(getCurrentForbiddenWindow(null, new Date())).toBeNull();
    expect(getCurrentForbiddenWindow(undefined, new Date())).toBeNull();
  });

  it('returns null when current time is outside all windows', () => {
    // 10:00 is between sunrise+15 and zenith
    const now = new Date(2024, 0, 15, 10, 0, 0);
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result).toBeNull();
  });

  it('returns state when current time is inside a window', () => {
    // 06:00 is after Fajr (05:30) and before sunrise+15 (07:00)
    const now = new Date(2024, 0, 15, 6, 0, 0);
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result).not.toBeNull();
    expect(result?.isForbidden).toBe(true);
    expect(result?.reason).toBe('After dawn until sun up');
    expect(result?.endsAt).toBe('07:00');
  });

  it('returns zenith window when between zenith start and Zuhr', () => {
    // 12:10 is between 12:10 (Zuhr-5) and 12:15 (Zuhr)
    const now = new Date(2024, 0, 15, 12, 10, 0);
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe('Sun at zenith');
  });

  it('returns Asr–Maghrib window when in that range', () => {
    const now = new Date(2024, 0, 15, 16, 0, 0); // 16:00 between Asr 15:30 and Maghrib 18:20
    const result = getCurrentForbiddenWindow(mockPrayerTimes, now);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe('After Asr until sunset');
    expect(result?.endsAt).toBe('18:20');
  });
});
