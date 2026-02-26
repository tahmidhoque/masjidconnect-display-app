/**
 * PrayerCountdown
 *
 * Shows a live countdown to the next prayer or jamaat, with phase-aware
 * labels. During `in-prayer` phase, displays a calm "Jamaat in progress"
 * message instead of the countdown digits.
 *
 * Computes the remaining time every second using useCurrentTime,
 * rather than relying on the static timeUntil from usePrayerTimes.
 * GPU-safe: uses transform/opacity only for animation.
 */

import React, { useMemo } from 'react';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { getTimeUntilNextPrayer } from '../../utils/dateUtils';
import type { PrayerPhase } from '../../hooks/usePrayerPhase';

interface PrayerCountdownProps {
  /** Current prayer phase — controls labels and in-prayer display */
  phase?: PrayerPhase;
}

/**
 * Map a prayer phase to its top label text.
 * Single dynamic line: "{prayerName} prayer in" or "{prayerName} Jamaat in".
 */
function phaseLabel(phase: PrayerPhase | undefined, prayerName: string | null | undefined): string {
  switch (phase) {
    case 'countdown-jamaat':
    case 'jamaat-soon':
      return prayerName ? `${prayerName} Jamaat in` : 'Jamaat in';
    case 'in-prayer':
      return 'In Progress';
    case 'countdown-adhan':
    default:
      return prayerName ? `${prayerName} prayer in` : 'Next prayer in';
  }
}

/**
 * Whether we are currently counting down to jamaat (between adhan and jamaat).
 */
function isCountingToJamaat(
  targetTime: { time: string } | null,
  jamaat: string | undefined,
): boolean {
  return Boolean(targetTime && jamaat && targetTime.time === jamaat);
}

/** Parse "H:mm" or "HH:mm" to minutes since midnight. Returns -1 if invalid. */
function timeToMinutes(hhmm: string | undefined): number {
  if (!hhmm) return -1;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

/**
 * Effective minutes for comparison when API may send 12h format for evening prayers.
 * For Maghrib/Isha, if parsed hour is 1–11, treat as PM (add 12h) so "7:45" → 19:45.
 */
function effectiveMinutes(hhmm: string | undefined, prayerName: string): number {
  const min = timeToMinutes(hhmm);
  if (min < 0 || !hhmm) return min;
  const h = Number(hhmm.split(':')[0]);
  if (Number.isNaN(h)) return min;
  const isEveningPrayer = prayerName === 'Maghrib' || prayerName === 'Isha';
  if (isEveningPrayer && h >= 1 && h <= 11) return min + 12 * 60; // PM
  return min;
}

const PrayerCountdown: React.FC<PrayerCountdownProps> = ({ phase }) => {
  const { nextPrayer } = usePrayerTimes();
  const currentTime = useCurrentTime();

  /**
   * Determine the target time string (HH:mm) to count down to.
   * If the next prayer's adhan has passed but jamaat hasn't, count to jamaat.
   * Otherwise count to adhan.
   */
  const targetTime = useMemo(() => {
    if (!nextPrayer) return null;

    const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60;
    const adhanMin = effectiveMinutes(nextPrayer.time, nextPrayer.name);
    const jamaatMin = effectiveMinutes(nextPrayer.jamaat, nextPrayer.name);

    // Between adhan and jamaat — count down to jamaat (numeric comparison avoids "9:45" vs "19:45" string issues)
    if (adhanMin >= 0 && jamaatMin >= 0 && nowMin >= adhanMin && nowMin < jamaatMin) {
      return { time: nextPrayer.jamaat!, forceTomorrow: false };
    }

    // Past this prayer's jamaat — show 0s until nextPrayer advances (avoids 23h loop).
    // Only when jamaat is "today" (afternoon/evening) or we're in morning; else nextPrayer is e.g. Fajr and we're in evening → count to tomorrow's Fajr.
    const isPastThisPrayerJamaat =
      adhanMin >= 0 && jamaatMin >= 0 && nowMin >= adhanMin && nowMin >= jamaatMin &&
      (jamaatMin >= 12 * 60 || nowMin < 12 * 60);
    if (isPastThisPrayerJamaat) {
      return null;
    }

    // Adhan has passed but no jamaat (or missing data) — show 0s until nextPrayer advances.
    if (adhanMin >= 0 && nowMin >= adhanMin && jamaatMin < 0) {
      return null;
    }

    // If adhan has passed today (and jamaat too, or no jamaat), this is tomorrow's prayer
    if (adhanMin >= 0 && nowMin >= adhanMin) {
      return { time: nextPrayer.time, forceTomorrow: true };
    }

    // Adhan is still in the future today
    return { time: nextPrayer.time, forceTomorrow: false };
  }, [nextPrayer, currentTime]);

  /**
   * Live countdown string, recomputed every second via currentTime.
   */
  const liveCountdown = useMemo(() => {
    if (!targetTime) return nextPrayer ? '0s' : '';
    return getTimeUntilNextPrayer(targetTime.time, targetTime.forceTomorrow);
  }, [targetTime, currentTime, nextPrayer]);

  /** When counting to jamaat: "{name} Jamaat in"; otherwise "{name} prayer in". */
  const countingToJamaat = isCountingToJamaat(targetTime, nextPrayer?.jamaat);
  const countdownLabel = useMemo(
    () =>
      countingToJamaat
        ? (nextPrayer?.name ? `${nextPrayer.name} Jamaat in` : 'Jamaat in')
        : (nextPrayer?.name ? `${nextPrayer.name} prayer in` : 'Next prayer in'),
    [countingToJamaat, nextPrayer?.name],
  );

  if (!nextPrayer) {
    return null;
  }

  /* ---- In-prayer: calm static display, no ticking countdown ---- */
  if (phase === 'in-prayer') {
    return (
      <div className="countdown-container flex flex-col items-center justify-center gap-0.5 py-2 px-4 text-center">
        <p className="text-subheading text-text-muted uppercase tracking-wider font-medium">
          {phaseLabel(phase, nextPrayer.name)}
        </p>
        <h3 className="text-prayer text-gold font-bold">{nextPrayer.name}</h3>
        <p className="text-heading font-bold text-text-primary">
          Jamaat in progress
        </p>
      </div>
    );
  }

  /* ---- Normal / jamaat countdown display — single label line + countdown (prayer highlighted above) ---- */
  return (
    <div className="countdown-container flex flex-col items-center justify-center gap-0.5 py-2 px-4 text-center">
      <p className="text-body text-text-muted uppercase tracking-wider">
        {countdownLabel}
      </p>
      {liveCountdown && (
        <p className="text-prayer text-gold countdown-stable font-semibold">
          {liveCountdown}
        </p>
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
