/**
 * Unit tests for jamaat-in-progress library media resolution.
 */

import { describe, expect, it } from 'vitest';
import type { DisplaySettings, Schedule, ScheduledPlaylistAssignment } from '@/api/models';
import {
  extractJamaatInProgressMedia,
  itemMatchesContentId,
  resolveJamaatInProgressMedia,
} from './jamaatInProgressContent';

const baseSettings = (): DisplaySettings => ({
  ramadanMode: 'auto',
  isRamadanActive: false,
  timeFormat: '12h',
  showImsak: false,
  showTomorrowJamaat: false,
  imsakOffset: 10,
  hijriDateAdjustment: 0,
  minutesAfterJamaatUntilNextPrayer: 10,
  defaultJamaatInProgressMinutes: 10,
  minutesAfterJamaatUntilNextPrayerBySalah: {},
  jamaatInProgressMode: 'content',
  jamaatInProgressContentId: 'poster-1',
});

const posterItem = {
  id: 'sched-row-1',
  contentItemId: 'poster-1',
  type: 'MEDIA_SLIDE',
  title: 'Salaah in progress',
  content: {
    mediaUrl: 'https://cdn.example.com/salaah.webp',
    mimeType: 'image/webp',
    mediaFit: 'cover',
  },
  contentItem: {
    id: 'poster-1',
    type: 'MEDIA_SLIDE',
    title: 'Salaah in progress',
    content: {
      mediaUrl: 'https://cdn.example.com/salaah.webp',
      mimeType: 'image/webp',
      mediaFit: 'cover',
    },
  },
};

describe('itemMatchesContentId', () => {
  it('matches contentItem.id and contentItemId', () => {
    expect(itemMatchesContentId(posterItem, 'poster-1')).toBe(true);
    expect(itemMatchesContentId(posterItem, 'sched-row-1')).toBe(true);
    expect(itemMatchesContentId(posterItem, 'missing')).toBe(false);
  });
});

describe('extractJamaatInProgressMedia', () => {
  it('extracts a poster image', () => {
    const media = extractJamaatInProgressMedia(posterItem);
    expect(media).toEqual({
      kind: 'image',
      url: 'https://cdn.example.com/salaah.webp',
      title: 'Salaah in progress',
      fit: 'cover',
      muted: true,
    });
  });

  it('extracts a looping video clip', () => {
    const media = extractJamaatInProgressMedia({
      type: 'VIDEO',
      title: 'Khutbah slide',
      content: {
        videoUrl: 'https://cdn.example.com/clip.mp4',
        mimeType: 'video/mp4',
        muted: true,
      },
    });
    expect(media?.kind).toBe('video');
    expect(media?.url).toBe('https://cdn.example.com/clip.mp4');
  });

  it('returns null for non-media library types', () => {
    expect(
      extractJamaatInProgressMedia({
        type: 'ANNOUNCEMENT',
        contentItem: { id: 'ann-1', type: 'ANNOUNCEMENT', content: {} },
      }),
    ).toBeNull();
  });
});

describe('resolveJamaatInProgressMedia', () => {
  it('resolves a playlist poster when mode is content', () => {
    const playlists = [
      {
        assignmentId: 'a1',
        type: 'DEFAULT',
        priority: 0,
        daysOfWeek: [],
        startTime: null,
        endTime: null,
        startDate: null,
        endDate: null,
        isActive: true,
        schedule: {
          id: 's1',
          name: 'Library',
          description: null,
          isDefault: true,
          isActive: true,
          items: [posterItem],
        },
      },
    ] as unknown as ScheduledPlaylistAssignment[];

    const media = resolveJamaatInProgressMedia({
      settings: baseSettings(),
      playlists,
    });
    expect(media?.kind).toBe('image');
    expect(media?.url).toBe('https://cdn.example.com/salaah.webp');
  });

  it('resolves from the active schedule when playlists are empty', () => {
    const schedule = {
      id: 's1',
      name: 'Main',
      items: [posterItem],
    } as unknown as Schedule;

    const media = resolveJamaatInProgressMedia({
      settings: baseSettings(),
      schedule,
    });
    expect(media?.url).toBe('https://cdn.example.com/salaah.webp');
  });

  it('returns null when the content id is missing from the library', () => {
    expect(
      resolveJamaatInProgressMedia({
        settings: { ...baseSettings(), jamaatInProgressContentId: 'unknown' },
        schedule: { id: 's1', name: 'Main', items: [posterItem] } as unknown as Schedule,
      }),
    ).toBeNull();
  });

  it('returns null for screen mode even when the item exists', () => {
    expect(
      resolveJamaatInProgressMedia({
        settings: { ...baseSettings(), jamaatInProgressMode: 'screen' },
        schedule: { id: 's1', name: 'Main', items: [posterItem] } as unknown as Schedule,
      }),
    ).toBeNull();
  });
});
