import { describe, expect, it } from 'vitest';
import {
  EMPTY_SCHEDULE,
  contentHasKey,
  isEmptySchedulePayload,
  normaliseEventsList,
  pickEmergencyFromContent,
  pickEventsField,
  pickScheduleField,
  pickScheduledPlaylistsField,
  resolveAuthoritativeCarousel,
} from './authoritativeContent';

describe('isEmptySchedulePayload', () => {
  it('treats omit, null, and empty lists as empty', () => {
    expect(isEmptySchedulePayload(undefined)).toBe(true);
    expect(isEmptySchedulePayload(null)).toBe(true);
    expect(isEmptySchedulePayload([])).toBe(true);
    expect(isEmptySchedulePayload({ items: [] })).toBe(true);
    expect(isEmptySchedulePayload({ data: [] })).toBe(true);
  });

  it('keeps a schedule that still has items', () => {
    expect(isEmptySchedulePayload({ items: [{ id: 'a' }] })).toBe(false);
  });
});

describe('pickScheduleField', () => {
  it('finds nested data.schedule and playlist paths', () => {
    expect(pickScheduleField({ data: { schedule: { items: [] } } })).toEqual({
      hasKey: true,
      raw: { items: [] },
    });
    expect(pickScheduleField({ playlist: { items: [{ id: '1' }] } }).hasKey).toBe(true);
  });

  it('reports omit when no schedule-shaped key exists', () => {
    expect(pickScheduleField({ masjid: { name: 'Test' } })).toEqual({
      hasKey: false,
      raw: undefined,
    });
  });
});

describe('pickEventsField / pickScheduledPlaylistsField', () => {
  it('reads empty events as a present empty list', () => {
    expect(pickEventsField({ events: [] })).toEqual({ hasKey: true, events: [] });
    expect(contentHasKey({ events: [] }, 'events')).toBe(true);
  });

  it('clears empty playlist assignments', () => {
    expect(pickScheduledPlaylistsField({ scheduledPlaylists: [] })).toEqual({
      hasKey: true,
      playlists: null,
    });
  });
});

describe('normaliseEventsList', () => {
  it('unwraps array, { events }, and { data } shapes', () => {
    expect(normaliseEventsList([{ id: 'e1' }])).toEqual([{ id: 'e1' }]);
    expect(normaliseEventsList({ events: [{ id: 'e2' }] })).toEqual([{ id: 'e2' }]);
    expect(normaliseEventsList({ data: [{ id: 'e3' }] })).toEqual([{ id: 'e3' }]);
    expect(normaliseEventsList({ events: [] })).toEqual([]);
    expect(normaliseEventsList(null)).toEqual([]);
  });
});

describe('pickEmergencyFromContent', () => {
  it('does not clear when the emergency key is omitted (live WS alert must stay)', () => {
    expect(pickEmergencyFromContent({ schedule: { items: [] } })).toEqual({
      hasKey: false,
      shouldClear: false,
    });
  });

  it('clears when emergency is explicitly null, empty, or a remote-clear action', () => {
    expect(pickEmergencyFromContent({ emergency: null })).toEqual({
      hasKey: true,
      shouldClear: true,
    });
    expect(pickEmergencyFromContent({ emergencyAlert: { action: 'clear' } })).toEqual({
      hasKey: true,
      shouldClear: true,
    });
    expect(pickEmergencyFromContent({ currentAlert: {} })).toEqual({
      hasKey: true,
      shouldClear: true,
    });
  });

  it('does not clear a live alert object that still has title and message', () => {
    expect(
      pickEmergencyFromContent({
        emergency: { title: 'Stay inside', message: 'Police incident nearby' },
      }),
    ).toEqual({ hasKey: true, shouldClear: false });
  });
});

describe('resolveAuthoritativeCarousel', () => {
  it('turns an omitted schedule into EMPTY_SCHEDULE so Full residue cannot linger', () => {
    const result = resolveAuthoritativeCarousel({
      screen: { id: 's', name: 'Hall', orientation: 'LANDSCAPE', contentConfig: {} },
      schedule: undefined as never,
      prayerTimes: {} as never,
      contentOverrides: [],
      lastUpdated: '',
    });
    expect(result.emptySchedule).toEqual(EMPTY_SCHEDULE);
    expect(result.scheduledPlaylists).toBeNull();
  });

  it('keeps a non-empty schedule raw for the caller to normalise', () => {
    const result = resolveAuthoritativeCarousel({
      screen: { id: 's', name: 'Hall', orientation: 'LANDSCAPE', contentConfig: {} },
      schedule: { id: 'keep', items: [{ id: 'slide-1' }] },
      prayerTimes: {} as never,
      contentOverrides: [],
      lastUpdated: '',
    } as never);
    expect(result.emptySchedule).toBeNull();
    expect(result.scheduleRaw).toEqual({ id: 'keep', items: [{ id: 'slide-1' }] });
  });
});
