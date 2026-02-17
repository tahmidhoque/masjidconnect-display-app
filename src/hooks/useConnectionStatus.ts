/**
 * useConnectionStatus Hook
 *
 * Combines network status and WebSocket connection health into a unified status.
 * Uses the consolidated realtimeService for connection monitoring.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectIsOffline } from '../store/slices/uiSlice';
import realtimeService from '../services/realtimeService';
import logger from '../utils/logger';

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

const STARTUP_GRACE_MS = 10_000;

export const useConnectionStatus = (): ConnectionStatus => {
  const isOffline = useSelector(selectIsOffline);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [grace, setGrace] = useState(true);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const t = setTimeout(() => setGrace(false), STARTUP_GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unsubs = [
      realtimeService.on('connect', () => { setWsConnected(true); setWsReconnecting(false); }),
      realtimeService.on('disconnect', () => setWsConnected(false)),
      realtimeService.on('reconnect', () => setWsReconnecting(true)),
    ];

    setWsConnected(realtimeService.connected);

    return () => unsubs.forEach((fn) => fn());
  }, []);

  return useMemo(() => {
    if (grace) {
      return { hasConnection: true, status: 'connected' as const, message: '', severity: 'error' as const, isReconnecting: false };
    }
    if (isOffline) {
      return { hasConnection: false, status: 'no-internet' as const, message: 'No Internet', severity: 'error' as const, isReconnecting: false };
    }
    if (wsReconnecting) {
      return { hasConnection: false, status: 'reconnecting' as const, message: 'Reconnecting...', severity: 'warning' as const, isReconnecting: true };
    }
    if (!wsConnected) {
      return { hasConnection: false, status: 'server-unreachable' as const, message: 'Server Unreachable', severity: 'warning' as const, isReconnecting: false };
    }
    return { hasConnection: true, status: 'connected' as const, message: '', severity: 'error' as const, isReconnecting: false };
  }, [isOffline, wsConnected, wsReconnecting, grace]);
};

export default useConnectionStatus;
