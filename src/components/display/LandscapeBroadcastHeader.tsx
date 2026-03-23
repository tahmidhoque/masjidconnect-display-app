/**
 * LandscapeBroadcastHeader
 *
 * Landscape-only top bar: live clock, Gregorian and Hijri dates, and the prayer
 * countdown (bar variant). Flex row with clock block growing and countdown
 * flush to the inner end of the bar. Renders above the content carousel.
 *
 * GPU-safe: no backdrop-filter.
 */

import React, { useMemo } from 'react';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import {
  calculateApproximateHijriDate,
  getTimeDisplayParts,
} from '../../utils/dateUtils';
import type { TimeFormat } from '../../api/models';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface LandscapeBroadcastHeaderProps {
  timeFormat?: TimeFormat;
  hijriDateAdjustment?: number;
  /** PrayerCountdown (typically variant="bar") and phase props supplied by parent */
  countdown: React.ReactNode;
}

const LandscapeBroadcastHeader: React.FC<LandscapeBroadcastHeaderProps> = ({
  timeFormat = '12h',
  hijriDateAdjustment = 0,
  countdown,
}) => {
  const currentTime = useCurrentTime();
  const timeStr24h = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(
    timeStr24h,
    timeFormat,
  );
  const dayName = DAYS[currentTime.getDay()];
  const dateStr = `${currentTime.getDate()} ${MONTHS[currentTime.getMonth()]} ${currentTime.getFullYear()}`;
  const gy = currentTime.getFullYear();
  const gm = currentTime.getMonth();
  const gd = currentTime.getDate();
  const hijriDate = useMemo(
    () => calculateApproximateHijriDate(new Date(gy, gm, gd), hijriDateAdjustment),
    [gy, gm, gd, hijriDateAdjustment],
  );

  return (
    <div
      className={`
        landscape-broadcast-header flex w-full min-h-0 min-w-0 flex-row items-stretch
        justify-between gap-x-6 px-4 py-2
      `}
    >
      <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5 py-0.5">
        <span className="text-landscape-broadcast-clock text-gold tabular-nums leading-none shrink-0">
          {timeMain}
          {timePeriod != null && (
            <span className="text-landscape-broadcast-clock-period font-extrabold text-gold/85 ml-0.5 align-baseline">
              {timePeriod}
            </span>
          )}
        </span>
        <p
          className="text-landscape-broadcast-header-dates min-w-0 max-w-full whitespace-nowrap overflow-hidden text-ellipsis"
          title={`${dayName} ${dateStr} · ${hijriDate}`}
        >
          <span className="text-text-secondary">{dayName}</span>{' '}
          <span className="text-text-secondary/95">{dateStr}</span>
          <span className="text-text-muted mx-1.5" aria-hidden>
            ·
          </span>
          <span className="text-text-muted">{hijriDate}</span>
        </p>
      </div>

      <div className="ms-auto flex min-w-0 shrink-0 flex-col items-stretch justify-center">
        {countdown}
      </div>
    </div>
  );
};

export default React.memo(LandscapeBroadcastHeader);
