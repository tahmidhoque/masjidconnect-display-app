/**
 * PrayerCountdown
 *
 * Shows a live countdown to the next prayer or jamaat, with phase-aware
 * labels. During the jamaat (congregation) sub-phase, displays a calm
 * "Jamaat in progress" message instead of the countdown digits. Once that
 * window ends (post-supplication / minutesAfterJamaat), counts down to the
 * next salah — not a static "{finished prayer} prayer" label. Adhan-target
 * wording is "Fajr Adhan in" / "Fajr starts in" (terminology), never
 * "Fajr prayer in".
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
import { resolveCountdownStartPhrase, resolvePrayerDisplayName, resolveTerminology } from '../../utils/prayerTerminology';
import { getEffectiveJamaat } from '../../utils/jumuahJamaat';
import { defaultMasjidTimezone } from '../../config/environment';
import { preJamaatLeadMinutes } from '../../utils/displaySettingsJamaat';

interface PrayerCountdownProps {
  /** Current prayer phase — controls labels and in-prayer display */
  phase?: PrayerPhase;
  /** When phase is 'in-prayer': 'jamaat' = first A min, 'post-jamaat' = next B min (portal displaySettings). */
  inPrayerSubPhase?: 'jamaat' | 'post-jamaat-supplication' | 'post-jamaat';
  /** Strip = horizontal split row; sidebar = stacked label + digits for narrow columns */
  variant?: 'default' | 'strip' | 'sidebar';
}

/**
 * Sunrise is on the timetable but is never a countdown target.
 */
const COUNTDOWN_SKIP_PRAYERS = new Set(['Sunrise', 'Shuruq']);

type SalahRow = {
  name: string;
  time: string;
  jamaat?: string;
};

type CountdownTarget = {
  time: string;
  forceTomorrow: boolean;
  /** Whether the target time is the prayer's jamaat (vs adhan). */
  target: 'jamaat' | 'adhan';
};

function isPostSalahCountdown(
  phase?: PrayerPhase,
  inPrayerSubPhase?: PrayerCountdownProps['inPrayerSubPhase'],
): boolean {
  return (
    phase === 'in-prayer' &&
    (inPrayerSubPhase === 'post-jamaat' || inPrayerSubPhase === 'post-jamaat-supplication')
  );
}

/**
 * Next salah after the prayer that just finished. Wraps Isha → Fajr.
 */
function nextSalahAfter(
  prayers: SalahRow[] | undefined,
  finishedName: string | undefined,
): SalahRow | null {
  if (!prayers?.length) return null;
  const sequence = prayers.filter((p) => !COUNTDOWN_SKIP_PRAYERS.has(p.name));
  if (sequence.length === 0) return null;
  if (!finishedName) return sequence[0] ?? null;
  const idx = sequence.findIndex((p) => p.name === finishedName);
  if (idx < 0) return sequence[0] ?? null;
  return sequence[(idx + 1) % sequence.length] ?? null;
}

