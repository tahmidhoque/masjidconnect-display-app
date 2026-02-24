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
 * For countdown-jamaat, includes the prayer name e.g. "Zuhr Jamaat in".
 */
function phaseLabel(phase: PrayerPhase | undefined, prayerName: string | null | undefined): string {
  switch (phase) {
    case 'countdown-jamaat':
      return prayerName ? `${prayerName} Jamaat in` : 'Jamaat in';
    case 'jamaat-soon':
      return 'Jamaat starts in';
    case 'in-prayer':
      return 'In Progress';
    case 'countdown-adhan':
    default:
      return 'Next Prayer';
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

    const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

    // Between adhan and jamaat — count down to jamaat
    if (
      nextPrayer.jamaat &&
      nextPrayer.time <= nowHHmm &&
      nextPrayer.jamaat > nowHHmm
    ) {
      return { time: nextPrayer.jamaat, forceTomorrow: false };
    }

    // Past this prayer's jamaat — don't count down to tomorrow's jamaat (avoids "loop").
    // Show 0s until nextPrayer updates to the next salaat.
    if (
      nextPrayer.jamaat &&
      nextPrayer.time <= nowHHmm &&
      nowHHmm >= nextPrayer.jamaat
    ) {
      return null;
    }

    // If adhan has passed today (and jamaat too, or no jamaat), this is tomorrow's prayer
    if (nextPrayer.time <= nowHHmm) {
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

  /** When counting to jamaat, label and bottom time must reflect jamaat, not adhan. */
  const countingToJamaat = isCountingToJamaat(targetTime, nextPrayer?.jamaat);
  const countdownLabel = useMemo(() => {
    if (countingToJamaat) {
      return phase === 'jamaat-soon' ? 'Jamaat starts in' : 'Jamaat in';
    }
    return phaseLabel(phase, nextPrayer?.name);
  }, [countingToJamaat, phase, nextPrayer?.name]);
  const bottomTimeLabel = countingToJamaat
    ? nextPrayer?.displayJamaat
    : nextPrayer?.displayTime;

  if (!nextPrayer) {
    return null;
  }

  /* ---- In-prayer: calm static display, no ticking countdown ---- */
  if (phase === 'in-prayer') {
    return (
      <div className="card-elevated flex flex-col items-center justify-center gap-2 py-4 text-center">
        <p className="text-caption text-text-muted uppercase tracking-wider">
          {phaseLabel(phase, nextPrayer.name)}
        </p>
        <h3 className="text-heading text-gold font-bold">{nextPrayer.name}</h3>
        <p className="text-body text-text-muted">
          Jamaat in progress
        </p>
      </div>
    );
  }

  /* ---- Normal / jamaat countdown display ---- */
  return (
    <div className="card-elevated flex flex-col items-center justify-center gap-2 py-4 text-center">
      <p className="text-caption text-text-muted uppercase tracking-wider">
        {countdownLabel}
      </p>
      <h3 className="text-heading text-emerald-light font-bold">{nextPrayer.name}</h3>

      {liveCountdown && (
        <p className="text-subheading text-gold countdown-stable font-semibold">
          {liveCountdown}
        </p>
      )}

      {bottomTimeLabel && (
        <p className="text-caption text-text-secondary countdown-stable">{bottomTimeLabel}</p>
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
