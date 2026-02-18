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
import { selectTimeFormat } from '../../store/slices/contentSlice';

interface RamadanCountdownBarProps {
  /** Maghrib adhan time in HH:mm format */
  iftarTime: string | null;
  /** Fajr adhan time in HH:mm format (end of Suhoor) */
  suhoorEndTime: string | null;
  /** Whether we are currently in fasting hours (Fajr → Maghrib) */
  isFastingHours: boolean;
  /** Compact layout for portrait orientation */
  compact?: boolean;
}

const RamadanCountdownBar: React.FC<RamadanCountdownBarProps> = ({
  iftarTime,
  suhoorEndTime,
  isFastingHours,
  compact = false,
}) => {
  const currentTime = useCurrentTime();
  const timeFormat = useSelector(selectTimeFormat);
  const { nextPrayer } = usePrayerTimes();

  /* ---- Formatted display times ---- */
  const displayIftarTime = useMemo(
    () => (iftarTime ? formatTimeToDisplay(iftarTime, timeFormat) : null),
    [iftarTime, timeFormat],
  );
  const displaySuhoorTime = useMemo(
    () => (suhoorEndTime ? formatTimeToDisplay(suhoorEndTime, timeFormat) : null),
    [suhoorEndTime, timeFormat],
  );

  /* ---- Live Ramadan countdown ---- */
  const ramadanCountdown = useMemo(() => {
    if (isFastingHours && iftarTime) {
      return getTimeUntilNextPrayer(iftarTime, false);
    }
    if (!isFastingHours && suhoorEndTime) {
      const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
      if (nowHHmm < suhoorEndTime) {
        return getTimeUntilNextPrayer(suhoorEndTime, false);
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFastingHours, iftarTime, suhoorEndTime, currentTime]);

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

  const nextPrayerCountdown = useMemo(() => {
    if (!nextPrayerTarget) return '';
    return getTimeUntilNextPrayer(nextPrayerTarget.time, nextPrayerTarget.forceTomorrow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPrayerTarget, currentTime]);

  /* ---- Determine Ramadan column label and prayer name ---- */
  const ramadanLabel = isFastingHours ? 'Iftar in' : 'Suhoor ends in';
  const ramadanPrayerName = isFastingHours ? 'Maghrib' : 'Fajr';
  const ramadanDisplayTime = isFastingHours ? displayIftarTime : displaySuhoorTime;

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
          card-elevated iftar-countdown-card gpu-accelerated
          flex flex-col items-center justify-center text-center
          border border-gold/20
          ${compact ? 'gap-1 py-3' : 'gap-2 py-5'}
        `}
      >
        {/* Dual label */}
        <div className="flex items-center gap-3">
          <span className="text-caption text-gold/70 uppercase tracking-wider font-medium">
            {ramadanLabel}
          </span>
          <span className="text-text-muted/30">|</span>
          <span className="text-caption text-text-muted uppercase tracking-wider font-medium">
            Next Prayer
          </span>
        </div>

        {/* Prayer name */}
        <h3
          className={`
            text-emerald-light font-bold
            ${compact ? 'text-subheading' : 'text-heading'}
          `}
        >
          {nextPrayer.name}
        </h3>

        {/* Countdown */}
        <p
          className={`
            text-gold font-bold tabular-nums
            ${compact ? 'text-heading' : 'text-display'}
          `}
        >
          {ramadanCountdown}
        </p>

        {/* Time */}
        {nextPrayer.displayTime && (
          <p className="text-caption text-text-secondary tabular-nums">
            {nextPrayer.displayTime}
          </p>
        )}
      </div>
    );
  }

  /* ================================================================
     TWO-COLUMN VIEW — Ramadan info and Next Prayer are different.
     ================================================================ */
  return (
    <div
      className={`
        card-elevated gpu-accelerated
        border border-gold/20
        ${compact ? 'py-3 px-3' : 'py-4 px-4'}
      `}
    >
      <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'}`}>
        {/* LEFT: Ramadan fasting countdown */}
        <div
          className={`
            flex flex-col items-center justify-center text-center
            border-r border-border pr-3
            ${compact ? 'gap-0.5' : 'gap-1.5'}
          `}
        >
          <p className="text-caption text-gold/70 uppercase tracking-wider font-medium">
            {ramadanCountdown ? ramadanLabel : `Suhoor ends at`}
          </p>

          {ramadanCountdown ? (
            <>
              <h3
                className={`
                  text-gold font-bold tabular-nums
                  ${compact ? 'text-subheading' : 'text-heading'}
                `}
              >
                {ramadanCountdown}
              </h3>
              {ramadanDisplayTime && (
                <p className="text-caption text-text-secondary tabular-nums">
                  {ramadanPrayerName} &middot; {ramadanDisplayTime}
                </p>
              )}
            </>
          ) : (
            /* Static Suhoor time when there's no active countdown */
            displaySuhoorTime && (
              <p
                className={`
                  text-gold font-semibold tabular-nums
                  ${compact ? 'text-body' : 'text-subheading'}
                `}
              >
                {displaySuhoorTime}
              </p>
            )
          )}
        </div>

        {/* RIGHT: Next Prayer countdown */}
        <div
          className={`
            flex flex-col items-center justify-center text-center
            ${compact ? 'gap-0.5' : 'gap-1.5'}
          `}
        >
          <p className="text-caption text-text-muted uppercase tracking-wider font-medium">
            Next Prayer
          </p>

          <h3
            className={`
              text-emerald-light font-bold
              ${compact ? 'text-body' : 'text-subheading'}
            `}
          >
            {nextPrayer.name}
          </h3>

          {nextPrayerCountdown && (
            <p
              className={`
                text-gold font-semibold tabular-nums
                ${compact ? 'text-subheading' : 'text-heading'}
              `}
            >
              {nextPrayerCountdown}
            </p>
          )}

          {nextPrayer.displayTime && (
            <p className="text-caption text-text-secondary tabular-nums">
              {nextPrayer.displayTime}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(RamadanCountdownBar);
