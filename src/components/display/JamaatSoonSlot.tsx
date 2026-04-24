/**
 * JamaatSoonSlot
 *
 * Owns the carousel-band content during the `jamaat-soon` phase.
 *
 * Default behaviour: renders the existing SilentPhonesGraphic.
 *
 * When the next prayer is Zuhr / Asr / Isha AND tomorrow's jamaat time
 * for that prayer differs from today's, this slot alternates every
 * `CYCLE_MS` between the silent-phones graphic and a new
 * TomorrowsJamaatChangeSlide that announces the change. Fade animation
 * matches the carousel's crossfade for visual consistency.
 *
 * Dev override: `window.__TOMORROW_JAMAAT_CHANGE_FORCE` (toggled via
 * Ctrl+Shift+M in useDevKeyboard) injects a fake prayer + tomorrow time,
 * bypassing the eligibility and diff checks so the slide can be verified
 * regardless of real prayer data.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import SilentPhonesGraphic from './SilentPhonesGraphic';
import TomorrowsJamaatChangeSlide from './TomorrowsJamaatChangeSlide';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Prayers for which a tomorrow-change announcement is shown. */
export const TOMORROW_CHANGE_ELIGIBLE_PRAYERS: ReadonlySet<string> = new Set([
  'Zuhr',
  'Asr',
  'Isha',
]);

/** Slide cycle interval (ms). Lead window is ~5 min so 8s cycles each slide ~18×. */
const CYCLE_MS = 8000;

/** Crossfade out duration (ms). Matches ContentCarousel's transition. */
const FADE_OUT_MS = 700;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Normalise a time string to HH:mm so comparisons are robust to seconds
 * suffixes ("13:30:00") or stray whitespace. Returns null when the input
 * cannot be parsed.
 */
