/**
 * useDevKeyboard
 *
 * Dev-only keyboard shortcuts for testing display features.
 * Only active when import.meta.env.DEV is true — completely
 * stripped from production builds by Vite.
 *
 * Shortcuts (active only in dev):
 *   Ctrl + Shift + 1  — Safety (critical) alert   (15 s)
 *   Ctrl + Shift + 2  — Facility (high) alert      (15 s)
 *   Ctrl + Shift + 3  — Janazah (medium) alert     (15 s)
 *   Ctrl + Shift + 4  — Schedule (medium) alert    (15 s)
 *   Ctrl + Shift + 5  — Community (high) alert     (15 s)
 *   Ctrl + Shift + 6  — Custom (medium) alert      (15 s)
 *   Ctrl + Shift + 7  — Safety (medium) alert      (15 s)
 *   Ctrl + Shift + 0  — Clear current alert
 *   Ctrl + Shift + R  — Toggle Ramadan mode
 *   Ctrl + Shift + J  — Cycle prayer phase (jamaat-soon → in-prayer → auto)
 *   Ctrl + Shift + O  — Cycle orientation (landscape → portrait → auto)
 *   Ctrl + Shift + N  — Advance carousel to next slide immediately
 *   Escape            — Clear current alert
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  createTestAlert,
  clearCurrentAlert,
} from '../store/slices/emergencySlice';
import { RAMADAN_FORCE_EVENT } from './useRamadanMode';
import { PRAYER_PHASE_FORCE_EVENT } from './usePrayerPhase';
import type { PrayerPhase } from './usePrayerPhase';
import { CAROUSEL_ADVANCE_EVENT } from '../components/display/ContentCarousel';
import logger from '../utils/logger';

/* ------------------------------------------------------------------ */
/*  Orientation dev override                                           */
/* ------------------------------------------------------------------ */

type Orientation = 'LANDSCAPE' | 'PORTRAIT';

/** Custom event dispatched when the dev orientation override changes */
export const ORIENTATION_FORCE_EVENT = 'orientation-force-change';

declare global {
  interface Window {
    __ORIENTATION_FORCE?: Orientation | undefined;
  }
}

/**
 * Alert type keyed by the character produced by Shift+digit.
 * Shift+1 = '!', Shift+2 = '@', etc. on standard US/UK layouts.
 * We also match the raw digit in case the browser sends it.
 * Values correspond to the numeric key index used in createTestAlert.
 */
const ALERT_MAP: Record<string, string> = {
  '!': '1', '1': '1',
  '@': '2', '2': '2',
  '#': '3', '3': '3', '£': '3',
  '$': '4', '4': '4',
  '%': '5', '5': '5',
  '^': '6', '6': '6',
  '&': '7', '7': '7',
};

/** Characters that mean "clear" (Shift+0 = ')' on US layout) */
const CLEAR_KEYS = new Set(['0', ')']);

const TEST_ALERT_DURATION = 15; // seconds

/**
 * Cycle the Ramadan mode dev override flag on `window`.
 * Three states:  force ON → force OFF → auto-detect → force ON …
 *
 * Dispatches a custom event so `useRamadanMode` can react via
 * useState (the window property alone is not reactive to React).
 */
function toggleRamadanForce(): void {
  if (window.__RAMADAN_FORCE === true) {
    // ON → OFF
    window.__RAMADAN_FORCE = false;
    logger.info('[DevKeyboard] Ramadan mode force OFF');
  } else if (window.__RAMADAN_FORCE === false) {
    // OFF → auto-detect
    window.__RAMADAN_FORCE = undefined;
    logger.info('[DevKeyboard] Ramadan mode auto-detect');
  } else {
    // auto-detect (undefined) → ON
    window.__RAMADAN_FORCE = true;
    logger.info('[DevKeyboard] Ramadan mode force ON');
  }
  // Notify useRamadanMode so it picks up the new value via setState
  window.dispatchEvent(new Event(RAMADAN_FORCE_EVENT));
}

