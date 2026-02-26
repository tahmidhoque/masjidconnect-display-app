/**
 * Redux ui slice tests — reducers only.
 */

import { describe, it, expect } from 'vitest';
import uiReducer from './uiSlice';
import {
  setOrientation,
  setScreenOrientation,
  setOffline,
  resetOfflineStatus,
  setInitializing,
  setError,
  clearError,
  setShowLoadingScreen,
  setShowContent,
  setKioskMode,
  setPendingRestart,
  clearPendingRestart,
  setUpdateStatus,
  clearUpdateStatus,
  resetUIState,
  addNotification,
  removeNotification,
} from './uiSlice';

describe('uiSlice', () => {
  describe('initial state', () => {
    it('has expected defaults', () => {
      const state = uiReducer(undefined, { type: 'init' });
      expect(state.orientation).toBe('LANDSCAPE');
      expect(state.rotationDegrees).toBe(0);
      expect(state.isOffline).toBe(false);
      expect(state.showLoadingScreen).toBe(true);
      expect(state.showContent).toBe(false);
      expect(state.isKioskMode).toBe(true);
      expect(state.hasError).toBe(false);
      expect(state.notifications).toEqual([]);
    });
  });

  describe('setOrientation', () => {
    it('sets orientation and rotation degrees', () => {
      const state = uiReducer(undefined, setOrientation('PORTRAIT'));
      expect(state.orientation).toBe('PORTRAIT');
      expect(state.rotationDegrees).toBe(90);
    });

    it('sets LANDSCAPE_INVERTED to 180', () => {
      const state = uiReducer(undefined, setOrientation('LANDSCAPE_INVERTED'));
      expect(state.rotationDegrees).toBe(180);
    });
  });

  describe('setScreenOrientation', () => {
    it('sets both orientation and rotationDegrees', () => {
      const state = uiReducer(
        undefined,
        setScreenOrientation({ orientation: 'PORTRAIT_INVERTED', rotationDegrees: 270 }),
      );
      expect(state.orientation).toBe('PORTRAIT_INVERTED');
      expect(state.rotationDegrees).toBe(270);
    });
  });

  describe('setOffline', () => {
    it('sets isOffline and offlineStartTime when going offline', () => {
      const state = uiReducer(undefined, setOffline(true));
      expect(state.isOffline).toBe(true);
      expect(state.wasOffline).toBe(true);
      expect(state.offlineStartTime).toBeTruthy();
    });

    it('clears offlineStartTime when coming back online', () => {
      let state = uiReducer(undefined, setOffline(true));
      state = uiReducer(state, setOffline(false));
      expect(state.isOffline).toBe(false);
      expect(state.offlineStartTime).toBeNull();
    });
  });

  describe('resetOfflineStatus', () => {
    it('clears offline state', () => {
      let state = uiReducer(undefined, setOffline(true));
      state = uiReducer(state, resetOfflineStatus());
      expect(state.isOffline).toBe(false);
      expect(state.wasOffline).toBe(false);
      expect(state.offlineStartTime).toBeNull();
    });
  });

  describe('setInitializing', () => {
    it('sets isInitializing', () => {
      const state = uiReducer(undefined, setInitializing(false));
      expect(state.isInitializing).toBe(false);
    });
  });

  describe('setError / clearError', () => {
    it('sets error message and stack', () => {
      const state = uiReducer(
        undefined,
        setError({ message: 'Something broke', stack: 'at line 1' }),
      );
      expect(state.hasError).toBe(true);
      expect(state.errorMessage).toBe('Something broke');
      expect(state.errorStack).toBe('at line 1');
    });

    it('clearError resets error state', () => {
      let state = uiReducer(undefined, setError({ message: 'Err' }));
      state = uiReducer(state, clearError());
      expect(state.hasError).toBe(false);
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('setShowLoadingScreen / setShowContent', () => {
    it('updates loading and content flags', () => {
      let state = uiReducer(undefined, setShowLoadingScreen(false));
      expect(state.showLoadingScreen).toBe(false);
      state = uiReducer(state, setShowContent(true));
      expect(state.showContent).toBe(true);
    });
  });

  describe('setKioskMode', () => {
    it('sets isKioskMode', () => {
      const state = uiReducer(undefined, setKioskMode(false));
      expect(state.isKioskMode).toBe(false);
    });
  });

  describe('setPendingRestart / clearPendingRestart', () => {
    it('sets and clears pending restart', () => {
      let state = uiReducer(
        undefined,
        setPendingRestart({ at: 12345, label: 'Restarting in 5s' }),
      );
      expect(state.pendingRestart).toEqual({ at: 12345, label: 'Restarting in 5s' });
      state = uiReducer(state, clearPendingRestart());
      expect(state.pendingRestart).toBeNull();
    });
  });

  describe('setUpdateStatus / clearUpdateStatus', () => {
    it('sets update phase and message', () => {
      const state = uiReducer(
        undefined,
        setUpdateStatus({ phase: 'downloading', message: 'Downloading...' }),
      );
      expect(state.updatePhase).toBe('downloading');
      expect(state.updateMessage).toBe('Downloading...');
    });

    it('clearUpdateStatus resets to idle', () => {
      let state = uiReducer(undefined, setUpdateStatus({ phase: 'installing' }));
      state = uiReducer(state, clearUpdateStatus());
      expect(state.updatePhase).toBe('idle');
      expect(state.updateMessage).toBe('');
    });
  });

  describe('addNotification / removeNotification', () => {
    it('adds notification with id and timestamp', () => {
      const state = uiReducer(
        undefined,
        addNotification({ type: 'info', message: 'Hello' }),
      );
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].message).toBe('Hello');
      expect(state.notifications[0].type).toBe('info');
      expect(state.notifications[0].id).toBeTruthy();
      expect(state.notifications[0].timestamp).toBeTruthy();
    });

    it('removeNotification removes by id', () => {
      let state = uiReducer(undefined, addNotification({ type: 'info', message: 'A' }));
      const id = state.notifications[0].id;
      state = uiReducer(state, removeNotification(id));
      expect(state.notifications).toHaveLength(0);
    });
  });

  describe('resetUIState', () => {
    it('resets to initial-like state', () => {
      let state = uiReducer(undefined, setOffline(true));
      state = uiReducer(state, setError({ message: 'Err' }));
      state = uiReducer(state, resetUIState());
      expect(state.orientation).toBe('LANDSCAPE');
      expect(state.isOffline).toBe(false);
      expect(state.hasError).toBe(false);
      expect(state.showLoadingScreen).toBe(true);
    });
  });
});
