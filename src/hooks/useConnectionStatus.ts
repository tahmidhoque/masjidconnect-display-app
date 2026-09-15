/**
 * useConnectionStatus Hook
 *
 * Combines network status and WebSocket connection health into a unified status.
 * Uses the consolidated realtimeService for connection monitoring.
 *
 * WebSocket outages are degraded, not fatal: persisted prayer times and content
 * keep showing. Copy stays calm so masjid staff do not treat a paused live
 * channel as a broken display.
 */

import { useMemo, useState, useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectIsOffline } from '../store/slices/uiSlice';
import { selectIsAuthenticated } from '../store/slices/authSlice';
import realtimeService from '../services/realtimeService';
import { LIVE_UPDATES_PAUSED_COPY } from '@/utils/connectionBannerLogic';

export type ConnectionStatusType =
  | 'connected'
  | 'reconnecting'
  | 'no-internet'
  | 'server-unreachable'
  | 'no-connection';

export interface ConnectionStatus {
  hasConnection: boolean;
  status: ConnectionStatusType;
  message: string;
  severity: 'error' | 'warning' | 'info';
  isReconnecting?: boolean;
}

/** Hide transient boot disconnects before the first socket handshake finishes. */
export const STARTUP_GRACE_MS = 10_000;

/**
 * Hold after a drop before reporting paused live updates, so brief reconnects
 * do not flash the footer.
 */
export const DISCONNECT_SETTLE_MS = 3_000;

const CONNECTED: ConnectionStatus = {
  hasConnection: true,
  status: 'connected',
  message: '',
  severity: 'info',
  isReconnecting: false,
};

export const useConnectionStatus = (): ConnectionStatus => {
  const isOffline = useAppSelector(selectIsOffline);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [wsConnected, setWsConnected] = useState(() => realtimeService.connected);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [grace, setGrace] = useState(true);
  const [wsDownSettled, setWsDownSettled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGrace(false), STARTUP_GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unsubs = [
      realtimeService.on('connect', () => {
        setWsConnected(true);
        setWsReconnecting(false);
      }),
      realtimeService.on('disconnect', () => {
        setWsConnected(false);
      }),
      realtimeService.on('reconnect', () => {
        setWsConnected(false);
        setWsReconnecting(true);
      }),
    ];

    setWsConnected(realtimeService.connected);

    return () => unsubs.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    if (wsConnected) {
      setWsDownSettled(false);
      return;
    }
    const t = setTimeout(() => setWsDownSettled(true), DISCONNECT_SETTLE_MS);
    return () => clearTimeout(t);
  }, [wsConnected]);

  return useMemo(() => {
    if (grace) {
      return CONNECTED;
    }

    /* WebSocket connected = we have connectivity; navigator.onLine can be false at dev startup. */
    if (wsConnected && !wsReconnecting) {
      return CONNECTED;
    }

    if (isOffline) {
      return {
        hasConnection: false,
        status: 'no-internet' as const,
        message: 'No Internet',
        severity: 'error' as const,
        isReconnecting: false,
      };
    }

    const liveChannelDown = !wsConnected || wsReconnecting;
    if (liveChannelDown) {
      // During pairing the WebSocket intentionally has no credentials and cannot
      // connect. Don't report a paused live channel — the API is clearly reachable
      // (we obtained a pairing code). Only flag it once we are authenticated
      // and the WebSocket is expected to be connected.
      if (!isAuthenticated && !wsReconnecting) {
        return CONNECTED;
      }

      // Brief drops stay on the healthy state so the footer does not flap.
      if (!wsDownSettled) {
        return CONNECTED;
      }

      return {
        hasConnection: false,
        status: (wsReconnecting ? 'reconnecting' : 'server-unreachable') as ConnectionStatusType,
        message: LIVE_UPDATES_PAUSED_COPY,
        severity: 'info' as const,
        isReconnecting: wsReconnecting,
      };
    }

    return CONNECTED;
  }, [isOffline, wsConnected, wsReconnecting, grace, isAuthenticated, wsDownSettled]);
};

export default useConnectionStatus;
