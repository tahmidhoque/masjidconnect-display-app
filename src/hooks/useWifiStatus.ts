/**
 * useWifiStatus Hook
 *
 * Polls the deploy server's /internal/wifi/status endpoint on Pi platforms.
 * Dispatches WiFi state to Redux uiSlice. No-ops gracefully on non-Pi
 * environments (Vercel, dev, etc.).
 */

import { useEffect, useRef, useCallback } from 'react';
import { isPiPlatform } from '../config/platform';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setWifiStatus, selectIsOffline } from '../store/slices/uiSlice';
import logger from '../utils/logger';

const POLL_INTERVAL_ONLINE_MS = 10_000;
const POLL_INTERVAL_OFFLINE_MS = 3_000;
const STARTUP_DELAY_MS = 5_000;

const useWifiStatus = (): void => {
  const dispatch = useAppDispatch();
  const isOffline = useAppSelector(selectIsOffline);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/internal/wifi/status', {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return;
      const data = await res.json();
      dispatch(setWifiStatus({
        state: data.state || 'unavailable',
        ssid: data.ssid || '',
        signal: data.signal || 0,
        ip: data.ip || '',
        hotspotActive: data.hotspotActive === true,
      }));
    } catch {
      // Endpoint unavailable (non-Pi or server not running) — clear status silently
    }
  }, [dispatch]);

  useEffect(() => {
    if (!isPiPlatform) return;

    startupRef.current = setTimeout(() => {
      poll();

      const intervalMs = isOffline ? POLL_INTERVAL_OFFLINE_MS : POLL_INTERVAL_ONLINE_MS;
      intervalRef.current = setInterval(poll, intervalMs);
    }, STARTUP_DELAY_MS);

    return () => {
      if (startupRef.current) clearTimeout(startupRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, isOffline]);
};

export default useWifiStatus;
