/**
 * useConnectionStatus Hook
 *
 * Combines network status and WebSocket connection health into a unified connection status.
 * Returns a simplified status object for display in the footer.
 *
 * Uses the new websocketService for real-time connection status.
 * Includes grace period logic to prevent false-positive disconnection warnings
 * during app startup and initial connection establishment.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectNetworkStatus } from '../store/slices/errorSlice';
import websocketService, { ConnectionState } from '../services/websocketService';
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

// App startup grace period - don't show connection errors for first 10 seconds
const APP_STARTUP_GRACE_PERIOD_MS = 10000;

/**
 * Hook that combines network status and WebSocket connection health
 * Uses the new websocketService for real-time connection status
 */
export const useConnectionStatus = (): ConnectionStatus => {
  const networkStatus = useSelector(selectNetworkStatus);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [isWithinStartupGrace, setIsWithinStartupGrace] = useState(true);
  const appStartTime = useRef(Date.now());

  // App startup grace period - don't show connection errors immediately
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsWithinStartupGrace(false);
      logger.info('[useConnectionStatus] App startup grace period ended');
    }, APP_STARTUP_GRACE_PERIOD_MS);

    return () => clearTimeout(timer);
  }, []);

  // Subscribe to WebSocket connection status changes
  useEffect(() => {
    // Subscribe to connect events
    const unsubConnect = websocketService.on('connect', () => {
      setWsConnected(true);
      setWsReconnecting(false);
      logger.debug('[useConnectionStatus] WebSocket connected');
    });

    // Subscribe to disconnect events
    const unsubDisconnect = websocketService.on('disconnect', () => {
      setWsConnected(false);
      logger.debug('[useConnectionStatus] WebSocket disconnected');
    });

    // Subscribe to reconnect events
    const unsubReconnect = websocketService.on<{ attempt: number }>('reconnect', (data) => {
      setWsReconnecting(true);
      logger.debug('[useConnectionStatus] WebSocket reconnecting', { attempt: data?.attempt });
    });

    // Check initial state
    setWsConnected(websocketService.isConnected());

    // Periodic check (backup in case events are missed)
    const interval = setInterval(() => {
      const connected = websocketService.isConnected();
      const state = websocketService.getConnectionState();
      
      setWsConnected(connected);
      setWsReconnecting(state === 'reconnecting');
    }, 5000);

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubReconnect();
      clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    const isOnline = networkStatus.isOnline;
    const isApiReachable = networkStatus.isApiReachable;

    // During app startup grace period, always report as connected
    // This prevents flash of disconnection warning during initial load
    if (isWithinStartupGrace) {
      logger.debug('[useConnectionStatus] Within startup grace period - reporting as connected', {
        isOnline,
        isApiReachable,
        wsConnected,
        timeSinceStart: `${Math.round((Date.now() - appStartTime.current) / 1000)}s`,
      });
      return {
        hasConnection: true,
        status: 'connected' as const,
        message: '',
        severity: 'error' as const,
        isReconnecting: false,
      };
    }

    // Determine combined status
    // Priority: no internet > reconnecting > server unreachable > connected
    if (!isOnline) {
      // Device is offline - no internet connection
      return {
        hasConnection: false,
        status: 'no-internet' as const,
        message: 'No Internet',
        severity: 'error' as const,
        isReconnecting: false,
      };
    } else if (wsReconnecting) {
      // WebSocket is reconnecting
      return {
        hasConnection: false,
        status: 'reconnecting' as const,
        message: 'Reconnecting...',
        severity: 'warning' as const,
        isReconnecting: true,
      };
    } else if (!isApiReachable && !wsConnected) {
      // Both API and WebSocket connection are having issues
      return {
        hasConnection: false,
        status: 'server-unreachable' as const,
        message: 'Server Unreachable',
        severity: 'warning' as const,
        isReconnecting: false,
      };
    } else {
      // Everything is connected (or at least API or WebSocket is working)
      return {
        hasConnection: true,
        status: 'connected' as const,
        message: '',
        severity: 'error' as const,
        isReconnecting: false,
      };
    }
  }, [
    networkStatus.isOnline,
    networkStatus.isApiReachable,
    wsConnected,
    wsReconnecting,
    isWithinStartupGrace,
  ]);
};

export default useConnectionStatus;
