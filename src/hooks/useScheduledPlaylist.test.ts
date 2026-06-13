import { describe, it, expect } from 'vitest';
import {
  buildPlaylistsBoundaryKey,
  buildPlaylistsContentRevision,
} from './useScheduledPlaylist';
import type { ScheduledPlaylistAssignment, ScheduleItem } from '@/api/models';

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
    assignmentId: overrides.assignmentId,
    type: overrides.type ?? 'DEFAULT',
    isActive: overrides.isActive ?? true,
    schedule: overrides.schedule,
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
});
