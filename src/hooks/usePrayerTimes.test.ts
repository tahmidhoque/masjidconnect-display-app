/**
 * Tests for usePrayerTimes hook.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePrayerTimes } from './usePrayerTimes';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { mockPrayerTimesArray } from '@/test-utils/mocks';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const minimalPrayerTimes = {
  ...mockPrayerTimesArray[0],
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
      React.createElement(AllTheProviders, { preloadedState: preloaded }, children);
    const { result } = renderHook(() => usePrayerTimes(), { wrapper });
    await waitFor(() => {
      expect(result.current).toHaveProperty('todaysPrayerTimes');
      expect(result.current).toHaveProperty('nextPrayer');
      expect(result.current).toHaveProperty('currentPrayer');
      expect(result.current).toHaveProperty('currentDate');
      expect(result.current).toHaveProperty('hijriDate');
      expect(result.current).toHaveProperty('isJumuahToday');
      expect(result.current).toHaveProperty('jumuahTime');
      expect(result.current).toHaveProperty('forbiddenPrayer');
      expect(Array.isArray(result.current.todaysPrayerTimes)).toBe(true);
    });
  });

  it('returns empty arrays when no prayer times in store', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AllTheProviders, null, children);
    const { result } = renderHook(() => usePrayerTimes(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.todaysPrayerTimes).toEqual([]);
    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.currentPrayer).toBeNull();
  });
});
