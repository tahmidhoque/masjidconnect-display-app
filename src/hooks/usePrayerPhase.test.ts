/**
 * Tests for usePrayerPhase — focuses on the edge cases the J-anchored rewrite
 * was designed to handle:
 *
 *   • Adhan == Jamaat (the Maghrib symptom).
 *   • Adhan within JAMAAT_LEAD_MIN of Jamaat (silent-phones must still fire).
 *   • Jamaat missing from payload.
 *   • Device timezone ≠ masjid timezone (the Pi-in-UTC scenario).
 *
 * The hook reads:
 *   - `usePrayerTimesContext` (mocked here for fixture nextPrayer/currentPrayer)
 *   - `useCurrentTime` (driven by `vi.setSystemTime`)
 *   - Redux selectors for `masjidTimezone` and `displaySettings`
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { usePrayerPhase } from './usePrayerPhase';
import { AllTheProviders, createTestStore } from '@/test-utils';

dayjs.extend(utc);
dayjs.extend(timezone);

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

interface MockPrayer {
  name: string;
  time: string;
  jamaat?: string;
}
const mockNextRef: { value: MockPrayer | null } = { value: null };
const mockCurrentRef: { value: MockPrayer | null } = { value: null };

vi.mock('../contexts/PrayerTimesContext', () => ({
  usePrayerTimesContext: () => ({
    nextPrayer: mockNextRef.value,
    currentPrayer: mockCurrentRef.value,
    todaysPrayerTimes: [],
    isJumuahToday: false,
    jumuahTime: null,
    jumuahDisplayTime: null,
    jumuahKhutbahTime: null,
    jumuahKhutbahRaw: null,
    upcomingJumuahJamaatRaw: null,
    upcomingJumuahKhutbahRaw: null,
    forbiddenPrayer: null,
    tomorrowsJamaats: null,
    currentDate: '',
    hijriDate: null,
  }),
}));

const TEST_TZ = 'Europe/London';

function renderPhase(initialState?: Parameters<typeof createTestStore>[0]) {
  const store = createTestStore({
    ...initialState,
    content: {
      ...createTestStore(initialState).getState().content,
      masjidTimezone: TEST_TZ,
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      AllTheProviders,
      { preloadedState: store.getState() },
      children,
    );
  return renderHook(() => usePrayerPhase(), { wrapper });
}

/**
 * Set fake time to a wall-clock minute in the masjid tz on a fixed BST date.
 * Keeps the test timezone-agnostic regardless of the host machine.
 */
function setMasjidTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  // Pick a date during BST so London = UTC+1 (matches existing dateUtils tests).
  const target = dayjs.tz(`2026-06-15 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`, TEST_TZ);
  vi.setSystemTime(target.toDate());
}

describe('usePrayerPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockNextRef.value = null;
    mockCurrentRef.value = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('A === J (adhan and jamaat at the same time)', () => {
    beforeEach(() => {
      mockNextRef.value = { name: 'Maghrib', time: '21:30', jamaat: '21:30' };
    });

    it('shows jamaat-soon at J - 4 min when adhan equals jamaat', () => {
      setMasjidTime('21:26'); // 4 min before J
      const { result } = renderPhase();
      expect(result.current.phase).toBe('jamaat-soon');
      expect(result.current.prayerName).toBe('Maghrib');
    });

    it('enters in-prayer (sub-phase jamaat) at J', () => {
      setMasjidTime('21:30');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('in-prayer');
      expect(result.current.inPrayerSubPhase).toBe('jamaat');
      expect(result.current.prayerName).toBe('Maghrib');
    });

    it('shows countdown-adhan well before the lead window', () => {
      setMasjidTime('21:00'); // 30 min before J=A
      const { result } = renderPhase();
      expect(result.current.phase).toBe('countdown-adhan');
    });
  });

  describe('A within JAMAAT_LEAD_MIN of J', () => {
    beforeEach(() => {
      mockNextRef.value = { name: 'Maghrib', time: '21:27', jamaat: '21:30' };
    });

    it('shows jamaat-soon at J - 5 min even though adhan has not fired yet', () => {
      setMasjidTime('21:25'); // J - 5
      const { result } = renderPhase();
      expect(result.current.phase).toBe('jamaat-soon');
    });

    it('shows jamaat-soon between adhan and jamaat too', () => {
      setMasjidTime('21:28'); // 1 min after A, 2 min before J
      const { result } = renderPhase();
      expect(result.current.phase).toBe('jamaat-soon');
    });
  });

  describe('A < J - JAMAAT_LEAD_MIN (normal spacing)', () => {
    beforeEach(() => {
      mockNextRef.value = { name: 'Zuhr', time: '12:15', jamaat: '13:00' };
    });

    it('shows countdown-jamaat between adhan and J - 5', () => {
      setMasjidTime('12:30');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('countdown-jamaat');
    });

    it('flips to jamaat-soon at J - 5 exactly', () => {
      setMasjidTime('12:55');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('jamaat-soon');
    });

    it('stays on countdown-adhan before adhan', () => {
      setMasjidTime('11:00');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('countdown-adhan');
    });
  });

  describe('jamaat missing from payload', () => {
    it('never enters jamaat-soon or in-prayer', () => {
      mockNextRef.value = { name: 'Asr', time: '15:30', jamaat: undefined };
      setMasjidTime('15:30');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('countdown-adhan');
    });
  });

  describe('Pi-in-UTC scenario (device tz ≠ masjid tz)', () => {
    /**
     * Force the Vitest "system tz" to UTC so that `Date.getHours()` would
     * report the wrong hour relative to Europe/London during BST. This
     * simulates the Raspberry Pi kiosk reality.
     */
    beforeEach(() => {
      process.env.TZ = 'UTC';
    });

    it('uses masjid wall-clock to resolve the phase, not the device clock', () => {
      mockNextRef.value = { name: 'Zuhr', time: '12:15', jamaat: '13:00' };
      // 12:55 BST = 11:55 UTC — old code would treat this as 11:55 (countdown-adhan).
      vi.setSystemTime(new Date('2026-06-15T11:55:00.000Z'));
      const { result } = renderPhase();
      expect(result.current.phase).toBe('jamaat-soon');
    });
  });
});
