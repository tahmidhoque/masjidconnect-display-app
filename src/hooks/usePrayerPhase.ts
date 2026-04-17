/**
 * usePrayerPhase
 *
 * Determines the current display phase of the prayer lifecycle.
 * Consumes `usePrayerTimes` and `useCurrentTime`, returning a phase string
 * that drives what the display shows (carousel, phones-off graphic,
 * or in-prayer calm screen).
 *
 * Phase rule (J = jamaat minutes-from-midnight, A = adhan minutes-from-midnight,
 * `JAMAAT_LEAD_MIN` = silent-phones lead time):
 *   countdown-adhan  — Normal display. Carousel visible, counting down to adhan.
 *   countdown-jamaat — Adhan passed, still > JAMAAT_LEAD_MIN to jamaat.
 *   jamaat-soon      — Within JAMAAT_LEAD_MIN of jamaat (regardless of adhan).
 *                      Phones-off graphic replaces carousel — fires for the full
 *                      lead window even when adhan == jamaat or A is inside the
 *                      lead window.
 *   in-prayer        — Jamaat reached. Calm screen for `jamaatProgressMin`
 *                      (sub-phase 'jamaat') then `delayMin` (sub-phase
 *                      'post-jamaat') sourced from displaySettings.
 *
 * All comparisons happen in masjid-local minutes-from-midnight via
 * `nowMinutesInTz` + `toMinutesFromMidnight`, so the phase machine works
 * correctly when the device runs in a different timezone (Pi kiosk in UTC).
 *
 * Supports a dev override via window.__PRAYER_PHASE_FORCE so keyboard
 * shortcuts can force any phase for testing (same pattern as Ramadan toggle).
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { usePrayerTimesContext } from '../contexts/PrayerTimesContext';
import { useCurrentTime } from './useCurrentTime';
import { nowMinutesInTz, toMinutesFromMidnight } from '../utils/dateUtils';
import logger from '../utils/logger';
import { useAppSelector } from '@/store/hooks';
import {
  selectDisplaySettings,
  selectMasjidTimezone,
} from '@/store/slices/contentSlice';
import { defaultMasjidTimezone } from '@/config/environment';
import {
  jamaatPhaseMinutesForDisplayPrayer,
  postJamaatDelayMinutes,
} from '@/utils/displaySettingsJamaat';
import { getEffectiveJamaat } from '@/utils/jumuahJamaat';

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

/**
 * Minutes BEFORE jamaat that the silent-phones / jamaat-soon screen shows.
 * Independent of adhan: even when adhan == jamaat (or within this window),
 * the silent-phones graphic still fires for the full lead time.
 */
