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
 *
 * Layout: two equal columns — label is right-aligned in the left half and the
 * numeric countdown (or in-prayer status) is left-aligned in the right half,
 * so the visual centre of the row reads as a clean split (portrait and strip).
 */

import React, { useMemo } from 'react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { getTimeUntilNextPrayer, toMinutesFromMidnight } from '../../utils/dateUtils';
import type { PrayerPhase } from '../../hooks/usePrayerPhase';
import CountdownDisplay from './CountdownDisplay';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings } from '../../store/slices/contentSlice';
import { prayerRowNameToTerminologyKey, resolveTerminology } from '../../utils/prayerTerminology';

interface PrayerCountdownProps {
  /** Current prayer phase — controls labels and in-prayer display */
  phase?: PrayerPhase;
  /** When phase is 'in-prayer': 'jamaat' = first A min, 'post-jamaat' = next B min (portal displaySettings). */
  inPrayerSubPhase?: 'jamaat' | 'post-jamaat';
  /** When "strip", render centred below prayer cards in the landscape prayer strip */
  variant?: 'default' | 'strip';
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

const PrayerCountdown: React.FC<PrayerCountdownProps> = ({
  phase,
  inPrayerSubPhase,
  variant = 'default',
}) => {
  const { nextPrayer, isJumuahToday } = usePrayerTimesContext();
  const currentTime = useCurrentTime();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

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

  const countingToJamaat = isCountingToJamaat(targetTime, nextPrayer?.jamaat);
  const displayName = useMemo(() => {
    if (!nextPrayer?.name) return '';
    if (nextPrayer.name === 'Zuhr' && isJumuahToday) {
      return resolveTerminology(terminology, 'jummah', 'Jumuah');
    }
    const key = prayerRowNameToTerminologyKey(nextPrayer.name);
    return key ? resolveTerminology(terminology, key, nextPrayer.name) : nextPrayer.name;
  }, [nextPrayer?.name, isJumuahToday, terminology]);

  const jamaatLabel = resolveTerminology(terminology, 'jamaat', 'Jamaat');
  const countdownLabel = useMemo(
    () =>
      countingToJamaat
        ? (displayName ? `${displayName} ${jamaatLabel} in` : `${jamaatLabel} in`)
        : (displayName ? `${displayName} prayer in` : 'Next prayer in'),
    [countingToJamaat, displayName, jamaatLabel],
  );

  if (!nextPrayer) {
    return null;
  }

  const isStrip = variant === 'strip';
  /**
   * Split row: vertical midline of the container — label flush right in the left
   * half, digits flush left in the right half (portrait and landscape strip).
   */
  /** `prayer-countdown-row` scopes CSS overrides for `.countdown-stable` (min-width / alignment). */
  const splitGridClass =
    'prayer-countdown-row grid grid-cols-2 w-full max-w-full min-w-0 items-center gap-x-4';
  const outerClass = isStrip
    ? splitGridClass
    : `countdown-container ${splitGridClass}`;

  const labelClass = isStrip
    ? 'text-countdown-strip-label text-text-primary uppercase font-bold tracking-wider text-right min-w-0'
    : 'prayer-countdown-label text-text-secondary uppercase font-semibold text-right min-w-0 tracking-wider';
  const digitsClass = isStrip
    ? 'text-countdown-strip-digits text-gold font-extrabold'
    : 'text-countdown text-gold';

  const inPrayerLabelClass = isStrip
    ? 'text-countdown-strip-label text-text-muted uppercase font-bold text-right min-w-0'
    : 'prayer-countdown-label text-text-muted uppercase font-medium text-right min-w-0 tracking-wider';
  const inPrayerValueClass = isStrip
    ? 'text-countdown-strip-label font-bold text-text-primary text-left min-w-0'
    : 'prayer-countdown-status font-bold text-text-primary text-left min-w-0';

  /* ---- In-prayer: name in left half, status in right half (same midline as countdown) ---- */
  if (phase === 'in-prayer') {
    const statusText =
      inPrayerSubPhase === 'post-jamaat'
        ? 'In progress'
        : `${jamaatLabel} in progress`;
    return (
      <div className={outerClass}>
        <span className={inPrayerLabelClass}>{displayName || nextPrayer.name}</span>
        <span className={inPrayerValueClass}>{statusText}</span>
      </div>
    );
  }

  return (
    <div className={outerClass}>
      <span className={labelClass}>{countdownLabel}</span>
      {liveCountdown ? (
        <span className={`${digitsClass} text-left min-w-0`}>
          <CountdownDisplay value={liveCountdown} className={digitsClass} />
        </span>
      ) : (
        <span className="min-w-0" aria-hidden />
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
