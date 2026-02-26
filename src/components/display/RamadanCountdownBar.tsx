/**
 * RamadanCountdownBar
 *
 * Unified countdown card for Ramadan mode. Replaces the separate
 * IftarCountdown + PrayerCountdown with a single two-column layout:
 *
 *   ┌─────────────────────┬──────────────────────┐
 *   │  SUHOOR ENDS IN     │  NEXT PRAYER          │
 *   │  5h 19m 20s         │  Fajr                 │
 *   │  Fajr · 05:23       │  5h 19m 20s           │
 *   │                     │  05:23                 │
 *   └─────────────────────┴──────────────────────┘
 *
 * Intelligently adapts to the current state:
 *  - Fasting hours: Left = "Iftar in" countdown, Right = Next Prayer
 *  - Pre-Fajr:     Merges into one display when both count to Fajr,
 *                   or shows two columns if next prayer differs
 *  - Post-Iftar:   Left = "Suhoor ends at" (static), Right = Next Prayer
 *
 * Accepts a `compact` prop for portrait orientation (tighter spacing).
 *
 * GPU-safe: no backdrop-filter, no heavy box-shadow animations.
 * Reuses useCurrentTime (already ticking every second) — no new intervals.
 */

import React, { useMemo } from 'react';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { getTimeUntilNextPrayer, formatTimeToDisplay } from '../../utils/dateUtils';
import { useSelector } from 'react-redux';
import CountdownDisplay from './CountdownDisplay';
import { selectTimeFormat } from '../../store/slices/contentSlice';

interface RamadanCountdownBarProps {
  /** Maghrib adhan time in HH:mm format */
  iftarTime: string | null;
  /** Fajr adhan time in HH:mm format (used for display when imsakTime not provided) */
  suhoorEndTime: string | null;
  /** Imsak time in HH:mm (suhoor ends); when provided, post-Iftar countdown targets this instead of Fajr */
  imsakTime?: string | null;
  /** Whether we are currently in fasting hours (Fajr → Maghrib) */
  isFastingHours: boolean;
  /** Compact layout for portrait orientation */
  compact?: boolean;
}

