/**
 * useDevKeyboard
 *
 * Dev-only keyboard shortcuts for testing display features.
 * Only active when import.meta.env.DEV is true — completely
 * stripped from production builds by Vite.
 *
 * Shortcuts (active only in dev):
 *   Ctrl + Shift + 1  — RED emergency alert      (15 s)
 *   Ctrl + Shift + 2  — ORANGE alert             (15 s)
 *   Ctrl + Shift + 3  — AMBER alert              (15 s)
 *   Ctrl + Shift + 4  — BLUE alert               (15 s)
 *   Ctrl + Shift + 5  — GREEN alert              (15 s)
 *   Ctrl + Shift + 6  — PURPLE alert             (15 s)
 *   Ctrl + Shift + 7  — DARK alert               (15 s)
 *   Ctrl + Shift + 0  — Clear current alert
 *   Escape            — Clear current alert
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  createTestAlert,
  clearCurrentAlert,
} from '../store/slices/emergencySlice';
import logger from '../utils/logger';

/**
 * Alert colour keyed by the character produced by Shift+digit.
 * Shift+1 = '!', Shift+2 = '@', etc. on standard US/UK layouts.
 * We also match the raw digit in case the browser sends it.
 */
const ALERT_MAP: Record<string, string> = {
  '!': 'RED',    '1': 'RED',
  '@': 'ORANGE', '2': 'ORANGE',
  '#': 'AMBER',  '3': 'AMBER',  '£': 'AMBER',
  '$': 'BLUE',   '4': 'BLUE',
  '%': 'GREEN',  '5': 'GREEN',
  '^': 'PURPLE', '6': 'PURPLE',
  '&': 'DARK',   '7': 'DARK',
};

/** Characters that mean "clear" (Shift+0 = ')' on US layout) */
const CLEAR_KEYS = new Set(['0', ')']);

const TEST_ALERT_DURATION = 15; // seconds

const useDevKeyboard = (): void => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    /** Log available shortcuts once on mount */
    // eslint-disable-next-line no-console
    console.log(
      '%c🎮 Dev keyboard shortcuts active',
      'color: #10b981; font-weight: bold; font-size: 13px',
    );
    // eslint-disable-next-line no-console
    console.table({
      'Ctrl+Shift+1': 'RED emergency alert (15 s)',
      'Ctrl+Shift+2': 'ORANGE alert (15 s)',
      'Ctrl+Shift+3': 'AMBER alert (15 s)',
      'Ctrl+Shift+4': 'BLUE alert (15 s)',
      'Ctrl+Shift+5': 'GREEN alert (15 s)',
      'Ctrl+Shift+6': 'PURPLE alert (15 s)',
      'Ctrl+Shift+7': 'DARK alert (15 s)',
      'Ctrl+Shift+0': 'Clear current alert',
      'Escape': 'Clear current alert',
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + digit → trigger / clear alert
      if (e.ctrlKey && e.shiftKey && !e.metaKey) {
        const alertType = ALERT_MAP[e.key];

        if (alertType) {
          e.preventDefault();
          logger.info(`[DevKeyboard] Triggering ${alertType} test alert`);
          dispatch(createTestAlert({ type: alertType, duration: TEST_ALERT_DURATION }));
          return;
        }

        if (CLEAR_KEYS.has(e.key)) {
          e.preventDefault();
          logger.info('[DevKeyboard] Clearing current alert');
          dispatch(clearCurrentAlert());
          return;
        }
      }

      // Escape (unmodified) → clear alert
      if (e.key === 'Escape' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        dispatch(clearCurrentAlert());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
};

export default useDevKeyboard;
