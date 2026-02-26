/**
 * Redux auth slice tests — reducers and extraReducers.
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
  logout,
  clearPairingError,
} from './authSlice';

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
  });
});
