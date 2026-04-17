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
import useMasjidTime from '../../hooks/useMasjidTime';
import { getTimeUntilNextPrayer, toMinutesFromMidnight } from '../../utils/dateUtils';
import type { PrayerPhase } from '../../hooks/usePrayerPhase';
import CountdownDisplay from './CountdownDisplay';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings, selectMasjidTimezone } from '../../store/slices/contentSlice';
import { prayerRowNameToTerminologyKey, resolveTerminology } from '../../utils/prayerTerminology';
import { defaultMasjidTimezone } from '../../config/environment';

interface PrayerCountdownProps {
  /** Current prayer phase — controls labels and in-prayer display */
  phase?: PrayerPhase;
  /** When phase is 'in-prayer': 'jamaat' = first A min, 'post-jamaat' = next B min (portal displaySettings). */
  inPrayerSubPhase?: 'jamaat' | 'post-jamaat';
  /** When "strip", render centred below prayer cards in the landscape prayer strip */
  variant?: 'default' | 'strip';
}

/**
 * Minutes BEFORE jamaat that we flip to the "Jamaat in" countdown label.
 * Mirrors `JAMAAT_LEAD_MIN` in `usePrayerPhase` so the countdown label and
 * silent-phones screen always swap together (also covers A == J and A within
 * the lead window — the previous heuristic missed those cases).
 */
const JAMAAT_LEAD_MIN = 5;

type CountdownTarget = {
  time: string;
  forceTomorrow: boolean;
  /** Whether the target time is the prayer's jamaat (vs adhan). */
  target: 'jamaat' | 'adhan';
};

const PrayerCountdown: React.FC<PrayerCountdownProps> = ({
  phase,
  inPrayerSubPhase,
  variant = 'default',
}) => {
  const { nextPrayer, isJumuahToday } = usePrayerTimesContext();
  // Use masjid-local time so comparisons against prayer strings are correct
  // when the Pi's system timezone is UTC.
  const now = useMasjidTime();
  const masjidTz = useAppSelector(selectMasjidTimezone) || defaultMasjidTimezone;
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  /**
   * Determine what to count down to. Mirrors the `usePrayerPhase` rule so the
   * countdown label and the silent-phones screen always agree.
   *
   *   - Before adhan, outside the lead window → count down to ADHAN
   *   - Inside the lead window (`now >= J − JAMAAT_LEAD_MIN`) → count down to
   *     JAMAAT, even when adhan hasn't fired yet (handles A == J and
   *     A within JAMAAT_LEAD_MIN of J)
   *   - Adhan passed, before jamaat → count down to JAMAAT
   *   - At/past jamaat → null (DisplayScreen swaps to in-prayer phase)
   *   - Adhan passed, no jamaat in payload → tomorrow's adhan (covers the
   *     after-Isha → tomorrow's Fajr branch in usePrayerTimes)
   */
  const targetTime = useMemo<CountdownTarget | null>(() => {
    if (!nextPrayer) return null;

    const nowMin = now.hour() * 60 + now.minute() + now.second() / 60;
    const A = toMinutesFromMidnight(nextPrayer.time, nextPrayer.name);
    const J = toMinutesFromMidnight(nextPrayer.jamaat, nextPrayer.name);

    if (A < 0 && J < 0) return null;

    // Before adhan today
    if (A >= 0 && nowMin < A) {
      // Lead window flip (only fires when A >= J − JAMAAT_LEAD_MIN, i.e. when
      // adhan and jamaat are within the lead window or equal)
      if (J >= 0 && nowMin >= J - JAMAAT_LEAD_MIN) {
        return { time: nextPrayer.jamaat!, forceTomorrow: false, target: 'jamaat' };
      }
      return { time: nextPrayer.time, forceTomorrow: false, target: 'adhan' };
    }

    // Adhan passed (or missing) but jamaat still upcoming today
    if (J >= 0 && nowMin < J) {
      return { time: nextPrayer.jamaat!, forceTomorrow: false, target: 'jamaat' };
    }

    // At/past jamaat — let DisplayScreen show in-prayer screen.
    if (J >= 0 && nowMin >= J) {
      return null;
    }

    // No jamaat in payload, adhan already passed → tomorrow's adhan.
    if (A >= 0) {
      return { time: nextPrayer.time, forceTomorrow: true, target: 'adhan' };
    }

    return null;
  }, [nextPrayer, now]);

  /**
   * Live countdown string, recomputed every second via now (masjid tz).
   * `now` is intentionally listed as a dependency even though it is not referenced
   * in the function body — it acts as a 1-second tick trigger so the string refreshes.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveCountdown = useMemo(() => {
    if (!targetTime) return nextPrayer ? '0s' : '';
    return getTimeUntilNextPrayer(targetTime.time, targetTime.forceTomorrow, {}, masjidTz);
  }, [targetTime, now, nextPrayer, masjidTz]);

  const countingToJamaat = targetTime?.target === 'jamaat';
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
    // post-jamaat: jamaat has finished — show "[prayerName] prayer" static (no countdown, no in-progress)
    // jamaat: show "Jamaat in progress"
    const statusText =
      inPrayerSubPhase === 'post-jamaat'
        ? 'prayer'
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
