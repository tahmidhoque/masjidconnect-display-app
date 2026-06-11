/**
 * Header
 *
 * Displays dates on either side and the current time in the centre (horizontal),
 * or clock with dates stacked below (vertical sidebar / portrait).
 * Optional masjid name via display settings.
 *
 * Borderless; optional gold accent line at bottom for horizontal branding.
 */

import React, { useMemo } from 'react';
import type { TimeFormat } from '@/api/models';
import useMasjidTime from '../../hooks/useMasjidTime';
import { calculateApproximateHijriDate, getTimeDisplayParts } from '../../utils/dateUtils';

interface HeaderProps {
  masjidName?: string | null;
  /** When true, show the masjid name (display settings). */
  showMasjidName?: boolean;
  /** When false, hide Gregorian date lines. */
  showDate?: boolean;
  /** When false, hide Hijri / Islamic date (Ramadan badge still follows ramadan props). */
  showHijriDate?: boolean;
  /** When true (landscape), use tighter padding and gap so layout fits */
  compact?: boolean;
  /** Whether Ramadan mode is active */
  isRamadan?: boolean;
  /** Current day of Ramadan (1-30) */
  ramadanDay?: number | null;
  /** When true (e.g. portrait), show Ramadan as two lines: "Day X" then "Ramadan Mubarak" */
  ramadanTwoLines?: boolean;
  /** Time display format (12h or 24h); defaults to 12h */
  timeFormat?: TimeFormat;
  /** Days to add to the calculated Hijri date (from displaySettings.hijriDateAdjustment) */
  hijriDateAdjustment?: number;
  /** When false, hide trailing seconds in 24h mode (e.g. portrait header) */
  showClockSeconds?: boolean;
  /** Horizontal bar (default) or vertical sidebar column. */
  layout?: 'horizontal' | 'vertical';
}

