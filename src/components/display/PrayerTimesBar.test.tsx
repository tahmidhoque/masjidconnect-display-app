/**
 * PrayerTimesBar — sidebar tile column layout.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrayerTimesBar from './PrayerTimesBar';
import { AllTheProviders, createTestStore } from '@/test-utils';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const prayers = [
  { name: 'Fajr', time: '03:15', jamaat: '03:45', isNext: true },
  { name: 'Sunrise', time: '04:43', isNext: false },
  { name: 'Zuhr', time: '13:05', jamaat: '13:30', isNext: false },
  { name: 'Asr', time: '18:30', jamaat: '19:00', isNext: false },
  { name: 'Maghrib', time: '21:21', jamaat: '21:26', isNext: false },
  { name: 'Isha', time: '22:45', jamaat: '23:00', isNext: false },
];

vi.mock('../../contexts/PrayerTimesContext', () => ({
  usePrayerTimesContext: () => ({
    todaysPrayerTimes: prayers,
    nextPrayer: prayers[0],
    currentPrayer: null,
    isJumuahToday: false,
    jumuahTime: null,
    forbiddenPrayer: null,
    tomorrowsJamaats: null,
  }),
}));

function renderBar(props: React.ComponentProps<typeof PrayerTimesBar> = {}) {
  const store = createTestStore();
  return render(
    React.createElement(
      AllTheProviders,
      { preloadedState: store.getState() } as React.ComponentProps<typeof AllTheProviders>,
      React.createElement(PrayerTimesBar, { variant: 'sidebar', ...props }),
    ),
  );
}

describe('PrayerTimesBar — sidebar tile columns', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date('2026-06-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to a two-column tile grid', () => {
    renderBar();
    expect(screen.getByTestId('prayer-strip-tile-grid')).toHaveAttribute(
      'data-tile-columns',
      '2',
    );
  });

  it('stacks prayer names in a single column when requested', () => {
    renderBar({ tileColumns: 1 });
    expect(screen.getByTestId('prayer-strip-tile-grid')).toHaveAttribute(
      'data-tile-columns',
      '1',
    );
    expect(screen.getByText('Fajr')).toBeInTheDocument();
    expect(screen.getByText('Isha')).toBeInTheDocument();
  });
});
