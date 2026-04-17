/**
 * useWifiKeyboard Hook
 *
 * Registers a production-safe keyboard shortcut (Ctrl+Shift+W) to toggle
 * the WiFi settings overlay. Works on both Pi and dev environments (unlike
 * useDevKeyboard which is dev-only).
 *
 * Requires a physical USB keyboard plugged into the Pi.
 */

import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setShowWifiSettings, selectShowWifiSettings } from '../store/slices/uiSlice';
import logger from '../utils/logger';

const useWifiKeyboard = (): void => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectShowWifiSettings);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+Shift+W toggles WiFi settings overlay
      if (e.ctrlKey && e.shiftKey && (e.key === 'W' || e.key === 'w')) {
        e.preventDefault();
        e.stopPropagation();
        const next = !isOpen;
        dispatch(setShowWifiSettings(next));
        logger.info('[WiFiKeyboard] Toggled WiFi settings overlay', { visible: next });
      }
    },
    [dispatch, isOpen],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
};

export default useWifiKeyboard;
