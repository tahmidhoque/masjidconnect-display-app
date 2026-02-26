/**
 * Redux auth slice tests — reducers, extraReducers, and thunk integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import authReducer from './authSlice';
import {
  requestPairingCode,
  checkPairingStatus,
  initializeFromStorage,
} from './authSlice';
import {
  setIsPaired,
  setPairingCodeExpired,
  setPolling,
  logout,
  clearPairingError,
} from './authSlice';
import { createTestStore } from '@/test-utils/mock-store';

const mockRequestPairingCode = vi.fn();
const mockCheckPairingStatus = vi.fn();
const mockGetPairedCredentials = vi.fn();

vi.mock('@/api/apiClient', () => ({
  default: {
    requestPairingCode: (...args: unknown[]) => mockRequestPairingCode(...args),
    checkPairingStatus: (...args: unknown[]) => mockCheckPairingStatus(...args),
    getPairedCredentials: (...args: unknown[]) => mockGetPairedCredentials(...args),
  },
}));

vi.mock('@/services/credentialService', () => ({
  default: {
    clearCredentials: vi.fn(),
    getCredentials: vi.fn(),
    initialise: vi.fn(),
    debugLogState: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('authSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('has unauthenticated initial state', () => {
      const state = authReducer(undefined, { type: 'init' });
      expect(state.isAuthenticated).toBe(false);
      expect(state.isPaired).toBe(false);
      expect(state.pairingCode).toBeNull();
      expect(state.screenId).toBeNull();
      expect(state.apiKey).toBeNull();
    });
  });

  describe('requestPairingCode', () => {
    it('sets pending and pairing on pending', () => {
      const state = authReducer(undefined, requestPairingCode.pending('', 'LANDSCAPE'));
      expect(state.isRequestingPairingCode).toBe(true);
      expect(state.isPairing).toBe(true);
      expect(state.pairingError).toBeNull();
    });

    it('sets pairing code and clears error on fulfilled', () => {
      const payload = {
        pairingCode: 'ABC123',
        expiresAt: '2024-12-31T12:00:00Z',
        requestTime: Date.now(),
      };
      const prev = authReducer(undefined, requestPairingCode.pending('', 'LANDSCAPE'));
      const state = authReducer(prev, requestPairingCode.fulfilled(payload, '', 'LANDSCAPE'));
      expect(state.isRequestingPairingCode).toBe(false);
      expect(state.pairingCode).toBe('ABC123');
      expect(state.pairingCodeExpiresAt).toBe(payload.expiresAt);
      expect(state.pairingError).toBeNull();
    });

    it('sets error on rejected', () => {
      const prev = authReducer(undefined, requestPairingCode.pending('', 'LANDSCAPE'));
      const state = authReducer(
        prev,
        requestPairingCode.rejected(null, '', 'LANDSCAPE', 'Network error'),
      );
      expect(state.isRequestingPairingCode).toBe(false);
      expect(state.isPairing).toBe(false);
      expect(state.pairingError).toBe('Network error');
    });
  });

  describe('checkPairingStatus', () => {
    it('sets authenticated and credentials when isPaired true', () => {
      const payload = {
        isPaired: true,
        credentials: {
          screenId: 'sid',
          apiKey: 'key',
          masjidId: 'mid',
        },
        masjidName: 'Test Masjid',
        screenName: 'Screen 1',
        orientation: 'LANDSCAPE',
      };
      const prev = authReducer(undefined, checkPairingStatus.pending('', 'CODE'));
      const state = authReducer(prev, checkPairingStatus.fulfilled(payload, '', 'CODE'));
      expect(state.isAuthenticated).toBe(true);
      expect(state.isPaired).toBe(true);
      expect(state.screenId).toBe('sid');
      expect(state.apiKey).toBe('key');
      expect(state.masjidId).toBe('mid');
      expect(state.pairingCode).toBeNull();
      expect(state.isPolling).toBe(false);
    });

    it('leaves state unchanged when isPaired false', () => {
      const payload = { isPaired: false, credentials: null };
      const prev = authReducer(undefined, checkPairingStatus.pending('', 'CODE'));
      const state = authReducer(prev, checkPairingStatus.fulfilled(payload, '', 'CODE'));
      expect(state.isCheckingPairingStatus).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.isPaired).toBe(false);
    });

    it('sets pairingError on rejected', () => {
      const prev = authReducer(undefined, checkPairingStatus.pending('', 'CODE'));
      const state = authReducer(
        prev,
        checkPairingStatus.rejected(null, '', 'CODE', 'Invalid code'),
      );
      expect(state.pairingError).toBe('Invalid code');
    });
  });

  describe('initializeFromStorage', () => {
    it('sets authenticated when credentials in payload', () => {
      const payload = {
        credentials: {
          screenId: 's',
          apiKey: 'k',
          masjidId: 'm',
        },
        pairingData: null,
      };
      const state = authReducer(
        undefined,
        initializeFromStorage.fulfilled(payload, '', undefined),
      );
      expect(state.isAuthenticated).toBe(true);
      expect(state.isPaired).toBe(true);
      expect(state.screenId).toBe('s');
      expect(state.apiKey).toBe('k');
      expect(state.masjidId).toBe('m');
    });

    it('sets pairing state when pairingData in payload', () => {
      const payload = {
        credentials: null,
        pairingData: {
          pairingCode: 'XYZ',
          expiresAt: '2024-12-31T12:00:00Z',
        },
      };
      const state = authReducer(
        undefined,
        initializeFromStorage.fulfilled(payload, '', undefined),
      );
      expect(state.isPairing).toBe(true);
      expect(state.pairingCode).toBe('XYZ');
      expect(state.pairingCodeExpiresAt).toBe(payload.pairingData.expiresAt);
    });

    it('sets authError on rejected', () => {
      const state = authReducer(
        undefined,
        initializeFromStorage.rejected(null, '', undefined, 'No credentials'),
      );
      expect(state.authError).toBe('No credentials');
    });
  });

  describe('reducers', () => {
    it('setIsPaired sets isPaired and isAuthenticated', () => {
      const state = authReducer(undefined, setIsPaired(true));
      expect(state.isPaired).toBe(true);
      expect(state.isAuthenticated).toBe(true);
    });

    it('setPairingCodeExpired clears pairing code when true', () => {
      const withCode = authReducer(undefined, requestPairingCode.fulfilled(
        { pairingCode: 'C', expiresAt: '2024-12-31T12:00:00Z', requestTime: 0 },
        '',
        'LANDSCAPE',
      ));
      const state = authReducer(withCode, setPairingCodeExpired(true));
      expect(state.isPairingCodeExpired).toBe(true);
      expect(state.pairingCode).toBeNull();
      expect(state.pairingCodeExpiresAt).toBeNull();
    });

    it('clearPairingError clears pairingError', () => {
      const withError = authReducer(
        undefined,
        requestPairingCode.rejected(new Error('err'), '', 'LANDSCAPE'),
      );
      const state = authReducer(withError, clearPairingError());
      expect(state.pairingError).toBeNull();
    });

    it('logout resets auth state', () => {
      const withAuth = authReducer(
        undefined,
        checkPairingStatus.fulfilled(
          {
            isPaired: true,
            credentials: { screenId: 's', apiKey: 'k', masjidId: 'm' },
            masjidName: 'Masjid',
            screenName: 'Screen',
            orientation: 'LANDSCAPE',
          },
          '',
          'CODE',
        ),
      );
      const state = authReducer(withAuth, logout());
      expect(state.isAuthenticated).toBe(false);
      expect(state.isPaired).toBe(false);
      expect(state.screenId).toBeNull();
      expect(state.apiKey).toBeNull();
      expect(state.masjidId).toBeNull();
      expect(state.pairingCode).toBeNull();
    });

    it('setPolling sets isPolling', () => {
      const state = authReducer(undefined, setPolling(true));
      expect(state.isPolling).toBe(true);
    });
  });

  describe('thunk integration', () => {
    beforeEach(() => {
      mockRequestPairingCode.mockReset();
      mockCheckPairingStatus.mockReset();
      mockGetPairedCredentials.mockReset();
    });

    it('requestPairingCode thunk succeeds and updates state', async () => {
      mockRequestPairingCode.mockResolvedValue({
        success: true,
        data: { pairingCode: 'ABC', expiresAt: '2025-12-31T12:00:00Z' },
      });
      const store = createTestStore();
      await store.dispatch(requestPairingCode('LANDSCAPE'));
      const state = store.getState().auth;
      expect(state.pairingCode).toBe('ABC');
      expect(state.pairingCodeExpiresAt).toBe('2025-12-31T12:00:00Z');
      expect(state.isRequestingPairingCode).toBe(false);
    });

    it('requestPairingCode thunk rejects when response not success', async () => {
      mockRequestPairingCode.mockResolvedValue({
        success: false,
        error: 'Server error',
      });
      const store = createTestStore();
      await store.dispatch(requestPairingCode('LANDSCAPE'));
      const state = store.getState().auth;
      expect(state.pairingError).toBe('Server error');
    });

    it('requestPairingCode thunk rejects on throw', async () => {
      mockRequestPairingCode.mockRejectedValue(new Error('Network error'));
      const store = createTestStore();
      await store.dispatch(requestPairingCode('LANDSCAPE'));
      const state = store.getState().auth;
      expect(state.pairingError).toBe('Network error');
    });

    it('checkPairingStatus thunk returns isPaired false', async () => {
      mockCheckPairingStatus.mockResolvedValue({
        success: true,
        data: { isPaired: false },
      });
      const store = createTestStore();
      await store.dispatch(checkPairingStatus('CODE'));
      const state = store.getState().auth;
      expect(state.isPaired).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('checkPairingStatus thunk fetches credentials when paired', async () => {
      mockCheckPairingStatus.mockResolvedValue({
        success: true,
        data: { isPaired: true },
      });
      mockGetPairedCredentials.mockResolvedValue({
        success: true,
        data: {
          apiKey: 'key',
          screenId: 'sid',
          masjidId: 'mid',
          masjidName: 'Masjid',
          screenName: 'Screen 1',
          orientation: 'LANDSCAPE',
        },
      });
      const store = createTestStore();
      await store.dispatch(checkPairingStatus('CODE'));
      const state = store.getState().auth;
      expect(state.isPaired).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.screenId).toBe('sid');
      expect(state.apiKey).toBe('key');
      expect(state.masjidId).toBe('mid');
    });

    it('initializeFromStorage thunk with credentials sets authenticated', async () => {
      const { default: credentialService } = await import('@/services/credentialService');
      (credentialService.getCredentials as ReturnType<typeof vi.fn>).mockReturnValue({
        apiKey: 'k',
        screenId: 's',
        masjidId: 'm',
      });
      const store = createTestStore();
      await store.dispatch(initializeFromStorage());
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.screenId).toBe('s');
    });

    it('initializeFromStorage thunk with valid pairing code in localStorage', async () => {
      const { default: credentialService } = await import('@/services/credentialService');
      (credentialService.getCredentials as ReturnType<typeof vi.fn>).mockReturnValue(null);
      localStorage.setItem('pairingCode', 'XYZ');
      localStorage.setItem('pairingCodeExpiresAt', new Date(Date.now() + 60000).toISOString());
      const store = createTestStore();
      await store.dispatch(initializeFromStorage());
      const state = store.getState().auth;
      expect(state.isPairing).toBe(true);
      expect(state.pairingCode).toBe('XYZ');
    });

    it('initializeFromStorage thunk with expired pairing code clears storage', async () => {
      const { default: credentialService } = await import('@/services/credentialService');
      (credentialService.getCredentials as ReturnType<typeof vi.fn>).mockReturnValue(null);
      localStorage.setItem('pairingCode', 'OLD');
      localStorage.setItem('pairingCodeExpiresAt', '2020-01-01T00:00:00Z');
      const store = createTestStore();
      await store.dispatch(initializeFromStorage());
      expect(localStorage.getItem('pairingCode')).toBeNull();
    });
  });
});
