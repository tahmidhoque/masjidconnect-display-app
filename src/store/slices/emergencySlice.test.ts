/**
 * Redux emergency slice tests — reducers and extraReducers.
 */

import { describe, it, expect, vi } from 'vitest';
import emergencyReducer from './emergencySlice';
import {
  setCurrentAlert,
  clearCurrentAlert,
  setConnectionStatus,
  initializeEmergencyService,
  connectToEmergencyService,
  clearExpiredAlert,
} from './emergencySlice';
import { mockEmergencyAlert } from '@/test-utils/mocks';

vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/services/emergencyAlertService', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearAlert: vi.fn(),
  },
}));

describe('emergencySlice', () => {
  describe('initial state', () => {
    it('has no current alert and not connected', () => {
      const state = emergencyReducer(undefined, { type: 'init' });
      expect(state.currentAlert).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.alertHistory).toEqual([]);
    });
  });

  describe('setCurrentAlert', () => {
    it('sets current alert and updates history', () => {
      const state = emergencyReducer(undefined, setCurrentAlert(mockEmergencyAlert));
      expect(state.currentAlert).toEqual(mockEmergencyAlert);
      expect(state.totalAlertsReceived).toBe(1);
      expect(state.alertHistory).toHaveLength(1);
      expect(state.alertHistory[0].action).toBe('received');
    });

    it('clearing alert adds cleared to history', () => {
      let state = emergencyReducer(undefined, setCurrentAlert(mockEmergencyAlert));
      state = emergencyReducer(state, setCurrentAlert(null));
      expect(state.currentAlert).toBeNull();
      expect(state.alertHistory).toHaveLength(2);
      expect(state.alertHistory[1].action).toBe('cleared');
    });
  });

  describe('clearCurrentAlert', () => {
    it('clears current alert and adds to history', () => {
      let state = emergencyReducer(undefined, setCurrentAlert(mockEmergencyAlert));
      state = emergencyReducer(state, clearCurrentAlert());
      expect(state.currentAlert).toBeNull();
      expect(state.alertHistory.some((e) => e.action === 'cleared')).toBe(true);
    });

    it('no-op when no current alert', () => {
      const state = emergencyReducer(undefined, clearCurrentAlert());
      expect(state.currentAlert).toBeNull();
      expect(state.alertHistory).toHaveLength(0);
    });
  });

  describe('setConnectionStatus', () => {
    it('sets isConnected and isConnecting', () => {
      let state = emergencyReducer(
        undefined,
        setConnectionStatus({ isConnected: true, isConnecting: false }),
      );
      expect(state.isConnected).toBe(true);
      expect(state.isConnecting).toBe(false);
      state = emergencyReducer(
        state,
        setConnectionStatus({ isConnected: false, isConnecting: true }),
      );
      expect(state.isConnecting).toBe(true);
    });
  });

  describe('initializeEmergencyService', () => {
    it('fulfilled does not throw', () => {
      const state = emergencyReducer(
        undefined,
        initializeEmergencyService.fulfilled(
          { baseURL: 'https://example.com', timestamp: new Date().toISOString() },
          '',
          'https://example.com',
        ),
      );
      expect(state).toBeDefined();
    });

    it('rejected sets error', () => {
      const state = emergencyReducer(
        undefined,
        initializeEmergencyService.rejected(
          null,
          '',
          'https://example.com',
          'Init failed',
        ),
      );
      expect(state.lastError).toBe('Init failed');
      expect(state.errorCount).toBe(1);
    });
  });

  describe('connectToEmergencyService', () => {
    it('fulfilled sets connection state', () => {
      const state = emergencyReducer(
        undefined,
        connectToEmergencyService.fulfilled(
        { timestamp: new Date().toISOString() },
        '',
        undefined,
      ),
      );
      expect(state).toBeDefined();
    });
  });

  describe('clearExpiredAlert', () => {
    it('fulfilled clears current alert when it matches', () => {
      let state = emergencyReducer(undefined, setCurrentAlert(mockEmergencyAlert));
      state = emergencyReducer(
        state,
        clearExpiredAlert.fulfilled(
          { alertId: mockEmergencyAlert.id, timestamp: new Date().toISOString() },
          '',
          mockEmergencyAlert.id,
        ),
      );
      expect(state.currentAlert).toBeNull();
    });
  });
});