const JAMAAT_LEAD_MIN = 5;

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
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const usePrayerPhase = (): PrayerPhaseData => {
  const { nextPrayer, currentPrayer, isJumuahToday, jumuahTime } =
    usePrayerTimesContext();
  const currentTime = useCurrentTime();
  const displaySettings = useAppSelector(selectDisplaySettings);
  const masjidTz =
    useAppSelector(selectMasjidTimezone) || defaultMasjidTimezone;

  /* ---- Dev force flag as reactive state ---- */
  const [forceFlag, setForceFlag] = useState<PrayerPhase | undefined>(
    () => window.__PRAYER_PHASE_FORCE,
  );

  useEffect(() => {
    const handleForceChange = () => {
      setForceFlag(window.__PRAYER_PHASE_FORCE);
    };
    window.addEventListener(PRAYER_PHASE_FORCE_EVENT, handleForceChange);
    return () =>
      window.removeEventListener(PRAYER_PHASE_FORCE_EVENT, handleForceChange);
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

  /* ---- Phase calculation (single source of truth, anchored on J) ---- */
  const phaseData = useMemo((): PrayerPhaseData => {
    // Dev override takes priority
    if (forceFlag) {
      const name = nextPrayer?.name ?? currentPrayer?.name ?? null;
      return { phase: forceFlag, prayerName: name };
    }

    const defaultResult: PrayerPhaseData = {
      phase: 'countdown-adhan',
      prayerName: nextPrayer?.name ?? null,
    };

    const now = nowMinutesInTz(currentTime, masjidTz);
    const delayMin = postJamaatDelayMinutes(displaySettings);

    /**
     * Resolve the in-prayer window (J ≤ now ≤ J + progress + delay) for a
     * given prayer. Returns null when the prayer or its jamaat is missing or
     * we're outside the window. Reused for both the `currentPrayer` and
     * `nextPrayer` paths so the screen stays on "Jamaat in progress" even
     * after `nextPrayer` advances to the following salaat.
     */
    const resolveInPrayer = (
      prayerName: string | undefined,
      jamaat: string | undefined,
    ): PrayerPhaseData | null => {
      if (!prayerName || !jamaat) return null;
      const J = toMinutesFromMidnight(jamaat, prayerName);
      if (J < 0 || now < J) return null;
      const progress = jamaatPhaseMinutesForDisplayPrayer(
        displaySettings,
        prayerName,
      );
      const totalWindow = progress + delayMin;
      const elapsed = now - J;
      if (elapsed > totalWindow) return null;
      const sub: 'jamaat' | 'post-jamaat' =
        elapsed <= progress ? 'jamaat' : 'post-jamaat';
      return { phase: 'in-prayer', prayerName, inPrayerSubPhase: sub };
    };

    // On Fridays the live phase machine targets `jummahJamaat` for the Zuhr
    // slot (countdown + in-prayer + jamaat-soon all anchor on it). The panel
    // continues to display `zuhrJamaat`; this only swaps the J value used by
    // the phase calculation. See `getEffectiveJamaat` for the exact rule.
    const currentEffectiveJamaat = getEffectiveJamaat(
      currentPrayer ?? undefined,
      isJumuahToday,
      jumuahTime,
    );
    const nextEffectiveJamaat = getEffectiveJamaat(
      nextPrayer ?? undefined,
      isJumuahToday,
      jumuahTime,
    );

    // 1) Stay on in-prayer for the just-finished prayer (currentPrayer is set
    //    by usePrayerTimes for the entire window so the screen doesn't flash
    //    back to the carousel after nextPrayer advances).
    const currentInPrayer = resolveInPrayer(
      currentPrayer?.name,
      currentEffectiveJamaat,
    );
    if (currentInPrayer) return currentInPrayer;

    if (!nextPrayer) return defaultResult;

    const A = toMinutesFromMidnight(nextPrayer.time, nextPrayer.name);
    const J = toMinutesFromMidnight(nextEffectiveJamaat, nextPrayer.name);

    // 2) At/just-past jamaat for nextPrayer (in case currentPrayer hasn't
    //    advanced yet) — same window calculation as above.
    const nextInPrayer = resolveInPrayer(nextPrayer.name, nextEffectiveJamaat);
    if (nextInPrayer) return nextInPrayer;

    if (A < 0 && J < 0) return defaultResult;

    // 3) When jamaat is missing, only the adhan countdown applies.
    if (J < 0) {
      return now < A
        ? { phase: 'countdown-adhan', prayerName: nextPrayer.name }
        : { phase: 'countdown-adhan', prayerName: nextPrayer.name };
    }

    /**
     * Clamp A so a malformed `A > J` payload doesn't break the rule.
     * When A is missing we treat it as J (no adhan-only countdown phase).
     */
    const Aeff = A < 0 || A > J ? J : A;
    if (A >= 0 && A > J) {
      logger.warn(
        '[PrayerPhase] Adhan after jamaat in payload — clamping A=J',
        { prayer: nextPrayer.name, adhan: nextPrayer.time, jamaat: nextEffectiveJamaat },
      );
    }

    // 4) Within the silent-phones lead window — fires regardless of A so the
    //    screen still shows when adhan == jamaat or A is inside the window.
    if (now >= J - JAMAAT_LEAD_MIN && now < J) {
      return { phase: 'jamaat-soon', prayerName: nextPrayer.name };
    }

    // 5) Adhan passed but more than the lead window remaining → countdown to jamaat.
    if (now >= Aeff && now < J - JAMAAT_LEAD_MIN) {
      return { phase: 'countdown-jamaat', prayerName: nextPrayer.name };
    }

    // 6) Default — counting down to adhan.
    return { phase: 'countdown-adhan', prayerName: nextPrayer.name };
  }, [
    nextPrayer,
    currentPrayer,
    currentTime,
    forceFlag,
    displaySettings,
    masjidTz,
    isJumuahToday,
    jumuahTime,
  ]);

  /* ---- Transition-gated diagnostic log ----
   * Fires once per phase/sub-phase/prayer change so we can trace incorrect
   * phase resolution without flooding the console every tick.
   */
  const lastTransitionRef = useRef<string>('');
  useEffect(() => {
    const key = `${phaseData.phase}|${phaseData.inPrayerSubPhase ?? ''}|${phaseData.prayerName ?? ''}`;
    if (lastTransitionRef.current === key) return;
    lastTransitionRef.current = key;
    const now = nowMinutesInTz(currentTime, masjidTz);
    const effectiveJamaat = getEffectiveJamaat(
      nextPrayer ?? undefined,
      isJumuahToday,
      jumuahTime,
    );
    logger.debug('[PrayerPhase] Transition', {
      phase: phaseData.phase,
      sub: phaseData.inPrayerSubPhase,
      prayer: phaseData.prayerName,
      A: nextPrayer ? toMinutesFromMidnight(nextPrayer.time, nextPrayer.name) : null,
      J: nextPrayer ? toMinutesFromMidnight(effectiveJamaat, nextPrayer.name) : null,
      nowMin: Math.round(now),
    });
  }, [phaseData, currentTime, masjidTz, nextPrayer, isJumuahToday, jumuahTime]);

  return phaseData;
};

export default usePrayerPhase;
