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
 * Returns the resolved tomorrow time when yes, null when no.
 */
export function resolveTomorrowChange(
  prayerName: string | null | undefined,
  todayJamaat: string | null | undefined,
  tomorrowsJamaats: Record<string, string> | null | undefined,
): { prayerName: string; tomorrow: string } | null {
  if (!prayerName || !TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has(prayerName)) {
    return null;
  }
  const today = normaliseHHmm(todayJamaat);
  const tomorrowRaw = tomorrowsJamaats?.[prayerName];
  const tomorrow = normaliseHHmm(tomorrowRaw);
  if (!today || !tomorrow) return null;
  if (today === tomorrow) return null;
  return { prayerName, tomorrow: tomorrowRaw as string };
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
    );
  }, [forceFlag, nextPrayer?.name, nextPrayer?.jamaat, tomorrowsJamaats]);

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
