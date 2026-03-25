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
 *   in-prayer        — Jamaat reached. Calm screen for A + B minutes (displaySettings: jamaat-in-progress + post-jamaat delay).
 *
 * Supports a dev override via window.__PRAYER_PHASE_FORCE so keyboard
 * shortcuts can force any phase for testing (same pattern as Ramadan toggle).
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { usePrayerTimesContext } from '../contexts/PrayerTimesContext';
import { useCurrentTime } from './useCurrentTime';
import { toMinutesFromMidnight } from '../utils/dateUtils';
import logger from '../utils/logger';
import { useAppSelector } from '@/store/hooks';
import { selectDisplaySettings } from '@/store/slices/contentSlice';
import {
  jamaatPhaseMinutesForDisplayPrayer,
  postJamaatDelayMinutes,
} from '@/utils/displaySettingsJamaat';

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
  /** When phase is 'in-prayer': 'jamaat' = first A min, 'post-jamaat' = next B min (displaySettings). */
  inPrayerSubPhase?: 'jamaat' | 'post-jamaat';
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** How many minutes before jamaat to show the phones-off graphic */
const JAMAAT_SOON_THRESHOLD_MIN = 5;

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
 * Convert a Date into total minutes since midnight.
 */
function nowMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const usePrayerPhase = (): PrayerPhaseData => {
  const { nextPrayer, currentPrayer } = usePrayerTimesContext();
  const currentTime = useCurrentTime();
  const displaySettings = useAppSelector(selectDisplaySettings);

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

  /* ---- Defensive debug: log when current prayer has no jamaat (helps diagnose production) ---- */
  const lastLoggedMissingJamaatRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentPrayer?.name && currentPrayer.jamaat == null) {
      if (lastLoggedMissingJamaatRef.current !== currentPrayer.name) {
        lastLoggedMissingJamaatRef.current = currentPrayer.name;
        logger.debug(
          '[PrayerPhase] currentPrayer has no jamaat time — in-prayer phase will not trigger',
          { prayerName: currentPrayer.name },
        );
      }
    } else if (currentPrayer?.jamaat) {
      lastLoggedMissingJamaatRef.current = null;
    }
  }, [currentPrayer?.name, currentPrayer?.jamaat]);

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

    const now = nowMinutes(currentTime);

    // === In-prayer window: past current prayer's jamaat but within A + B (displaySettings) ===
    // Use currentPrayer so we stay on "Jamaat in progress" for the full duration even after
    // nextPrayer has already advanced to the next salaat (avoids carousel flashing back after ~0.5s).
    const delayMin = postJamaatDelayMinutes(displaySettings);
    if (currentPrayer?.jamaat) {
      const jamaatProgressMin = jamaatPhaseMinutesForDisplayPrayer(
        displaySettings,
        currentPrayer.name,
      );
      const totalWindowMin = jamaatProgressMin + delayMin;
      const currentJamaatMin = toMinutesFromMidnight(currentPrayer.jamaat, currentPrayer.name);
      if (currentJamaatMin >= 0 && now >= currentJamaatMin) {
        const minutesSinceJamaat = now - currentJamaatMin;
        if (minutesSinceJamaat <= totalWindowMin) {
          const inPrayerSubPhase: 'jamaat' | 'post-jamaat' =
            minutesSinceJamaat <= jamaatProgressMin ? 'jamaat' : 'post-jamaat';
          logger.debug(
            `[PrayerPhase] in-prayer: ${minutesSinceJamaat.toFixed(1)} min since ${currentPrayer.name} jamaat (${inPrayerSubPhase})`,
          );
          return { phase: 'in-prayer', prayerName: currentPrayer.name, inPrayerSubPhase };
        }
        // Diagnostic: if minutesSinceJamaat is unexpectedly large (>1h), may indicate time parsing bug
        if (minutesSinceJamaat > 60) {
          logger.warn('[PrayerPhase] Past jamaat but minutesSinceJamaat unexpectedly large — possible time format mismatch', {
            prayerName: currentPrayer.name,
            jamaat: currentPrayer.jamaat,
            minutesSinceJamaat: Math.round(minutesSinceJamaat),
            nowMinutes: Math.round(now),
            jamaatMinutes: currentJamaatMin,
          });
        }
      }
    }

    if (!nextPrayer) return defaultResult;

    const adhanMin = toMinutesFromMidnight(nextPrayer.time, nextPrayer.name);
    const jamaatMin = toMinutesFromMidnight(nextPrayer.jamaat, nextPrayer.name);

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

    // === At or just past jamaat: in-prayer from nextPrayer's jamaat time ===
    // Ensures we show in-prayer as soon as we reach jamaat even if currentPrayer hasn't updated.
    if (jamaatMin >= 0 && now >= jamaatMin) {
      const jamaatProgressMin = jamaatPhaseMinutesForDisplayPrayer(
        displaySettings,
        nextPrayer.name,
      );
      const totalWindowMin = jamaatProgressMin + delayMin;
      const minutesSinceJamaat = now - jamaatMin;
      if (minutesSinceJamaat <= totalWindowMin) {
        const inPrayerSubPhase: 'jamaat' | 'post-jamaat' =
          minutesSinceJamaat <= jamaatProgressMin ? 'jamaat' : 'post-jamaat';
        logger.debug(
          `[PrayerPhase] in-prayer: ${minutesSinceJamaat.toFixed(1)} min since ${nextPrayer.name} jamaat (nextPrayer-based, ${inPrayerSubPhase})`,
        );
        return { phase: 'in-prayer', prayerName: nextPrayer.name, inPrayerSubPhase };
      }
      // Diagnostic: if minutesSinceJamaat is unexpectedly large (>1h), may indicate time parsing bug (e.g. 12h format)
      if (minutesSinceJamaat > 60) {
        logger.warn('[PrayerPhase] Past jamaat but minutesSinceJamaat unexpectedly large — possible time format mismatch', {
          prayerName: nextPrayer.name,
          jamaat: nextPrayer.jamaat,
          minutesSinceJamaat: Math.round(minutesSinceJamaat),
          nowMinutes: Math.round(now),
          jamaatMinutes: jamaatMin,
        });
      }
    }

    // === Adhan has NOT yet passed ===
    if (now < adhanMin) {
      return { phase: 'countdown-adhan', prayerName };
    }

    // === Between adhan and jamaat ===
    if (now >= adhanMin && now < jamaatMin) {
      const minutesToJamaat = jamaatMin - now;

      // At or past jamaat (rounding / boundary): show in-prayer, not jamaat-soon
      if (minutesToJamaat <= 0) {
        logger.debug(
          `[PrayerPhase] in-prayer: at or past jamaat (minutesToJamaat=${minutesToJamaat.toFixed(2)})`,
        );
        return { phase: 'in-prayer', prayerName, inPrayerSubPhase: 'jamaat' };
      }

      if (minutesToJamaat <= JAMAAT_SOON_THRESHOLD_MIN) {
        logger.debug(
          `[PrayerPhase] jamaat-soon: ${minutesToJamaat.toFixed(1)} min to jamaat`,
        );
        return { phase: 'jamaat-soon', prayerName };
      }

      return { phase: 'countdown-jamaat', prayerName };
    }

    // Past jamaat and past in-prayer window — back to normal countdown for next salaat
    return { phase: 'countdown-adhan', prayerName: nextPrayer.name };
  }, [nextPrayer, currentPrayer, currentTime, forceFlag, displaySettings]);

  return phaseData;
};

export default usePrayerPhase;
