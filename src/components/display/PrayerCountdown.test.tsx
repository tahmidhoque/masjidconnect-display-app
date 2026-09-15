/**
 * Tests for PrayerCountdown.
 *
 * Focus: the after-Isha → tomorrow's Fajr regression. When `usePrayerTimes`
 * swaps `nextPrayer` to the next-day record (Fajr at 05:00), the time strings
 * are still HH:mm form and `nowMin >= J` for today's wall-clock. Before the
 * fix, the countdown returned `null` here and rendered "0s" all night.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrayerCountdown from './PrayerCountdown';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { DEFAULT_DISPLAY_SETTINGS } from '@/store/slices/contentSlice';
import type { DisplaySettings } from '@/api/models';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const fajrTomorrow = {
  name: 'Fajr',
  time: '05:00',
  jamaat: '05:30',
  displayTime: '5:00 AM',
  displayJamaat: '5:30 AM',
  isNext: true,
  isCurrent: false,
  timeUntil: '',
  jamaatTime: '05:30',
};

const ishaToday = {
  name: 'Isha',
  time: '20:00',
  jamaat: '20:15',
  displayTime: '8:00 PM',
  displayJamaat: '8:15 PM',
  isNext: false,
  isCurrent: true,
  timeUntil: '',
  jamaatTime: '20:15',
};

vi.mock('../../contexts/PrayerTimesContext', () => ({
  usePrayerTimesContext: vi.fn(),
}));

import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';

function makeWrapper(settings?: Partial<DisplaySettings>) {
  const store = createTestStore();
  const contentState = store.getState().content;
  const preloaded = {
    content: {
      ...contentState,
      masjidTimezone: 'Europe/London',
      displaySettings: settings
        ? { ...DEFAULT_DISPLAY_SETTINGS, ...contentState.displaySettings, ...settings }
        : { ...contentState.displaySettings, ...DEFAULT_DISPLAY_SETTINGS },
    },
  };
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      AllTheProviders,
      { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
      children,
    );
  };
}

describe('PrayerCountdown — after-Isha tomorrow regression', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('counts down to tomorrow\'s Fajr at 23:00 (does NOT show 0s)', () => {
    // 2026-04-19T22:00:00Z = 23:00 BST. nextPrayer is tomorrow's Fajr at 05:00.
    // Pre-fix: liveCountdown = "0s" (targetTime returned null because nowMin >= J).
    // Post-fix: counts down to tomorrow's adhan → "5h 59m" (give or take 1m).
    vi.setSystemTime(new Date('2026-04-19T22:00:00.000Z'));

    (usePrayerTimesContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      nextPrayer: fajrTomorrow,
      currentPrayer: null,
      isJumuahToday: false,
      jumuahTime: null,
    });

    render(
      <PrayerCountdown phase="countdown-adhan" />,
      { wrapper: makeWrapper() },
    );

    expect(screen.queryByText(/^0s$/)).not.toBeInTheDocument();
    // Around 6h to 5:00 from 23:00 BST (with adhan at 05:00 next day BST = 6h gap)
    // CountdownDisplay splits into individual <span> elements per number/unit.
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('renders "Jamaat in progress" when phase is in-prayer (does not leak tomorrow countdown)', () => {
    // Inside the in-prayer window for Isha. nextPrayer has already advanced to
    // tomorrow's Fajr in some flows; the in-prayer render branch must win
    // regardless of what targetTime computes.
    vi.setSystemTime(new Date('2026-04-19T19:20:00.000Z')); // 20:20 BST

    (usePrayerTimesContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      nextPrayer: fajrTomorrow,
      currentPrayer: ishaToday,
      isJumuahToday: false,
      jumuahTime: null,
    });

    render(
      <PrayerCountdown phase="in-prayer" inPrayerSubPhase="jamaat" />,
      { wrapper: makeWrapper() },
    );

    expect(screen.getByText(/Jamaat in progress/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0s$/)).not.toBeInTheDocument();
  });

  it('counts down to today\'s adhan when next prayer is later today (regression guard)', () => {
    // 10:00 BST on 2026-04-19. Next prayer = Zuhr at 13:00 (3h away).
    vi.setSystemTime(new Date('2026-04-19T09:00:00.000Z'));

    const zuhrToday = {
      ...fajrTomorrow,
      name: 'Zuhr',
      time: '13:00',
      jamaat: '13:30',
      displayTime: '1:00 PM',
      displayJamaat: '1:30 PM',
    };
    (usePrayerTimesContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      nextPrayer: zuhrToday,
      currentPrayer: null,
      isJumuahToday: false,
      jumuahTime: null,
    });

    render(
      <PrayerCountdown phase="countdown-adhan" />,
      { wrapper: makeWrapper() },
    );

    expect(screen.queryByText(/^0s$/)).not.toBeInTheDocument();
    // 10:00 → 13:00 = 3h
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
  });
});

describe('PrayerCountdown — post-Salah countdown to next prayer', () => {
  const zuhr = {
    name: 'Zuhr',
    time: '13:00',
    jamaat: '13:30',
    displayTime: '1:00 PM',
    displayJamaat: '1:30 PM',
    isNext: true,
    isCurrent: true,
    timeUntil: '',
    jamaatTime: '13:30',
  };
  const asr = {
    name: 'Asr',
    time: '16:45',
    jamaat: '17:15',
    displayTime: '4:45 PM',
    displayJamaat: '5:15 PM',
    isNext: false,
    isCurrent: false,
    timeUntil: '',
    jamaatTime: '17:15',
  };
  const fajr = {
    name: 'Fajr',
    time: '05:00',
    jamaat: '05:30',
    displayTime: '5:00 AM',
    displayJamaat: '5:30 AM',
    isNext: false,
    isCurrent: false,
    timeUntil: '',
    jamaatTime: '05:30',
  };
  const isha = {
    name: 'Isha',
    time: '20:00',
    jamaat: '20:15',
    displayTime: '8:00 PM',
    displayJamaat: '8:15 PM',
    isNext: true,
    isCurrent: true,
    timeUntil: '',
    jamaatTime: '20:15',
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('counts down to Asr during post-jamaat instead of a static Zuhr prayer label', () => {
    // 13:40 BST — Zuhr jamaat (13:30) has ended; still inside minutesAfterJamaat.
    vi.setSystemTime(new Date('2026-04-19T12:40:00.000Z'));

    (usePrayerTimesContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      nextPrayer: zuhr,
      currentPrayer: zuhr,
      todaysPrayerTimes: [fajr, zuhr, asr, isha],
      isJumuahToday: false,
      jumuahTime: null,
    });

    render(
      <PrayerCountdown phase="in-prayer" inPrayerSubPhase="post-jamaat" />,
      { wrapper: makeWrapper() },
    );

    expect(screen.queryByText(/^prayer$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Asr prayer in/i)).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('counts down to the next salah during post-jamaat supplication as well', () => {
    vi.setSystemTime(new Date('2026-04-19T12:40:00.000Z'));

    (usePrayerTimesContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      nextPrayer: zuhr,
      currentPrayer: zuhr,
      todaysPrayerTimes: [fajr, zuhr, asr, isha],
      isJumuahToday: false,
      jumuahTime: null,
    });

    render(
      <PrayerCountdown phase="in-prayer" inPrayerSubPhase="post-jamaat-supplication" />,
      { wrapper: makeWrapper() },
    );

    expect(screen.getByText(/Asr prayer in/i)).toBeInTheDocument();
    expect(screen.queryByText(/Jamaat in progress/i)).not.toBeInTheDocument();
  });

  it('counts down to tomorrow\'s Fajr during Isha post-jamaat', () => {
    vi.setSystemTime(new Date('2026-04-19T19:40:00.000Z')); // 20:40 BST

    (usePrayerTimesContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      nextPrayer: isha,
      currentPrayer: isha,
      todaysPrayerTimes: [fajr, zuhr, asr, isha],
      isJumuahToday: false,
      jumuahTime: null,
    });

    render(
      <PrayerCountdown phase="in-prayer" inPrayerSubPhase="post-jamaat" />,
      { wrapper: makeWrapper() },
    );

    expect(screen.getByText(/Fajr prayer in/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0s$/)).not.toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
  });
});

describe('PrayerCountdown — Portal pre-jamaat lead', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const zuhrTight = {
    name: 'Zuhr',
    time: '12:58',
    jamaat: '13:00',
    displayTime: '12:58 PM',
    displayJamaat: '1:00 PM',
    isNext: true,
    isCurrent: false,
    timeUntil: '',
    jamaatTime: '13:00',
  };

  it('stays on the adhan label 4 min before jamaat when Portal lead is 60s', () => {
    // 12:56 BST — inside the legacy 5-min window but outside a 60s Portal lead.
    vi.setSystemTime(new Date('2026-06-15T11:56:00.000Z'));
    (usePrayerTimesContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      nextPrayer: zuhrTight,
      currentPrayer: null,
      isJumuahToday: false,
      jumuahTime: null,
    });

    render(
      <PrayerCountdown phase="countdown-adhan" />,
      {
        wrapper: makeWrapper({
          preJamaatCountdownEnabled: true,
          preJamaatCountdownSeconds: 60,
        }),
      },
    );

    expect(screen.getByText(/Zuhr prayer in/i)).toBeInTheDocument();
    expect(screen.queryByText(/Jamaat in/i)).not.toBeInTheDocument();
  });
});

