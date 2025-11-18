/**
 * useConnectionStatus Hook
 *
 * Combines network status and SSE connection health into a unified connection status.
 * Returns a simplified status object for display in the footer.
 */

import { useMemo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectNetworkStatus } from "../store/slices/errorSlice";
import unifiedSSEService from "../services/unifiedSSEService";

export type ConnectionStatusType =
  | "connected"
  | "no-internet"
  | "server-unreachable"
  | "no-connection";

export interface ConnectionStatus {
  hasConnection: boolean;
  status: ConnectionStatusType;
  message: string;
  severity: "error" | "warning";
}

/**
 * Hook that combines network status and SSE connection health
 */
export const useConnectionStatus = (): ConnectionStatus => {
  const networkStatus = useSelector(selectNetworkStatus);
  const [sseConnected, setSseConnected] = useState(
    unifiedSSEService.isConnectionHealthy(),
  );

  // Subscribe to SSE connection status changes
  useEffect(() => {
    const unsubscribe = unifiedSSEService.addConnectionStatusListener(
      (status) => {
        const isHealthy = unifiedSSEService.isConnectionHealthy();
        setSseConnected(isHealthy);
      },
    );

    // Also check periodically in case listener doesn't fire
    const interval = setInterval(() => {
      const isHealthy = unifiedSSEService.isConnectionHealthy();
      setSseConnected(isHealthy);
    }, 5000); // Check every 5 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    const isOnline = networkStatus.isOnline;
    const isApiReachable = networkStatus.isApiReachable;

    // Determine combined status
    // Priority: no internet > server unreachable > no connection (both) > connected
    if (!isOnline) {
      // Device is offline - no internet connection
      return {
        hasConnection: false,
        status: "no-internet",
        message: "No Internet",
        severity: "error",
      };
    } else if (!isApiReachable || !sseConnected) {
      // Online but server/SSE is unreachable
      return {
        hasConnection: false,
        status: "server-unreachable",
        message: "Server Unreachable",
        severity: "warning",
      };
    } else {
      // Everything is connected
      return {
        hasConnection: true,
        status: "connected",
        message: "",
        severity: "error",
      };
    }
  }, [networkStatus.isOnline, networkStatus.isApiReachable, sseConnected]);
};

