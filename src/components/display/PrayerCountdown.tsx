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
import { getEffectiveJamaat } from '../../utils/jumuahJamaat';
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
  const { nextPrayer, isJumuahToday, jumuahTime } = usePrayerTimesContext();
  // Use masjid-local time so comparisons against prayer strings are correct
  // when the Pi's system timezone is UTC.
  const now = useMasjidTime();
  const masjidTz = useAppSelector(selectMasjidTimezone) || defaultMasjidTimezone;
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  /**
   * On Fridays, the countdown must target `jummahJamaat` even though
   * `nextPrayer` is still the Zuhr slot (the panel keeps the Zuhr row anchored
   * to its own jamaat — `JumuahBar` displays the Friday time separately).
   * `getEffectiveJamaat` is the single source of truth for that swap.
   */
  const effectiveJamaat = getEffectiveJamaat(nextPrayer, isJumuahToday, jumuahTime);

  /**
   * Determine what to count down to. Mirrors the `usePrayerPhase` rule so the
   * countdown label and the silent-phones screen always agree.
   *
   *   - Before adhan, outside the lead window → count down to ADHAN
   *   - Inside the lead window (`now >= J − JAMAAT_LEAD_MIN`) → count down to
   *     JAMAAT, even when adhan hasn't fired yet (handles A == J and
   *     A within JAMAAT_LEAD_MIN of J)
   *   - Adhan passed, before jamaat → count down to JAMAAT
   *   - At/past jamaat AND phase === 'in-prayer' → null (the in-prayer render
   *     branch above takes over and shows "Jamaat in progress")
   *   - At/past jamaat AND phase !== 'in-prayer' → tomorrow's adhan. This
   *     covers the after-Isha → tomorrow's Fajr branch in `usePrayerTimes`,
   *     which swaps `nextPrayer` to tomorrow's record but keeps the time as
   *     an HH:mm string (e.g. "05:00") that compares as "in the past" to
   *     today's wall-clock minute count. Without this branch the countdown
   *     would freeze at "0s" between the end of the in-prayer window and
   *     midnight.
   *   - Adhan passed, no jamaat in payload → tomorrow's adhan (legacy
   *     fallback; the after-Isha case above handles the common path).
   */
  const targetTime = useMemo<CountdownTarget | null>(() => {
    if (!nextPrayer) return null;

    const nowMin = now.hour() * 60 + now.minute() + now.second() / 60;
    const A = toMinutesFromMidnight(nextPrayer.time, nextPrayer.name);
    const J = toMinutesFromMidnight(effectiveJamaat, nextPrayer.name);

    if (A < 0 && J < 0) return null;

    // Before adhan today
    if (A >= 0 && nowMin < A) {
      // Lead window flip (only fires when A >= J − JAMAAT_LEAD_MIN, i.e. when
      // adhan and jamaat are within the lead window or equal)
      if (J >= 0 && nowMin >= J - JAMAAT_LEAD_MIN) {
        return { time: effectiveJamaat!, forceTomorrow: false, target: 'jamaat' };
      }
      return { time: nextPrayer.time, forceTomorrow: false, target: 'adhan' };
    }

    // Adhan passed (or missing) but jamaat still upcoming today
    if (J >= 0 && nowMin < J) {
      return { time: effectiveJamaat!, forceTomorrow: false, target: 'jamaat' };
    }

    // At/past jamaat. Two possibilities:
    //   (a) Active in-prayer window — DisplayScreen passes phase='in-prayer'
    //       and the early-return branch above renders "Jamaat in progress".
    //       Returning null avoids a transient stale countdown during the tick
    //       between jamaat ringing and the phase machine catching up.
    //   (b) After-Isha → tomorrow's Fajr (or any wrap-around). The hook has
    //       already swapped `nextPrayer` to the next-day record but the time
    //       strings are still HH:mm form, so they read as "in the past"
    //       relative to today's `nowMin`. Count down to tomorrow's adhan.
    if (J >= 0 && nowMin >= J) {
      if (phase === 'in-prayer') return null;
      if (A >= 0) {
        return { time: nextPrayer.time, forceTomorrow: true, target: 'adhan' };
      }
      return null;
    }

    // No jamaat in payload, adhan already passed → tomorrow's adhan.
    if (A >= 0) {
      return { time: nextPrayer.time, forceTomorrow: true, target: 'adhan' };
    }

    return null;
  }, [nextPrayer, now, effectiveJamaat, phase]);

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
   * Strip layout: 2-col grid with label flush right and digits flush left, meeting at the centre.
   * Portrait layout: inline flex centred as one text block — label and digits share a baseline
   *   so they read as a single phrase ("Maghrib Jamaat in 12m 34s"). Width-stability is provided
   *   by `.countdown-stable` (min-width: 12ch, text-align: center) so the centred group does not
   *   jitter as the digits tick.
   */
  /** `prayer-countdown-row` scopes CSS overrides for `.countdown-stable` (min-width / alignment) on the strip. */
  const splitGridClass =
    'prayer-countdown-row grid grid-cols-2 w-full max-w-full min-w-0 items-center gap-x-4';
  const portraitRowClass =
    'prayer-countdown-portrait flex w-full max-w-full min-w-0 items-center justify-center flex-nowrap gap-x-3 whitespace-nowrap';
  const outerClass = isStrip
    ? splitGridClass
    : `countdown-container ${portraitRowClass}`;

  const labelClass = isStrip
    ? 'text-countdown-strip-label text-text-primary uppercase font-bold tracking-wider text-right min-w-0'
    : 'prayer-countdown-label text-text-secondary uppercase font-semibold tracking-wider';
  const digitsClass = isStrip
    ? 'text-countdown-strip-digits text-gold font-extrabold'
    : 'text-countdown text-gold';

  const inPrayerLabelClass = isStrip
    ? 'text-countdown-strip-label text-text-muted uppercase font-bold text-right min-w-0'
    : 'prayer-countdown-label text-text-muted uppercase font-medium tracking-wider';
  const inPrayerValueClass = isStrip
    ? 'text-countdown-strip-label font-bold text-text-primary text-left min-w-0'
    : 'prayer-countdown-status font-bold text-text-primary';

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
        <span className={`${digitsClass} ${isStrip ? 'text-left min-w-0' : ''}`}>
          <CountdownDisplay value={liveCountdown} className={digitsClass} />
        </span>
      ) : (
        <span className={isStrip ? 'min-w-0' : ''} aria-hidden />
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
