/**
 * Realtime middleware tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realtimeMiddleware, cleanupRealtimeMiddleware } from './realtimeMiddleware';
import { createTestStore } from '@/test-utils/mock-store';

const mockPerformFactoryReset = vi.fn();
const mockOn = vi.fn(() => () => {});
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockSetHttpHeartbeatEnabled = vi.fn();
const mockHasCredentials = vi.fn();
const mockGetMasjidId = vi.fn(() => null);
const mockSetOnScheduledRestart = vi.fn();
const mockSetOnUpdateStatus = vi.fn();
const mockClearScheduledRestart = vi.fn();
const mockClearDeviceUpdatePolling = vi.fn();
const mockSetAlert = vi.fn();
const mockClearAlert = vi.fn();

vi.mock('@/services/realtimeService', () => ({
  default: {
    on: (event: string, handler: () => void) =>
      (mockOn as (e: string, h: () => void) => (() => void))(event, handler),
    connect: () => mockConnect(),
    disconnect: () => mockDisconnect(),
  },
}));

vi.mock('@/services/syncService', () => ({
  default: {
    start: () => mockStart(),
    stop: () => mockStop(),
    setHttpHeartbeatEnabled: (v: boolean) => mockSetHttpHeartbeatEnabled(v),
    on: vi.fn(() => () => {}),
  },
}));

vi.mock('@/services/credentialService', () => ({
  default: {
    hasCredentials: () => mockHasCredentials(),
    getMasjidId: () => mockGetMasjidId(),
    getCredentials: vi.fn(),
  },
}));

vi.mock('@/services/remoteControlService', () => ({
  default: {
    setOnScheduledRestart: (...args: unknown[]) => mockSetOnScheduledRestart(...args),
    setOnUpdateStatus: (...args: unknown[]) => mockSetOnUpdateStatus(...args),
    clearScheduledRestart: () => mockClearScheduledRestart(),
    clearDeviceUpdatePolling: () => mockClearDeviceUpdatePolling(),
    handleCommand: vi.fn(),
    performFactoryReset: () => mockPerformFactoryReset(),
  },
}));

vi.mock('@/services/emergencyAlertService', () => ({
  default: {
    setAlert: (...args: unknown[]) => mockSetAlert(...args),
    clearAlert: () => mockClearAlert(),
    addListener: vi.fn(() => () => {}),
  },
}));

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('realtimeMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockHasCredentials.mockReturnValue(true);
    cleanupRealtimeMiddleware();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls init after auth/checkPairingStatus/fulfilled when authenticated', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
    });
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'auth/checkPairingStatus/fulfilled',
      payload: { isPaired: true, credentials: { screenId: 's', apiKey: 'k', masjidId: 'm' } },
    });
    expect(mockConnect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();
  });

  it('does not call init when not authenticated', () => {
    mockHasCredentials.mockReturnValue(false);
    const store = createTestStore();
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'auth/checkPairingStatus/fulfilled',
      payload: { isPaired: true, credentials: {} },
    });
    vi.advanceTimersByTime(100);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('calls cleanup on auth/logout', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
    });
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'auth/checkPairingStatus/fulfilled',
      payload: { isPaired: true, credentials: {} },
    });
    vi.advanceTimersByTime(100);
    expect(mockConnect).toHaveBeenCalled();
    mockConnect.mockClear();
    mockStop.mockClear();
    dispatch({ type: 'auth/logout' });
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });

  it('passes action to next', () => {
    const store = createTestStore();
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    const action = { type: 'test/action' };
    dispatch(action);
    expect(next).toHaveBeenCalledWith(action);
  });

  it('subscribes to screen_token_invalid and calls performFactoryReset when fired', () => {
    const handlers = new Map<string, () => void>();
    mockOn.mockImplementation(
      ((event: string, handler: () => void) => {
        handlers.set(event, handler);
        return () => {
          handlers.delete(event);
        };
      }) as never,
    );
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
    });
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'auth/checkPairingStatus/fulfilled',
      payload: { isPaired: true, credentials: { screenId: 's', apiKey: 'k', masjidId: 'm' } },
    });
    vi.advanceTimersByTime(100);
    const invalidHandler = handlers.get('screen_token_invalid');
    expect(invalidHandler).toBeDefined();
    invalidHandler?.();
    expect(mockPerformFactoryReset).toHaveBeenCalledTimes(1);
  });

  it('emergency:alert with action clear calls clearAlert and not setAlert', () => {
    const handlers = new Map<string, (data?: unknown) => void>();
    mockOn.mockImplementation(
      ((event: string, handler: (data?: unknown) => void) => {
        handlers.set(event, handler);
        return () => {
          handlers.delete(event);
        };
      }) as never,
    );
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
    });
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'auth/checkPairingStatus/fulfilled',
      payload: { isPaired: true, credentials: { screenId: 's', apiKey: 'k', masjidId: 'm' } },
    });
    vi.advanceTimersByTime(100);
    const alertHandler = handlers.get('emergency:alert');
    expect(alertHandler).toBeDefined();
    alertHandler?.({ action: 'clear' });
    expect(mockClearAlert).toHaveBeenCalledTimes(1);
    expect(mockSetAlert).not.toHaveBeenCalled();
  });

  it('emergency:alert clear is recognised case-insensitively and inside nested data', () => {
    const handlers = new Map<string, (data?: unknown) => void>();
    mockOn.mockImplementation(
      ((event: string, handler: (data?: unknown) => void) => {
        handlers.set(event, handler);
        return () => {
          handlers.delete(event);
        };
      }) as never,
    );
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
    });
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'auth/checkPairingStatus/fulfilled',
      payload: { isPaired: true, credentials: { screenId: 's', apiKey: 'k', masjidId: 'm' } },
    });
    vi.advanceTimersByTime(100);
    const alertHandler = handlers.get('emergency:alert');
    mockClearAlert.mockClear();
    alertHandler?.({ data: { action: 'CLEAR' } });
    expect(mockClearAlert).toHaveBeenCalledTimes(1);
    alertHandler?.(JSON.stringify({ action: 'hide' }));
    expect(mockClearAlert).toHaveBeenCalledTimes(2);
  });

  it('emergency:alert show path calls setAlert with payload fields', () => {
    const handlers = new Map<string, (data?: unknown) => void>();
    mockOn.mockImplementation(
      ((event: string, handler: (data?: unknown) => void) => {
        handlers.set(event, handler);
        return () => {
          handlers.delete(event);
        };
      }) as never,
    );
    mockGetMasjidId.mockReturnValue('masjid-1');
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
    });
    const middleware = realtimeMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'auth/checkPairingStatus/fulfilled',
      payload: { isPaired: true, credentials: { screenId: 's', apiKey: 'k', masjidId: 'm' } },
    });
    vi.advanceTimersByTime(100);
    const alertHandler = handlers.get('emergency:alert');
    alertHandler?.({
      id: 'a1',
      action: 'show',
      title: 'T',
      message: 'M',
      category: 'safety',
      urgency: 'critical',
      color: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      expiresAt: '2025-01-01T01:00:00.000Z',
    });
    expect(mockSetAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        title: 'T',
        message: 'M',
        masjidId: 'masjid-1',
        action: 'show',
      }),
    );
    expect(mockClearAlert).not.toHaveBeenCalled();
  });
});
