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
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { getTimeUntilNextPrayer, toMinutesFromMidnight } from '../../utils/dateUtils';
import type { PrayerPhase } from '../../hooks/usePrayerPhase';
import CountdownDisplay from './CountdownDisplay';

interface PrayerCountdownProps {
  /** Current prayer phase — controls labels and in-prayer display */
  phase?: PrayerPhase;
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

const PrayerCountdown: React.FC<PrayerCountdownProps> = ({ phase }) => {
  const { nextPrayer } = usePrayerTimesContext();
  const currentTime = useCurrentTime();

  /**
   * Determine the target time string (HH:mm) to count down to.
   * If the next prayer's adhan has passed but jamaat hasn't, count to jamaat.
   * Otherwise count to adhan.
   */
  const targetTime = useMemo(() => {
    if (!nextPrayer) return null;

    const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60;
    const adhanMin = toMinutesFromMidnight(nextPrayer.time, nextPrayer.name);
    const jamaatMin = toMinutesFromMidnight(nextPrayer.jamaat, nextPrayer.name);

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

  /* ---- In-prayer: single line "Fajr | Jamaat in progress" ---- */
  if (phase === 'in-prayer') {
    return (
      <div className="countdown-container flex flex-row items-baseline justify-center gap-2 py-1.5 px-4 text-center">
        <span className="text-body text-text-muted uppercase tracking-wider font-medium">
          {nextPrayer.name}
        </span>
        <span className="text-text-muted/50">|</span>
        <span className="text-body font-bold text-text-primary">
          Jamaat in progress
        </span>
      </div>
    );
  }

  /* ---- Normal / jamaat countdown — single line "Fajr prayer in | 5h 19m 20s" ---- */
  return (
    <div className="countdown-container flex flex-row items-baseline justify-center gap-2 py-1.5 px-4 text-center">
      <span className="text-body text-text-muted uppercase tracking-wider font-medium">
        {countdownLabel}
      </span>
      {liveCountdown && (
        <>
          <span className="text-text-muted/50">|</span>
          <span className="text-countdown text-gold font-bold">
            <CountdownDisplay value={liveCountdown} className="text-countdown text-gold font-bold" />
          </span>
        </>
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
