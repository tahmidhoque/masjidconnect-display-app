/**
 * Tests for usePrayerTimes hook.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
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
