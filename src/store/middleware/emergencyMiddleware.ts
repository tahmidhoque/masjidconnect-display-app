/**
 * Emergency Middleware
 *
 * Integrates emergencyAlertService with Redux store.
 * Handles alert state synchronisation between the service and Redux.
 */

import { Middleware, UnknownAction, PayloadAction } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '../index';
import emergencyAlertService from '../../services/emergencyAlertService';
import {
  setCurrentAlert,
  setConnectionStatus,
  resetReconnectAttempts,
  clearError,
  connectToEmergencyService,
  disconnectFromEmergencyService,
  initializeEmergencyService,
} from '../slices/emergencySlice';
import { selectIsAuthenticated } from '../slices/authSlice';
import { apiUrl } from '../../config/environment';
import logger from '../../utils/logger';

let listenersSetup = false;

export const emergencyMiddleware: Middleware<object, RootState> = (api) => {
  const setupListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;

    logger.debug('[EmergencyMW] Setting up alert listeners');
    emergencyAlertService.addListener((alert) => {
      api.dispatch(setCurrentAlert(alert));
    });
  };

  setupListeners();

  return (next) => (action) => {
    const result = next(action);

    if (!action || typeof action !== 'object' || !('type' in action)) {
      return result;
    }

    const typedAction = action as UnknownAction;
    const state = api.getState();

    switch (typedAction.type) {
      case 'emergency/initializeEmergencyService/fulfilled': {
        if (selectIsAuthenticated(state)) {
          (api.dispatch as AppDispatch)(connectToEmergencyService());
        }
        break;
      }
      case 'emergency/connectToEmergencyService/fulfilled': {
        api.dispatch(setConnectionStatus({ isConnected: true, isConnecting: false }));
        api.dispatch(resetReconnectAttempts());
        api.dispatch(clearError());
        break;
      }
      case 'emergency/connectToEmergencyService/rejected': {
        const rejected = typedAction as PayloadAction<string | undefined>;
        api.dispatch(setConnectionStatus({
          isConnected: false,
          isConnecting: false,
          error: rejected.payload ?? null,
        }));
        break;
      }
      case 'emergency/disconnectFromEmergencyService/fulfilled': {
        api.dispatch(setConnectionStatus({ isConnected: false, isConnecting: false }));
        break;
      }
      case 'auth/logout': {
        (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
        emergencyAlertService.cleanup();
        break;
      }
      case 'emergency/setEnabled': {
        const setEnabledAction = typedAction as PayloadAction<boolean>;
        const isEnabled = setEnabledAction.payload;
        const isAuth = selectIsAuthenticated(state);
        if (isEnabled && isAuth) {
          (api.dispatch as AppDispatch)(initializeEmergencyService(apiUrl));
        } else if (!isEnabled) {
          (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
        }
        break;
      }
    }

    return result;
  };
};

export const cleanupEmergencyMiddleware = () => {
  listenersSetup = false;
  emergencyAlertService.cleanup();
};
