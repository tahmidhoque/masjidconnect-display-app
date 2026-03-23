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
  /** When phase is 'in-prayer': 'jamaat' = 0–10 min (Jamaat in progress), 'post-jamaat' = 10–(10+X) min (In progress) */
  inPrayerSubPhase?: 'jamaat' | 'post-jamaat';
  /** When true (landscape), use tighter spacing and smaller label */
  compact?: boolean;
  /** When "bar", render for landscape countdown bar — no nested box, larger typography */
  /** When "strip", render centred below prayer cards in prayer strip */
  variant?: 'default' | 'bar' | 'strip';
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
  compact = false,
  variant = 'default',
}) => {
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

  /** Default/strip: "{name} Jamaat in" / "{name} prayer in". Bar variant uses `barCountdownSubline` under hero digits. */
  const countingToJamaat = isCountingToJamaat(targetTime, nextPrayer?.jamaat);
  const displayName = nextPrayer?.name === 'Zuhr' && isJumuahToday ? 'Jumuah' : (nextPrayer?.name ?? '');
  const countdownLabel = useMemo(
    () =>
      countingToJamaat
        ? (displayName ? `${displayName} Jamaat in` : 'Jamaat in')
        : (displayName ? `${displayName} prayer in` : 'Next prayer in'),
    [countingToJamaat, displayName],
  );

  /** Landscape bar only: mirrors date line under clock ("till … prayer/jamaat"). */
  const barCountdownSubline = useMemo(
    () =>
      countingToJamaat
        ? (displayName ? `till ${displayName} jamaat` : 'till jamaat')
        : (displayName ? `till ${displayName} prayer` : 'till next prayer'),
    [countingToJamaat, displayName],
  );

  if (!nextPrayer) {
    return null;
  }

  const isBar = variant === 'bar';
  const isStrip = variant === 'strip';
  const containerClass = isStrip
    ? 'flex flex-row items-center justify-center gap-4 w-full'
    : `countdown-container flex flex-row items-center justify-between ${compact ? 'gap-3' : 'gap-4'}`;
  const labelClass = isBar
    ? 'text-countdown-bar-label text-text-primary uppercase font-bold tracking-wider'
    : isStrip
      ? 'text-countdown-strip-label text-text-primary uppercase font-bold tracking-wider'
      : `text-text-secondary uppercase font-semibold text-left ${compact ? 'text-body tracking-wider' : 'text-subheading tracking-wider'}`;
  const digitsClass = isBar
    ? 'text-countdown-bar-digits text-gold font-extrabold'
    : isStrip
      ? 'text-countdown-strip-digits text-gold font-extrabold'
      : 'text-countdown text-gold';

  const inPrayerLabelClass = isStrip
    ? 'text-countdown-strip-label text-text-muted uppercase font-bold'
    : isBar
      ? 'text-countdown-bar-label text-text-muted uppercase font-bold'
      : `text-text-muted uppercase font-medium ${compact ? 'text-body tracking-wider' : 'text-subheading tracking-wider'}`;
  const inPrayerValueClass = isStrip || isBar
    ? `${isStrip ? 'text-countdown-strip-label' : 'text-countdown-bar-label'} font-bold text-text-primary`
    : `font-bold text-text-primary ${compact ? 'text-body' : 'text-subheading'}`;

  /* ---- In-prayer: single line "Fajr | Jamaat in progress" or "Fajr | In progress" ---- */
  if (phase === 'in-prayer') {
    const statusText = inPrayerSubPhase === 'post-jamaat' ? 'In progress' : 'Jamaat in progress';
    const row = (
      <>
        <span className={inPrayerLabelClass}>{displayName || nextPrayer.name}</span>
        <span className="text-text-muted/50">|</span>
        <span className={inPrayerValueClass}>{statusText}</span>
      </>
    );
    if (isBar) {
      return (
        <div className="contents">
          <div className="landscape-broadcast-countdown landscape-broadcast-countdown--status-row ms-auto flex h-full min-w-0 flex-row flex-wrap items-center justify-end gap-x-3 gap-y-0 text-right">
            {row}
          </div>
        </div>
      );
    }
    return (
      <div className={isStrip ? 'flex flex-row items-baseline justify-center gap-4 w-full' : `countdown-container flex flex-row items-baseline justify-center text-center ${compact ? 'gap-2' : 'gap-3'}`}>
        {row}
      </div>
    );
  }

  /* ---- Normal / jamaat — bar: hero digits on top (like clock), subline below (like dates) ---- */
  if (isBar) {
    return (
      <div className="contents">
        <div
          className={`
            landscape-broadcast-countdown flex flex-col items-stretch justify-center gap-0.5
            ms-auto min-w-0 h-full w-max max-w-full
          `}
        >
          {liveCountdown ? (
            <div className={`${digitsClass} tabular-nums leading-none shrink-0 min-w-0 text-right`}>
              <CountdownDisplay value={liveCountdown} className={digitsClass} />
            </div>
          ) : null}
          <p
            className={`
              landscape-broadcast-countdown-subline text-landscape-broadcast-header-dates
              text-text-secondary min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-right
            `}
            title={barCountdownSubline}
          >
            {barCountdownSubline}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <span className={labelClass}>
        {countdownLabel}
      </span>
      {liveCountdown && (
        <span className={`${digitsClass} ${isStrip ? '' : 'text-right'}`}>
          <CountdownDisplay value={liveCountdown} className={digitsClass} />
        </span>
      )}
    </div>
  );
};

export default React.memo(PrayerCountdown);