/**
 * Cycle the prayer phase dev override flag on `window`.
 * Three states: jamaat-soon → in-prayer → auto-detect → jamaat-soon …
 *
 * Dispatches a custom event so `usePrayerPhase` can react via
 * useState (the window property alone is not reactive to React).
 */
const PRAYER_PHASE_CYCLE: (PrayerPhase | undefined)[] = [
  'jamaat-soon',
  'in-prayer',
  undefined,
];

function togglePrayerPhaseForce(): void {
  const current = window.__PRAYER_PHASE_FORCE;
  const currentIdx = PRAYER_PHASE_CYCLE.indexOf(current);
  const nextIdx = (currentIdx + 1) % PRAYER_PHASE_CYCLE.length;
  const nextPhase = PRAYER_PHASE_CYCLE[nextIdx];

  window.__PRAYER_PHASE_FORCE = nextPhase;
  const label = nextPhase ?? 'auto-detect';
  logger.info(`[DevKeyboard] Prayer phase force: ${label}`);

  window.dispatchEvent(new Event(PRAYER_PHASE_FORCE_EVENT));
}

/**
 * Cycle the orientation dev override on `window`.
 * Three states: LANDSCAPE → PORTRAIT → auto-detect → LANDSCAPE …
 */
const ORIENTATION_CYCLE: (Orientation | undefined)[] = [
  'LANDSCAPE',
  'PORTRAIT',
  undefined,
];

function toggleOrientationForce(): void {
  const current = window.__ORIENTATION_FORCE;
  const currentIdx = ORIENTATION_CYCLE.indexOf(current);
  const nextIdx = (currentIdx + 1) % ORIENTATION_CYCLE.length;
  const next = ORIENTATION_CYCLE[nextIdx];

  window.__ORIENTATION_FORCE = next;
  const label = next ?? 'auto-detect';
  logger.info(`[DevKeyboard] Orientation force: ${label}`);

  window.dispatchEvent(new Event(ORIENTATION_FORCE_EVENT));
}

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
      'Ctrl+Shift+1': 'Safety CRITICAL alert (15 s)',
      'Ctrl+Shift+2': 'Facility HIGH alert (15 s)',
      'Ctrl+Shift+3': 'Janazah MEDIUM alert (15 s)',
      'Ctrl+Shift+4': 'Schedule MEDIUM alert (15 s)',
      'Ctrl+Shift+5': 'Community HIGH alert (15 s)',
      'Ctrl+Shift+6': 'Custom MEDIUM alert (15 s)',
      'Ctrl+Shift+7': 'Safety MEDIUM alert (15 s)',
      'Ctrl+Shift+0': 'Clear current alert',
      'Ctrl+Shift+R': 'Cycle Ramadan mode (on → off → auto)',
      'Ctrl+Shift+J': 'Cycle prayer phase (jamaat-soon → in-prayer → auto)',
      'Ctrl+Shift+O': 'Cycle orientation (landscape → portrait → auto)',
      'Ctrl+Shift+N': 'Advance carousel to next slide',
      'Escape': 'Clear current alert',
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + key → special actions
      if (e.ctrlKey && e.shiftKey && !e.metaKey) {
        // Ramadan mode toggle (R or r)
        if (e.key === 'R' || e.key === 'r') {
          e.preventDefault();
          toggleRamadanForce();
          return;
        }

        // Prayer phase toggle (J or j)
        if (e.key === 'J' || e.key === 'j') {
          e.preventDefault();
          togglePrayerPhaseForce();
          return;
        }

        // Orientation toggle (O or o)
        if (e.key === 'O' || e.key === 'o') {
          e.preventDefault();
          toggleOrientationForce();
          return;
        }

        // Carousel next slide (N or n)
        if (e.key === 'N' || e.key === 'n') {
          e.preventDefault();
          logger.info('[DevKeyboard] Advancing carousel to next slide');
          window.dispatchEvent(new Event(CAROUSEL_ADVANCE_EVENT));
          return;
        }

        const alertType = ALERT_MAP[e.key];

        if (alertType) {
          e.preventDefault();
          logger.info(`[DevKeyboard] Triggering test alert type ${alertType}`);
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
