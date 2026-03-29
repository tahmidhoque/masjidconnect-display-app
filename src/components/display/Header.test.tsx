/**
 * Tests for Header component.
 *
 * Header uses useMasjidTime (which reads from Redux) to display the
 * clock, so every render must be wrapped with a Redux provider.
 *
 * The DST / timezone tests verify that the clock shows the masjid's
 * wall-clock time rather than the device's system time — the primary
 * regression fixed in the DST timezone handling update.
 *
 * Reference instant: 2026-03-29T10:00:00Z
 *   • UTC device clock   → 10:00
 *   • Europe/London BST  → 11:00
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from './Header';
import { createTestStore, AllTheProviders } from '@/test-utils';

// ---------------------------------------------------------------------------
// Helper — build a wrapper with an optional masjidTimezone in the Redux store
// ---------------------------------------------------------------------------

function makeWrapper(masjidTimezone: string | null = null) {
  const store = createTestStore();
  const contentState = store.getState().content;
  const preloaded = { content: { ...contentState, masjidTimezone } };

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      AllTheProviders,
      { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
      children,
    );
  }

  return Wrapper;
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('Header — rendering', () => {
  it('renders without crashing', () => {
    render(React.createElement(Header), { wrapper: makeWrapper() });
    expect(document.body.textContent).toBeTruthy();
  });

  it('renders a grid container element', () => {
    render(React.createElement(Header), { wrapper: makeWrapper() });
    const el = document.querySelector('[class*="grid"]');
    expect(el).toBeInTheDocument();
  });

  it('shows "Ramadan Mubarak — Day N" when isRamadan and ramadanDay are provided', () => {
    render(
      React.createElement(Header, { isRamadan: true, ramadanDay: 15 }),
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText(/Ramadan Mubarak — Day 15/)).toBeInTheDocument();
  });

  it('shows two-line Ramadan text when ramadanTwoLines is true', () => {
    render(
      React.createElement(Header, { isRamadan: true, ramadanDay: 10, ramadanTwoLines: true }),
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText(/Day 10/)).toBeInTheDocument();
    expect(screen.getByText(/Ramadan Mubarak/)).toBeInTheDocument();
  });

  it('does not render Ramadan text when isRamadan is false', () => {
    render(
      React.createElement(Header, { isRamadan: false, ramadanDay: 15 }),
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByText(/Ramadan/)).not.toBeInTheDocument();
  });

  it('displays the Hijri date when not in Ramadan mode', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z'));

    render(React.createElement(Header), { wrapper: makeWrapper('Europe/London') });

    // Hijri date always contains "AH"
    expect(screen.getByText(/AH/)).toBeInTheDocument();

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// DST / timezone clock display
// ---------------------------------------------------------------------------

describe('Header — DST timezone clock display', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows 11:00 (BST) when device UTC is 10:00 and masjidTimezone is Europe/London (24h format)', () => {
    // THE CORE DST REGRESSION TEST.
    // If the Pi is in UTC but the masjid is in BST, the clock must show BST time.
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper('Europe/London') },
    );

    // 24h format: we expect "11:00" not "10:00"
    expect(screen.getByText(/11:00/)).toBeInTheDocument();
    expect(screen.queryByText(/^10:00$/)).not.toBeInTheDocument();
  });

  it('shows "11" in the hours portion in 12h format (BST)', () => {
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '12h' }),
      { wrapper: makeWrapper('Europe/London') },
    );

    // 12h format: 11:00 AM → main part "11:00" with period "am"
    expect(screen.getByText(/11:00/)).toBeInTheDocument();
  });

  it('shows 10:00 UTC when masjidTimezone is UTC', () => {
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper('UTC') },
    );

    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });

  it('shows 14:00 for Asia/Dubai (UTC+4) at 10:00 UTC', () => {
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper('Asia/Dubai') },
    );

    expect(screen.getByText(/14:00/)).toBeInTheDocument();
  });

  it('shows 06:00 for America/New_York (UTC-4, EDT in March) at 10:00 UTC', () => {
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper('America/New_York') },
    );

    expect(screen.getByText(/06:00/)).toBeInTheDocument();
  });

  it('falls back to Europe/London (BST) when store has no timezone', () => {
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z'));

    // No timezone in the Redux store → falls back to defaultMasjidTimezone = Europe/London.
    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper(null) },
    );

    // Default fallback is Europe/London; in BST → 11:00.
    expect(screen.getByText(/11:00/)).toBeInTheDocument();
  });

  it('shows correct date (Monday 30 March) in BST at 23:30 UTC on Sunday 29 March', () => {
    // 2026-03-29T23:30:00Z = 00:30 BST on Mon 30 Mar 2026.
    vi.setSystemTime(new Date('2026-03-29T23:30:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper('Europe/London') },
    );

    // The Gregorian date line should show "30 March 2026" (BST calendar date).
    expect(screen.getByText(/30 March 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Monday/)).toBeInTheDocument();
  });

  it('shows Sunday 29 March on UTC side when crossing midnight in BST', () => {
    // Same instant: the UTC date is still Sunday 29 March.
    // With Europe/London it's Monday 30 March — this is what the display shows.
    vi.setSystemTime(new Date('2026-03-29T23:30:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper('Europe/London') },
    );

    // Should NOT show Sunday or "29 March" in the clock/date area
    expect(screen.queryByText(/Sunday/)).not.toBeInTheDocument();
    // "29 March" shouldn't appear in the left-column date
    expect(screen.queryByText(/29 March/)).not.toBeInTheDocument();
  });

  it('shows same time in winter (Jan) for UTC and Europe/London (no DST offset)', () => {
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

    render(
      React.createElement(Header, { timeFormat: '24h' }),
      { wrapper: makeWrapper('Europe/London') },
    );

    // January: no BST, London = UTC → 10:00.
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });
});
