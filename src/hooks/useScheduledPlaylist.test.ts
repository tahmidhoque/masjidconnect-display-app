import { describe, it, expect } from 'vitest';
import {
  buildPlaylistsBoundaryKey,
  buildPlaylistsContentRevision,
} from './useScheduledPlaylist';
import type { ScheduledPlaylistAssignment } from '@/api/models';

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
        schedule: {
          id: 'sched-1',
          name: 'Main',
          items: [{ id: 'item-1', contentItemId: 'c1', order: 0 }],
        },
      }),
    ];
    const withNewItem = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: {
          id: 'sched-1',
          name: 'Main',
          items: [
            { id: 'item-1', contentItemId: 'c1', order: 0 },
            { id: 'item-2', contentItemId: 'c2', order: 1 },
          ],
        },
      }),
    ];
    const editedItem = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: {
          id: 'sched-1',
          name: 'Main',
          items: [{ id: 'item-1', contentItemId: 'c99', order: 0 }],
        },
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
        schedule: {
          id: 'sched-1',
          name: 'Main',
          items: [{ id: 'item-1', contentItemId: 'c1', order: 0 }],
        },
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
        schedule: {
          id: 'sched-1',
          name: 'Main',
          items: [{ id: 'item-1' }],
        },
      }),
    ];
    const after = [
      makeAssignment({
        assignmentId: 'a1',
        schedule: {
          id: 'sched-1',
          name: 'Main',
          items: [{ id: 'item-1' }, { id: 'item-2' }],
        },
      }),
    ];
    expect(buildPlaylistsBoundaryKey(before)).toBe(buildPlaylistsBoundaryKey(after));
  });
});
