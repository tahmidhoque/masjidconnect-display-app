import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { PrayerTimes, ScheduledPlaylistAssignment } from '@/api/models';
import {
  getNextBoundary,
  resolveActiveSchedule,
  resolvePrayerTimesForDate,
} from './scheduleResolver';

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
   * Day-filtered prayer windows: a non-empty daysOfWeek restricts the window
   * to those local days (JS 0=Sun … 6=Sat); empty applies every day.
   * 2026-06-19 is a Friday, 2026-06-16 a Tuesday, in Europe/London.
   */
  it('applies the optional daysOfWeek filter to PRAYER_WINDOW assignments', () => {
    const fridayOnlyWindow = makeAssignment({
      assignmentId: 'friday-evening',
      type: 'PRAYER_WINDOW',
      priority: 5,
      daysOfWeek: [5],
      startPrayer: 'MAGHRIB',
      endPrayer: 'ISHA',
      startPrayerAnchor: 'ADHAN',
      endPrayerAnchor: 'ADHAN',
      schedule: {
        id: 'friday-evening',
        name: 'Friday Evening',
        description: null,
        isDefault: false,
        isActive: true,
        items: [],
      },
    });
    const fallback = makeAssignment({
      assignmentId: 'default-1',
      type: 'DEFAULT',
    });

    const friday = resolveActiveSchedule(
      [fridayOnlyWindow, fallback],
      localInstant('2026-06-19', '19:00'),
      TZ,
      mockPrayerTimes,
    );
    expect(friday?.assignmentId).toBe('friday-evening');

    // Same in-window time on a Tuesday must fall through to the default.
    const tuesday = resolveActiveSchedule(
      [fridayOnlyWindow, fallback],
      localInstant('2026-06-16', '19:00'),
      TZ,
      mockPrayerTimes,
    );
    expect(tuesday?.assignmentId).toBe('default-1');
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

describe('resolvePrayerTimesForDate', () => {
  const day = (date: string, asr: string, maghrib: string): PrayerTimes => ({
    ...mockPrayerTimes,
    date,
    asr,
    maghrib,
  });

  it('picks the matching day from the multi-day { data: [...] } store shape', () => {
    const wrapped = {
      data: [
        day('2026-09-01', '17:48', '20:03'),
        day('2026-09-02', '17:46', '20:01'),
      ],
    } as PrayerTimes;
    const resolved = resolvePrayerTimesForDate(
      wrapped,
      localInstant('2026-09-02', '10:00'),
      TZ,
    );
    expect(resolved?.asr).toBe('17:46');
  });

  it('falls back to the first entry when no date matches', () => {
    const wrapped = {
      data: [day('2026-09-01', '17:48', '20:03')],
    } as PrayerTimes;
    const resolved = resolvePrayerTimesForDate(
      wrapped,
      localInstant('2026-09-05', '10:00'),
      TZ,
    );
    expect(resolved?.asr).toBe('17:48');
  });

  it('returns flat single-day objects unchanged', () => {
    expect(
      resolvePrayerTimesForDate(mockPrayerTimes, localInstant('2026-09-01', '10:00'), TZ),
    ).toBe(mockPrayerTimes);
  });
});

/**
 * Regression suite modelling a real customer configuration (masjid
 * cmqsb4uxf0000ks04ux5naoni, Europe/London) that surfaced two bugs:
 *
 * 1. Prayer times arrive as a multi-day array stored as `{ data: [...] }`;
 *    passing the wrapper into the window maths left every prayer boundary
 *    undefined, so PRAYER_WINDOW playlists never activated on the display.
 * 2. matchesRecurring accepted a "1=Sunday" day convention alongside the
 *    canonical JS 0=Sunday one, so every RECURRING rule also fired on the
 *    preceding day (Friday Jummah content showing on Thursday).
 *
 * Assignments (as stored in ScreenPlaylistAssignment):
 * - PRAYER_WINDOW "Friday After Asr"    p3  ASR adhan → MAGHRIB adhan (daily)
 * - RECURRING     "Friday After Jummah" p2  Fri 13:45–14:15
 * - RECURRING     "Daily Rotation"      p1  Thu 12:10–12:15
 * - RECURRING     "Friday Jummah"       p1  Fri 13:00–13:45
 * - DEFAULT       "Day to day"          p0
 */
describe('resolveActiveSchedule — complex customer schedule (regression)', () => {
  const weekPrayerTimes = {
    data: [
      { ...mockPrayerTimes, date: '2026-08-31', fajr: '04:24', zuhr: '13:10', asr: '17:49', maghrib: '20:05', isha: '21:00' },
      { ...mockPrayerTimes, date: '2026-09-01', fajr: '04:27', zuhr: '13:10', asr: '17:48', maghrib: '20:03', isha: '20:57' },
      { ...mockPrayerTimes, date: '2026-09-02', fajr: '04:29', zuhr: '13:10', asr: '17:46', maghrib: '20:01', isha: '20:55' },
      { ...mockPrayerTimes, date: '2026-09-03', fajr: '04:31', zuhr: '13:09', asr: '17:44', maghrib: '19:58', isha: '20:52' },
      { ...mockPrayerTimes, date: '2026-09-04', fajr: '04:33', zuhr: '13:09', asr: '17:42', maghrib: '19:56', isha: '20:50' },
    ],
  } as PrayerTimes;

  const assignments: ScheduledPlaylistAssignment[] = [
    makeAssignment({
      assignmentId: 'friday-after-asr',
      type: 'PRAYER_WINDOW',
      priority: 3,
      startPrayer: 'ASR',
      endPrayer: 'MAGHRIB',
      startPrayerAnchor: 'ADHAN',
      endPrayerAnchor: 'ADHAN',
      schedule: { id: 's-after-asr', name: 'Friday After Asr', description: null, isDefault: false, isActive: true, items: [] },
    }),
    makeAssignment({
      assignmentId: 'friday-after-jummah',
      type: 'RECURRING',
      priority: 2,
      daysOfWeek: [5],
      startTime: '13:45',
      endTime: '14:15',
      schedule: { id: 's-after-jummah', name: 'Friday After Jummah', description: null, isDefault: false, isActive: true, items: [] },
    }),
    makeAssignment({
      assignmentId: 'daily-rotation',
      type: 'RECURRING',
      priority: 1,
      daysOfWeek: [4],
      startTime: '12:10',
      endTime: '12:15',
      schedule: { id: 's-rotation', name: 'Daily Rotation', description: null, isDefault: false, isActive: true, items: [] },
    }),
    makeAssignment({
      assignmentId: 'friday-jummah',
      type: 'RECURRING',
      priority: 1,
      daysOfWeek: [5],
      startTime: '13:00',
      endTime: '13:45',
      schedule: { id: 's-jummah', name: 'Friday Jummah', description: null, isDefault: false, isActive: true, items: [] },
    }),
    makeAssignment({
      assignmentId: 'day-to-day',
      type: 'DEFAULT',
      priority: 0,
      schedule: { id: 's-default', name: 'Day to day', description: null, isDefault: true, isActive: true, items: [] },
    }),
  ];

  const activeAt = (date: string, time: string) =>
    resolveActiveSchedule(assignments, localInstant(date, time), TZ, weekPrayerTimes)
      ?.assignmentId;

  // 2026-09-04 is a Friday
  it('runs the full Friday timeline', () => {
    expect(activeAt('2026-09-04', '12:00')).toBe('day-to-day');
    expect(activeAt('2026-09-04', '13:00')).toBe('friday-jummah');
    expect(activeAt('2026-09-04', '13:44')).toBe('friday-jummah');
    expect(activeAt('2026-09-04', '13:45')).toBe('friday-after-jummah');
    expect(activeAt('2026-09-04', '14:14')).toBe('friday-after-jummah');
    expect(activeAt('2026-09-04', '14:15')).toBe('day-to-day');
    // Asr adhan 17:42 → Maghrib adhan 19:56 (prayer window)
    expect(activeAt('2026-09-04', '17:41')).toBe('day-to-day');
    expect(activeAt('2026-09-04', '17:42')).toBe('friday-after-asr');
    expect(activeAt('2026-09-04', '19:55')).toBe('friday-after-asr');
    expect(activeAt('2026-09-04', '19:56')).toBe('day-to-day');
  });

  it('activates the prayer window from the multi-day store shape (bug 1)', () => {
    // 2026-09-01 is a Tuesday: Asr 17:48 → Maghrib 20:03. Prayer windows apply
    // daily (no day-of-week support), so the window must activate here too.
    expect(activeAt('2026-09-01', '18:30')).toBe('friday-after-asr');
    expect(activeAt('2026-09-01', '17:47')).toBe('day-to-day');
    expect(activeAt('2026-09-01', '20:03')).toBe('day-to-day');
  });

  it('does not fire Friday playlists on Thursday (bug 2)', () => {
    // 2026-09-03 is a Thursday. Previously the "1=Sunday" convention check made
    // daysOfWeek [5] (Friday) match on Thursday as well.
    expect(activeAt('2026-09-03', '13:20')).toBe('day-to-day');
    expect(activeAt('2026-09-03', '13:50')).toBe('day-to-day');
    // Thursday's own rule still fires.
    expect(activeAt('2026-09-03', '12:12')).toBe('daily-rotation');
  });

  it('does not fire Thursday playlists on Wednesday (bug 2)', () => {
    // 2026-09-02 is a Wednesday; daysOfWeek [4] (Thursday) must not match.
    expect(activeAt('2026-09-02', '12:12')).toBe('day-to-day');
  });

  it('computes prayer-window boundaries from the multi-day store shape', () => {
    // Tuesday 17:00 → next boundary is Asr adhan 17:48 for that day.
    const next = getNextBoundary(
      assignments,
      localInstant('2026-09-01', '17:00'),
      TZ,
      weekPrayerTimes,
    );
    expect(next).not.toBeNull();
    expect(dayjs(next!).tz(TZ).format('YYYY-MM-DD HH:mm')).toBe('2026-09-01 17:48');
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
