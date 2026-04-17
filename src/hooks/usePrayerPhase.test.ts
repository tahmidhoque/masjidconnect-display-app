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
const mockIsJumuahTodayRef: { value: boolean } = { value: false };
const mockJumuahTimeRef: { value: string | null } = { value: null };

vi.mock('../contexts/PrayerTimesContext', () => ({
  usePrayerTimesContext: () => ({
    nextPrayer: mockNextRef.value,
    currentPrayer: mockCurrentRef.value,
    todaysPrayerTimes: [],
    isJumuahToday: mockIsJumuahTodayRef.value,
    jumuahTime: mockJumuahTimeRef.value,
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
    React.createElement(AllTheProviders, {
      preloadedState: store.getState(),
      children,
    });
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
    mockIsJumuahTodayRef.value = false;
    mockJumuahTimeRef.value = null;
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

  /**
   * On Fridays the Zuhr slot is replaced by Jumu'ah for the live phase machine.
   * `nextPrayer.name` is still 'Zuhr' (the panel keeps the Zuhr row), but
   * `jumuahTime` from the API takes over as the J anchor for countdown,
   * jamaat-soon, and in-prayer transitions. These tests pin that behaviour.
   */
  describe('Friday — Jumu\u2019ah jamaat overrides Zuhr jamaat', () => {
    beforeEach(() => {
      // zuhrJamaat = 13:30, jummahJamaat = 13:45 — the two diverge so the test
      // distinguishes which one drove the phase decision.
      mockNextRef.value = { name: 'Zuhr', time: '13:00', jamaat: '13:30' };
      mockIsJumuahTodayRef.value = true;
      mockJumuahTimeRef.value = '13:45';
    });

    it('stays on countdown-jamaat past Zuhr jamaat when Jumuah is later', () => {
      // 13:35 — past zuhrJamaat (13:30) but before Jumuah lead window (13:40).
      // Old behaviour would have entered in-prayer here against zuhrJamaat.
      setMasjidTime('13:35');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('countdown-jamaat');
      expect(result.current.prayerName).toBe('Zuhr');
    });

    it('flips to jamaat-soon at Jumuah J - 5 (not Zuhr J - 5)', () => {
      setMasjidTime('13:40'); // Jumuah J - 5
      const { result } = renderPhase();
      expect(result.current.phase).toBe('jamaat-soon');
    });

    it('enters in-prayer at Jumuah jamaat, not Zuhr jamaat', () => {
      setMasjidTime('13:45');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('in-prayer');
      expect(result.current.inPrayerSubPhase).toBe('jamaat');
      // prayerName stays 'Zuhr' — DisplayScreen swaps it to the API-driven
      // Jumu'ah label before passing to InPrayerScreen.
      expect(result.current.prayerName).toBe('Zuhr');
    });

    it('uses currentPrayer.jamaat → Jumuah substitution for the in-prayer window', () => {
      // Simulate post-jamaat: usePrayerTimes has advanced nextPrayer to Asr
      // but kept currentPrayer = Zuhr for the duration of the window.
      mockCurrentRef.value = { name: 'Zuhr', time: '13:00', jamaat: '13:30' };
      mockNextRef.value = { name: 'Asr', time: '17:00', jamaat: '17:15' };
      setMasjidTime('13:50'); // 5 min after Jumuah jamaat
      const { result } = renderPhase();
      expect(result.current.phase).toBe('in-prayer');
      expect(result.current.prayerName).toBe('Zuhr');
    });

    it('falls back to zuhrJamaat when jumuahTime is missing on a Friday', () => {
      // Defensive: API hasn't supplied jummahJamaat for this Friday — we must
      // not blank the countdown; fall through to the regular Zuhr jamaat.
      mockJumuahTimeRef.value = null;
      setMasjidTime('13:30');
      const { result } = renderPhase();
      expect(result.current.phase).toBe('in-prayer');
      expect(result.current.prayerName).toBe('Zuhr');
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
