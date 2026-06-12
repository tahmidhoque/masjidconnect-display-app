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
 *   Ctrl + Shift + J  — Cycle prayer display (phones → adhan dua → jamaat → … → auto)
 *   Ctrl + Shift + A  — Toggle post-adhan supplication force
 *   Ctrl + Shift + B  — Toggle jamaat blackout (full black screen)
 *   Ctrl + Shift + O  — Cycle orientation (landscape → portrait → auto)
 *   Ctrl + Shift + N  — Advance carousel to next slide immediately
 *   Ctrl + Shift + F  — Toggle forbidden-prayer notice (show fake / auto)
 *   Ctrl + Shift + P  — Cycle highlighted prayer (Fajr → … → Isha → auto)
 *   Ctrl + Shift + T  — Toggle "show tomorrow's list" (simulate after Isha for testing)
 *   Ctrl + Alt + Shift + M
 *                     — Cycle fake "tomorrow's jamaat changed" override
 *                       (Zuhr → Asr → Isha → off) for testing JamaatSoonSlot.
 *                       Uses Alt as well as Shift to avoid Chrome's
 *                       Ctrl+Shift+M (profile picker) interception.
 *   Escape            — Clear current alert
 *
 * Console fallbacks (when a browser shortcut is intercepted):
 *   window.__devCyclePrayerDisplay()      — same as Ctrl+Shift+J
 *   window.__devToggleAdhanSupplication() — same as Ctrl+Shift+A
 *   window.__devToggleJamaatBlackout()    — same as Ctrl+Shift+B
 *   window.__devCycleTomorrowChange()     — same as Ctrl+Alt+Shift+M
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  createTestAlert,
  clearCurrentAlert,
} from '../store/slices/emergencySlice';
import { RAMADAN_FORCE_EVENT } from './useRamadanMode';
import { PRAYER_PHASE_FORCE_EVENT } from './usePrayerPhase';
import {
  cyclePrayerDisplayDevState,
  toggleAdhanSupplicationDevForce,
  toggleJamaatBlackoutDevForce,
} from '@/dev/prayerDisplayDevOverride';
import {
  FORBIDDEN_PRAYER_FORCE_EVENT,
  NEXT_PRAYER_CYCLE_EVENT,
  SHOW_TOMORROW_LIST_FORCE_EVENT,
} from './usePrayerTimes';
import { CAROUSEL_ADVANCE_EVENT } from '../components/display/ContentCarousel';
import {
  TOMORROW_JAMAAT_CHANGE_FORCE_EVENT,
  type TomorrowJamaatChangeForce,
} from '../components/display/JamaatSoonSlot';
import logger from '../utils/logger';
import dayjs from 'dayjs';

/* ------------------------------------------------------------------ */
/*  Orientation dev override                                           */
/* ------------------------------------------------------------------ */

type Orientation = 'LANDSCAPE' | 'PORTRAIT';

/** Custom event dispatched when the dev orientation override changes */
export const ORIENTATION_FORCE_EVENT = 'orientation-force-change';