const GoldAccentBar = () => (
  <div
    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[0.2rem] w-[3.75rem] rounded-sm pointer-events-none"
    style={{
      background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold-light))',
    }}
    aria-hidden
  />
);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const Header: React.FC<HeaderProps> = ({
  masjidName = null,
  showMasjidName = false,
  showDate = true,
  showHijriDate = true,
  compact = false,
  isRamadan = false,
  ramadanDay = null,
  ramadanTwoLines = false,
  timeFormat = '12h',
  hijriDateAdjustment = 0,
  showClockSeconds = true,
  layout = 'horizontal',
}) => {
  const now = useMasjidTime();

  const hours = now.hour();
  const minutes = now.minute();

  const timeStr24h = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(timeStr24h, timeFormat);
  const showSecondsInClock = timeFormat === '24h' && showClockSeconds;
  const secStr = showSecondsInClock ? String(now.second()).padStart(2, '0') : '';
  const dateLine1 = DAYS[now.day()];
  const dateLine2 = `${now.date()} ${MONTHS[now.month()]} ${now.year()}`;

  const calendarDate = now.date();
  const calendarMonth = now.month();
  const calendarYear = now.year();
  const masjidCalendarDate = useMemo(
    () => new Date(calendarYear, calendarMonth, calendarDate),
    [calendarYear, calendarMonth, calendarDate],
  );
  const hijriDate = useMemo(
    () => calculateApproximateHijriDate(masjidCalendarDate, hijriDateAdjustment),
    [masjidCalendarDate, hijriDateAdjustment],
  );

  const showName = showMasjidName && !!masjidName?.trim();
  const trimmedName = masjidName?.trim() ?? '';

  const rightDateContent = useMemo(() => {
    if (!showHijriDate) return null;
    if (isRamadan && ramadanDay != null) {
      return ramadanTwoLines ? null : `Ramadan Mubarak — Day ${ramadanDay}`;
    }
    return hijriDate;
  }, [showHijriDate, isRamadan, ramadanDay, ramadanTwoLines, hijriDate]);

  const showRamadanTwoLines =
    showHijriDate && isRamadan && ramadanDay != null && ramadanTwoLines;

  const showVerticalDates =
    showDate || showRamadanTwoLines || (rightDateContent != null && !ramadanTwoLines);

  if (layout === 'vertical') {
    return (
      <div
        className={`relative flex flex-col items-center justify-center h-full overflow-hidden rounded-lg px-3 gap-2 ${
          compact ? 'py-3' : 'py-4'
        }`}
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {showName && (
          <p className="text-subheading font-bold text-gold/90 text-center truncate max-w-full leading-tight px-1">
            {trimmedName}
          </p>
        )}

        <div className="flex flex-col items-center shrink-0 pointer-events-none">
          <span className="text-clock text-gold leading-none">{timeMain}</span>
          {timePeriod != null && (
            <span className="text-gold/90 text-body font-medium">{timePeriod}</span>
          )}
        </div>

        {showVerticalDates && (
          <div className="flex flex-col items-center text-center min-w-0">
            {showDate && (
              <>
                <p className="text-body text-text-secondary font-semibold leading-tight">{dateLine1}</p>
                <p className="text-caption text-text-secondary leading-tight">{dateLine2}</p>
              </>
            )}
            {showRamadanTwoLines ? (
              <>
                <p className="text-subheading font-bold text-gold/90 mt-1 leading-tight">
                  Day {ramadanDay}
                </p>
                <p className="text-body font-semibold text-gold/80 leading-tight">
                  Ramadan Mubarak
                </p>
              </>
            ) : rightDateContent ? (
              <p className="text-caption text-text-muted mt-1 leading-tight">{rightDateContent}</p>
            ) : null}
          </div>
        )}

        <GoldAccentBar />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col overflow-hidden ${
        compact ? 'gap-3 rounded-lg px-4 py-3' : 'gap-4 rounded-lg px-4 py-4'
      }`}
      style={{
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.08) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {showName && (
        <p className="text-subheading font-bold text-gold/90 text-center truncate leading-tight">
          {trimmedName}
        </p>
      )}

      <div
        className={`relative grid items-center ${
          showDate && (showHijriDate || showRamadanTwoLines || rightDateContent)
            ? 'grid-cols-[1fr_auto_1fr]'
            : 'grid-cols-1 justify-items-center'
        } ${compact ? 'gap-4' : 'gap-5'}`}
      >
        {showDate && (
          <div className="min-w-0 flex flex-col">
            <p
              className={`text-text-secondary font-semibold truncate leading-tight ${
                compact ? 'text-body' : 'text-subheading'
              }`}
            >
              {dateLine1}
            </p>
            <p className="text-body text-text-secondary font-semibold truncate leading-tight">
              {dateLine2}
            </p>
          </div>
        )}

        <div
          className={`flex items-baseline justify-center shrink-0 pointer-events-none ${
            compact ? 'gap-1.5' : 'gap-2'
          } ${!showDate ? 'col-span-full' : ''}`}
        >
          <span className="text-clock text-gold">{timeMain}</span>
          {timePeriod != null && (
            <span
              className={`text-gold/90 align-baseline ${
                compact ? 'text-body font-normal' : 'text-subheading font-medium'
              }`}
            >
              {timePeriod}
            </span>
          )}
          {showSecondsInClock && (
            <span className="text-caption text-gold/70 tabular-nums font-medium">{secStr}</span>
          )}
        </div>

        {(showHijriDate || showRamadanTwoLines) && (
          <div className="min-w-0 flex flex-col items-end">
            {showRamadanTwoLines ? (
              <>
                <p className="text-subheading font-bold truncate text-right text-gold/90">
                  Day {ramadanDay}
                </p>
                <p className="text-body font-semibold truncate text-right text-gold/80 leading-tight">
                  Ramadan Mubarak
                </p>
              </>
            ) : rightDateContent ? (
              <p
                className={`text-body font-semibold truncate text-right ${
                  isRamadan ? 'text-gold/80' : 'text-text-muted'
                }`}
              >
                {rightDateContent}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <GoldAccentBar />
    </div>
  );
};

export default React.memo(Header);
