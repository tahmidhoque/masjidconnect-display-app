/**
 * Header
 *
 * Displays dates on either side and the current time in the centre.
 * Left: Gregorian date. Right: Hijri date (or "Ramadan Mubarak — Day X" in Ramadan).
 * Centre: Large clock for readability from a distance.
 *
 * No masjid name — display is assumed to be in a single known location.
 * Borderless; optional gold accent line at bottom for branding.
 */

import React, { useMemo } from 'react';
import type { TimeFormat } from '@/api/models';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { calculateApproximateHijriDate, getTimeDisplayParts } from '../../utils/dateUtils';

interface HeaderProps {
  /** Unused — kept for API compatibility; masjid name is no longer displayed */
  masjidName?: string | null;
  /** Whether Ramadan mode is active */
  isRamadan?: boolean;
  /** Current day of Ramadan (1-30) */
  ramadanDay?: number | null;
  /** When true (e.g. portrait), show Ramadan as two lines: "Day X" then "Ramadan Mubarak" */
  ramadanTwoLines?: boolean;
  /** Time display format (12h or 24h); defaults to 12h */
  timeFormat?: TimeFormat;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const Header: React.FC<HeaderProps> = ({
  isRamadan = false,
  ramadanDay = null,
  ramadanTwoLines = false,
  timeFormat = '12h',
}) => {
  const currentTime = useCurrentTime();

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();

  const timeStr24h = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(timeStr24h, timeFormat);
  const secStr = String(seconds).padStart(2, '0');
  const dateLine1 = DAYS[currentTime.getDay()];
  const dateLine2 = `${currentTime.getDate()} ${MONTHS[currentTime.getMonth()]} ${currentTime.getFullYear()}`;

  const calendarDate = currentTime.getDate();
  const hijriDate = useMemo(() => calculateApproximateHijriDate(), [calendarDate]);

  const rightDateContent = useMemo(() => {
    if (isRamadan && ramadanDay != null) {
      return ramadanTwoLines ? null : `Ramadan Mubarak — Day ${ramadanDay}`;
    }
    return hijriDate;
  }, [isRamadan, ramadanDay, ramadanTwoLines, hijriDate]);

  return (
    <div
      className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg px-4 py-4 overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
      }}
    >
      {/* Gold accent line at the bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[0.2rem] w-[3.75rem] rounded-sm"
        style={{
          background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold-light))',
        }}
      />

      {/* Left — Gregorian date (day on first line, rest on second) */}
      <div className="min-w-0 flex flex-col">
        <p className="text-body text-text-secondary font-semibold truncate leading-tight">{dateLine1}</p>
        <p className="text-body text-text-secondary font-semibold truncate leading-tight">{dateLine2}</p>
      </div>

      {/* Centre — Clock (main focus); time and period scale together; no glow */}
      <div className="flex items-baseline gap-1.5 justify-center shrink-0 pointer-events-none">
        <span className="text-clock text-gold">{timeMain}</span>
        {timePeriod != null && (
          <span className="text-subheading text-gold/90 font-normal align-baseline">{timePeriod}</span>
        )}
        {timeFormat === '24h' && (
          <span className="text-caption text-gold/70 tabular-nums">{secStr}</span>
        )}
      </div>

      {/* Right — Hijri or Ramadan badge (portrait: Ramadan as "Day X" / "Ramadan Mubarak") */}
      <div className="min-w-0 flex flex-col items-end">
        {isRamadan && ramadanDay != null && ramadanTwoLines ? (
          <>
            <p className="text-body font-semibold truncate text-right text-gold/80">
              Day {ramadanDay}
            </p>
            <p className="text-body font-semibold truncate text-right text-gold/80 leading-tight">
              Ramadan Mubarak
            </p>
          </>
        ) : (
          <p
            className={`text-body font-semibold truncate text-right ${
              isRamadan ? 'text-gold/80' : 'text-text-muted'
            }`}
          >
            {rightDateContent}
          </p>
        )}
      </div>
    </div>
  );
};

export default React.memo(Header);
