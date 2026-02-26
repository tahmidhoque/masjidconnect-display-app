/**
 * Realtime middleware tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realtimeMiddleware, cleanupRealtimeMiddleware } from './realtimeMiddleware';
import { createTestStore } from '@/test-utils/mock-store';

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
    on: (...args: unknown[]) => mockOn(...args),
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
});
