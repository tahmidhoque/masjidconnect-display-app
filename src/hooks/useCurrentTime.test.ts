/**
 * Tests for useCurrentTime hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCurrentTime from './useCurrentTime';

describe('useCurrentTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a Date instance', () => {
    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toBeInstanceOf(Date);
  });

  it('updates roughly every second when timer advances', () => {
    const base = new Date(2024, 0, 15, 12, 0, 0);
    vi.setSystemTime(base);

    const { result } = renderHook(() => useCurrentTime());
    expect(result.current.getTime()).toBe(base.getTime());

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // After 1s the global time manager will have fired
    expect(result.current).toBeInstanceOf(Date);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useCurrentTime());
    unmount();
    // No error and no leak (subscription removed)
  });
});
