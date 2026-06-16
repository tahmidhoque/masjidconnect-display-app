import { describe, it, expect } from 'vitest';
import {
  buildPlaylistsBoundaryKey,
  buildPlaylistsContentRevision,
  buildPrayerTimesBoundaryKey,
} from './useScheduledPlaylist';
import type { ScheduledPlaylistAssignment, ScheduleItem, PrayerTimes } from '@/api/models';

function makeScheduleItem(id: string, contentId: string, order: number): ScheduleItem {
  return {
    id,
    order,
    contentItem: {
      id: contentId,
      type: 'CUSTOM',
      title: 'Test item',
      content: {},
      duration: 10,
    },
  };
}

function makeSchedule(
  overrides: Partial<ScheduledPlaylistAssignment['schedule']> &
    Pick<ScheduledPlaylistAssignment['schedule'], 'id' | 'name' | 'items'>,
): ScheduledPlaylistAssignment['schedule'] {
  return {
    description: null,
    isDefault: true,
    isActive: true,
    ...overrides,
  };
}

function makeAssignment(
  overrides: Partial<ScheduledPlaylistAssignment> & {
    assignmentId: string;
    schedule: ScheduledPlaylistAssignment['schedule'];
  },
): ScheduledPlaylistAssignment {
  return {
    type: 'DEFAULT',
    priority: 0,
    isActive: true,
    daysOfWeek: [],
    startTime: null,
    endTime: null,
    startDate: null,
    endDate: null,
    ...overrides,
  } as ScheduledPlaylistAssignment;
}

describe('buildPlaylistsContentRevision', () => {
  it('changes when playlist items are added or edited', () => {
    const base = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Main',
          items: [makeScheduleItem('item-1', 'c1', 0)],
        }),
      }),
    ];
    const withNewItem = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Main',
          items: [
            makeScheduleItem('item-1', 'c1', 0),
            makeScheduleItem('item-2', 'c2', 1),
          ],
        }),
      }),
    ];
    const editedItem = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Main',
          items: [makeScheduleItem('item-1', 'c99', 0)],
        }),
      }),
    ];

    const baseKey = buildPlaylistsContentRevision(base);
    expect(buildPlaylistsContentRevision(withNewItem)).not.toBe(baseKey);
    expect(buildPlaylistsContentRevision(editedItem)).not.toBe(baseKey);
  });

  it('is stable when only assignment metadata unrelated to items changes', () => {
    const playlists = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Main',
          items: [makeScheduleItem('item-1', 'c1', 0)],
        }),
      }),
    ];
    expect(buildPlaylistsContentRevision(playlists)).toBe(
      buildPlaylistsContentRevision([...playlists]),
    );
  });
});

describe('buildPlaylistsBoundaryKey', () => {
  it('does not change when only playlist items change', () => {
    const before = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Main',
          items: [makeScheduleItem('item-1', 'c1', 0)],
        }),
      }),
    ];
    const after = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Main',
          items: [makeScheduleItem('item-1', 'c1', 0), makeScheduleItem('item-2', 'c2', 1)],
        }),
      }),
    ];
    expect(buildPlaylistsBoundaryKey(before)).toBe(buildPlaylistsBoundaryKey(after));
  });

  it('changes when prayer-window fields change', () => {
    const base = [
      makeAssignment({
        assignmentId: 'a1',
        type: 'PRAYER_WINDOW',
        startPrayer: 'MAGHRIB',
        endPrayer: 'ISHA',
        startPrayerAnchor: 'ADHAN',
        endPrayerAnchor: 'ADHAN',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Evening',
          items: [],
        }),
      }),
    ];
    const changedEnd = [
      makeAssignment({
        assignmentId: 'a1',
        type: 'PRAYER_WINDOW',
        startPrayer: 'MAGHRIB',
        endPrayer: 'FAJR',
        startPrayerAnchor: 'ADHAN',
        endPrayerAnchor: 'ADHAN',
        schedule: makeSchedule({
          id: 'sched-1',
          name: 'Evening',
          items: [],
        }),
      }),
    ];
    expect(buildPlaylistsBoundaryKey(base)).not.toBe(
      buildPlaylistsBoundaryKey(changedEnd),
    );
  });
});

describe('buildPrayerTimesBoundaryKey', () => {
  const prayerTimes: PrayerTimes = {
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

  it('changes when jamaat times change', () => {
    const baseKey = buildPrayerTimesBoundaryKey(prayerTimes);
    const updated = buildPrayerTimesBoundaryKey({
      ...prayerTimes,
      maghribJamaat: '18:30',
    });
    expect(updated).not.toBe(baseKey);
  });

  it('is empty when prayer times are absent', () => {
    expect(buildPrayerTimesBoundaryKey(null)).toBe('');
  });
});
