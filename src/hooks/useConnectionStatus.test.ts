/**
 * Tests for useConnectionStatus hook.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionStatus, STARTUP_GRACE_MS, DISCONNECT_SETTLE_MS } from './useConnectionStatus';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { setOffline } from '@/store/slices/uiSlice';
import { setIsPaired } from '@/store/slices/authSlice';
import { LIVE_UPDATES_PAUSED_COPY } from '@/utils/connectionBannerLogic';

const realtime = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload?: unknown) => void>>();
  return {
    connected: false,
    listeners,
    emit(event: string, payload?: unknown) {
      listeners.get(event)?.forEach((cb) => cb(payload));
    },
    reset() {
      listeners.clear();
      this.connected = false;
    },
  };
});

vi.mock('@/services/realtimeService', () => ({
  default: {
    on: vi.fn((event: string, cb: (payload?: unknown) => void) => {
      let set = realtime.listeners.get(event);
      if (!set) {
        set = new Set();
        realtime.listeners.set(event, set);
      }
      set.add(cb);
      return () => set!.delete(cb);
    }),
    get connected() {
      return realtime.connected;
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

function wrapperFor(preloaded?: Parameters<typeof createTestStore>[0]) {
  const store = createTestStore(preloaded);
  return {
    store,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        { preloadedState: store.getState() } as React.ComponentProps<typeof AllTheProviders>,
        children,
      ),
  };
}

describe('useConnectionStatus', () => {
  beforeEach(() => {
    realtime.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns connection status shape', () => {
    const { wrapper } = wrapperFor();
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
    const { wrapper } = wrapperFor();
    renderHook(() => useConnectionStatus(), { wrapper });
    expect(realtimeService.on).toHaveProperty('mock');
    expect(realtimeService.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(realtimeService.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(realtimeService.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('returns no-internet when isOffline is true after grace period', async () => {
    const store = createTestStore();
    store.dispatch(setOffline(true));
    const { wrapper } = wrapperFor(store.getState());
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });
    await act(async () => {
      vi.advanceTimersByTime(STARTUP_GRACE_MS + DISCONNECT_SETTLE_MS);
    });
    expect(result.current.status).toBe('no-internet');
    expect(result.current.hasConnection).toBe(false);
    expect(result.current.message).toBe('No Internet');
  });

  it('stays connected during a brief WebSocket drop so the footer does not flap', async () => {
    const store = createTestStore();
    store.dispatch(setIsPaired(true));
    const { wrapper } = wrapperFor(store.getState());
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(STARTUP_GRACE_MS);
    });

    await act(async () => {
      realtime.emit('connect');
    });
    expect(result.current.status).toBe('connected');

    await act(async () => {
      realtime.emit('disconnect');
      realtime.emit('reconnect', { attempt: 1 });
    });
    expect(result.current.status).toBe('connected');
    expect(result.current.message).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(DISCONNECT_SETTLE_MS - 100);
    });
    expect(result.current.status).toBe('connected');
  });

  it('reports Live updates paused after a settled WebSocket outage', async () => {
    const store = createTestStore();
    store.dispatch(setIsPaired(true));
    const { wrapper } = wrapperFor(store.getState());
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(STARTUP_GRACE_MS);
    });

    await act(async () => {
      realtime.emit('disconnect');
      realtime.emit('reconnect', { attempt: 1 });
      vi.advanceTimersByTime(DISCONNECT_SETTLE_MS);
    });

    expect(result.current.hasConnection).toBe(false);
    expect(result.current.status).toBe('reconnecting');
    expect(result.current.message).toBe(LIVE_UPDATES_PAUSED_COPY);
    expect(result.current.severity).toBe('info');
    expect(result.current.message).not.toMatch(/reconnect/i);
    expect(result.current.message).not.toMatch(/unreachable/i);
  });

  it('uses the same paused copy when the socket is down and not actively retrying', async () => {
    const store = createTestStore();
    store.dispatch(setIsPaired(true));
    const { wrapper } = wrapperFor(store.getState());
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(STARTUP_GRACE_MS + DISCONNECT_SETTLE_MS);
    });

    expect(result.current.status).toBe('server-unreachable');
    expect(result.current.message).toBe(LIVE_UPDATES_PAUSED_COPY);
    expect(result.current.severity).toBe('info');
  });

  it('returns to connected without panic copy when the socket recovers', async () => {
    const store = createTestStore();
    store.dispatch(setIsPaired(true));
    const { wrapper } = wrapperFor(store.getState());
    const { result } = renderHook(() => useConnectionStatus(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(STARTUP_GRACE_MS);
      realtime.emit('reconnect', { attempt: 1 });
      vi.advanceTimersByTime(DISCONNECT_SETTLE_MS);
    });
    expect(result.current.message).toBe(LIVE_UPDATES_PAUSED_COPY);

    await act(async () => {
      realtime.emit('connect');
    });
    expect(result.current.status).toBe('connected');
    expect(result.current.message).toBe('');
    expect(result.current.hasConnection).toBe(true);
  });

  it('cleans up timers and listeners on unmount', () => {
    const { wrapper } = wrapperFor();
    const { unmount } = renderHook(() => useConnectionStatus(), { wrapper });
    unmount();
  });
});
