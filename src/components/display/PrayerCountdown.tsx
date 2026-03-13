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
  /** When true (landscape), use tighter spacing and smaller label */
  compact?: boolean;
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

const PrayerCountdown: React.FC<PrayerCountdownProps> = ({ phase, compact = false }) => {
  const { nextPrayer, isJumuahToday } = usePrayerTimesContext();
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

  /** When counting to jamaat: "{name} Jamaat in"; otherwise "{name} prayer in". On Friday, show "Jumuah" instead of "Zuhr". */
  const countingToJamaat = isCountingToJamaat(targetTime, nextPrayer?.jamaat);
  const displayName = nextPrayer?.name === 'Zuhr' && isJumuahToday ? 'Jumuah' : (nextPrayer?.name ?? '');
  const countdownLabel = useMemo(
    () =>
      countingToJamaat
        ? (displayName ? `${displayName} Jamaat in` : 'Jamaat in')
        : (displayName ? `${displayName} prayer in` : 'Next prayer in'),
    [countingToJamaat, displayName],
  );

  if (!nextPrayer) {
    return null;
  }

  /* ---- In-prayer: single line "Fajr | Jamaat in progress" ---- */
  if (phase === 'in-prayer') {
    return (
      <div className={`countdown-container flex flex-row items-baseline justify-center text-center ${compact ? 'gap-2' : 'gap-3'}`}>
        <span className={`text-text-muted uppercase font-medium ${compact ? 'text-body tracking-wider' : 'text-subheading tracking-wider'}`}>
          {displayName || nextPrayer.name}
        </span>
        <span className="text-text-muted/50">|</span>
        <span className={`font-bold text-text-primary ${compact ? 'text-body' : 'text-subheading'}`}>
          Jamaat in progress
        </span>
      </div>
    );
  }

  /* ---- Normal / jamaat countdown — label left, countdown right ---- */
  return (
    <div className={`countdown-container flex flex-row items-center justify-between ${compact ? 'gap-3' : 'gap-4'}`}>
      <span className={`text-text-secondary uppercase font-semibold text-left ${compact ? 'text-body tracking-wider' : 'text-subheading tracking-wider'}`}>
        {countdownLabel}
      </span>
      {liveCountdown && (
        <span className="text-countdown text-gold text-right">
          <CountdownDisplay value={liveCountdown} className="text-countdown text-gold" />
        </span>
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
