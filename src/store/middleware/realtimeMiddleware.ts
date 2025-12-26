/**
 * Realtime WebSocket Middleware
 *
 * Redux middleware that manages WebSocket connection and dispatches
 * actions for real-time events (emergency alerts, orientation changes,
 * remote commands).
 * 
 * Uses the new websocketService for Socket.io communication.
 */

import { Middleware, MiddlewareAPI, Dispatch, UnknownAction } from '@reduxjs/toolkit';
import type { AppDispatch } from '../index';
import websocketService, {
  EmergencyAlert,
  RemoteCommand,
  OrientationChange,
} from '../../services/websocketService';
import syncService from '../../services/syncService';
import credentialService from '../../services/credentialService';
import remoteControlService from '../../services/remoteControlService';
import type { RemoteCommand as ApiRemoteCommand } from '../../api/models';
import {
  setCurrentAlert,
  setConnectionStatus,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  clearError,
} from '../slices/emergencySlice';
import { setOrientation } from '../slices/uiSlice';
import logger from '../../utils/logger';

// Auth state type for getState
interface AuthStateShape {
  auth: { isAuthenticated: boolean };
}

// Track initialisation state
let isInitialised = false;
let unsubscribers: Array<() => void> = [];

// Type for the middleware API
type AppMiddlewareAPI = MiddlewareAPI<Dispatch<UnknownAction>, unknown>;

/**
 * Convert WebSocket alert to Redux format
 */
const convertAlertToReduxFormat = (alert: EmergencyAlert) => {
  return {
    id: alert.id,
    title: alert.title,
    message: alert.message,
    color: alert.type === 'emergency' ? '#f44336' : alert.type === 'warning' ? '#ff9800' : '#2196f3',
    createdAt: alert.createdAt,
    expiresAt: alert.expiresAt || undefined,
    timing: undefined,
    masjidId: credentialService.getMasjidId() || '',
    colorScheme: undefined,
  };
};

/**
 * Convert WebSocket command format to API command format
 * WebSocket: { id, type, payload, createdAt }
 * API: { commandId, type, payload, timestamp }
 */
const convertWebSocketCommandToApiFormat = (wsCommand: RemoteCommand): ApiRemoteCommand => {
  return {
    commandId: wsCommand.id,
    type: wsCommand.type,
    payload: wsCommand.payload,
    timestamp: wsCommand.createdAt || new Date().toISOString(),
  };
};

/**
 * Realtime middleware for WebSocket integration
 */
