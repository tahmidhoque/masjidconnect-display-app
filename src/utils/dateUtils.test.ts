/**
 * Unit tests for dateUtils.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  calculateApproximateHijriDate,
  fetchHijriDate,
} from './dateUtils';

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
    // Implementation does not validate hour range; 25 % 12 = 1
    expect(formatTimeTo12Hour('25:00')).toBe('1:00 PM');
  });
});

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
});

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

describe('parseTimeString', () => {
  it('parses HH:mm to Date on reference date', () => {
    const ref = new Date(2024, 0, 15); // 15 Jan 2024
    const result = parseTimeString('14:30', ref);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
    expect(result.getDate()).toBe(15);
  });

  it('returns empty Date for empty string', () => {
    const result = parseTimeString('');
    expect(result).toBeInstanceOf(Date);
  });

  it('returns empty Date for invalid string', () => {
    const result = parseTimeString('invalid');
    expect(result).toBeInstanceOf(Date);
  });
});

describe('getTimeDifferenceInMinutes', () => {
  it('returns positive minutes when time2 is after time1', () => {
    expect(getTimeDifferenceInMinutes('10:00', '11:30')).toBe(90);
  });

  it('returns negative minutes when time2 is before time1', () => {
    expect(getTimeDifferenceInMinutes('12:00', '10:00')).toBe(-120);
  });
});

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

describe('formatDateToDisplay', () => {
  it('formats ISO date string to long format', () => {
    const result = formatDateToDisplay('2024-06-15');
    expect(result).toContain('2024');
    expect(result).toContain('June');
    expect(result).toContain('15');
  });
});

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

describe('getNextPrayerTime', () => {
  it('returns next prayer after current time', () => {
    const times = {
      fajr: '05:30',
      sunrise: '06:45',
      zuhr: '12:15',
      asr: '15:30',
      maghrib: '18:20',
      isha: '19:45',
    };
    const current = new Date(2024, 0, 15, 10, 0, 0); // 10:00
    const result = getNextPrayerTime(current, times);
    expect(result.name).toBe('Zuhr');
    expect(result.time).toBe('12:15');
  });

  it('returns first prayer of next day when all passed', () => {
    const times = {
      fajr: '05:30',
      sunrise: '06:45',
      zuhr: '12:15',
      asr: '15:30',
      maghrib: '18:20',
      isha: '19:45',
    };
    const current = new Date(2024, 0, 15, 22, 0, 0); // 22:00
    const result = getNextPrayerTime(current, times);
    expect(result.name).toBe('Fajr');
    expect(result.time).toBe('05:30');
  });

  it('excludes Sunrise from countdown', () => {
    const times = {
      fajr: '05:30',
      sunrise: '06:45',
      zuhr: '12:15',
      asr: '15:30',
      maghrib: '18:20',
      isha: '19:45',
    };
    const current = new Date(2024, 0, 15, 6, 0, 0); // 6:00 — after Fajr, before Zuhr
    const result = getNextPrayerTime(current, times);
    expect(result.name).toBe('Zuhr');
  });

  it('returns empty when no prayer times', () => {
    const result = getNextPrayerTime(new Date(), {});
    expect(result).toEqual({ name: '', time: '' });
  });
});

describe('getTimeUntilNextPrayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0)); // 10:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty for empty nextPrayerTime', () => {
    expect(getTimeUntilNextPrayer('')).toBe('');
  });

  it('returns hours and minutes when next prayer is later today', () => {
    const result = getTimeUntilNextPrayer('12:00'); // 2h from 10:00
    expect(result).toMatch(/\d{2}h \d{2}m/);
  });

  it('returns minutes and seconds when under 1 hour', () => {
    const result = getTimeUntilNextPrayer('10:30'); // 30 min from 10:00
    expect(result).toMatch(/\d{2}m \d{2}s/);
  });

  it('respects includeSeconds option', () => {
    const result = getTimeUntilNextPrayer('10:05', false, { includeSeconds: true });
    expect(result).toMatch(/\d{2}m \d{2}s/);
  });
});

describe('calculateApproximateHijriDate', () => {
  it('returns a string in format "D Month YYYY AH"', () => {
    const result = calculateApproximateHijriDate(new Date(2024, 0, 15));
    expect(result).toMatch(/^\d{1,2} \w+ \d+ AH$/);
  });

  it('uses current date when no argument', () => {
    const result = calculateApproximateHijriDate();
    expect(result).toMatch(/ AH$/);
  });
});

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
