/**
 * useConnectionStatus Hook
 *
 * Combines network status and SSE connection health into a unified connection status.
 * Returns a simplified status object for display in the footer.
 *
 * Includes grace period logic to prevent false-positive disconnection warnings
 * during app startup and initial SSE connection establishment.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { selectNetworkStatus } from "../store/slices/errorSlice";
import unifiedSSEService from "../services/unifiedSSEService";
import logger from "../utils/logger";

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

// App startup grace period - don't show connection errors for first 10 seconds
const APP_STARTUP_GRACE_PERIOD_MS = 10000;

/**
 * Hook that combines network status and SSE connection health
 */
export const useConnectionStatus = (): ConnectionStatus => {
  const networkStatus = useSelector(selectNetworkStatus);
  const [sseConnected, setSseConnected] = useState(
    unifiedSSEService.isConnectionHealthy(),
  );
  const [isWithinStartupGrace, setIsWithinStartupGrace] = useState(true);
  const appStartTime = useRef(Date.now());

  // App startup grace period - don't show connection errors immediately
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsWithinStartupGrace(false);
      logger.info("[useConnectionStatus] App startup grace period ended");
    }, APP_STARTUP_GRACE_PERIOD_MS);

    return () => clearTimeout(timer);
  }, []);

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

    // During app startup grace period, always report as connected
    // This prevents flash of disconnection warning during initial load
    if (isWithinStartupGrace) {
      logger.debug(
        "[useConnectionStatus] Within startup grace period - reporting as connected",
        {
          isOnline,
          isApiReachable,
          sseConnected,
          timeSinceStart: `${Math.round((Date.now() - appStartTime.current) / 1000)}s`,
        },
      );
      return {
        hasConnection: true,
        status: "connected",
        message: "",
        severity: "error" as const,
      };
    }

    // Check if SSE is within its own grace period (first 60 seconds after connection)
    const sseWithinGrace = unifiedSSEService.isWithinGracePeriod();

    // Determine combined status
    // Priority: no internet > server unreachable > no connection (both) > connected
    if (!isOnline) {
      // Device is offline - no internet connection
      return {
        hasConnection: false,
        status: "no-internet" as const,
        message: "No Internet",
        severity: "error" as const,
      };
    } else if (!isApiReachable && !sseWithinGrace) {
      // API is unreachable AND we're outside the SSE grace period
      // Only show server unreachable if API heartbeat actually failed
      return {
        hasConnection: false,
        status: "server-unreachable" as const,
        message: "Server Unreachable",
        severity: "warning" as const,
      };
    } else if (!sseConnected && !sseWithinGrace && !isApiReachable) {
      // Both SSE and API are having issues, outside grace period
      return {
        hasConnection: false,
        status: "server-unreachable" as const,
        message: "Server Unreachable",
        severity: "warning" as const,
      };
    } else {
      // Everything is connected, or within grace period
      return {
        hasConnection: true,
        status: "connected" as const,
        message: "",
        severity: "error" as const,
      };
    }
  }, [
    networkStatus.isOnline,
    networkStatus.isApiReachable,
    sseConnected,
    isWithinStartupGrace,
  ]);
};
