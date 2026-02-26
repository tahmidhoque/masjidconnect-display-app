/**
 * Tests for useConnectionStatus hook.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionStatus } from './useConnectionStatus';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { setOffline } from '@/store/slices/uiSlice';

vi.mock('@/services/realtimeService', () => ({
  default: {
    on: vi.fn(() => () => {}),
    get connected() {
      return false;
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('useConnectionStatus', () => {
  it('returns connection status shape', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AllTheProviders, null, children);
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });
    expect(result.current).toHaveProperty('hasConnection');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('message');
    expect(result.current).toHaveProperty('severity');
    expect(['connected', 'reconnecting', 'no-internet', 'server-unreachable', 'no-connection']).toContain(
      result.current.status,
    );
  });

  it('subscribes to realtimeService events on mount', async () => {
    const realtimeService = (await import('@/services/realtimeService')).default;
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AllTheProviders, null, children);
    renderHook(() => useConnectionStatus(), { wrapper });
    expect(realtimeService.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(realtimeService.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(realtimeService.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('returns no-internet when isOffline is true after grace period', async () => {
    vi.useFakeTimers();
    const store = createTestStore();
    store.dispatch(setOffline(true));
    const preloaded = store.getState();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
        children,
      );
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current.status).toBe('no-internet');
    expect(result.current.hasConnection).toBe(false);
    vi.useRealTimers();
  });
});
