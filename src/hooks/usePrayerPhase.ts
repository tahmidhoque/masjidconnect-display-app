/**
 * usePrayerPhase
 *
 * Determines the current display phase of the prayer lifecycle.
 * Consumes `usePrayerTimes` and `useCurrentTime`, returning a phase string
 * that drives what the display shows (carousel, phones-off graphic,
 * or in-prayer calm screen).
 *
 * Phases:
 *   countdown-adhan  — Normal display. Carousel visible, counting down to adhan.
 *   countdown-jamaat — Adhan passed, carousel visible, counting down to jamaat (> 5 min).
 *   jamaat-soon      — Within 5 min of jamaat. Phones-off graphic replaces carousel.
 *   in-prayer        — Jamaat reached. Calm "get ready" screen for 5 min.
 *
 * Supports a dev override via window.__PRAYER_PHASE_FORCE so keyboard
 * shortcuts can force any phase for testing (same pattern as Ramadan toggle).
 */

import { useMemo, useState, useEffect } from 'react';
import { usePrayerTimes } from './usePrayerTimes';
import { useCurrentTime } from './useCurrentTime';
import logger from '../utils/logger';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PrayerPhase =
  | 'countdown-adhan'
  | 'countdown-jamaat'
  | 'jamaat-soon'
  | 'in-prayer';

export interface PrayerPhaseData {
  /** Current display phase */
  phase: PrayerPhase;
  /** Name of the prayer this phase relates to (e.g. "Zuhr") */
  prayerName: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** How many minutes before jamaat to show the phones-off graphic */
const JAMAAT_SOON_THRESHOLD_MIN = 5;

/** How many minutes after jamaat to show the in-prayer screen */
const IN_PRAYER_DURATION_MIN = 5;

/* ------------------------------------------------------------------ */
/*  Dev-mode force flag                                                */
/*                                                                     */
/*  The toggle (useDevKeyboard Ctrl+Shift+J) sets                      */
/*  window.__PRAYER_PHASE_FORCE and dispatches a custom event so the   */
/*  hook can react immediately via useState.                           */
/* ------------------------------------------------------------------ */

/** Custom event name dispatched by the dev toggle */
export const PRAYER_PHASE_FORCE_EVENT = 'prayer-phase-force-change';

declare global {
  interface Window {
    __PRAYER_PHASE_FORCE?: PrayerPhase | undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Parse an "HH:mm" string into total minutes since midnight.
 * Returns -1 if invalid.
 */
function toMinutes(timeStr: string | undefined): number {
  if (!timeStr) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

/**
 * Convert a Date into total minutes since midnight.
 */
function nowMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const usePrayerPhase = (): PrayerPhaseData => {
  const { nextPrayer, currentPrayer } = usePrayerTimes();
  const currentTime = useCurrentTime();

  /* ---- Dev force flag as reactive state ---- */
  const [forceFlag, setForceFlag] = useState<PrayerPhase | undefined>(
    () => window.__PRAYER_PHASE_FORCE,
  );

  useEffect(() => {
    const handleForceChange = () => {
      setForceFlag(window.__PRAYER_PHASE_FORCE);
    };
    window.addEventListener(PRAYER_PHASE_FORCE_EVENT, handleForceChange);
    return () => window.removeEventListener(PRAYER_PHASE_FORCE_EVENT, handleForceChange);
  }, []);

  /* ---- Phase calculation ---- */
  const phaseData = useMemo((): PrayerPhaseData => {
    // Dev override takes priority
    if (forceFlag) {
      const name = nextPrayer?.name ?? currentPrayer?.name ?? null;
      logger.debug(`[PrayerPhase] Dev override active: ${forceFlag}`);
      return { phase: forceFlag, prayerName: name };
    }

    // Default phase
    const defaultResult: PrayerPhaseData = {
      phase: 'countdown-adhan',
      prayerName: nextPrayer?.name ?? null,
    };

    if (!nextPrayer) return defaultResult;

    const now = nowMinutes(currentTime);
    const adhanMin = toMinutes(nextPrayer.time);
    const jamaatMin = toMinutes(nextPrayer.jamaat);

    // If we don't have valid adhan time, fall back to default
    if (adhanMin < 0) return defaultResult;

    // Determine the prayer name for context.
    // When between adhan and jamaat, or post-jamaat, use the "next" prayer's name
    // (which is actually the current one being prayed — usePrayerTimes sets nextIndex
    // to the same prayer when between adhan and jamaat).
    const prayerName = nextPrayer.name;

    // No jamaat time available — just count down to adhan
    if (jamaatMin < 0) {
      return { phase: 'countdown-adhan', prayerName };
    }

    // === Adhan has NOT yet passed ===
    if (now < adhanMin) {
      return { phase: 'countdown-adhan', prayerName };
    }

    // === Between adhan and jamaat ===
    if (now >= adhanMin && now < jamaatMin) {
      const minutesToJamaat = jamaatMin - now;

      if (minutesToJamaat <= JAMAAT_SOON_THRESHOLD_MIN) {
        logger.debug(
          `[PrayerPhase] jamaat-soon: ${minutesToJamaat.toFixed(1)} min to jamaat`,
        );
        return { phase: 'jamaat-soon', prayerName };
      }

      return { phase: 'countdown-jamaat', prayerName };
    }

    // === Past jamaat time ===
    const minutesSinceJamaat = now - jamaatMin;

    if (minutesSinceJamaat <= IN_PRAYER_DURATION_MIN) {
      logger.debug(
        `[PrayerPhase] in-prayer: ${minutesSinceJamaat.toFixed(1)} min since jamaat`,
      );
      return { phase: 'in-prayer', prayerName };
    }

    // Past the in-prayer window — back to normal countdown for next salaat
    return { phase: 'countdown-adhan', prayerName: nextPrayer.name };
  }, [nextPrayer, currentPrayer, currentTime, forceFlag]);

  return phaseData;
};

export default usePrayerPhase;
