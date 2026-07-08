/**
 * Header
 *
 * Displays dates on either side and the current time in the centre (horizontal),
 * or clock with dates stacked below (vertical sidebar / portrait).
 * Optional masjid name via display settings.
 *
 * Borderless; optional gold accent line at bottom for horizontal branding.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { TimeFormat } from '@/api/models';
import useMasjidTime from '../../hooks/useMasjidTime';
import { calculateApproximateHijriDate, getTimeDisplayParts } from '../../utils/dateUtils';
import { LogoBadge, headerBadgeHeightClass, portraitHeaderBadgeHeightClass } from './MasjidLogo';
import type { DisplayLogoBackground, DisplayLogoSize } from '../../types/displayLayout';

/** Masjid logo docked in the header row — replaces the top brand rail when a
 * full-width header zone is visible so branding is not duplicated. */
export interface HeaderLogo {
  src: string;
  side: 'left' | 'right';
  size: DisplayLogoSize;
  background: DisplayLogoBackground;
}

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
  /** Portrait stack header — logo docks left/right and swaps with the date block. */
  portrait?: boolean;
  /** Masjid logo docked in the header row (horizontal layout). */
  logo?: HeaderLogo | null;
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
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
  portrait = false,
  logo = null,
}) => {
  const now = useMasjidTime();
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logo?.src]);

  const activeLogo = logo && !logoFailed && layout === 'horizontal' ? logo : null;
  const portraitLogoRow = portrait && activeLogo;
  const showLeftLogo = portraitLogoRow
    ? activeLogo.side === 'left'
    : activeLogo?.side === 'left';
  const showRightLogo = portraitLogoRow
    ? activeLogo.side === 'right'
    : activeLogo?.side === 'right';
  /** Portrait + logo: both date blocks stack on the side opposite the logo. */
  const portraitDatesOnLeft = portraitLogoRow && showRightLogo;
  const portraitDatesOnRight = portraitLogoRow && showLeftLogo;
  const showDateOnLeft = showDate && !portraitLogoRow;

  const hours = now.hour();
  const minutes = now.minute();

  const timeStr24h = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(timeStr24h, timeFormat);
  const showSecondsInClock = timeFormat === '24h' && showClockSeconds;
  const secStr = showSecondsInClock ? String(now.second()).padStart(2, '0') : '';
  const dateLine1 = DAYS[now.day()];
  const dateLine2 = `${now.date()} ${MONTHS[now.month()]} ${now.year()}`;
  /** Compact single-line Gregorian for the portrait logo date stack. */
  const portraitGregorianLine = `${DAYS_SHORT[now.day()]} ${now.date()} ${MONTHS_SHORT[now.month()]} ${now.year()}`;

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

  const hasLeftColumn = portraitLogoRow
    ? showLeftLogo || portraitDatesOnLeft
    : showDateOnLeft || showLeftLogo;
  const hasRightColumn = portraitLogoRow
    ? showRightLogo || portraitDatesOnRight
    : showHijriDate || showRamadanTwoLines || showRightLogo;
  const portraitDatesAlign: 'start' | 'end' = portraitDatesOnRight ? 'end' : 'start';

  const renderGregorianDate = (align: 'start' | 'end') => (
    <div
      className={`min-w-0 w-full flex flex-col overflow-hidden ${
        align === 'end' ? 'items-end text-right' : 'items-start text-left'
      }`}
    >
      <p
        className={`w-full text-text-secondary font-semibold truncate leading-tight ${
          compact ? 'text-body' : 'text-subheading'
        }`}
      >
        {dateLine1}
      </p>
      <p className="w-full text-body text-text-secondary font-semibold truncate leading-tight">
        {dateLine2}
      </p>
    </div>
  );

  /** Portrait + logo: row 1 = Gregorian (one line), row 2 = Islamic only. */
  const renderPortraitGregorianLine = (align: 'start' | 'end') => (
    <p
      className={`w-full min-w-0 max-w-full text-caption text-text-secondary font-semibold leading-tight truncate whitespace-nowrap ${
        align === 'end' ? 'text-right' : 'text-left'
      }`}
    >
      {portraitGregorianLine}
    </p>
  );

  const renderIslamicDate = (align: 'start' | 'end', singleLine = false) => {
    if (!showHijriDate && !showRamadanTwoLines) return null;
    const alignClass = align === 'end' ? 'items-end text-right' : 'items-start text-left';
    const lineClass = singleLine
      ? 'w-full min-w-0 max-w-full text-caption font-semibold leading-tight truncate whitespace-nowrap'
      : 'w-full text-body font-semibold truncate leading-tight';
    return (
      <div className={`min-w-0 w-full flex flex-col overflow-hidden ${alignClass}`}>
        {showRamadanTwoLines ? (
          singleLine ? (
            <p className={`${lineClass} text-gold/90`}>
              Day {ramadanDay} · Ramadan Mubarak
            </p>
          ) : (
            <>
              <p className="w-full text-subheading font-bold truncate text-gold/90 leading-tight">
                Day {ramadanDay}
              </p>
              <p className="w-full text-body font-semibold truncate text-gold/80 leading-tight">
                Ramadan Mubarak
              </p>
            </>
          )
        ) : rightDateContent ? (
          <p
            className={`${lineClass} ${isRamadan ? 'text-gold/80' : 'text-text-muted'}`}
          >
            {rightDateContent}
          </p>
        ) : null}
      </div>
    );
  };

  /** Portrait + logo: row 1 = Gregorian only, row 2 = Islamic only — two lines total. */
  const renderPortraitDatesStack = (align: 'start' | 'end') => (
    <div
      className={`min-w-0 max-w-full flex flex-col gap-0.5 overflow-hidden ${
        align === 'end' ? 'items-end' : 'items-start'
      }`}
    >
      {showDate && renderPortraitGregorianLine(align)}
      {renderIslamicDate(align, true)}
    </div>
  );

  const renderLogoBadge = (side: 'left' | 'right') => {
    if (!activeLogo || (side === 'left' ? !showLeftLogo : !showRightLogo)) return null;
    return (
      <LogoBadge
        src={activeLogo.src}
        background={activeLogo.background}
        heightClass={
          portraitLogoRow
            ? portraitHeaderBadgeHeightClass(activeLogo.size)
            : headerBadgeHeightClass(activeLogo.size)
        }
        maxWidthClass={portraitLogoRow ? 'max-w-[9rem]' : 'max-w-20'}
        onError={() => setLogoFailed(true)}
      />
    );
  };

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

      {portraitLogoRow ? (
        <div className="relative flex items-center min-h-[3.25rem]">
          <div className="flex-1 min-w-0 max-w-[46%] z-[1] flex items-center gap-2 overflow-hidden">
            {renderLogoBadge('left')}
            {portraitDatesOnLeft && renderPortraitDatesStack(portraitDatesAlign)}
          </div>
          <div className="flex-1 min-w-0 max-w-[46%] z-[1] ml-auto flex items-center justify-end gap-2 overflow-hidden">
            {portraitDatesOnRight && renderPortraitDatesStack(portraitDatesAlign)}
            {renderLogoBadge('right')}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <div
              className={`flex items-baseline justify-center shrink-0 ${
                compact ? 'gap-1.5' : 'gap-2'
              }`}
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
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`relative grid items-center ${
            hasLeftColumn && hasRightColumn
              ? 'grid-cols-[1fr_auto_1fr]'
              : 'grid-cols-1 justify-items-center'
          } ${compact ? 'gap-4' : 'gap-5'}`}
        >
          {hasLeftColumn && (
            <div className="min-w-0 flex items-center gap-2 overflow-hidden">
              {renderLogoBadge('left')}
              {showDateOnLeft && renderGregorianDate('start')}
            </div>
          )}

          <div
            className={`flex items-baseline justify-center shrink-0 pointer-events-none ${
              compact ? 'gap-1.5' : 'gap-2'
            } ${!hasLeftColumn ? 'col-span-full' : ''}`}
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

          {hasRightColumn && (
            <div className="min-w-0 flex items-center justify-end gap-2 overflow-hidden">
              {(showHijriDate || showRamadanTwoLines) && renderIslamicDate('end')}
              {renderLogoBadge('right')}
            </div>
          )}
        </div>
      )}

      <GoldAccentBar />
    </div>
  );
};

export default React.memo(Header);
