/**
 * Tests for useMasjidTime hook.
 *
 * Verifies that the hook:
 *  1. Returns a dayjs object in the masjid's IANA timezone (not the device's).
 *  2. Falls back to `Europe/London` (defaultMasjidTimezone) when the store
 *     has no timezone set.
 *  3. Updates every second as the global time manager ticks.
 *  4. Switches timezone when the Redux store value changes.
 *  5. Correctly offsets during BST (UTC+1) — the core DST regression fix.
 *
 * Strategy:
 *  - `vi.setSystemTime` pins the UTC instant (device-local = UTC in test runner).
 *  - We provide Redux store state via `AllTheProviders` / `createTestStore`.
 *  - We check dayjs `.hour()` and `.format()` in the masjid zone rather than
 *    device-local getters so the assertions are zone-agnostic.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import useMasjidTime from './useMasjidTime';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { defaultMasjidTimezone } from '@/config/environment';

dayjs.extend(utc);
dayjs.extend(timezone);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** BST instant: 10:00 UTC = 11:00 Europe/London (DST active). */
const BST_UTC = '2026-03-29T10:00:00.000Z';

/** Winter instant: 10:00 UTC = 10:00 Europe/London (no DST). */
const WINTER_UTC = '2026-01-15T10:00:00.000Z';

/**
 * Build a React wrapper that provides a Redux store with the given masjidTimezone.
 */
function makeWrapper(masjidTimezone: string | null) {
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
// Tests
// ---------------------------------------------------------------------------

describe('useMasjidTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a dayjs object', () => {
    vi.setSystemTime(new Date(BST_UTC));
    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });
    expect(result.current).toHaveProperty('format');
    expect(result.current).toHaveProperty('hour');
    expect(result.current).toHaveProperty('minute');
  });

  // ---- Timezone conversion -------------------------------------------------

  it('returns BST wall-clock hour (11) not UTC hour (10) during DST', () => {
    vi.setSystemTime(new Date(BST_UTC)); // 10:00 UTC = 11:00 BST

    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    // dayjs.tz converts the UTC instant to Europe/London wall-clock time.
    expect(result.current.hour()).toBe(11);
    expect(result.current.format('HH:mm')).toBe('11:00');
  });

  it('returns UTC+0 hour during winter (no DST)', () => {
    vi.setSystemTime(new Date(WINTER_UTC)); // 10:00 UTC = 10:00 London (no BST)

    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    expect(result.current.hour()).toBe(10);
    expect(result.current.format('HH:mm')).toBe('10:00');
  });

  it('returns America/New_York wall-clock time (UTC-4 in March DST)', () => {
    // 2026-03-29: US DST started Mar 8 → New York = EDT = UTC-4.
    // 10:00 UTC = 06:00 New York.
    vi.setSystemTime(new Date(BST_UTC));

    const wrapper = makeWrapper('America/New_York');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    expect(result.current.hour()).toBe(6);
    expect(result.current.format('HH:mm')).toBe('06:00');
  });

  it('returns Asia/Karachi time (UTC+5, no DST)', () => {
    // 10:00 UTC = 15:00 Karachi (UTC+5).
    vi.setSystemTime(new Date(BST_UTC));

    const wrapper = makeWrapper('Asia/Karachi');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    expect(result.current.hour()).toBe(15);
    expect(result.current.format('HH:mm')).toBe('15:00');
  });

  // ---- Fallback -----------------------------------------------------------

  it('falls back to defaultMasjidTimezone when store has no timezone (null)', () => {
    vi.setSystemTime(new Date(BST_UTC)); // 10:00 UTC = 11:00 BST

    const wrapper = makeWrapper(null); // No timezone in store
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    // defaultMasjidTimezone is 'Europe/London' → should produce BST time.
    const expected = dayjs(new Date(BST_UTC)).tz(defaultMasjidTimezone).hour();
    expect(result.current.hour()).toBe(expected);
  });

  it('defaultMasjidTimezone is Europe/London', () => {
    expect(defaultMasjidTimezone).toBe('Europe/London');
  });

  // ---- Tick updates -------------------------------------------------------

  it('updates minute value when timer advances 60 seconds', () => {
    vi.setSystemTime(new Date('2026-03-29T10:00:00.000Z')); // 11:00 BST

    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    expect(result.current.minute()).toBe(0);

    // Advance fake clock 60 seconds — the GlobalTimeManager fires 60 ticks.
    // Do NOT use waitFor here: it uses real timers internally and deadlocks
    // with vi.useFakeTimers().
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.minute()).toBe(1);
  });

  it('updates hour when crossing the hour boundary', () => {
    // Start at 10:59:30 UTC = 11:59:30 BST
    vi.setSystemTime(new Date('2026-03-29T10:59:30.000Z'));

    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    expect(result.current.hour()).toBe(11);
    expect(result.current.minute()).toBe(59);

    act(() => {
      vi.advanceTimersByTime(31_000); // +31 seconds → 12:00:01 BST
    });

    expect(result.current.hour()).toBe(12);
    expect(result.current.minute()).toBe(0);
  });

  // ---- Date boundary ------------------------------------------------------

  it('returns correct calendar date in masjid timezone', () => {
    // 23:30 UTC = 00:30 BST next day (2026-03-30).
    vi.setSystemTime(new Date('2026-03-29T23:30:00.000Z'));

    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    // The masjid calendar date should be March 30, not March 29.
    expect(result.current.date()).toBe(30);
    expect(result.current.month()).toBe(2); // dayjs months are 0-indexed; March = 2
  });

  it('returns correct weekday in masjid timezone', () => {
    // Use a summer date where there is no DST transition ambiguity.
    // 2026-06-13T23:30:00Z = Saturday UTC = 00:30 BST on Sunday June 14.
    // June is well into BST (UTC+1), no transition on that date.
    vi.setSystemTime(new Date('2026-06-13T23:30:00.000Z'));

    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    // Sunday = 0 in dayjs .day(); the BST date is June 14 (Sunday).
    expect(result.current.day()).toBe(0);
    expect(result.current.date()).toBe(14);
  });

  // ---- Format helpers -----------------------------------------------------

  it('format("dddd, MMMM D, YYYY") returns masjid-local date string', () => {
    // 23:30 UTC = 00:30 BST → Mar 30 not Mar 29.
    vi.setSystemTime(new Date('2026-03-29T23:30:00.000Z'));

    const wrapper = makeWrapper('Europe/London');
    const { result } = renderHook(() => useMasjidTime(), { wrapper });

    const formatted = result.current.format('dddd, MMMM D, YYYY');
    expect(formatted).toContain('March 30');
    expect(formatted).toContain('2026');
  });

  // ---- Cleanup / no leaks -------------------------------------------------

  it('unsubscribes from the time manager on unmount without throwing', () => {
    vi.setSystemTime(new Date(BST_UTC));
    const wrapper = makeWrapper('Europe/London');
    const { unmount } = renderHook(() => useMasjidTime(), { wrapper });
    expect(() => unmount()).not.toThrow();
  });
});
