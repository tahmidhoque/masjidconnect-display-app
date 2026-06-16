import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { PrayerTimes, ScheduledPlaylistAssignment } from '@/api/models';
import { getNextBoundary, resolveActiveSchedule } from './scheduleResolver';

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

function localInstant(date: string, time: string): Date {
  return dayjs.tz(`${date} ${time}`, TZ).toDate();
}

function makeAssignment(
  overrides: Partial<ScheduledPlaylistAssignment> & Pick<ScheduledPlaylistAssignment, 'assignmentId'>,
): ScheduledPlaylistAssignment {
  return {
    type: 'DEFAULT',
    priority: 0,
    daysOfWeek: [],
    startTime: null,
    endTime: null,
    startDate: null,
    endDate: null,
    isActive: true,
    schedule: {
      id: 'sched-1',
      name: 'Test playlist',
      description: null,
      isDefault: false,
      isActive: true,
      items: [],
    },
    ...overrides,
  } as ScheduledPlaylistAssignment;
}

describe('resolveActiveSchedule', () => {
  it('prefers PRAYER_WINDOW over RECURRING when both could match', () => {
    const now = localInstant('2026-06-16', '19:00');
    const prayerAssignment = makeAssignment({
      assignmentId: 'prayer-1',
      type: 'PRAYER_WINDOW',
      priority: 1,
      startPrayer: 'MAGHRIB',
      endPrayer: 'ISHA',
      startPrayerAnchor: 'ADHAN',
      endPrayerAnchor: 'ADHAN',
      schedule: {
        id: 'evening',
        name: 'Evening',
        description: null,
        isDefault: false,
        isActive: true,
        items: [],
      },
    });
    const recurringAssignment = makeAssignment({
      assignmentId: 'recurring-1',
      type: 'RECURRING',
      priority: 99,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      startTime: '00:00',
      endTime: '23:59',
      schedule: {
        id: 'all-day',
        name: 'All day',
        description: null,
        isDefault: false,
        isActive: true,
        items: [],
      },
    });

    const active = resolveActiveSchedule(
      [recurringAssignment, prayerAssignment],
      now,
      TZ,
      mockPrayerTimes,
    );

    expect(active?.assignmentId).toBe('prayer-1');
  });
});

describe('getNextBoundary', () => {
  it('returns the next prayer-window edge when assignments include PRAYER_WINDOW', () => {
    const now = localInstant('2026-06-16', '17:00');
    const assignments = [
      makeAssignment({
        assignmentId: 'prayer-1',
        type: 'PRAYER_WINDOW',
        startPrayer: 'MAGHRIB',
        endPrayer: 'ISHA',
        startPrayerAnchor: 'ADHAN',
        endPrayerAnchor: 'ADHAN',
      }),
    ];

    const next = getNextBoundary(assignments, now, TZ, mockPrayerTimes);
    expect(next).not.toBeNull();
    expect(dayjs(next!).tz(TZ).format('HH:mm')).toBe('18:20');
  });

  it('returns Isha end when already inside the prayer window', () => {
    const now = localInstant('2026-06-16', '19:00');
    const assignments = [
      makeAssignment({
        assignmentId: 'prayer-1',
        type: 'PRAYER_WINDOW',
        startPrayer: 'MAGHRIB',
        endPrayer: 'ISHA',
        startPrayerAnchor: 'ADHAN',
        endPrayerAnchor: 'ADHAN',
      }),
    ];

    const next = getNextBoundary(assignments, now, TZ, mockPrayerTimes);
    expect(next).not.toBeNull();
    expect(dayjs(next!).tz(TZ).format('HH:mm')).toBe('19:45');
  });

  it('ignores PRAYER_WINDOW boundaries when prayer times are missing', () => {
    const now = localInstant('2026-06-16', '17:00');
    const assignments = [
      makeAssignment({
        assignmentId: 'prayer-1',
        type: 'PRAYER_WINDOW',
        startPrayer: 'MAGHRIB',
        endPrayer: 'ISHA',
        startPrayerAnchor: 'ADHAN',
        endPrayerAnchor: 'ADHAN',
      }),
    ];

    expect(getNextBoundary(assignments, now, TZ, null)).toBeNull();
  });
});
