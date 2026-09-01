import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { PrayerTimes } from '@/api/models';
import {
  getPrayerWindowBoundaryMinutes,
  getUpcomingPrayerWindowBoundaries,
  isWithinPrayerWindow,
  matchesPrayerWindowDays,
} from './prayerWindowSchedule';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Europe/London';

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

const maghribToIshaWindow = {
  startPrayer: 'MAGHRIB' as const,
  endPrayer: 'ISHA' as const,
  startPrayerAnchor: 'ADHAN' as const,
  endPrayerAnchor: 'ADHAN' as const,
  startPrayerOffsetMinutes: 0,
  endPrayerOffsetMinutes: 0,
};

function localInstant(date: string, time: string): Date {
  return dayjs.tz(`${date} ${time}`, TZ).toDate();
}

describe('getPrayerWindowBoundaryMinutes', () => {
  it('resolves adhan and jamaat anchors', () => {
    expect(
      getPrayerWindowBoundaryMinutes('MAGHRIB', 'ADHAN', 0, mockPrayerTimes),
    ).toBe(18 * 60 + 20);
    expect(
      getPrayerWindowBoundaryMinutes('MAGHRIB', 'JAMAAT', 0, mockPrayerTimes),
    ).toBe(18 * 60 + 25);
  });

  it('applies minute offsets', () => {
    expect(
      getPrayerWindowBoundaryMinutes('MAGHRIB', 'ADHAN', 10, mockPrayerTimes),
    ).toBe(18 * 60 + 30);
  });
});

describe('isWithinPrayerWindow', () => {
  it('is true between Maghrib and Isha adhan', () => {
    const now = localInstant('2026-06-16', '19:00');
    expect(isWithinPrayerWindow(now, maghribToIshaWindow, mockPrayerTimes, TZ)).toBe(
      true,
    );
  });

  it('is false before Maghrib', () => {
    const now = localInstant('2026-06-16', '17:00');
    expect(isWithinPrayerWindow(now, maghribToIshaWindow, mockPrayerTimes, TZ)).toBe(
      false,
    );
  });

  it('is false after Isha', () => {
    const now = localInstant('2026-06-16', '20:30');
    expect(isWithinPrayerWindow(now, maghribToIshaWindow, mockPrayerTimes, TZ)).toBe(
      false,
    );
  });
});

describe('matchesPrayerWindowDays', () => {
  // 2026-06-16 is a Tuesday; 2026-06-19 is a Friday; 2026-06-20 is a Saturday.
  const ishaToFajrWindow = {
    startPrayer: 'ISHA' as const,
    endPrayer: 'FAJR' as const,
    startPrayerAnchor: 'ADHAN' as const,
    endPrayerAnchor: 'ADHAN' as const,
    startPrayerOffsetMinutes: 0,
    endPrayerOffsetMinutes: 0,
  };

  it('applies every day when daysOfWeek is empty or missing', () => {
    const now = localInstant('2026-06-16', '19:00');
    expect(
      matchesPrayerWindowDays(now, maghribToIshaWindow, [], mockPrayerTimes, TZ),
    ).toBe(true);
    expect(
      matchesPrayerWindowDays(now, maghribToIshaWindow, undefined, mockPrayerTimes, TZ),
    ).toBe(true);
  });

  it('matches only the configured days (JS 0=Sun … 6=Sat)', () => {
    const friday = localInstant('2026-06-19', '19:00');
    const tuesday = localInstant('2026-06-16', '19:00');
    expect(
      matchesPrayerWindowDays(friday, maghribToIshaWindow, [5], mockPrayerTimes, TZ),
    ).toBe(true);
    expect(
      matchesPrayerWindowDays(tuesday, maghribToIshaWindow, [5], mockPrayerTimes, TZ),
    ).toBe(false);
  });

  it('attributes the after-midnight tail of an overnight window to the previous day', () => {
    // Friday Isha → Saturday Fajr: Saturday 01:00 still belongs to Friday.
    const saturdayNight = localInstant('2026-06-20', '01:00');
    expect(
      matchesPrayerWindowDays(saturdayNight, ishaToFajrWindow, [5], mockPrayerTimes, TZ),
    ).toBe(true);
    expect(
      matchesPrayerWindowDays(saturdayNight, ishaToFajrWindow, [6], mockPrayerTimes, TZ),
    ).toBe(false);
    // Before midnight the window belongs to its own day.
    const fridayEvening = localInstant('2026-06-19', '20:30');
    expect(
      matchesPrayerWindowDays(fridayEvening, ishaToFajrWindow, [5], mockPrayerTimes, TZ),
    ).toBe(true);
  });

  it('accepts 7 as an ISO Sunday alias', () => {
    // 2026-06-21 is a Sunday.
    const sunday = localInstant('2026-06-21', '19:00');
    expect(
      matchesPrayerWindowDays(sunday, maghribToIshaWindow, [7], mockPrayerTimes, TZ),
    ).toBe(true);
  });
});

describe('getUpcomingPrayerWindowBoundaries', () => {
  it('returns Maghrib start when now is before the window', () => {
    const now = localInstant('2026-06-16', '17:00');
    const boundaries = getUpcomingPrayerWindowBoundaries(
      maghribToIshaWindow,
      mockPrayerTimes,
      now,
      TZ,
    );
    const labels = boundaries.map((d) => dayjs(d).tz(TZ).format('HH:mm'));
    expect(labels).toContain('18:20');
    expect(labels).toContain('19:45');
  });

  it('returns Isha end as the nearest boundary when now is inside the window', () => {
    const now = localInstant('2026-06-16', '19:00');
    const boundaries = getUpcomingPrayerWindowBoundaries(
      maghribToIshaWindow,
      mockPrayerTimes,
      now,
      TZ,
    );
    const future = boundaries
      .filter((d) => d.getTime() > now.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    expect(future.length).toBeGreaterThan(0);
    expect(dayjs(future[0]).tz(TZ).format('HH:mm')).toBe('19:45');
  });

  it('includes tomorrow start after today window ends', () => {
    const now = localInstant('2026-06-16', '21:00');
    const boundaries = getUpcomingPrayerWindowBoundaries(
      maghribToIshaWindow,
      mockPrayerTimes,
      now,
      TZ,
    );
    const tomorrowStart = dayjs(now).tz(TZ).add(1, 'day').hour(18).minute(20).second(0);
    expect(boundaries.some((d) => d.getTime() === tomorrowStart.toDate().getTime())).toBe(
      true,
    );
  });
});
