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

  /**
   * Regression: admin stores HH:mm in masjid-local time. During BST (UTC+1),
   * comparing against UTC shifts the window by an hour and schedules appear
   * not to come into effect at the configured local start.
   * 2026-07-30 is a Thursday (JS day 4 / ISO 4) in Europe/London BST.
   */
  it('matches RECURRING windows in masjid-local time during BST', () => {
    const recurring = makeAssignment({
      assignmentId: 'daily-rotation',
      type: 'RECURRING',
      priority: 1,
      daysOfWeek: [4], // Thursday (JS Sun=0)
      startTime: '10:10',
      endTime: '14:00',
      schedule: {
        id: 'rotation',
        name: 'Daily Rotation',
        description: null,
        isDefault: false,
        isActive: true,
        items: [],
      },
    });
    const fallback = makeAssignment({
      assignmentId: 'default',
      type: 'DEFAULT',
      priority: 0,
      schedule: {
        id: 'day-to-day',
        name: 'Day to day',
        description: null,
        isDefault: true,
        isActive: true,
        items: [],
      },
    });

    // London 10:15 = UTC 09:15 — must be active in local time (would miss if using UTC)
    expect(
      resolveActiveSchedule([recurring, fallback], localInstant('2026-07-30', '10:15'), TZ)?.assignmentId,
    ).toBe('daily-rotation');

    // London 13:59 still inside; 14:00 is exclusive end
    expect(
      resolveActiveSchedule([recurring, fallback], localInstant('2026-07-30', '13:59'), TZ)?.assignmentId,
    ).toBe('daily-rotation');
    expect(
      resolveActiveSchedule([recurring, fallback], localInstant('2026-07-30', '14:00'), TZ)?.assignmentId,
    ).toBe('default');

    // Before start → default (UTC comparison would falsely activate from ~11:10)
    expect(
      resolveActiveSchedule([recurring, fallback], localInstant('2026-07-30', '10:05'), TZ)?.assignmentId,
    ).toBe('default');
  });

  it('matches cross-midnight RECURRING windows using the masjid-local calendar day', () => {
    // Friday night into Saturday morning in BST
    const overnight = makeAssignment({
      assignmentId: 'overnight',
      type: 'RECURRING',
      priority: 1,
      daysOfWeek: [5], // Friday (JS)
      startTime: '22:00',
      endTime: '02:00',
    });
    const fallback = makeAssignment({
      assignmentId: 'default',
      type: 'DEFAULT',
      priority: 0,
    });

    expect(
      resolveActiveSchedule([overnight, fallback], localInstant('2026-07-31', '23:00'), TZ)?.assignmentId,
    ).toBe('overnight');
    // Saturday 01:00 still belongs to Friday's window
    expect(
      resolveActiveSchedule([overnight, fallback], localInstant('2026-08-01', '01:00'), TZ)?.assignmentId,
    ).toBe('overnight');
    expect(
      resolveActiveSchedule([overnight, fallback], localInstant('2026-08-01', '02:00'), TZ)?.assignmentId,
    ).toBe('default');
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

  it('returns the next RECURRING boundary in masjid-local time during BST', () => {
    const now = localInstant('2026-07-30', '09:00');
    const assignments = [
      makeAssignment({
        assignmentId: 'daily-rotation',
        type: 'RECURRING',
        priority: 1,
        daysOfWeek: [4],
        startTime: '10:10',
        endTime: '14:00',
      }),
    ];

    const next = getNextBoundary(assignments, now, TZ);
    expect(next).not.toBeNull();
    // Must be London 10:10, not UTC 10:10 (= London 11:10)
    expect(dayjs(next!).tz(TZ).format('YYYY-MM-DD HH:mm')).toBe('2026-07-30 10:10');
  });
});