export function normaliseHHmm(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Pure check: should the tomorrow-change slide be shown for this combo?
 *
 * Returns the resolved tomorrow time when yes, null when no. When tomorrow's
 * entry is Jumuah (Friday Zuhr replaced by the Jumuah congregational time),
 * the returned `prayerName` is `'Jumuah'` so the slide labels itself
 * accurately rather than saying "Zuhr".
 *
 * Friday → Saturday note: on Fridays the Zuhr slot is rewritten by
 * `applyJummahSubstitution` so `todayJamaat` is the Jumuah congregational
 * time, with the underlying weekday Zuhr preserved on `todayAlternateJamaat`.
 * Comparing the displayed Jumuah time against tomorrow's regular Zuhr would
 * always differ and falsely trigger the slide. When today's slot is Jumuah
 * but tomorrow's slot is plain Zuhr (i.e. tomorrow is not also a Friday),
 * compare the two underlying weekday Zuhr times instead so the slide only
 * shows when the regular Zuhr jamaat itself is changing.
 */
export function resolveTomorrowChange(
  prayerName: string | null | undefined,
  todayJamaat: string | null | undefined,
  tomorrowsJamaats: TomorrowsJamaatsMap | undefined,
  todayIsJumuah?: boolean,
  todayAlternateJamaat?: string | null,
): { prayerName: string; tomorrow: string } | null {
  if (!prayerName || !TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has(prayerName)) {
    return null;
  }
  const entry = tomorrowsJamaats?.[prayerName];
  const tomorrowRaw = entry?.jamaat;
  const tomorrow = normaliseHHmm(tomorrowRaw);
  if (!tomorrow) return null;

  // Friday-aware comparison: if today's slot has been substituted with
  // Jumuah but tomorrow's slot is a plain Zuhr, compare the underlying
  // weekday Zuhr times so a Jumuah-vs-Zuhr mismatch doesn't falsely fire.
  const useAlternateForToday =
    todayIsJumuah === true && entry?.isJumuah !== true;
  const today = useAlternateForToday
    ? normaliseHHmm(todayAlternateJamaat)
    : normaliseHHmm(todayJamaat);
  if (!today) return null;
  if (today === tomorrow) return null;

  return {
    prayerName: entry?.isJumuah ? 'Jumuah' : prayerName,
    tomorrow: tomorrowRaw as string,
  };
}

/* ------------------------------------------------------------------ */
/*  Dev override                                                       */
/* ------------------------------------------------------------------ */

/** Custom event dispatched by the dev keyboard shortcut (Ctrl+Shift+M). */
export const TOMORROW_JAMAAT_CHANGE_FORCE_EVENT =
  'tomorrow-jamaat-change-force-change';

export interface TomorrowJamaatChangeForce {
  prayerName: 'Zuhr' | 'Asr' | 'Isha';
  /** Tomorrow's jamaat time in HH:mm. */
  tomorrow: string;
}

declare global {
  interface Window {
    __TOMORROW_JAMAAT_CHANGE_FORCE?: TomorrowJamaatChangeForce | undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export interface JamaatSoonSlotProps {
  /** Forwarded to slide components for landscape vs portrait layout. */
  landscapeSplit?: boolean;
}

const JamaatSoonSlot: React.FC<JamaatSoonSlotProps> = ({
  landscapeSplit = false,
}) => {
  const { nextPrayer, tomorrowsJamaats } = usePrayerTimesContext();

  /* Dev override flag, kept reactive via custom event. */
  const [forceFlag, setForceFlag] = useState<TomorrowJamaatChangeForce | undefined>(
    () => window.__TOMORROW_JAMAAT_CHANGE_FORCE,
  );
  useEffect(() => {
    const handler = () => setForceFlag(window.__TOMORROW_JAMAAT_CHANGE_FORCE);
    window.addEventListener(TOMORROW_JAMAAT_CHANGE_FORCE_EVENT, handler);
    return () =>
      window.removeEventListener(TOMORROW_JAMAAT_CHANGE_FORCE_EVENT, handler);
  }, []);

  /**
   * Resolved tomorrow change to render. Dev override wins; otherwise we
   * compute from the real next prayer + tomorrow's jamaats map.
   */
  const tomorrowChange = useMemo(() => {
    if (forceFlag) {
      return { prayerName: forceFlag.prayerName, tomorrow: forceFlag.tomorrow };
    }
    return resolveTomorrowChange(
      nextPrayer?.name,
      nextPrayer?.jamaat,
      tomorrowsJamaats,
      nextPrayer?.isJumuah,
      nextPrayer?.alternateJamaat,
    );
  }, [
    forceFlag,
    nextPrayer?.name,
    nextPrayer?.jamaat,
    nextPrayer?.isJumuah,
    nextPrayer?.alternateJamaat,
    tomorrowsJamaats,
  ]);

  /* Cycling state: 0 = phones graphic, 1 = tomorrow-change slide. */
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  /* Reset to slide 0 whenever the change resolves to something different
   * (or disappears) so the user always sees the phones graphic first. */
  useEffect(() => {
    setActiveIdx(0);
    setPhase('in');
  }, [tomorrowChange?.prayerName, tomorrowChange?.tomorrow]);

  useEffect(() => {
    if (!tomorrowChange) return;

    /**
     * Tracks any in-flight swap timers so an unmount mid-fade can clear
     * them. `setInterval` only schedules ticks; the 700ms swap delay is
     * a separate timer that needs its own cleanup window.
     */
    const swapTimers = new Set<ReturnType<typeof setTimeout>>();

    const tickId = setInterval(() => {
      setPhase('out');
      const swapId = setTimeout(() => {
        setActiveIdx((prev) => (prev === 0 ? 1 : 0));
        setPhase('in');
        swapTimers.delete(swapId);
      }, FADE_OUT_MS);
      swapTimers.add(swapId);
    }, CYCLE_MS);

    return () => {
      clearInterval(tickId);
      swapTimers.forEach((id) => clearTimeout(id));
      swapTimers.clear();
    };
  }, [tomorrowChange]);

  /* No tomorrow change → preserve current behaviour exactly. */
  if (!tomorrowChange) {
    return <SilentPhonesGraphic landscapeSplit={landscapeSplit} />;
  }

  const slide =
    activeIdx === 0 ? (
      <SilentPhonesGraphic landscapeSplit={landscapeSplit} />
    ) : (
      <TomorrowsJamaatChangeSlide
        prayerName={tomorrowChange.prayerName}
        tomorrowTime={tomorrowChange.tomorrow}
        landscapeSplit={landscapeSplit}
      />
    );

  return (
    <div
      key={activeIdx}
      className={`h-full w-full ${phase === 'in' ? 'animate-fade-in' : 'animate-fade-out'}`}
    >
      {slide}
    </div>
  );
};

export default React.memo(JamaatSoonSlot);
