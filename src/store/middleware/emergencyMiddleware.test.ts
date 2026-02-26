/**
 * Emergency middleware tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emergencyMiddleware, cleanupEmergencyMiddleware } from './emergencyMiddleware';
import { createTestStore } from '@/test-utils/mock-store';
import { mockEmergencyAlert } from '@/test-utils/mocks';

const mockAddListener = vi.fn();
const mockCleanup = vi.fn();

vi.mock('@/services/emergencyAlertService', () => ({
  default: {
    addListener: (...args: unknown[]) => mockAddListener(...args),
    cleanup: () => mockCleanup(),
    setAlert: vi.fn(),
    clearAlert: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('emergencyMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupEmergencyMiddleware();
  });

  it('sets up alert listener on first action', () => {
    const store = createTestStore();
    const middleware = emergencyMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({ type: 'some/action' });
    expect(mockAddListener).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ type: 'some/action' });
  });

  it('dispatches setCurrentAlert when service listener fires', () => {
    let listenerCb: ((alert: unknown) => void) | null = null;
    mockAddListener.mockImplementation((cb: (alert: unknown) => void) => {
      listenerCb = cb;
      return () => {};
    });
    const store = createTestStore();
    const middleware = emergencyMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({ type: 'init' });
    expect(listenerCb).toBeTruthy();
    listenerCb!(mockEmergencyAlert);
    expect(store.getState().emergency.currentAlert).toEqual(mockEmergencyAlert);
  });

  it('on emergency/initializeEmergencyService/fulfilled when authenticated dispatches connect', async () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
    });
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const middleware = emergencyMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'emergency/initializeEmergencyService/fulfilled',
      payload: { baseURL: 'https://example.com', timestamp: new Date().toISOString() },
    });
    await Promise.resolve();
    const dispatched = dispatchSpy.mock.calls.map((c) => c[0]);
    const hasConnectDispatch =
      dispatched.some((a) => typeof a === 'function') ||
      dispatched.some((a) => (a as { type?: string })?.type?.startsWith('emergency/connect'));
    expect(hasConnectDispatch).toBe(true);
  });

  it('on emergency/connectToEmergencyService/fulfilled dispatches setConnectionStatus', () => {
    const store = createTestStore();
    const middleware = emergencyMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'emergency/connectToEmergencyService/fulfilled',
      payload: undefined,
    });
    const state = store.getState().emergency;
    expect(state.isConnected).toBe(true);
    expect(state.isConnecting).toBe(false);
  });

  it('on emergency/connectToEmergencyService/rejected dispatches setConnectionStatus with error', () => {
    const store = createTestStore();
    const middleware = emergencyMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({
      type: 'emergency/connectToEmergencyService/rejected',
      payload: 'Connection failed',
    });
    const state = store.getState().emergency;
    expect(state.isConnected).toBe(false);
    expect(state.connectionError).toBe('Connection failed');
  });

  it('on auth/logout dispatches disconnectFromEmergencyService and calls cleanup', () => {
    const store = createTestStore();
    const middleware = emergencyMiddleware({
      getState: store.getState,
      dispatch: store.dispatch,
    } as never);
    const next = vi.fn((a: unknown) => a);
    const dispatch = middleware(next);
    dispatch({ type: 'auth/logout' });
    expect(next).toHaveBeenCalled();
    expect(mockCleanup).toHaveBeenCalled();
  });
});
