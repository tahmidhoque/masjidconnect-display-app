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
import {
  setScreenOrientation,
  setPendingRestart,
  clearPendingRestart,
  setUpdateStatus,
  clearUpdateStatus,
} from '../slices/uiSlice';
import logger from '../../utils/logger';
import {
  parseScreenOrientation,
  parseRotationDegrees,
  orientationToRotationDegrees,
} from '../../utils/orientation';
import type { EmergencyAlert } from '../../api/models';
import type { ContentInvalidationPayload } from '../../types/realtime';

/**
 * Normalise raw Socket.io `emergency:alert` payloads (object, JSON string, or `{ data: { ... } }`).
 */
function normaliseEmergencyAlertWsPayload(raw: unknown): Record<string, unknown> | null {
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const outer = parsed as Record<string, unknown>;
  const inner = outer.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return { ...outer, ...(inner as Record<string, unknown>) };
  }
  return outer;
}

/** True when the server intends to dismiss the full-screen alert without waiting for expiry. */
function isEmergencyRemoteClearAction(payload: Record<string, unknown>): boolean {
  const a = payload.action;
  if (typeof a !== 'string') return false;
  const n = a.trim().toLowerCase();
  return n === 'clear' || n === 'hide' || n === 'cancel';
}

interface AuthShape {
  auth: { isAuthenticated: boolean };
}

let initialised = false;
const unsubs: Array<() => void> = [];

/** Coalesce window for content:invalidate (ms). Multiple events per type result in one refetch. */
const CONTENT_INVALIDATE_COALESCE_MS = 3000;

/** Pending coalesce timeouts per invalidation type. Cleared on cleanup. */
const invalidationCoalesceMap = new Map<string, ReturnType<typeof setTimeout>>();

/** Coalesce rapid `content:update` / `prayer-times:update` WS events (ms). */
const WS_UPDATE_COALESCE_MS = 3000;

/** Pending coalesce timeouts for legacy update event names. Cleared on cleanup. */
const wsUpdateCoalesceMap = new Map<string, ReturnType<typeof setTimeout>>();

