import { Middleware, MiddlewareAPI, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '../index';
import emergencyAlertService from '../../services/emergencyAlertService';
import remoteControlService from '../../services/remoteControlService';
import { 
  setCurrentAlert, 
  setConnectionStatus,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  setError,
  clearError,
  initializeEmergencyService,
  connectToEmergencyService,
  disconnectFromEmergencyService,
  selectIsEnabled,
  selectAutoReconnect,
  selectShouldReconnect,
  selectReconnectAttempts,
  selectMaxReconnectAttempts
} from '../slices/emergencySlice';
import { selectIsAuthenticated } from '../slices/authSlice';
import logger from '../../utils/logger';

// Track if we've set up listeners to avoid duplicates
let listenersSetup = false;
let reconnectTimer: NodeJS.Timeout | null = null;

/**
 * Emergency middleware handles SSE connections and emergency alert integration
 */
export const emergencyMiddleware: Middleware = (api: any) => {
  
  // Set up emergency service listeners
  const setupEmergencyListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;
    
    logger.debug('[EmergencyMiddleware] Setting up emergency service listeners');
    
    // Listen for alert changes from the service
    emergencyAlertService.addListener((alert) => {
      if (alert) {
        logger.debug('[EmergencyMiddleware] Alert received from service:', { id: alert.id, title: alert.title });
      } else {
        logger.debug('[EmergencyMiddleware] Alert cleared from service');
      }
      api.dispatch(setCurrentAlert(alert));
    });
    
    // Monitor connection status (we'll implement this in the service if needed)
    // For now, we'll manage connection status through the middleware
  };
  
  // Initialize remote control service
  const initializeRemoteControl = (baseURL: string) => {
    try {
      logger.info('[EmergencyMiddleware] Initializing remote control service');
      remoteControlService.initialize(baseURL);
    } catch (error) {
      logger.error('[EmergencyMiddleware] Error initializing remote control service', { error });
    }
  };
  
  // Handle reconnection logic
  const handleReconnection = () => {
    const state = api.getState();
    const shouldReconnect = selectShouldReconnect(state);
    const isAuthenticated = selectIsAuthenticated(state);
    
    if (shouldReconnect && isAuthenticated) {
      const reconnectAttempts = selectReconnectAttempts(state);
      const maxAttempts = selectMaxReconnectAttempts(state);
      
      if (reconnectAttempts < maxAttempts) {
        // Calculate exponential backoff delay
        const baseDelay = 5000; // 5 seconds
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), 60000); // Max 1 minute
        
        logger.debug(`[EmergencyMiddleware] Scheduling reconnection attempt ${reconnectAttempts + 1}/${maxAttempts} in ${delay}ms`);
        
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        
        reconnectTimer = setTimeout(() => {
          const currentState = api.getState();
          const stillShouldReconnect = selectShouldReconnect(currentState);
          
          if (stillShouldReconnect) {
            api.dispatch(incrementReconnectAttempts());
            api.dispatch(connectToEmergencyService());
          }
        }, delay);
      } else {
        logger.warn('[EmergencyMiddleware] Maximum reconnection attempts reached');
        api.dispatch(setError('Maximum reconnection attempts reached'));
      }
    }
  };
  
  // Set up listeners once
  setupEmergencyListeners();
  
  return (next) => (action: any) => {
    const result = next(action);
    const state = api.getState();
    
    // Helper function to initialize SSE services when authenticated
    const tryInitializeSSE = () => {
      const isAuthenticated = selectIsAuthenticated(state);
      const isEmergencyEnabled = selectIsEnabled(state);
      
      if (isAuthenticated && isEmergencyEnabled) {
        // Check if credentials are in localStorage
        const hasCredentials = !!(
          localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId')
        );
        
        if (hasCredentials) {
          const baseURL = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000' 
            : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
          
          logger.info('[EmergencyMiddleware] Authentication successful with credentials, initializing emergency service', {
            baseURL,
            hasScreenId: !!localStorage.getItem('masjid_screen_id'),
          });
          api.dispatch(initializeEmergencyService(baseURL));
          return true;
        } else {
          logger.warn('[EmergencyMiddleware] Authentication successful but no credentials found, delaying SSE initialization');
          // Retry after a short delay to allow credentials to be stored
          setTimeout(() => {
            const currentState = api.getState();
            const stillAuthenticated = selectIsAuthenticated(currentState);
            const hasCredentialsNow = !!(
              localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId')
            );
            if (stillAuthenticated && hasCredentialsNow) {
              const baseURL = process.env.NODE_ENV === 'development' 
                ? 'http://localhost:3000' 
                : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
              logger.info('[EmergencyMiddleware] Credentials now available, initializing emergency service');
              (api.dispatch as AppDispatch)(initializeEmergencyService(baseURL));
            }
          }, 1000);
          return false;
        }
      }
      return false;
    };
    
    // Handle specific actions
    switch (action.type) {
      case 'auth/initializeFromStorage/fulfilled':
      case 'auth/checkPairingStatus/fulfilled':
      case 'auth/setIsPaired': {
        // When authentication is successful, initialize emergency service
        logger.debug('[EmergencyMiddleware] Auth action received', { actionType: action.type });
        tryInitializeSSE();
        break;
      }
      
      case 'emergency/initializeEmergencyService/fulfilled': {
        // After successful initialization, attempt to connect
        const isAuthenticated = selectIsAuthenticated(state);
        
                           if (isAuthenticated) {
            logger.debug('[EmergencyMiddleware] Emergency service initialized, connecting...');
            api.dispatch(connectToEmergencyService());
          }
        break;
      }
      
      case 'emergency/connectToEmergencyService/fulfilled': {
        // Connection successful
        logger.debug('[EmergencyMiddleware] Emergency service connected successfully');
        api.dispatch(setConnectionStatus({ isConnected: true, isConnecting: false }));
        api.dispatch(resetReconnectAttempts());
        api.dispatch(clearError());
        
        // Clear any reconnection timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        break;
      }
      
      case 'emergency/connectToEmergencyService/rejected': {
        // Connection failed
        logger.warn('[EmergencyMiddleware] Emergency service connection failed');
        api.dispatch(setConnectionStatus({ 
          isConnected: false, 
          isConnecting: false,
          error: action.payload as string
        }));
        
        // Schedule reconnection if enabled
        handleReconnection();
        break;
      }
      
      case 'emergency/disconnectFromEmergencyService/fulfilled': {
        // Disconnection successful
        logger.debug('[EmergencyMiddleware] Emergency service disconnected');
        api.dispatch(setConnectionStatus({ isConnected: false, isConnecting: false }));
        
        // Clear any reconnection timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        break;
      }
      
             case 'auth/logout': {
         // When logging out, disconnect emergency service
         logger.debug('[EmergencyMiddleware] Logout detected, disconnecting emergency service');
         (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
         break;
       }
      
      case 'emergency/setEnabled': {
        // When emergency service is enabled/disabled
        const isEnabled = action.payload;
        const isAuthenticated = selectIsAuthenticated(state);
        
                 if (isEnabled && isAuthenticated) {
           // Re-initialize if enabled
           const baseURL = process.env.NODE_ENV === 'development' 
             ? 'http://localhost:3000' 
             : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
           
           (api.dispatch as AppDispatch)(initializeEmergencyService(baseURL));
         } else if (!isEnabled) {
           // Disconnect if disabled
           (api.dispatch as AppDispatch)(disconnectFromEmergencyService());
         }
        break;
      }
      
      case 'ui/setOffline': {
        // Handle offline/online status changes
        const isOffline = action.payload;
        
        if (isOffline) {
          // Going offline - the service will handle reconnection when back online
          logger.debug('[EmergencyMiddleware] Device went offline');
        } else {
          // Coming back online - attempt reconnection if needed
          logger.debug('[EmergencyMiddleware] Device came back online');
          
          const isAuthenticated = selectIsAuthenticated(state);
          const isEnabled = selectIsEnabled(state);
          
          // CRITICAL FIX: Check for credentials before reconnecting
          if (isAuthenticated && isEnabled) {
            const hasCredentials = !!(
              localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId')
            );
            
            if (hasCredentials) {
              // Small delay to ensure network is stable
              setTimeout(() => {
                logger.debug('[EmergencyMiddleware] Reconnecting SSE after coming online');
                (api.dispatch as AppDispatch)(connectToEmergencyService());
              }, 2000);
            } else {
              logger.warn('[EmergencyMiddleware] Cannot reconnect SSE - no credentials available');
            }
          }
        }
        break;
      }
    }
    
    // CRITICAL: Also check state after every action to catch any missed authentication cases
    // This ensures SSE is initialized even if we missed the specific action
    // BUT: Only check on auth-related actions to prevent excessive checks
    const isAuthAction = action.type.startsWith('auth/') || action.type.startsWith('emergency/');
    if (isAuthAction) {
      const isAuthenticated = selectIsAuthenticated(state);
      const isEnabled = selectIsEnabled(state);
      const hasCredentials = !!(
        localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId')
      );
      
      // Check if we should have SSE initialized but don't
      if (isAuthenticated && isEnabled && hasCredentials) {
        const emergencyState = state.emergency;
        // Only initialize if we haven't already initialized or if connection failed
        if (!emergencyState.connectionUrl && !emergencyState.isConnecting && !emergencyState.isConnected) {
          logger.info('[EmergencyMiddleware] Detected authenticated state but SSE not initialized, initializing now');
          const baseURL = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000' 
            : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
          api.dispatch(initializeEmergencyService(baseURL));
        }
      }
    }
    
    return result;
  };
};

// Cleanup function for the middleware
export const cleanupEmergencyMiddleware = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Reset listeners flag so they can be set up again if needed
  listenersSetup = false;
  
  logger.debug('[EmergencyMiddleware] Cleaned up');
};