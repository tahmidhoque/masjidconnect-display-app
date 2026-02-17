/**
 * Emergency Middleware
 *
 * Integrates emergencyAlertService with Redux store.
 * Handles alert state synchronisation between the service and Redux.
 */

import { Middleware } from '@reduxjs/toolkit';
import type { AppDispatch } from '../index';
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

export const emergencyMiddleware: Middleware = (api: any) => {
  const setupListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;

    logger.debug('[EmergencyMW] Setting up alert listeners');
    emergencyAlertService.addListener((alert) => {
      api.dispatch(setCurrentAlert(alert));
    });
  };

  setupListeners();

  return (next) => (action: any) => {
    const result = next(action);
    const state = api.getState();

    switch (action.type) {
      case 'emergency/initializeEmergencyService/fulfilled': {
        if (selectIsAuthenticated(state)) {
          api.dispatch(connectToEmergencyService());
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
        api.dispatch(setConnectionStatus({
          isConnected: false,
          isConnecting: false,
          error: action.payload as string,
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
        const isEnabled = action.payload;
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
