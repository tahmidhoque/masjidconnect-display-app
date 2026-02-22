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
import { setScreenOrientation, setPendingRestart, clearPendingRestart } from '../slices/uiSlice';
import logger from '../../utils/logger';
import {
  parseScreenOrientation,
  parseRotationDegrees,
  orientationToRotationDegrees,
} from '../../utils/orientation';
import type { ContentInvalidationPayload } from '../../types/realtime';

interface AuthShape {
  auth: { isAuthenticated: boolean };
}

let initialised = false;
const unsubs: Array<() => void> = [];

/** Coalesce window for content:invalidate (ms). Multiple events per type result in one refetch. */
const CONTENT_INVALIDATE_COALESCE_MS = 3000;

/** Pending coalesce timeouts per invalidation type. Cleared on cleanup. */
const invalidationCoalesceMap = new Map<string, ReturnType<typeof setTimeout>>();

const VALID_INVALIDATION_TYPES: Array<ContentInvalidationPayload['type']> = [
  'prayer_times',
  'schedule',
  'content_item',
  'schedule_assignment',
  'events',
];

export const realtimeMiddleware: Middleware = (api: any) => {
  const init = () => {
    if (initialised) return;
    const state = api.getState() as AuthShape;
    if (!state.auth.isAuthenticated || !credentialService.hasCredentials()) return;

    initialised = true;
    logger.info('[RealtimeMW] Starting WebSocket and sync');

    // Hydrate orientation from localStorage so rotation is correct before first screen:orientation
    try {
      const storedOrientation =
        typeof localStorage !== 'undefined' ? localStorage.getItem('screen_orientation') : null;
      const storedDegrees =
        typeof localStorage !== 'undefined' ? localStorage.getItem('screen_rotation_degrees') : null;
      if (storedOrientation) {
        const orientation = parseScreenOrientation(storedOrientation);
        const parsed = parseRotationDegrees(storedDegrees != null ? parseInt(storedDegrees, 10) : undefined);
        const rotationDegrees = parsed ?? orientationToRotationDegrees(orientation);
        api.dispatch(setScreenOrientation({ orientation, rotationDegrees }));
      }
    } catch {
      // ignore
    }

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

    // Orientation changes (four values + optional rotationDegrees; FR-1–FR-8)
    unsubs.push(
      realtimeService.on<any>('orientation:change', (data) => {
        const orientation = parseScreenOrientation(data?.orientation);
        const rotationDegrees =
          parseRotationDegrees(data?.rotationDegrees) ?? orientationToRotationDegrees(orientation);
        try {
          localStorage.setItem('screen_orientation', orientation);
          localStorage.setItem('screen_rotation_degrees', String(rotationDegrees));
        } catch {
          // ignore storage errors
        }
        api.dispatch(setScreenOrientation({ orientation, rotationDegrees }));
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

    // Content invalidation (content:invalidate) — granular refetch, no full screen reload
    unsubs.push(
      realtimeService.on<ContentInvalidationPayload>('content:invalidate', (payload) => {
        if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
          logger.debug('[RealtimeMW] content:invalidate ignored (invalid payload)', { payload });
          return;
        }
        const invalidationType = payload.type as ContentInvalidationPayload['type'];
        if (!VALID_INVALIDATION_TYPES.includes(invalidationType)) {
          logger.debug('[RealtimeMW] content:invalidate ignored (unknown type)', { type: payload.type });
          return;
        }
        const screenId = credentialService.getCredentials()?.screenId;
        if (payload.screenId != null && payload.screenId !== '' && payload.screenId !== screenId) {
          logger.debug('[RealtimeMW] content:invalidate ignored (screenId mismatch)', {
            payloadScreenId: payload.screenId,
            thisScreenId: screenId,
          });
          return;
        }

        logger.info('[RealtimeMW] content:invalidate received, scheduling refetch', {
          type: payload.type,
          action: payload.action,
          coalesceMs: CONTENT_INVALIDATE_COALESCE_MS,
        });

        const runRefetch = () => {
          invalidationCoalesceMap.delete(payload.type);
          logger.info('[RealtimeMW] content:invalidate dispatching refetch', { type: payload.type });
          import('../slices/contentSlice').then((mod) => {
            const dispatch = api.dispatch as AppDispatch;
            switch (payload.type) {
              case 'prayer_times':
                dispatch(mod.refreshPrayerTimes({ forceRefresh: true }));
                break;
              case 'schedule':
              case 'schedule_assignment':
                // schedule_assignment: screen's assigned schedule changed — refreshSchedule clears
                // content cache and fetches fresh content so Redux state.schedule updates correctly.
                dispatch(mod.refreshSchedule({ forceRefresh: true }));
                break;
              case 'content_item':
                dispatch(mod.refreshContent({ forceRefresh: true }));
                break;
              case 'events':
                dispatch(mod.refreshEvents({ forceRefresh: true }));
                break;
              default:
                break;
            }
          });
        };

        const existing = invalidationCoalesceMap.get(payload.type);
        if (existing) clearTimeout(existing);
        const timeoutId = setTimeout(runRefetch, CONTENT_INVALIDATE_COALESCE_MS);
        invalidationCoalesceMap.set(payload.type, timeoutId);
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
    invalidationCoalesceMap.forEach((id) => clearTimeout(id));
    invalidationCoalesceMap.clear();
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
  invalidationCoalesceMap.forEach((id) => clearTimeout(id));
  invalidationCoalesceMap.clear();
  remoteControlService.clearScheduledRestart();
  realtimeService.disconnect();
  syncService.stop();
  initialised = false;
};

export default realtimeMiddleware;
