/**
 * Live-refetch replace-not-merge tests for Full → Free fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestStore } from '@/test-utils/mock-store';
import { refreshContent, refreshEvents } from './contentSlice';
import { EMPTY_SCHEDULE } from '@/utils/authoritativeContent';

const mockSyncContent = vi.fn();
const mockSyncEvents = vi.fn();
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockClearAlert = vi.fn();

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/services/syncService', () => ({
  default: {
    syncContent: (...args: unknown[]) => mockSyncContent(...args),
    syncEvents: (...args: unknown[]) => mockSyncEvents(...args),
    syncPrayerTimes: vi.fn(),
  },
}));

vi.mock('@/services/storageService', () => ({
  default: {
    get: (...args: unknown[]) => mockStorageGet(...args),
    set: (...args: unknown[]) => mockStorageSet(...args),
  },
}));

vi.mock('@/services/mediaCacheService', () => ({
  default: { prefetchAndRetain: vi.fn().mockResolvedValue(undefined) },
  collectHttpUrls: vi.fn(() => []),
}));

vi.mock('@/services/emergencyAlertService', () => ({
  default: {
    clearAlert: (...args: unknown[]) => mockClearAlert(...args),
    setAlert: vi.fn(),
    addListener: vi.fn(() => () => {}),
    getCurrentAlert: vi.fn(() => null),
  },
}));

const leftoverFullSchedule = {
  id: 'premium',
  name: 'Full Access',
  items: [{ id: 'video-1', order: 0, type: 'VIDEO', title: 'Clip' }],
};

const freeLiveContent = {
  screen: { id: 's', name: 'Hall', orientation: 'LANDSCAPE' as const, contentConfig: {} },
  masjid: { id: 'm', name: 'Test Masjid', timezone: 'Europe/London', logoUrl: null },
  schedule: { id: 'cleared-schedule', name: 'Schedule', items: [] },
  scheduledPlaylists: [],
  events: [],
  emergency: null,
  prayerTimes: { fajr: '05:30' },
  contentOverrides: [],
  lastUpdated: new Date().toISOString(),
};

describe('contentSlice live authoritative replace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGet.mockResolvedValue(null);
    mockStorageSet.mockResolvedValue(undefined);
  });

  it('replaces leftover Full carousel/events/logo on a successful live content refetch', async () => {
    mockSyncContent.mockResolvedValue({
      success: true,
      fromCache: false,
      data: freeLiveContent,
    });

    const store = createTestStore({
      content: {
        schedule: leftoverFullSchedule,
        scheduledPlaylists: [{ id: 'pl-1' }],
        events: [{ id: 'e-full' }],
        masjidLogoUrl: 'https://cdn.example/logo.png',
      } as never,
    });

    await store.dispatch(refreshContent({ forceRefresh: true }));

    const state = store.getState().content;
    expect(state.schedule?.items).toEqual([]);
    expect(state.scheduledPlaylists).toBeNull();
    expect(state.events).toEqual([]);
    expect(state.masjidLogoUrl).toBeNull();
    expect(mockStorageSet).toHaveBeenCalledWith('schedule', EMPTY_SCHEDULE);
    expect(mockStorageSet).toHaveBeenCalledWith('events', []);
    expect(mockClearAlert).toHaveBeenCalled();
  });

  it('does not merge leftover Full events after a live empty events sync', async () => {
    mockSyncEvents.mockResolvedValue({
      success: true,
      fromCache: false,
      data: { events: [] },
    });
    mockStorageGet.mockResolvedValue([{ id: 'cached-premium-event' }]);

    const store = createTestStore({
      content: {
        events: [{ id: 'cached-premium-event' }],
      } as never,
    });

    await store.dispatch(refreshEvents({ forceRefresh: true }));

    expect(store.getState().content.events).toEqual([]);
    expect(mockStorageSet).toHaveBeenCalledWith('events', []);
    expect(mockStorageGet).not.toHaveBeenCalled();
  });

  it('keeps cached events when the live events sync fails', async () => {
    mockSyncEvents.mockResolvedValue({
      success: false,
      fromCache: false,
      error: 'network',
    });
    mockStorageGet.mockResolvedValue([{ id: 'offline-event' }]);

    const store = createTestStore();
    await store.dispatch(refreshEvents({ forceRefresh: true }));

    expect(store.getState().content.events).toEqual([{ id: 'offline-event' }]);
    expect(mockStorageSet).not.toHaveBeenCalledWith('events', []);
  });

  it('does not dismiss a live emergency when the content payload omits the key', async () => {
    const withoutEmergency = {
      screen: freeLiveContent.screen,
      masjid: freeLiveContent.masjid,
      schedule: freeLiveContent.schedule,
      scheduledPlaylists: freeLiveContent.scheduledPlaylists,
      events: freeLiveContent.events,
      prayerTimes: freeLiveContent.prayerTimes,
      contentOverrides: freeLiveContent.contentOverrides,
      lastUpdated: freeLiveContent.lastUpdated,
    };
    mockSyncContent.mockResolvedValue({
      success: true,
      fromCache: false,
      data: withoutEmergency,
    });

    const store = createTestStore();
    await store.dispatch(refreshContent({ forceRefresh: true }));

    expect(mockClearAlert).not.toHaveBeenCalled();
    expect(store.getState().content.schedule?.items).toEqual([]);
  });
});
