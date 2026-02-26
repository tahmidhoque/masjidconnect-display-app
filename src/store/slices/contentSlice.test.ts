/**
 * Redux content slice tests — reducers and extraReducers.
 */

import { describe, it, expect, vi } from 'vitest';
import contentReducer from './contentSlice';
import {
  refreshContent,
  refreshPrayerTimes,
  refreshSchedule,
  refreshEvents,
  loadCachedContent,
  refreshAllContent,
  normalizeScheduleData,
} from './contentSlice';
import {
  setCarouselTime,
  setPrayerAnnouncement,
  setShowPrayerAnnouncement,
  setPrayerAnnouncementName,
  setIsPrayerJamaat,
  clearAllErrors,
} from './contentSlice';
import type { PrayerTimes } from '@/api/models';
import { mockScreenContent, mockPrayerTimesArray } from '@/test-utils/mocks';

/** Minimal prayer times shape for reducer payloads */
const minimalPrayerTimes = {
  ...mockPrayerTimesArray[0],
  zuhr: (mockPrayerTimesArray[0] as { dhuhr?: string }).dhuhr ?? '12:15',
  fajrJamaat: '05:45',
  zuhrJamaat: '12:30',
  asrJamaat: '16:00',
  maghribJamaat: '18:25',
  ishaJamaat: '20:00',
};

vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('contentSlice', () => {
  describe('initial state', () => {
    it('has null content and loading flags', () => {
      const state = contentReducer(undefined, { type: 'init' });
      expect(state.screenContent).toBeNull();
      expect(state.prayerTimes).toBeNull();
      expect(state.schedule).toBeNull();
      expect(state.events).toBeNull();
      expect(state.isLoading).toBe(true);
    });
  });

  describe('refreshContent', () => {
    it('sets loading and clears error on pending', () => {
      const state = contentReducer(undefined, refreshContent.pending('', {}));
      expect(state.isLoadingContent).toBe(true);
      expect(state.contentError).toBeNull();
    });

    it('updates state on fulfilled with content payload', () => {
      const payload = {
        content: mockScreenContent as never,
        masjidName: 'Test Masjid',
        masjidTimezone: 'Europe/London',
        carouselTime: 30,
        timeFormat: '12h' as const,
        timestamp: new Date().toISOString(),
        schedule: undefined,
        events: undefined,
      };
      const prev = contentReducer(undefined, refreshContent.pending('', {}));
      const state = contentReducer(prev, refreshContent.fulfilled(payload, '', {}));
      expect(state.isLoadingContent).toBe(false);
      expect(state.screenContent).toEqual(mockScreenContent);
      expect(state.masjidName).toBe('Test Masjid');
      expect(state.masjidTimezone).toBe('Europe/London');
      expect(state.carouselTime).toBe(30);
      expect(state.timeFormat).toBe('12h');
    });

    it('does not update content when payload.skipped is true', () => {
      const payload = { skipped: true, reason: 'debounced' } as never;
      const prev = contentReducer(undefined, refreshContent.pending('', {}));
      const state = contentReducer(prev, refreshContent.fulfilled(payload, '', {}));
      expect(state.isLoadingContent).toBe(false);
      expect(state.screenContent).toBeNull();
    });

    it('sets contentError on rejected', () => {
      const prev = contentReducer(undefined, refreshContent.pending('', {}));
      const state = contentReducer(
        prev,
        refreshContent.rejected(null, '', {}, 'Network error'),
      );
      expect(state.isLoadingContent).toBe(false);
      expect(state.contentError).toBe('Network error');
    });

    it('stores schedule from payload when provided (e.g. from content.data.schedule or playlist)', () => {
      const scheduleWithDua = {
        id: 's1',
        name: 'Main',
        items: [
          {
            id: 'dua-1',
            order: 0,
            contentItem: {
              id: 'c1',
              type: 'DUA' as const,
              title: 'Dua',
              content: { arabicText: 'نص', transliteration: 'nun', translation: 'Text' },
              duration: 25,
            },
          },
        ],
      };
      const payload = {
        content: mockScreenContent as never,
        masjidName: 'Test Masjid',
        masjidTimezone: 'Europe/London',
        carouselTime: 30,
        timeFormat: '12h' as const,
        timestamp: new Date().toISOString(),
        schedule: scheduleWithDua,
        events: undefined,
      };
      const prev = contentReducer(undefined, refreshContent.pending('', {}));
      const state = contentReducer(prev, refreshContent.fulfilled(payload, '', {}));
      expect(state.schedule).toEqual(scheduleWithDua);
      expect(state.schedule?.items[0].contentItem.type).toBe('DUA');
    });
  });

  describe('refreshPrayerTimes', () => {
    it('sets prayer times on fulfilled (object)', () => {
      const payload = {
        prayerTimes: minimalPrayerTimes,
        timestamp: new Date().toISOString(),
      };
      const prev = contentReducer(undefined, refreshPrayerTimes.pending('', {}));
      const state = contentReducer(prev, refreshPrayerTimes.fulfilled(payload, '', {}));
      expect(state.isLoadingPrayerTimes).toBe(false);
      expect(state.prayerTimes).toEqual(minimalPrayerTimes);
    });

    it('takes first element when prayerTimes is array', () => {
      const payload = {
        prayerTimes: [minimalPrayerTimes],
        timestamp: new Date().toISOString(),
      };
      const prev = contentReducer(undefined, refreshPrayerTimes.pending('', {}));
      const state = contentReducer(
        prev,
        refreshPrayerTimes.fulfilled(
          payload as unknown as { prayerTimes: PrayerTimes; timestamp: string },
          '',
          {},
        ),
      );
      expect(state.prayerTimes).toEqual(minimalPrayerTimes);
    });

    it('sets prayerTimesError on rejected', () => {
      const prev = contentReducer(undefined, refreshPrayerTimes.pending('', {}));
      const state = contentReducer(
        prev,
        refreshPrayerTimes.rejected(null, '', {}, 'No prayer times'),
      );
      expect(state.prayerTimesError).toBe('No prayer times');
    });
  });

  describe('refreshSchedule', () => {
    it('sets schedule on fulfilled', () => {
      const schedule = { id: 's1', name: 'Main', items: [] };
      const payload = {
        schedule,
        timestamp: new Date().toISOString(),
      };
      const prev = contentReducer(undefined, refreshSchedule.pending('', {}));
      const state = contentReducer(prev, refreshSchedule.fulfilled(payload, '', {}));
      expect(state.schedule).toEqual(schedule);
      expect(state.scheduleError).toBeNull();
    });

    it('sets scheduleError on rejected', () => {
      const prev = contentReducer(undefined, refreshSchedule.pending('', {}));
      const state = contentReducer(
        prev,
        refreshSchedule.rejected(null, '', {}, 'Failed'),
      );
      expect(state.scheduleError).toBe('Failed');
    });

    it('stores schedule with DUA items when fulfilled', () => {
      const scheduleWithDua = {
        id: 's1',
        name: 'Main',
        items: [
          {
            id: 'i1',
            order: 0,
            contentItem: {
              id: 'c1',
              type: 'DUA' as const,
              title: 'Dua for guidance',
              content: { arabicText: 'اَهْدِنَا', transliteration: 'Ihdina', translation: 'Guide us' },
              duration: 30,
            },
          },
        ],
      };
      const payload = { schedule: scheduleWithDua, timestamp: new Date().toISOString() };
      const prev = contentReducer(undefined, refreshSchedule.pending('', {}));
      const state = contentReducer(prev, refreshSchedule.fulfilled(payload, '', {}));
      expect(state.schedule).toEqual(scheduleWithDua);
      expect(state.schedule?.items[0].contentItem.type).toBe('DUA');
    });
  });

  describe('refreshEvents', () => {
    it('sets events on fulfilled', () => {
      const events = [{ id: 'e1', title: 'Event' }];
      const payload = {
        events,
        timestamp: new Date().toISOString(),
      };
      const prev = contentReducer(undefined, refreshEvents.pending('', {}));
      const state = contentReducer(prev, refreshEvents.fulfilled(payload, '', {}));
      expect(state.events).toEqual(events);
    });
  });

  describe('loadCachedContent', () => {
    it('populates state from cached payload', () => {
      const payload = {
        schedule: { id: 's1', name: 'Main', items: [] } as never,
        events: [] as never[],
        prayerTimes: minimalPrayerTimes,
        screenContent: mockScreenContent as never,
        timestamp: new Date().toISOString(),
      };
      const state = contentReducer(
        undefined,
        loadCachedContent.fulfilled(payload, '', undefined),
      );
      expect(state.schedule).toEqual(payload.schedule);
      expect(state.events).toEqual([]);
      expect(state.prayerTimes).toEqual(minimalPrayerTimes);
      expect(state.screenContent).toEqual(mockScreenContent);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('refreshAllContent', () => {
    it('sets loading on pending', () => {
      const state = contentReducer(undefined, refreshAllContent.pending('', {}));
      expect(state.isLoading).toBe(true);
    });

    it('sets lastUpdated and clears loading on fulfilled', () => {
      const payload = {
        timestamp: new Date().toISOString(),
        results: ['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled'] as ('fulfilled' | 'rejected')[],
      };
      const prev = contentReducer(undefined, refreshAllContent.pending('', {}));
      const state = contentReducer(prev, refreshAllContent.fulfilled(payload, '', {}));
      expect(state.isLoading).toBe(false);
      expect(state.lastUpdated).toBe(payload.timestamp);
    });

    it('clears loading on rejected', () => {
      const prev = contentReducer(undefined, refreshAllContent.pending('', {}));
      const state = contentReducer(
        prev,
        refreshAllContent.rejected(null, '', {}, 'Refresh failed'),
      );
      expect(state.isLoading).toBe(false);
    });
  });

  describe('normalizeScheduleData', () => {
    it('normalises flattened schedule with DUA item (type, content with arabicText, transliteration, translation)', () => {
      const raw = {
        id: 's1',
        name: 'Main',
        items: [
          {
            id: 'dua-1',
            order: 0,
            type: 'DUA',
            title: 'Dua for guidance',
            content: {
              arabicText: 'اَهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
              transliteration: 'Ihdina as-sirata al-mustaqim',
              translation: 'Guide us to the straight path',
              reference: 'Surah Al-Fatiha',
            },
            duration: 25,
          },
        ],
      };
      const result = normalizeScheduleData(raw);
      expect(result.id).toBe('s1');
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.contentItem.type).toBe('DUA');
      expect(item.contentItem.title).toBe('Dua for guidance');
      expect(item.contentItem.content).toEqual(raw.items[0].content);
      expect(item.contentItem.duration).toBe(25);
    });

    it('skips malformed items that throw and keeps valid ones (per-item resilience)', () => {
      const badItem = { id: 'bad', order: 1 };
      Object.defineProperty(badItem, 'contentItem', {
        get() {
          throw new Error('Invalid contentItem');
        },
        configurable: true,
      });
      const raw = {
        id: 's1',
        name: 'Main',
        items: [
          { id: 'valid-1', order: 0, type: 'CUSTOM', title: 'Valid', content: {}, duration: 30 },
          badItem,
          { id: 'valid-2', order: 2, type: 'DUA', title: 'Dua', content: { arabicText: 'نص' }, duration: 20 },
        ],
      };
      const result = normalizeScheduleData(raw);
      expect(result.items).toHaveLength(2);
      const ids = result.items.map((i) => (i as { id?: string; contentItem?: { id?: string } }).contentItem?.id ?? (i as { id?: string }).id);
      expect(ids).toContain('valid-1-content');
      expect(ids).toContain('valid-2-content');
    });

    it('accepts schedule when items are under data array', () => {
      const raw = {
        id: 's1',
        name: 'Main',
        data: [
          { id: 'd1', order: 0, type: 'CUSTOM', title: 'Item', content: {}, duration: 30 },
        ],
      };
      const result = normalizeScheduleData(raw);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].contentItem.type).toBe('CUSTOM');
    });
  });

  describe('reducers', () => {
    it('setCarouselTime clamps between 5 and 300', () => {
      let state = contentReducer(undefined, setCarouselTime(10));
      expect(state.carouselTime).toBe(10);
      state = contentReducer(undefined, setCarouselTime(1));
      expect(state.carouselTime).toBe(5);
      state = contentReducer(undefined, setCarouselTime(400));
      expect(state.carouselTime).toBe(300);
    });

    it('setPrayerAnnouncement updates show and name', () => {
      const state = contentReducer(
        undefined,
        setPrayerAnnouncement({ show: true, prayerName: 'Fajr', isJamaat: false }),
      );
      expect(state.showPrayerAnnouncement).toBe(true);
      expect(state.prayerAnnouncementName).toBe('Fajr');
      expect(state.isPrayerJamaat).toBe(false);
    });

    it('setPrayerAnnouncement with undefined prayerName does not overwrite', () => {
      let state = contentReducer(
        undefined,
        setPrayerAnnouncement({ show: true, prayerName: 'Fajr' }),
      );
      state = contentReducer(state, setPrayerAnnouncement({ show: false }));
      expect(state.prayerAnnouncementName).toBe('Fajr');
    });

    it('setShowPrayerAnnouncement and setPrayerAnnouncementName update single fields', () => {
      let state = contentReducer(undefined, setShowPrayerAnnouncement(true));
      expect(state.showPrayerAnnouncement).toBe(true);
      state = contentReducer(state, setPrayerAnnouncementName('Dhuhr'));
      expect(state.prayerAnnouncementName).toBe('Dhuhr');
      state = contentReducer(state, setIsPrayerJamaat(true));
      expect(state.isPrayerJamaat).toBe(true);
    });

    it('clearAllErrors clears all error fields', () => {
      let state = contentReducer(
        undefined,
        refreshContent.rejected(new Error('err'), '', {}),
      );
      state = contentReducer(state, clearAllErrors());
      expect(state.contentError).toBeNull();
      expect(state.prayerTimesError).toBeNull();
      expect(state.scheduleError).toBeNull();
      expect(state.eventsError).toBeNull();
    });
  });
});
