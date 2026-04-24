/**
 * Tests for usePrayerTimes hook.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { PrayerTimes } from '@/api/models';
import { usePrayerTimes } from './usePrayerTimes';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { mockPrayerTimesArray } from '@/test-utils/mocks';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Matches default masjid TZ when `content.masjidTimezone` is null in tests. */
const TEST_TZ = 'Europe/London';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const minimalPrayerTimes = {
  ...mockPrayerTimesArray[0],
  zuhr: (mockPrayerTimesArray[0] as { dhuhr?: string }).dhuhr ?? '12:15',
  fajrJamaat: '05:45',
  zuhrJamaat: '12:30',
  asrJamaat: '16:00',
  maghribJamaat: '18:25',
  ishaJamaat: '20:00',
};

describe('usePrayerTimes', () => {
  it('returns hook shape with all expected keys', async () => {
    const store = createTestStore();
    const contentState = store.getState().content;
    const storeWithPrayers = createTestStore({
      content: {
        ...contentState,
        prayerTimes: minimalPrayerTimes,
        timeFormat: '12h',
      },
    });
    const preloaded = storeWithPrayers.getState();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
        children,
      );
    const { result } = renderHook(() => usePrayerTimes(), { wrapper });
    await waitFor(() => {
      expect(result.current).toHaveProperty('todaysPrayerTimes');
      expect(result.current).toHaveProperty('nextPrayer');
      expect(result.current).toHaveProperty('currentPrayer');
      expect(result.current).toHaveProperty('currentDate');
      expect(result.current).toHaveProperty('hijriDate');
      expect(result.current).toHaveProperty('isJumuahToday');
      expect(result.current).toHaveProperty('jumuahTime');
      expect(result.current).toHaveProperty('upcomingJumuahJamaatRaw');
      expect(result.current).toHaveProperty('upcomingJumuahKhutbahRaw');
      expect(result.current).toHaveProperty('forbiddenPrayer');
      expect(Array.isArray(result.current.todaysPrayerTimes)).toBe(true);
    });
  });

  it('returns empty arrays when no prayer times in store', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        {} as React.ComponentProps<typeof AllTheProviders>,
        children,
      );
    const { result } = renderHook(() => usePrayerTimes(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.todaysPrayerTimes).toEqual([]);
    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.currentPrayer).toBeNull();
  });

  it('extracts Isha Jamaat when API returns IshaJamaat (capital I)', async () => {
    const prayerTimesWithCapitalIsha = {
      ...minimalPrayerTimes,
      IshaJamaat: '20:15', // Backend may return capital I
    };
    delete (prayerTimesWithCapitalIsha as Record<string, unknown>).ishaJamaat;
    const store = createTestStore();
    const contentState = store.getState().content;
    const storeWithPrayers = createTestStore({
      content: {
        ...contentState,
        prayerTimes: prayerTimesWithCapitalIsha,
        timeFormat: '12h',
      },
    });
    const preloaded = storeWithPrayers.getState();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
        children,
      );
    const { result } = renderHook(() => usePrayerTimes(), { wrapper });
    await waitFor(() => {
      const isha = result.current.todaysPrayerTimes.find((p) => p.name === 'Isha');
      expect(isha).toBeDefined();
      expect(isha?.jamaat).toBe('20:15');
    });
  });

  describe('next-prayer selection regression (10am scenario)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('selects Zuhr as next prayer at 10am masjid-tz with realistic UK times', async () => {
      // 10:00 BST on 2026-06-15 (during BST). Pre-rewrite, the late-night
      // branch + string-compare selection could mis-select Fajr at this hour
      // when the device tz differed from the masjid tz. With the unified
      // numeric selection Zuhr (12:15) is the only valid pick.
      vi.setSystemTime(new Date('2026-06-15T09:00:00.000Z')); // 10:00 BST

      const todayLondon = dayjs.tz('2026-06-15', TEST_TZ).format('YYYY-MM-DD');
      const prayerTimes = {
        date: todayLondon,
        fajr: '03:30',
        sunrise: '04:45',
        zuhr: '12:15',
        asr: '17:30',
        maghrib: '21:20',
        isha: '22:45',
        fajrJamaat: '04:00',
        zuhrJamaat: '12:30',
        asrJamaat: '17:45',
        maghribJamaat: '21:25',
        ishaJamaat: '23:00',
      };

      const store = createTestStore();
      const contentState = store.getState().content;
      const storeWithTimes = createTestStore({
        content: {
          ...contentState,
          prayerTimes,
          masjidTimezone: TEST_TZ,
          timeFormat: '24h',
        },
      });
      const preloaded = storeWithTimes.getState();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          AllTheProviders,
          { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
          children,
        );

      const { result } = renderHook(() => usePrayerTimes(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.nextPrayer?.name).toBe('Zuhr');
        },
        { timeout: 2000 },
      );
    });
  });

  describe('Friday Jumuah replaces Zuhr', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Helper: pick the next Friday in TEST_TZ at the requested wall-clock time. */
    const nextFridayAt = (hour: number, minute = 0) => {
      let d = dayjs().tz(TEST_TZ);
      while (d.day() !== 5) d = d.add(1, 'day');
      return d.hour(hour).minute(minute).second(0).millisecond(0);
    };

    const mountHook = (prayerTimes: PrayerTimes) => {
      const store = createTestStore();
      const contentState = store.getState().content;
      const storeWithTimes = createTestStore({
        content: {
          ...contentState,
          prayerTimes,
          masjidTimezone: TEST_TZ,
          timeFormat: '24h',
        },
      });
      const preloaded = storeWithTimes.getState();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          AllTheProviders,
          { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
          children,
        );
      return renderHook(() => usePrayerTimes(), { wrapper });
    };

    it('substitutes jummahKhutbah/jummahJamaat into the Zuhr row on Fridays', async () => {
      // Pick 11:00 on the next Friday — well before any prayer slot.
      const friday = nextFridayAt(11, 0);
      vi.setSystemTime(friday.toDate());

      const prayerTimes = {
        date: friday.format('YYYY-MM-DD'),
        fajr: '03:30',
        sunrise: '04:45',
        zuhr: '12:15',
        asr: '17:30',
        maghrib: '21:20',
        isha: '22:45',
        fajrJamaat: '04:00',
        zuhrJamaat: '13:45', // Regular Zuhr jamaat AFTER jumuah jamaat
        asrJamaat: '17:45',
        maghribJamaat: '21:25',
        ishaJamaat: '23:00',
        jummahKhutbah: '13:00',
        jummahJamaat: '13:15',
      } as PrayerTimes;

      const { result } = mountHook(prayerTimes);

      await waitFor(
        () => {
          expect(result.current.isJumuahToday).toBe(true);
          const zuhrRow = result.current.todaysPrayerTimes.find(
            (p) => p.name === 'Zuhr',
          );
          expect(zuhrRow).toBeDefined();
          expect(zuhrRow?.time).toBe('13:00');
          expect(zuhrRow?.jamaat).toBe('13:15');
          expect(zuhrRow?.jamaatTime).toBe('13:15');
          // isJumuah flag drives the "Jumuah" relabel in the panel/strip and
          // alternateJamaat lets the UI surface the regular zuhrJamaat as a
          // small subtext for attendees who pray solar-noon Zuhr separately.
          expect(zuhrRow?.isJumuah).toBe(true);
          expect(zuhrRow?.alternateJamaat).toBe('13:45');
        },
        { timeout: 2000 },
      );
    });

    it('advances next prayer to Asr after jummahJamaat in-prayer window ends (even when zuhrJamaat is later)', async () => {
      // jummahJamaat = 13:15 → in-prayer window (10m progress + 10m delay = 20m
      // default) ends at 13:35. zuhrJamaat = 14:00. Test at 13:40: well past
      // the Jumuah window, but still before the regular zuhrJamaat. Without
      // the substitution, calculatePrayersAccurately would see jamaatMin =
      // 14:00 and treat us as "before Zuhr jamaat" → keep nextPrayer on Zuhr.
      // With the fix, the row's jamaat is 13:15 (well past + outside window)
      // → next advances to Asr.
      const friday = nextFridayAt(13, 40);
      vi.setSystemTime(friday.toDate());

      const prayerTimes = {
        date: friday.format('YYYY-MM-DD'),
        fajr: '03:30',
        sunrise: '04:45',
        zuhr: '12:15',
        asr: '17:30',
        maghrib: '21:20',
        isha: '22:45',
        fajrJamaat: '04:00',
        zuhrJamaat: '14:00',
        asrJamaat: '17:45',
        maghribJamaat: '21:25',
        ishaJamaat: '23:00',
        jummahKhutbah: '13:00',
        jummahJamaat: '13:15',
      } as PrayerTimes;

      const { result } = mountHook(prayerTimes);

      await waitFor(
        () => {
          expect(result.current.isJumuahToday).toBe(true);
          expect(result.current.nextPrayer?.name).toBe('Asr');
        },
        { timeout: 2000 },
      );
    });

    it('falls back to regular Zuhr times on Fridays when jummahJamaat is missing', async () => {
      const friday = nextFridayAt(11, 0);
      vi.setSystemTime(friday.toDate());

      const prayerTimes = {
        date: friday.format('YYYY-MM-DD'),
        fajr: '03:30',
        sunrise: '04:45',
        zuhr: '12:15',
        asr: '17:30',
        maghrib: '21:20',
        isha: '22:45',
        fajrJamaat: '04:00',
        zuhrJamaat: '12:30',
        asrJamaat: '17:45',
        maghribJamaat: '21:25',
        ishaJamaat: '23:00',
      } as PrayerTimes;

      const { result } = mountHook(prayerTimes);

      await waitFor(
        () => {
          const zuhrRow = result.current.todaysPrayerTimes.find(
            (p) => p.name === 'Zuhr',
          );
          expect(zuhrRow?.time).toBe('12:15');
          expect(zuhrRow?.jamaat).toBe('12:30');
        },
        { timeout: 2000 },
      );
    });

    it('does NOT substitute Jumuah times on non-Fridays', async () => {
      // Find next Saturday (day === 6) at 11:00
      let d = dayjs().tz(TEST_TZ);
      while (d.day() !== 6) d = d.add(1, 'day');
      const saturday = d.hour(11).minute(0).second(0).millisecond(0);
      vi.setSystemTime(saturday.toDate());

      const prayerTimes = {
        date: saturday.format('YYYY-MM-DD'),
        fajr: '03:30',
        sunrise: '04:45',
        zuhr: '12:15',
        asr: '17:30',
        maghrib: '21:20',
        isha: '22:45',
        fajrJamaat: '04:00',
        zuhrJamaat: '12:30',
        asrJamaat: '17:45',
        maghribJamaat: '21:25',
        ishaJamaat: '23:00',
        // jummah fields present but should be ignored on Saturday
        jummahKhutbah: '13:00',
        jummahJamaat: '13:15',
      } as PrayerTimes;

      const { result } = mountHook(prayerTimes);

      await waitFor(
        () => {
          expect(result.current.isJumuahToday).toBe(false);
          const zuhrRow = result.current.todaysPrayerTimes.find(
            (p) => p.name === 'Zuhr',
          );
          expect(zuhrRow?.time).toBe('12:15');
          expect(zuhrRow?.jamaat).toBe('12:30');
          expect(zuhrRow?.isJumuah).toBeUndefined();
          expect(zuhrRow?.alternateJamaat).toBeUndefined();
        },
        { timeout: 2000 },
      );
    });

    it("enriches tomorrow's Zuhr entry with Jumuah + alternate when tomorrow is Friday", async () => {
      // Find next Thursday (day === 4) at 11:00; tomorrow is Friday.
      let d = dayjs().tz(TEST_TZ);
      while (d.day() !== 4) d = d.add(1, 'day');
      const thursday = d.hour(11).minute(0).second(0).millisecond(0);
      vi.setSystemTime(thursday.toDate());

      const thursdayYmd = thursday.format('YYYY-MM-DD');
      const fridayYmd = thursday.add(1, 'day').format('YYYY-MM-DD');

      const buildDay = (
        date: string,
        zuhrJamaat: string,
        jummah?: { jummahJamaat: string; jummahKhutbah?: string },
      ) => ({
        date,
        fajr: '03:30',
        sunrise: '04:45',
        zuhr: '12:15',
        asr: '17:30',
        maghrib: '21:20',
        isha: '22:45',
        fajrJamaat: '04:00',
        zuhrJamaat,
        asrJamaat: '17:45',
        maghribJamaat: '21:25',
        ishaJamaat: '23:00',
        ...(jummah ?? {}),
      });

      const prayerTimes = {
        data: [
          buildDay(thursdayYmd, '12:30'),
          buildDay(fridayYmd, '12:35', {
            jummahKhutbah: '13:00',
            jummahJamaat: '13:15',
          }),
        ],
      } as unknown as PrayerTimes;

      const { result } = mountHook(prayerTimes);

      await waitFor(
        () => {
          // Today is Thursday: Zuhr row stays regular, no Jumuah relabel.
          expect(result.current.isJumuahToday).toBe(false);
          const zuhrRow = result.current.todaysPrayerTimes.find(
            (p) => p.name === 'Zuhr',
          );
          expect(zuhrRow?.isJumuah).toBeUndefined();
          // Tomorrow's column for Zuhr exposes Jumuah as primary with the
          // regular zuhrJamaat as alternate so the panel/strip can show both.
          const tomorrowZuhr = result.current.tomorrowsJamaats?.['Zuhr'];
          expect(tomorrowZuhr).toBeDefined();
          expect(tomorrowZuhr?.jamaat).toBe('13:15');
          expect(tomorrowZuhr?.isJumuah).toBe(true);
          expect(tomorrowZuhr?.alternateJamaat).toBe('12:35');
          // Other rows stay simple (no isJumuah / alternate fields).
          const tomorrowAsr = result.current.tomorrowsJamaats?.['Asr'];
          expect(tomorrowAsr?.jamaat).toBe('17:45');
          expect(tomorrowAsr?.isJumuah).toBeUndefined();
        },
        { timeout: 2000 },
      );
    });

    it("after-Isha on Thursday: tomorrow's Zuhr row carries isJumuah and alternateJamaat", async () => {
      // Find next Thursday at 23:30 — well past Isha (22:45 / 23:00 jamaat)
      // so the hook switches to displaying tomorrow's (Friday's) prayer list.
      let d = dayjs().tz(TEST_TZ);
      while (d.day() !== 4) d = d.add(1, 'day');
      const thursdayLate = d.hour(23).minute(30).second(0).millisecond(0);
      vi.setSystemTime(thursdayLate.toDate());

      const thursdayYmd = thursdayLate.format('YYYY-MM-DD');
      const fridayYmd = thursdayLate.add(1, 'day').format('YYYY-MM-DD');

      const buildDay = (
        date: string,
        zuhrJamaat: string,
        jummah?: { jummahJamaat: string; jummahKhutbah?: string },
      ) => ({
        date,
        fajr: '03:30',
        sunrise: '04:45',
        zuhr: '12:15',
        asr: '17:30',
        maghrib: '21:20',
        isha: '22:45',
        fajrJamaat: '04:00',
        zuhrJamaat,
        asrJamaat: '17:45',
        maghribJamaat: '21:25',
        ishaJamaat: '23:00',
        ...(jummah ?? {}),
      });

      const prayerTimes = {
        data: [
          buildDay(thursdayYmd, '12:30'),
          buildDay(fridayYmd, '12:35', {
            jummahKhutbah: '13:00',
            jummahJamaat: '13:15',
          }),
        ],
      } as unknown as PrayerTimes;

      const { result } = mountHook(prayerTimes);

      await waitFor(
        () => {
          // After Isha, the displayed list is tomorrow (Friday).
          expect(result.current.isJumuahToday).toBe(true);
          const zuhrRow = result.current.todaysPrayerTimes.find(
            (p) => p.name === 'Zuhr',
          );
          expect(zuhrRow).toBeDefined();
          expect(zuhrRow?.time).toBe('13:00');
          expect(zuhrRow?.jamaat).toBe('13:15');
          // The relabel + alternate-Zuhr subtext both depend on these flags.
          expect(zuhrRow?.isJumuah).toBe(true);
          expect(zuhrRow?.alternateJamaat).toBe('12:35');
        },
        { timeout: 2000 },
      );
    });
  });

  it('exposes upcoming Friday jummah whenever week data includes a future Friday row', async () => {
    const dayRow = (date: string, jummah?: { jummahJamaat: string; jummahKhutbah: string }) => ({
      date,
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
      ...jummah,
    });

    const start = dayjs().tz(TEST_TZ).startOf('day');
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const d = start.add(i, 'day');
      const ymd = d.format('YYYY-MM-DD');
      const isFri = d.day() === 5;
      rows.push(
        dayRow(
          ymd,
          isFri ? { jummahJamaat: '13:30', jummahKhutbah: '13:00' } : undefined,
        ),
      );
    }
    const weekPrayerTimes = { data: rows } as PrayerTimes;

    const store = createTestStore();
    const contentState = store.getState().content;
    const storeWithWeek = createTestStore({
      content: {
        ...contentState,
        prayerTimes: weekPrayerTimes,
        timeFormat: '12h',
      },
    });
    const preloaded = storeWithWeek.getState();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
        children,
      );
    const { result } = renderHook(() => usePrayerTimes(), { wrapper });
    await waitFor(() => {
      expect(result.current.upcomingJumuahJamaatRaw).toBe('13:30');
      expect(result.current.upcomingJumuahKhutbahRaw).toBe('13:00');
    });
    expect(result.current.isJumuahToday).toBe(start.day() === 5);
  });
});
