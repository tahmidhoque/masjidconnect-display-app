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
  /** Fajr adhan time in HH:mm format (used when imsakTime not provided) */
  suhoorEndTime: string | null;
  /** Imsak time in HH:mm (suhoor ends); when provided, "Suhoor ends in" countdown targets this */
  imsakTime?: string | null;
  /** Whether we are currently in fasting hours (Fajr → Maghrib) */
  isFastingHours: boolean;
  /** Use compact layout for portrait orientation */
  compact?: boolean;
}

const IftarCountdown: React.FC<IftarCountdownProps> = ({
  iftarTime,
  suhoorEndTime,
  imsakTime: imsakTimeProp = null,
  isFastingHours,
  compact = false,
}) => {
  const currentTime = useCurrentTime();
  const timeFormat = useSelector(selectTimeFormat);
  const suhoorCountdownTarget = imsakTimeProp ?? suhoorEndTime;

  /** Live countdown to Iftar, recomputed every second */
  const liveIftarCountdown = useMemo(() => {
    if (!isFastingHours || !iftarTime) return null;
    return getTimeUntilNextPrayer(iftarTime, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFastingHours, iftarTime, currentTime]);

  /** Live countdown to Suhoor end (pre-Fajr only); uses Imsak when provided */
  const liveSuhoorCountdown = useMemo(() => {
    if (isFastingHours || !suhoorCountdownTarget) return null;
    const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    if (nowHHmm >= suhoorCountdownTarget) return null;
    return getTimeUntilNextPrayer(suhoorCountdownTarget, false);
  }, [isFastingHours, suhoorCountdownTarget, currentTime]);

  const displayIftarTime = useMemo(
    () => (iftarTime ? formatTimeToDisplay(iftarTime, timeFormat) : null),
    [iftarTime, timeFormat],
  );

  const displaySuhoorTime = useMemo(
    () => (suhoorCountdownTarget ? formatTimeToDisplay(suhoorCountdownTarget, timeFormat) : null),
    [suhoorCountdownTarget, timeFormat],
  );
  const displaySuhoorLabel = imsakTimeProp ? 'Imsak' : 'Fajr';

  /* ---- Fasting hours: hero Iftar countdown ---- */
  if (isFastingHours && liveIftarCountdown) {
    return (
      <div
        className={`
          iftar-countdown-card gpu-accelerated
          flex flex-col items-center justify-center text-center
          ${compact ? 'gap-1 py-3' : 'gap-2 py-4'}
        `}
      >
        <p className="text-body text-text-muted uppercase tracking-wider font-medium">
          Time until Iftar
        </p>

        <h3
          className={`
            text-gold font-bold tabular-nums
            ${compact ? 'text-prayer' : 'text-display'}
          `}
        >
          {liveIftarCountdown}
        </h3>

        {displayIftarTime && (
          <p className="text-body text-text-secondary tabular-nums">
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
          gpu-accelerated
          flex flex-col items-center justify-center text-center
          ${compact ? 'gap-1 py-2' : 'gap-1.5 py-3'}
        `}
      >
        <p className="text-body text-text-muted uppercase tracking-wider">
          Suhoor ends in
        </p>

        <h3 className="text-prayer text-gold font-semibold tabular-nums">
          {liveSuhoorCountdown}
        </h3>

        <p className="text-body text-text-secondary tabular-nums">
          {displaySuhoorLabel} &middot; {displaySuhoorTime}
        </p>
      </div>
    );
  }

  /* ---- Post-Iftar / no data: show Suhoor info line ---- */
  if (!isFastingHours && displaySuhoorTime) {
    return (
      <div
        className={`
          gpu-accelerated flex items-center justify-center text-center
          ${compact ? 'py-2' : 'py-3'}
        `}
      >
        <p className="text-body text-text-secondary">
          Suhoor ends at <span className="text-gold font-medium tabular-nums">{displaySuhoorTime}</span>
        </p>
      </div>
    );
  }

  return null;
};

export default React.memo(IftarCountdown);