const PrayerCountdown: React.FC<PrayerCountdownProps> = ({
  phase,
  inPrayerSubPhase,
  variant = 'default',
}) => {
  const { nextPrayer, currentPrayer, todaysPrayerTimes, isJumuahToday, jumuahTime } =
    usePrayerTimesContext();
  // Use masjid-local time so comparisons against prayer strings are correct
  // when the Pi's system timezone is UTC.
  const now = useMasjidTime();
  const masjidTz = useAppSelector(selectMasjidTimezone) || defaultMasjidTimezone;
  const displaySettings = useAppSelector(selectDisplaySettings);
  const terminology = displaySettings?.terminology;
  const jamaatLeadMin = preJamaatLeadMinutes(displaySettings);
  const postSalahCountdown = isPostSalahCountdown(phase, inPrayerSubPhase);
  const adhanLabel = resolveTerminology(terminology, 'adhan', 'Start');

  /**
   * After jamaat ends, `nextPrayer` is still the finished salah for the rest
   * of the in-prayer window (strip highlight). Countdown must look ahead.
   */
  const countdownPrayer = useMemo(() => {
    if (!postSalahCountdown) return nextPrayer;
    return (
      nextSalahAfter(todaysPrayerTimes, currentPrayer?.name ?? nextPrayer?.name) ?? nextPrayer
    );
  }, [postSalahCountdown, todaysPrayerTimes, currentPrayer?.name, nextPrayer]);

  /**
   * On Fridays, the countdown must target `jummahJamaat` even though
   * `nextPrayer` is still the Zuhr slot (the panel keeps the Zuhr row anchored
   * to its own jamaat — `JumuahBar` displays the Friday time separately).
   * `getEffectiveJamaat` is the single source of truth for that swap.
   */
  const effectiveJamaat = getEffectiveJamaat(countdownPrayer, isJumuahToday, jumuahTime);

  /**
   * Determine what to count down to. Mirrors the `usePrayerPhase` rule so the
   * countdown label and the silent-phones screen always agree.
   *
   *   - Before adhan, outside the lead window → count down to ADHAN
   *   - Inside the lead window (`now >= J − leadMinutes`) → count down to
   *     JAMAAT, even when adhan hasn't fired yet (handles A == J and
   *     A within the lead window of J)
   *   - Adhan passed, before jamaat → count down to JAMAAT
   *   - At/past jamaat AND phase === 'in-prayer' (jamaat sub-phase) → null
   *     (the in-prayer render branch shows "Jamaat in progress")
   *   - At/past jamaat AND post-salah (post-jamaat / post-supplication) →
   *     countdownPrayer is already the next salah; fall through to its adhan
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
    if (!countdownPrayer) return null;

    const nowMin = now.hour() * 60 + now.minute() + now.second() / 60;
    const A = toMinutesFromMidnight(countdownPrayer.time, countdownPrayer.name);
    const J = toMinutesFromMidnight(effectiveJamaat, countdownPrayer.name);

    if (A < 0 && J < 0) return null;

    // Before adhan today
    if (A >= 0 && nowMin < A) {
      // Lead window flip (only fires when A >= J − lead, i.e. when
      // adhan and jamaat are within the lead window or equal)
      if (jamaatLeadMin > 0 && J >= 0 && nowMin >= J - jamaatLeadMin) {
        return { time: effectiveJamaat!, forceTomorrow: false, target: 'jamaat' };
      }
      return { time: countdownPrayer.time, forceTomorrow: false, target: 'adhan' };
    }

    // Adhan passed (or missing) but jamaat still upcoming today
    if (J >= 0 && nowMin < J) {
      return { time: effectiveJamaat!, forceTomorrow: false, target: 'jamaat' };
    }

    // At/past jamaat. Two possibilities:
    //   (a) Active jamaat congregation — DisplayScreen passes phase='in-prayer'
    //       and the early-return branch renders "Jamaat in progress".
    //       Returning null avoids a transient stale countdown during the tick
    //       between jamaat ringing and the phase machine catching up.
    //   (b) After-Isha → tomorrow's Fajr (or any wrap-around), including the
    //       post-salah window where countdownPrayer is already tomorrow's Fajr
    //       but the HH:mm string reads as "in the past" vs today's nowMin.
    if (J >= 0 && nowMin >= J) {
      if (phase === 'in-prayer' && !postSalahCountdown) return null;
      if (A >= 0) {
        return { time: countdownPrayer.time, forceTomorrow: true, target: 'adhan' };
      }
      return null;
    }

    // No jamaat in payload, adhan already passed → tomorrow's adhan.
    if (A >= 0) {
      return { time: countdownPrayer.time, forceTomorrow: true, target: 'adhan' };
    }

    return null;
  }, [countdownPrayer, now, effectiveJamaat, phase, postSalahCountdown, jamaatLeadMin]);

  /**
   * Live countdown string. `targetTime` already depends on `now`, so this
   * recomputes every second without listing `now` again.
   */
  const liveCountdown = useMemo(() => {
    if (!targetTime) return countdownPrayer ? '0s' : '';
    return getTimeUntilNextPrayer(targetTime.time, targetTime.forceTomorrow, {}, masjidTz);
  }, [targetTime, countdownPrayer, masjidTz]);

  const countingToJamaat = targetTime?.target === 'jamaat';
  const displayName = useMemo(
    () => resolvePrayerDisplayName(countdownPrayer?.name, terminology, { isJumuahToday }) ?? '',
    [countdownPrayer?.name, isJumuahToday, terminology],
  );

  const jamaatLabel = resolveTerminology(terminology, 'jamaat', 'Jamaat');
  const countdownLabel = useMemo(
    () =>
      countingToJamaat
        ? (displayName ? `${displayName} ${jamaatLabel} in` : `${jamaatLabel} in`)
        : resolveCountdownStartPhrase(displayName, adhanLabel),
    [countingToJamaat, displayName, jamaatLabel, adhanLabel],
  );

  if (!countdownPrayer) {
    return null;
  }

  const isStrip = variant === 'strip';
  const isSidebar = variant === 'sidebar';
  /**
   * Strip: 2-col grid — label right, digits left at the centre split.
   * Sidebar: stacked centred block for narrow columns (scoped type in `.prayer-sidebar-countdown`).
   * Portrait/default: inline flex centred as one phrase.
   */
  const splitGridClass =
    'prayer-countdown-row grid grid-cols-2 w-full max-w-full min-w-0 items-center gap-x-4';
  const sidebarStackClass =
    'prayer-countdown-sidebar flex flex-col items-center justify-center w-full max-w-full min-w-0 text-center gap-0.5';
  const portraitRowClass =
    'prayer-countdown-portrait flex w-full max-w-full min-w-0 items-center justify-center flex-nowrap gap-x-3 whitespace-nowrap';
  const outerClass = isSidebar
    ? sidebarStackClass
    : isStrip
      ? splitGridClass
      : `countdown-container ${portraitRowClass}`;

  const labelClass = isSidebar
    ? 'text-countdown-strip-label text-text-primary uppercase font-bold tracking-wider'
    : isStrip
      ? 'text-countdown-strip-label text-text-primary uppercase font-bold tracking-wider text-right min-w-0'
      : 'prayer-countdown-label text-text-secondary uppercase font-semibold tracking-wider';
  const digitsClass = isSidebar || isStrip
    ? 'text-countdown-strip-digits text-gold font-extrabold'
    : 'text-countdown text-gold';

  const inPrayerLabelClass = isSidebar
    ? 'text-countdown-strip-label text-text-muted uppercase font-bold'
    : isStrip
      ? 'text-countdown-strip-label text-text-muted uppercase font-bold text-right min-w-0'
      : 'prayer-countdown-label text-text-muted uppercase font-medium tracking-wider';
  const inPrayerValueClass = isSidebar
    ? 'text-countdown-strip-label font-bold text-text-primary'
    : isStrip
      ? 'text-countdown-strip-label font-bold text-text-primary text-left min-w-0'
      : 'prayer-countdown-status font-bold text-text-primary';

  /* ---- Jamaat congregation: name in left half, status in right half ---- */
  if (phase === 'in-prayer' && !postSalahCountdown) {
    return (
      <div className={outerClass}>
        <span className={inPrayerLabelClass}>{displayName || countdownPrayer.name}</span>
        <span className={inPrayerValueClass}>{`${jamaatLabel} in progress`}</span>
      </div>
    );
  }

  return (
    <div className={outerClass}>
      <span className={labelClass}>{countdownLabel}</span>
      {liveCountdown ? (
        <span className={`${digitsClass} ${isStrip ? 'text-left min-w-0' : ''} ${isSidebar ? 'leading-none' : ''}`}>
          <CountdownDisplay value={liveCountdown} className={digitsClass} />
        </span>
      ) : (
        <span className={isStrip ? 'min-w-0' : ''} aria-hidden />
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
