/**
 * Realtime Middleware
 *
 * Connects the consolidated realtimeService + syncService to Redux.
 * Listens for auth events to start/stop connections.
 */

import { Middleware } from '@reduxjs/toolkit';
import type { AppDispatch } from '../index';
import realtimeService from '../../services/realtimeService';
import syncService from '../../services/syncService';
import credentialService from '../../services/credentialService';
import remoteControlService from '../../services/remoteControlService';
import emergencyAlertService from '../../services/emergencyAlertService';
import {
  setConnectionStatus,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  clearError,
} from '../slices/emergencySlice';
import { setOrientation, setPendingRestart, clearPendingRestart } from '../slices/uiSlice';
import logger from '../../utils/logger';

interface AuthShape {
  auth: { isAuthenticated: boolean };
}

let initialised = false;
const unsubs: Array<() => void> = [];

export const realtimeMiddleware: Middleware = (api: any) => {
  const init = () => {
    if (initialised) return;
    const state = api.getState() as AuthShape;
    if (!state.auth.isAuthenticated || !credentialService.hasCredentials()) return;

    initialised = true;
    logger.info('[RealtimeMW] Starting WebSocket and sync');

    // Show on-screen countdown when a delayed restart/reload is scheduled
    remoteControlService.setOnScheduledRestart((delaySeconds, label) => {
      api.dispatch(setPendingRestart({ at: Date.now() + delaySeconds * 1_000, label }));
    });

    // WebSocket event listeners
    unsubs.push(
      realtimeService.on('connect', () => {
        api.dispatch(setConnectionStatus({ isConnected: true, isConnecting: false }));
        api.dispatch(resetReconnectAttempts());
        api.dispatch(clearError());
        // WebSocket is up — suppress HTTP heartbeat fallback
        syncService.setHttpHeartbeatEnabled(false);
      }),
    );

    unsubs.push(
      realtimeService.on('disconnect', () => {
        api.dispatch(setConnectionStatus({ isConnected: false, isConnecting: false }));
        // WebSocket lost — resume HTTP heartbeat so the display stays visible in admin
        syncService.setHttpHeartbeatEnabled(true);
      }),
    );

    unsubs.push(
      realtimeService.on('reconnect', () => {
        api.dispatch(incrementReconnectAttempts());
      }),
    );

    // Log heartbeat acks for RTT visibility (no Redux action needed)
    unsubs.push(
      realtimeService.on<{ serverTime?: string }>('heartbeat:ack', (ack) => {
        logger.debug('[RealtimeMW] Heartbeat ack', { serverTime: ack?.serverTime });
      }),
    );

    // Emergency alerts — pass through v2 category/urgency/color fields
    unsubs.push(
      realtimeService.on<any>('emergency:alert', (payload) => {
        if (payload.action === 'clear') {
          emergencyAlertService.clearAlert();
          return;
        }
        emergencyAlertService.setAlert({
          id: payload.id || `alert-${Date.now()}`,
          title: payload.title,
          message: payload.message,
          category: payload.category ?? 'community',
          urgency: payload.urgency ?? 'high',
          color: payload.color ?? null,
          createdAt: payload.createdAt,
          expiresAt: payload.expiresAt,
          masjidId: credentialService.getMasjidId() || '',
          timing: payload.timing,
          action: payload.action,
        });
      }),
    );

    unsubs.push(
      realtimeService.on('emergency:clear', () => {
        emergencyAlertService.clearAlert();
      }),
    );

    // Orientation changes
    unsubs.push(
      realtimeService.on<any>('orientation:change', (data) => {
        const o = String(data?.orientation ?? '').toUpperCase() as 'LANDSCAPE' | 'PORTRAIT';
        if (o === 'LANDSCAPE' || o === 'PORTRAIT') {
          localStorage.setItem('screen_orientation', o);
          api.dispatch(setOrientation(o));
        }
      }),
    );

    // Remote commands (command object includes type from screen:command / screen:command:${type})
    unsubs.push(
      realtimeService.on<any>('command', async (cmd) => {
        const commandId = cmd.commandId || cmd.id || `cmd-${Date.now()}`;
        const commandType = cmd.type;
        try {
          await remoteControlService.handleCommand({
            commandId,
            type: cmd.type,
            payload: cmd.payload,
            timestamp: cmd.timestamp || new Date().toISOString(),
          });
          realtimeService.acknowledgeCommand(commandId, true, undefined, commandType);
          if (commandType === 'CLEAR_CACHE') {
            import('../slices/contentSlice').then(({ refreshAllContent }) => {
              (api.dispatch as AppDispatch)(refreshAllContent({ forceRefresh: true }));
            });
          }
        } catch (err) {
          realtimeService.acknowledgeCommand(commandId, false, String(err), commandType);
        }
      }),
    );

    // Content update notifications -> dispatch Redux refresh
    unsubs.push(
      realtimeService.on('content:update', () => {
        import('../slices/contentSlice').then(({ refreshAllContent }) => {
          (api.dispatch as AppDispatch)(refreshAllContent({ forceRefresh: true }));
        });
      }),
    );

    unsubs.push(
      realtimeService.on('prayer-times:update', () => {
        import('../slices/contentSlice').then(({ refreshPrayerTimes }) => {
          (api.dispatch as AppDispatch)(refreshPrayerTimes({ forceRefresh: true }));
        });
      }),
    );

    // Sync service heartbeat commands
    unsubs.push(
      syncService.on<any>('command:received', async (cmd) => {
        await remoteControlService.handleCommand({
          commandId: cmd.commandId || cmd.id || `cmd-${Date.now()}`,
          type: cmd.type,
          payload: cmd.payload,
          timestamp: cmd.timestamp || new Date().toISOString(),
        });
      }),
    );

    // Connect
    realtimeService.connect();
    syncService.start();
  };

  const cleanup = () => {
    unsubs.forEach((fn) => fn());
    unsubs.length = 0;
    api.dispatch(clearPendingRestart());
    remoteControlService.clearScheduledRestart();
    realtimeService.disconnect();
    syncService.stop();
    initialised = false;
  };

  return (next) => (action: unknown) => {
    const result = next(action);
    const { type } = action as { type: string };

    if (type === 'auth/initializeFromStorage/fulfilled' || type === 'auth/checkPairingStatus/fulfilled') {
      setTimeout(() => init(), 100);
    }
    if (type === 'auth/logout') {
      cleanup();
    }

    return result;
  };
};

export const cleanupRealtimeMiddleware = () => {
  unsubs.forEach((fn) => fn());
  unsubs.length = 0;
  remoteControlService.clearScheduledRestart();
  realtimeService.disconnect();
  syncService.stop();
  initialised = false;
};

export default realtimeMiddleware;