declare global {
  interface Window {
    __ORIENTATION_FORCE?: Orientation | undefined;
    /** @deprecated Use __devCyclePrayerDisplay */
    __devCyclePhase?: () => void;
    __devCyclePrayerDisplay?: () => void;
    __devToggleAdhanSupplication?: () => void;
    __devToggleJamaatBlackout?: () => void;
    /** Console fallback — same effect as Ctrl+Alt+Shift+M */
    __devCycleTomorrowChange?: () => void;
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

/**
 * Toggle the forbidden-prayer (makruh) notice for dev testing.
 * Show: sets a fake "forbidden until [now+5min]" state so the notice appears without changing system time.
 * Auto: clears override so the real computed value is used.
 */
/**
 * Cycle the fake "tomorrow's jamaat changed" override on `window`.
 * Four states: undefined → Zuhr 13:35 → Asr 16:45 → Isha 21:30 → undefined …
 *
 * When set, JamaatSoonSlot bypasses its eligibility / diff checks and
 * renders the TomorrowsJamaatChangeSlide alongside SilentPhonesGraphic
 * regardless of real prayer data. Combine with Ctrl+Shift+J (force
 * jamaat-soon phase) to verify the alternation.
 */
const TOMORROW_JAMAAT_CHANGE_CYCLE: (TomorrowJamaatChangeForce | undefined)[] = [
  { prayerName: 'Fajr', tomorrow: '04:30' },
  { prayerName: 'Zuhr', tomorrow: '13:35' },
  { prayerName: 'Asr', tomorrow: '16:45' },
  { prayerName: 'Isha', tomorrow: '21:30' },
  undefined,
];

function toggleTomorrowJamaatChangeForce(): void {
  const current = window.__TOMORROW_JAMAAT_CHANGE_FORCE;
  const currentIdx = TOMORROW_JAMAAT_CHANGE_CYCLE.findIndex(
    (entry) =>
      (entry === undefined && current === undefined) ||
      (entry !== undefined &&
        current !== undefined &&
        entry.prayerName === current.prayerName &&
        entry.tomorrow === current.tomorrow),
  );
  const nextIdx = (currentIdx + 1) % TOMORROW_JAMAAT_CHANGE_CYCLE.length;
  const next = TOMORROW_JAMAAT_CHANGE_CYCLE[nextIdx];

  window.__TOMORROW_JAMAAT_CHANGE_FORCE = next;
  const label = next ? `${next.prayerName} → ${next.tomorrow}` : 'auto-detect';
  logger.info(`[DevKeyboard] Tomorrow jamaat change force: ${label}`);

  /**
   * Convenience: when activating the override we also pin the prayer phase
   * to `jamaat-soon` so the slot is actually rendered. When cycling back
   * to "off", clear the phase override so the display returns to live data.
   * Without this the user would have to remember to also press Ctrl+Shift+J,
   * which is the most common reason "the dev shortcut doesn't work".
   */
  if (next) {
    if (window.__PRAYER_PHASE_FORCE !== 'jamaat-soon') {
      window.__PRAYER_PHASE_FORCE = 'jamaat-soon';
      window.dispatchEvent(new Event(PRAYER_PHASE_FORCE_EVENT));
      logger.info('[DevKeyboard] Auto-forced prayer phase: jamaat-soon');
    }
  } else if (window.__PRAYER_PHASE_FORCE === 'jamaat-soon') {
    window.__PRAYER_PHASE_FORCE = undefined;
    window.dispatchEvent(new Event(PRAYER_PHASE_FORCE_EVENT));
    logger.info('[DevKeyboard] Cleared auto-forced prayer phase');
  }

  window.dispatchEvent(new Event(TOMORROW_JAMAAT_CHANGE_FORCE_EVENT));
}

function toggleForbiddenPrayerForce(): void {
  if (window.__FORBIDDEN_PRAYER_FORCE !== undefined && window.__FORBIDDEN_PRAYER_FORCE !== null) {
    window.__FORBIDDEN_PRAYER_FORCE = undefined;
    logger.info('[DevKeyboard] Forbidden-prayer notice: auto (computed from time)');
  } else {
    const endsAt = dayjs().add(5, 'minute').format('HH:mm');
    window.__FORBIDDEN_PRAYER_FORCE = {
      isForbidden: true,
      reason: 'After dawn until sun up',
      endsAt,
    };
    logger.info('[DevKeyboard] Forbidden-prayer notice: showing fake', { endsAt });
  }
  window.dispatchEvent(new Event(FORBIDDEN_PRAYER_FORCE_EVENT));
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
      'Ctrl+Shift+J': 'Cycle prayer display (phones → adhan dua → jamaat → … → auto)',
      'Ctrl+Shift+A': 'Toggle post-adhan supplication (force on/off)',
      'Ctrl+Shift+B': 'Toggle jamaat blackout (full black screen)',
      'Ctrl+Shift+O': 'Cycle orientation (landscape → portrait → auto)',
      'Ctrl+Shift+N': 'Advance carousel to next slide',
      'Ctrl+Shift+F': 'Toggle forbidden-prayer notice (show fake / auto)',
      'Ctrl+Shift+P': 'Cycle highlighted prayer (Fajr → … → auto)',
      'Ctrl+Shift+T': "Toggle show tomorrow's list (simulate after Isha)",
      'Ctrl+Alt+Shift+M': 'Cycle fake tomorrow jamaat change (Zuhr → Asr → Isha → off)',
      'Escape': 'Clear current alert',
    });

    /**
     * Console fallbacks — always available in dev, immune to browser
     * shortcut interception. Call from DevTools, e.g.:
     *   __devCycleTomorrowChange()
     *   __devCyclePhase()
     */
    window.__devCyclePrayerDisplay = cyclePrayerDisplayDevState;
    window.__devCyclePhase = cyclePrayerDisplayDevState;
    window.__devToggleAdhanSupplication = toggleAdhanSupplicationDevForce;
    window.__devToggleJamaatBlackout = toggleJamaatBlackoutDevForce;
    window.__devCycleTomorrowChange = toggleTomorrowJamaatChangeForce;
    // eslint-disable-next-line no-console
    console.log(
      '%cConsole: __devCyclePrayerDisplay(), __devToggleAdhanSupplication(), __devToggleJamaatBlackout(), __devCycleTomorrowChange()',
      'color: #93c5fd; font-style: italic',
    );

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Alt + Shift + M — separate combo so Chrome's Ctrl+Shift+M
      // (profile picker) cannot swallow it. Checked before the generic
      // Ctrl+Shift block so altKey doesn't disqualify it.
      if (
        e.ctrlKey &&
        e.shiftKey &&
        e.altKey &&
        !e.metaKey &&
        (e.key === 'M' || e.key === 'm' || e.code === 'KeyM')
      ) {
        e.preventDefault();
        toggleTomorrowJamaatChangeForce();
        return;
      }

      // Ctrl + Shift + key → special actions
      if (e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey) {
        // Ramadan mode toggle (R or r)
        if (e.key === 'R' || e.key === 'r') {
          e.preventDefault();
          toggleRamadanForce();
          return;
        }

        // Prayer display cycle (J or j)
        if (e.key === 'J' || e.key === 'j') {
          e.preventDefault();
          cyclePrayerDisplayDevState();
          return;
        }

        // Post-adhan supplication toggle (A or a)
        if (e.key === 'A' || e.key === 'a') {
          e.preventDefault();
          toggleAdhanSupplicationDevForce();
          return;
        }

        // Jamaat blackout toggle (B or b)
        if (e.key === 'B' || e.key === 'b') {
          e.preventDefault();
          toggleJamaatBlackoutDevForce();
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

        // Forbidden-prayer notice toggle (F or f) — for testing without changing system time
        if (e.key === 'F' || e.key === 'f') {
          e.preventDefault();
          toggleForbiddenPrayerForce();
          return;
        }

        // Cycle highlighted prayer (P or p) — for testing countdown/highlight per prayer
        if (e.key === 'P' || e.key === 'p') {
          e.preventDefault();
          window.dispatchEvent(new Event(NEXT_PRAYER_CYCLE_EVENT));
          return;
        }

        // Toggle show tomorrow's list (T or t) — simulate "after Isha" for testing without changing system time
        if (e.key === 'T' || e.key === 't') {
          e.preventDefault();
          if (window.__SHOW_TOMORROW_LIST === true) {
            window.__SHOW_TOMORROW_LIST = false;
            logger.info('[DevKeyboard] Show tomorrow list: OFF (force today)');
          } else if (window.__SHOW_TOMORROW_LIST === false) {
            window.__SHOW_TOMORROW_LIST = undefined;
            logger.info('[DevKeyboard] Show tomorrow list: auto (from time)');
          } else {
            window.__SHOW_TOMORROW_LIST = true;
            logger.info('[DevKeyboard] Show tomorrow list: ON (force tomorrow)');
          }
          window.dispatchEvent(new Event(SHOW_TOMORROW_LIST_FORCE_EVENT));
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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      delete window.__devCyclePhase;
      delete window.__devCyclePrayerDisplay;
      delete window.__devToggleAdhanSupplication;
      delete window.__devToggleJamaatBlackout;
      delete window.__devCycleTomorrowChange;
    };
  }, [dispatch]);
};

export default useDevKeyboard;