const VALID_INVALIDATION_TYPES: Array<ContentInvalidationPayload['type']> = [
  'prayer_times',
  'schedule',
  'content_item',
  'schedule_assignment',
  'playlist_assignment',
  'events',
  'display_settings',
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

    // Push device update status (FORCE_UPDATE flow) to Redux for Footer
    remoteControlService.setOnUpdateStatus((phase, message, restartAt) => {
      api.dispatch(setUpdateStatus({ phase, message, restartAt }));
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

    // Screen deleted on server — token rejected at handshake; wipe local state like FACTORY_RESET
    unsubs.push(
      realtimeService.on('screen_token_invalid', () => {
        logger.warn('[RealtimeMW] Screen token invalid — performing factory reset');
        void remoteControlService.performFactoryReset();
      }),
    );

    // Log heartbeat acks for RTT visibility (no Redux action needed)
    unsubs.push(
      realtimeService.on<{ serverTime?: string }>('heartbeat:ack', (ack) => {
        logger.debug('[RealtimeMW] Heartbeat ack', { serverTime: ack?.serverTime });
      }),
    );

    // Emergency alerts — `action: clear` (or hide/cancel) dismisses overlay immediately
    unsubs.push(
      realtimeService.on<unknown>('emergency:alert', (raw) => {
        const payload = normaliseEmergencyAlertWsPayload(raw);
        if (!payload) {
          logger.debug('[RealtimeMW] emergency:alert ignored (invalid payload)');
          return;
        }
        if (isEmergencyRemoteClearAction(payload)) {
          logger.info('[RealtimeMW] emergency:alert remote clear');
          emergencyAlertService.clearAlert();
          return;
        }
        emergencyAlertService.setAlert({
          id: (typeof payload.id === 'string' && payload.id) || `alert-${Date.now()}`,
          title: payload.title as string,
          message: payload.message as string,
          category: (payload.category as EmergencyAlert['category']) ?? 'community',
          urgency: (payload.urgency as EmergencyAlert['urgency']) ?? 'high',
          color: (payload.color as string | null | undefined) ?? null,
          createdAt: payload.createdAt as string,
          expiresAt: payload.expiresAt as string,
          masjidId: credentialService.getMasjidId() || '',
          timing: payload.timing as EmergencyAlert['timing'],
          action: payload.action as EmergencyAlert['action'],
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
          if (commandType === 'CLEAR_CACHE' || commandType === 'RELOAD_CONTENT') {
            import('../slices/contentSlice').then(({ refreshAllContent }) => {
              (api.dispatch as AppDispatch)(refreshAllContent({ forceRefresh: true }));
            });
          }
          if (commandType === 'UPDATE_SETTINGS') {
            import('../slices/contentSlice').then(({ refreshAllContent }) => {
              (api.dispatch as AppDispatch)(refreshAllContent({ forceRefresh: true }));
            });
          }
          if (commandType === 'REFRESH_PRAYER_TIMES') {
            import('../slices/contentSlice').then(({ refreshPrayerTimes }) => {
              (api.dispatch as AppDispatch)(refreshPrayerTimes({ forceRefresh: true }));
            });
          }
          if (commandType === 'UPDATE_ORIENTATION' && cmd.payload && typeof cmd.payload === 'object') {
            const data = cmd.payload as { orientation?: unknown; rotationDegrees?: unknown };
            const orientation = parseScreenOrientation(data?.orientation);
            const rotationDegrees =
              parseRotationDegrees(data?.rotationDegrees) ?? orientationToRotationDegrees(orientation);
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('screen_orientation', orientation);
                localStorage.setItem('screen_rotation_degrees', String(rotationDegrees));
              }
            } catch {
              // ignore storage errors
            }
            api.dispatch(setScreenOrientation({ orientation, rotationDegrees }));
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

        logger.debug('[RealtimeMW] content:invalidate received, scheduling refetch', {
          type: payload.type,
          action: payload.action,
          coalesceMs: CONTENT_INVALIDATE_COALESCE_MS,
        });
        const runRefetch = () => {
          invalidationCoalesceMap.delete(payload.type);
          logger.debug('[RealtimeMW] content:invalidate dispatching refetch', { type: payload.type });
          void (async () => {
            try {
              const mod = await import('../slices/contentSlice');
              const dispatch = api.dispatch as AppDispatch;
              switch (payload.type) {
                case 'prayer_times':
                  await dispatch(mod.refreshPrayerTimes({ forceRefresh: true })).unwrap();
                  break;
                case 'display_settings':
                  await dispatch(mod.refreshContent({ forceRefresh: true })).unwrap();
                  await dispatch(mod.refreshPrayerTimes({ forceRefresh: true })).unwrap();
                  break;
                case 'schedule':
                case 'schedule_assignment':
                  // Schedule payload is persisted during content sync — fetch content first.
                  await dispatch(mod.refreshContent({ forceRefresh: true })).unwrap();
                  await dispatch(mod.refreshPrayerTimes({ forceRefresh: true })).unwrap();
                  break;
                case 'playlist_assignment':
                  await dispatch(mod.refreshContent({ forceRefresh: true })).unwrap();
                  await dispatch(mod.refreshPrayerTimes({ forceRefresh: true })).unwrap();
                  break;
                case 'content_item':
                  await dispatch(mod.refreshContent({ forceRefresh: true })).unwrap();
                  await dispatch(mod.refreshPrayerTimes({ forceRefresh: true })).unwrap();
                  break;
                case 'events':
                  await dispatch(mod.refreshEvents({ forceRefresh: true })).unwrap();
                  break;
                default:
                  break;
              }
            } catch (err) {
              logger.warn('[RealtimeMW] content:invalidate refetch failed', {
                type: payload.type,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          })();
        };

        const existing = invalidationCoalesceMap.get(payload.type);
        if (existing) clearTimeout(existing);
        const timeoutId = setTimeout(runRefetch, CONTENT_INVALIDATE_COALESCE_MS);
        invalidationCoalesceMap.set(payload.type, timeoutId);
      }),
    );

    // Legacy/alternate push events — backend may emit these instead of content:invalidate
    const scheduleWsUpdateRefetch = (key: string, run: () => Promise<void>) => {
      const runRefetch = () => {
        wsUpdateCoalesceMap.delete(key);
        void (async () => {
          try {
            await run();
          } catch (err) {
            logger.warn('[RealtimeMW] WS update refetch failed', {
              key,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();
      };
      const existing = wsUpdateCoalesceMap.get(key);
      if (existing) clearTimeout(existing);
      const timeoutId = setTimeout(runRefetch, WS_UPDATE_COALESCE_MS);
      wsUpdateCoalesceMap.set(key, timeoutId);
    };

    unsubs.push(
      realtimeService.on('content:update', () => {
        logger.debug('[RealtimeMW] content:update received, scheduling refetch', {
          coalesceMs: WS_UPDATE_COALESCE_MS,
        });
        scheduleWsUpdateRefetch('content:update', async () => {
          const mod = await import('../slices/contentSlice');
          await (api.dispatch as AppDispatch)(mod.refreshContent({ forceRefresh: true })).unwrap();
        });
      }),
    );

    unsubs.push(
      realtimeService.on('prayer-times:update', () => {
        logger.debug('[RealtimeMW] prayer-times:update received, scheduling refetch', {
          coalesceMs: WS_UPDATE_COALESCE_MS,
        });
        scheduleWsUpdateRefetch('prayer-times:update', async () => {
          const mod = await import('../slices/contentSlice');
          await (api.dispatch as AppDispatch)(mod.refreshPrayerTimes({ forceRefresh: true })).unwrap();
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
        // When commands arrive via HTTP heartbeat (no WebSocket), we must still trigger
        // refetch and orientation updates — only the WebSocket listener did this before.
        const commandType = cmd.type;
        if (commandType === 'CLEAR_CACHE' || commandType === 'RELOAD_CONTENT') {
          import('../slices/contentSlice').then(({ refreshAllContent }) => {
            (api.dispatch as AppDispatch)(refreshAllContent({ forceRefresh: true }));
          });
        }
        if (commandType === 'UPDATE_SETTINGS') {
          import('../slices/contentSlice').then(({ refreshAllContent }) => {
            (api.dispatch as AppDispatch)(refreshAllContent({ forceRefresh: true }));
          });
        }
        if (commandType === 'REFRESH_PRAYER_TIMES') {
          import('../slices/contentSlice').then(({ refreshPrayerTimes }) => {
            (api.dispatch as AppDispatch)(refreshPrayerTimes({ forceRefresh: true }));
          });
        }
        if (commandType === 'UPDATE_ORIENTATION' && cmd.payload && typeof cmd.payload === 'object') {
          const data = cmd.payload as { orientation?: unknown; rotationDegrees?: unknown };
          const orientation = parseScreenOrientation(data?.orientation);
          const rotationDegrees =
            parseRotationDegrees(data?.rotationDegrees) ?? orientationToRotationDegrees(orientation);
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('screen_orientation', orientation);
              localStorage.setItem('screen_rotation_degrees', String(rotationDegrees));
            }
          } catch {
            // ignore storage errors
          }
          api.dispatch(setScreenOrientation({ orientation, rotationDegrees }));
        }
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
    wsUpdateCoalesceMap.forEach((id) => clearTimeout(id));
    wsUpdateCoalesceMap.clear();
    api.dispatch(clearPendingRestart());
    api.dispatch(clearUpdateStatus());
    remoteControlService.clearScheduledRestart();
    remoteControlService.clearDeviceUpdatePolling();
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
  wsUpdateCoalesceMap.forEach((id) => clearTimeout(id));
  wsUpdateCoalesceMap.clear();
  remoteControlService.clearScheduledRestart();
  remoteControlService.clearDeviceUpdatePolling();
  realtimeService.disconnect();
  syncService.stop();
  initialised = false;
};

export default realtimeMiddleware;