const RamadanCountdownBar: React.FC<RamadanCountdownBarProps> = ({
  iftarTime,
  suhoorEndTime,
  imsakTime: imsakTimeProp = null,
  isFastingHours,
  compact = false,
}) => {
  const currentTime = useCurrentTime();
  const timeFormat = useSelector(selectTimeFormat);
  const { nextPrayer } = usePrayerTimes();

  /* ---- Post-Iftar: count down to Imsak (suhoor ends) when available, else Fajr ---- */
  const suhoorCountdownTarget = imsakTimeProp ?? suhoorEndTime;

  /* ---- Formatted display times ---- */
  const displayIftarTime = useMemo(
    () => (iftarTime ? formatTimeToDisplay(iftarTime, timeFormat) : null),
    [iftarTime, timeFormat],
  );
  const displaySuhoorTime = useMemo(
    () => (suhoorEndTime ? formatTimeToDisplay(suhoorEndTime, timeFormat) : null),
    [suhoorEndTime, timeFormat],
  );
  const displayImsakTime = useMemo(
    () => (suhoorCountdownTarget ? formatTimeToDisplay(suhoorCountdownTarget, timeFormat) : null),
    [suhoorCountdownTarget, timeFormat],
  );

  /* ---- Live Ramadan countdown ---- */
  const ramadanCountdown = useMemo(() => {
    if (isFastingHours && iftarTime) {
      return getTimeUntilNextPrayer(iftarTime, false);
    }
    if (!isFastingHours && suhoorCountdownTarget) {
      const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
      if (nowHHmm < suhoorCountdownTarget) {
        return getTimeUntilNextPrayer(suhoorCountdownTarget, false);
      }
    }
    return null;
  }, [isFastingHours, iftarTime, suhoorCountdownTarget, currentTime]);

  /* ---- Next prayer countdown ---- */
  const nextPrayerTarget = useMemo(() => {
    if (!nextPrayer) return null;
    const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

    if (nextPrayer.jamaat && nextPrayer.time <= nowHHmm && nextPrayer.jamaat > nowHHmm) {
      return { time: nextPrayer.jamaat, forceTomorrow: false };
    }
    if (nextPrayer.time <= nowHHmm) {
      return { time: nextPrayer.time, forceTomorrow: true };
    }
    return { time: nextPrayer.time, forceTomorrow: false };
  }, [nextPrayer, currentTime]);

  /** Prayer-side countdown: matches main countdown — seconds when under 1 hour. */
  const nextPrayerCountdown = useMemo(() => {
    if (!nextPrayerTarget) return '';
    return getTimeUntilNextPrayer(nextPrayerTarget.time, nextPrayerTarget.forceTomorrow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPrayerTarget, currentTime]);

  /** When counting to jamaat (between adhan and jamaat), show jamaat label and time. */
  const countingToJamaat = Boolean(
    nextPrayerTarget &&
      nextPrayer?.jamaat &&
      nextPrayerTarget.time === nextPrayer.jamaat,
  );
  const nextPrayerColumnLabel = nextPrayer
    ? (countingToJamaat ? `${nextPrayer.name} Jamaat in` : `${nextPrayer.name} prayer in`)
    : '';

  /* ---- Determine Ramadan column label and prayer name ---- */
  const ramadanLabel = isFastingHours ? 'Iftar in' : 'Suhoor ends in';
  const ramadanPrayerName = isFastingHours ? 'Maghrib' : (imsakTimeProp ? 'Imsak' : 'Fajr');
  const ramadanDisplayTime = isFastingHours ? displayIftarTime : (imsakTimeProp ? displayImsakTime : displaySuhoorTime);

  /* ---- Check if both columns would count to the same prayer ---- */
  const isMerged = useMemo(() => {
    if (!nextPrayer || !ramadanCountdown) return false;
    if (isFastingHours && nextPrayer.name === 'Maghrib') return true;
    if (!isFastingHours && nextPrayer.name === 'Fajr') return true;
    return false;
  }, [nextPrayer, ramadanCountdown, isFastingHours]);

  /* ---- No data guard ---- */
  if (!nextPrayer) return null;

  /* ================================================================
     MERGED VIEW — both Ramadan + Next Prayer point to the same prayer.
     Show a single centred display with both labels.
     ================================================================ */
  if (isMerged && ramadanCountdown) {
    return (
      <div
        className={`
          countdown-container iftar-countdown-card gpu-accelerated shrink-0
          flex flex-col items-center justify-center text-center
          ${compact ? 'gap-1 py-3' : 'gap-0.5 py-2'}
          ${compact ? 'px-3' : 'px-4'}
        `}
      >
        {/* Dual label: Ramadan countdown | "{prayerName} prayer in" or "Jamaat in" */}
        <div className="flex items-center gap-3">
          <span className="text-body text-gold/70 uppercase tracking-wider font-medium">
            {ramadanLabel}
          </span>
          <span className="text-text-muted/30">|</span>
          <span className="text-body text-text-muted uppercase tracking-wider font-medium">
            {nextPrayerColumnLabel}
          </span>
        </div>

        {/* Countdown — use prayer-side countdown so last-5-mins seconds apply */}
        <p className="text-prayer text-gold font-bold">
          <CountdownDisplay
            value={nextPrayerCountdown || ramadanCountdown}
            className="text-prayer text-gold font-bold"
          />
        </p>
      </div>
    );
  }

  /* ================================================================
     TWO-COLUMN VIEW — Ramadan info and Next Prayer are different.
     ================================================================ */
  return (
    <div
      className={`
        countdown-container gpu-accelerated shrink-0
        ${compact ? 'py-3' : 'py-2'}
        ${compact ? 'px-3' : 'px-4'}
      `}
    >
      <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'}`}>
        {/* LEFT: Ramadan fasting countdown */}
        <div
          className="flex flex-col items-center justify-center text-center gap-0.5 pr-3"
        >
          <p className="text-body text-gold/70 uppercase tracking-wider font-medium">
            {ramadanCountdown ? ramadanLabel : `Suhoor ends at`}
          </p>

          {ramadanCountdown ? (
            <h3 className="text-prayer text-gold font-bold">
              <CountdownDisplay value={ramadanCountdown} className="text-prayer text-gold font-bold" />
            </h3>
          ) : (
            /* Static Suhoor time when there's no active countdown */
            (ramadanDisplayTime ?? displaySuhoorTime) && (
              <p className="text-prayer text-gold font-semibold countdown-stable">
                {ramadanDisplayTime ?? displaySuhoorTime}
              </p>
            )
          )}
        </div>

        {/* RIGHT: Next Prayer countdown — label is "{prayerName} prayer in" or "Jamaat in" */}
        <div className="flex flex-col items-center justify-center text-center gap-0.5">
          <p className="text-body text-text-muted uppercase tracking-wider font-medium">
            {nextPrayerColumnLabel}
          </p>

          {nextPrayerCountdown && (
            <p className="text-prayer text-gold font-semibold">
              <CountdownDisplay
                value={nextPrayerCountdown}
                className="text-prayer text-gold font-semibold"
              />
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(RamadanCountdownBar);
