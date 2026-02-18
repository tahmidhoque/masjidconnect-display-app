/**
 * IftarCountdown
 *
 * Hero countdown component for Ramadan mode. During fasting hours
 * (Fajr → Maghrib) it shows a prominent "Time until Iftar" countdown.
 * Outside fasting hours (Maghrib → Fajr) it shows a "Suhoor ends at"
 * information line.
 *
 * Accepts a `compact` prop for portrait orientation where vertical
 * space is constrained — uses smaller text and tighter padding.
 *
 * GPU-safe: uses transform/opacity only. No backdrop-filter.
 * Reuses the existing `useCurrentTime` hook — no new intervals.
 */

import React, { useMemo } from 'react';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { getTimeUntilNextPrayer, formatTimeToDisplay } from '../../utils/dateUtils';
import { useSelector } from 'react-redux';
import { selectTimeFormat } from '../../store/slices/contentSlice';

interface IftarCountdownProps {
  /** Maghrib adhan time in HH:mm format */
  iftarTime: string | null;
  /** Fajr adhan time in HH:mm format (end of Suhoor) */
  suhoorEndTime: string | null;
  /** Whether we are currently in fasting hours (Fajr → Maghrib) */
  isFastingHours: boolean;
  /** Use compact layout for portrait orientation */
  compact?: boolean;
}

const IftarCountdown: React.FC<IftarCountdownProps> = ({
  iftarTime,
  suhoorEndTime,
  isFastingHours,
  compact = false,
}) => {
  const currentTime = useCurrentTime();
  const timeFormat = useSelector(selectTimeFormat);

  /** Live countdown to Iftar, recomputed every second */
  const liveIftarCountdown = useMemo(() => {
    if (!isFastingHours || !iftarTime) return null;
    return getTimeUntilNextPrayer(iftarTime, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFastingHours, iftarTime, currentTime]);

  /** Live countdown to Suhoor end (pre-Fajr only) */
  const liveSuhoorCountdown = useMemo(() => {
    if (isFastingHours || !suhoorEndTime) return null;
    const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    // Only relevant between midnight and Fajr
    if (nowHHmm >= suhoorEndTime) return null;
    return getTimeUntilNextPrayer(suhoorEndTime, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFastingHours, suhoorEndTime, currentTime]);

  const displayIftarTime = useMemo(
    () => (iftarTime ? formatTimeToDisplay(iftarTime, timeFormat) : null),
    [iftarTime, timeFormat],
  );

  const displaySuhoorTime = useMemo(
    () => (suhoorEndTime ? formatTimeToDisplay(suhoorEndTime, timeFormat) : null),
    [suhoorEndTime, timeFormat],
  );

  /* ---- Fasting hours: hero Iftar countdown ---- */
  if (isFastingHours && liveIftarCountdown) {
    return (
      <div
        className={`
          card-elevated iftar-countdown-card gpu-accelerated
          flex flex-col items-center justify-center text-center
          border border-gold/20
          ${compact ? 'gap-1 py-3' : 'gap-2 py-4'}
        `}
      >
        <p
          className={`
            text-text-muted uppercase tracking-wider font-medium
            ${compact ? 'text-caption' : 'text-caption'}
          `}
        >
          Time until Iftar
        </p>

        <h3
          className={`
            text-gold font-bold tabular-nums
            ${compact ? 'text-heading' : 'text-display'}
          `}
        >
          {liveIftarCountdown}
        </h3>

        {displayIftarTime && (
          <p
            className={`
              text-text-secondary tabular-nums
              ${compact ? 'text-caption' : 'text-body'}
            `}
          >
            Maghrib &middot; {displayIftarTime}
          </p>
        )}
      </div>
    );
  }

  /* ---- Pre-Fajr: Suhoor countdown ---- */
  if (!isFastingHours && liveSuhoorCountdown && displaySuhoorTime) {
    return (
      <div
        className={`
          card-elevated gpu-accelerated
          flex flex-col items-center justify-center text-center
          ${compact ? 'gap-1 py-2' : 'gap-1.5 py-3'}
        `}
      >
        <p className="text-caption text-text-muted uppercase tracking-wider">
          Suhoor ends in
        </p>

        <h3
          className={`
            text-gold font-semibold tabular-nums
            ${compact ? 'text-subheading' : 'text-heading'}
          `}
        >
          {liveSuhoorCountdown}
        </h3>

        <p className="text-caption text-text-secondary tabular-nums">
          Fajr &middot; {displaySuhoorTime}
        </p>
      </div>
    );
  }

  /* ---- Post-Iftar / no data: show Suhoor info line ---- */
  if (!isFastingHours && displaySuhoorTime) {
    return (
      <div
        className={`
          card-elevated gpu-accelerated flex items-center justify-center text-center
          ${compact ? 'py-2' : 'py-3'}
        `}
      >
        <p className="text-caption text-text-secondary">
          Suhoor ends at <span className="text-gold font-medium tabular-nums">{displaySuhoorTime}</span>
        </p>
      </div>
    );
  }

  return null;
};

export default React.memo(IftarCountdown);