export const realtimeMiddleware: Middleware = (api: AppMiddlewareAPI) => {
  /**
   * Initialise WebSocket connection and services
   */
  const initialise = () => {
    if (isInitialised) {
      logger.debug('[RealtimeMiddleware] Already initialised');
      return;
    }

    const state = api.getState() as { auth: { isAuthenticated: boolean } };
    const isAuthenticated = state.auth.isAuthenticated;

    if (!isAuthenticated) {
      logger.debug('[RealtimeMiddleware] Not authenticated, skipping');
      return;
    }

    // Check credentials
    if (!credentialService.hasCredentials()) {
      logger.warn('[RealtimeMiddleware] No credentials, cannot connect');
      return;
    }

    if (!credentialService.getMasjidId()) {
      logger.warn('[RealtimeMiddleware] Missing masjidId - WebSocket may not authenticate properly');
    }

    isInitialised = true;
    logger.info('[RealtimeMiddleware] Initialising WebSocket and sync services');

    // Set up WebSocket event listeners
    setupWebSocketListeners();

    // Connect WebSocket
    websocketService.connect();

    // Start sync service
    syncService.start();

    // Set up sync service listeners
    setupSyncServiceListeners();
  };

  /**
   * Set up WebSocket event listeners
   */
  const setupWebSocketListeners = () => {
    // Connection events
    unsubscribers.push(
      websocketService.on('connect', () => {
        logger.info('[RealtimeMiddleware] WebSocket connected');
        api.dispatch(setConnectionStatus({ isConnected: true, isConnecting: false }));
        api.dispatch(resetReconnectAttempts());
        api.dispatch(clearError());
      })
    );

    unsubscribers.push(
      websocketService.on('disconnect', () => {
        logger.info('[RealtimeMiddleware] WebSocket disconnected');
        api.dispatch(setConnectionStatus({ isConnected: false, isConnecting: false }));
      })
    );

    unsubscribers.push(
      websocketService.on<{ attempt: number }>('reconnect', (data) => {
        logger.debug('[RealtimeMiddleware] WebSocket reconnecting', data);
        api.dispatch(incrementReconnectAttempts());
      })
    );

    // Emergency alerts
    unsubscribers.push(
      websocketService.on<EmergencyAlert>('emergency:alert', (alert) => {
        logger.info('[RealtimeMiddleware] Emergency alert received', {
          id: alert.id,
          title: alert.title,
        });

        const reduxAlert = convertAlertToReduxFormat(alert);
        api.dispatch(setCurrentAlert(reduxAlert as Parameters<typeof setCurrentAlert>[0]));

        // Store for persistence
        localStorage.setItem('emergencyAlert', JSON.stringify(reduxAlert));
      })
    );

    unsubscribers.push(
      websocketService.on('emergency:clear', () => {
        logger.info('[RealtimeMiddleware] Emergency alert cleared');
        api.dispatch(setCurrentAlert(null));
        localStorage.removeItem('emergencyAlert');
      })
    );

    // Orientation changes from SCREEN_ORIENTATION WebSocket event
    unsubscribers.push(
      websocketService.on<OrientationChange>('orientation:change', (data) => {
        const normalizedOrientation = data.orientation.toUpperCase() as 'LANDSCAPE' | 'PORTRAIT';
        
        logger.info('[RealtimeMiddleware] Orientation change received via WebSocket', {
          orientation: normalizedOrientation,
          source: data.source,
        });

        // Store in localStorage for persistence
        localStorage.setItem('screen_orientation', normalizedOrientation);

        // Dispatch Redux action to update orientation state
        api.dispatch(setOrientation(normalizedOrientation));

        // Dispatch custom event for React components that listen directly
        window.dispatchEvent(
          new CustomEvent('orientation-changed', {
            detail: {
              orientation: normalizedOrientation,
              timestamp: Date.now(),
              source: 'websocket',
            },
          })
        );

        logger.info('[RealtimeMiddleware] Orientation updated successfully', {
          orientation: normalizedOrientation,
        });
      })
    );

    // Remote commands
    unsubscribers.push(
      websocketService.on<RemoteCommand>('command', async (command) => {
        logger.info('[RealtimeMiddleware] Command received', {
          type: command.type,
          id: command.id,
        });

        try {
          await handleRemoteCommand(command);
          websocketService.acknowledgeCommand(command.id, true);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Command failed';
          logger.error('[RealtimeMiddleware] Command execution failed', { error: errorMessage });
          websocketService.acknowledgeCommand(command.id, false, errorMessage);
        }
      })
    );

    // Content updates - CRITICAL FIX: dispatch Redux actions instead of calling syncService directly
    // This ensures data propagates to Redux store and triggers re-renders
    unsubscribers.push(
      websocketService.on('content:update', () => {
        logger.info('[RealtimeMiddleware] Content update notification - dispatching Redux action');
        // Import actions dynamically to avoid circular deps
        import('../slices/contentSlice').then(({ refreshAllContent }) => {
          (api.dispatch as AppDispatch)(refreshAllContent({ forceRefresh: true }));
        });
      })
    );

    // Prayer times updates
    unsubscribers.push(
      websocketService.on('prayer-times:update', () => {
        logger.info('[RealtimeMiddleware] Prayer times update notification - dispatching Redux action');
        // Import actions dynamically to avoid circular deps
        import('../slices/contentSlice').then(({ refreshPrayerTimes }) => {
          (api.dispatch as AppDispatch)(refreshPrayerTimes({ forceRefresh: true }));
        });
      })
    );
  };

  /**
   * Set up sync service event listeners
   */
  const setupSyncServiceListeners = () => {
    // Handle commands from heartbeat
    unsubscribers.push(
      syncService.on<RemoteCommand>('command:received', async (command) => {
        logger.info('[RealtimeMiddleware] Command from heartbeat', {
          type: command.type,
          id: command.id,
        });

        try {
          await handleRemoteCommand(command);
        } catch (error) {
          logger.error('[RealtimeMiddleware] Heartbeat command failed', { error });
        }
      })
    );
  };

  /**
   * Handle a remote command by delegating to remoteControlService
   * 
   * This centralises all command handling logic in remoteControlService,
   * which provides:
   * - Command throttling and deduplication
   * - Response tracking
   * - Support for all command types including FORCE_UPDATE and FACTORY_RESET
   * - Proper error handling and reporting
   */
  const handleRemoteCommand = async (command: RemoteCommand): Promise<void> => {
    logger.info('[RealtimeMiddleware] Handling command via remoteControlService', { 
      type: command.type, 
      id: command.id 
    });

    // Handle UPDATE_ORIENTATION specially to ensure immediate UI update
    // The remoteControlService will also handle it, but we want to ensure
    // the orientation change event is dispatched immediately via Redux
    if (command.type === 'UPDATE_ORIENTATION' && command.payload) {
      const orientation = (command.payload as Record<string, unknown>).orientation;
      if (typeof orientation === 'string') {
        const normalizedOrientation = orientation.toUpperCase() as 'LANDSCAPE' | 'PORTRAIT';
        logger.info('[RealtimeMiddleware] Processing UPDATE_ORIENTATION command', { 
          orientation: normalizedOrientation 
        });
        
        // Store in localStorage for persistence
        localStorage.setItem('screen_orientation', normalizedOrientation);
        
        // Dispatch Redux action to update orientation state
        api.dispatch(setOrientation(normalizedOrientation));
        
        // Dispatch custom event for React components that listen directly
        window.dispatchEvent(
          new CustomEvent('orientation-changed', {
            detail: {
              orientation: normalizedOrientation,
              timestamp: Date.now(),
              source: 'websocket-command',
            },
          })
        );
      }
    }

    // Convert WebSocket command format to API format expected by remoteControlService
    const apiCommand = convertWebSocketCommandToApiFormat(command);
    
    // Delegate to remoteControlService which handles all command types
    // including FORCE_UPDATE, FACTORY_RESET, RESTART_APP, etc.
    await remoteControlService.handleCommandFromHeartbeat(apiCommand);
  };

  /**
   * Cleanup WebSocket connection and services
   */
  const cleanup = () => {
    logger.info('[RealtimeMiddleware] Cleaning up');

    // Unsubscribe from all events
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers = [];

    // Disconnect WebSocket
    websocketService.disconnect();

    // Stop sync service
    syncService.stop();

    isInitialised = false;
  };

  // Middleware function
  return (next) => (action: unknown) => {
    const result = next(action);
    const typedAction = action as { type: string; payload?: unknown };

    // Handle specific actions
    switch (typedAction.type) {
      case 'auth/initializeFromStorage/fulfilled':
      case 'auth/checkPairingStatus/fulfilled':
        // Authentication successful, initialise services
        logger.debug('[RealtimeMiddleware] Auth action received');
        // Use setTimeout to ensure Redux state is updated
        setTimeout(() => initialise(), 100);
        break;

      case 'auth/logout':
        // User logged out, cleanup services
        logger.debug('[RealtimeMiddleware] Logout detected');
        cleanup();
        break;

      case 'network/setOnline':
        // Network came back online
        if (!isInitialised) {
          const state = api.getState() as AuthStateShape;
          const isAuthenticated = state.auth.isAuthenticated;
          if (isAuthenticated) {
            logger.info('[RealtimeMiddleware] Network online, reconnecting');
            setTimeout(() => initialise(), 1000);
          }
        } else {
          // Resume sync service
          syncService.resume();
        }
        break;

      case 'network/setOffline':
        // Network went offline
        logger.info('[RealtimeMiddleware] Network offline, pausing sync');
        syncService.pause();
        break;
    }

    return result;
  };
};

/**
 * Cleanup function for the middleware
 */
export const cleanupRealtimeMiddleware = () => {
  // Unsubscribe from all events
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];

  // Disconnect services
  websocketService.disconnect();
  syncService.stop();

  isInitialised = false;

  logger.debug('[RealtimeMiddleware] Cleaned up');
};

export default realtimeMiddleware;
