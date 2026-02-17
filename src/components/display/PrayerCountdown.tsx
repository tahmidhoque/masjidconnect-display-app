/**
 * PrayerCountdown
 *
 * Shows a live countdown to the next prayer.
 * Computes the remaining time every second using useCurrentTime,
 * rather than relying on the static timeUntil from usePrayerTimes.
 * GPU-safe: uses transform/opacity only for animation.
 */

import React, { useMemo } from 'react';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { getTimeUntilNextPrayer } from '../../utils/dateUtils';

const PrayerCountdown: React.FC = () => {
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
    if (!targetTime) return '';
    return getTimeUntilNextPrayer(targetTime.time, targetTime.forceTomorrow);
  }, [targetTime, currentTime]);

  if (!nextPrayer) {
    return null;
  }

  return (
    <div className="card-elevated flex flex-col items-center justify-center gap-2 py-4 text-center">
      <p className="text-caption text-text-muted uppercase tracking-wider">Next Prayer</p>
      <h3 className="text-heading text-emerald-light font-bold">{nextPrayer.name}</h3>

      {liveCountdown && (
        <p className="text-subheading text-gold tabular-nums font-semibold">
          {liveCountdown}
        </p>
      )}

      {nextPrayer.displayTime && (
        <p className="text-caption text-text-secondary tabular-nums">{nextPrayer.displayTime}</p>
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
