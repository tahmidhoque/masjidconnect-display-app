/**
 * PrayerStrip
 *
 * Landscape-only horizontal bar: clock/date on the left, six prayer cue cards
 * in a row. Replaces Header + PrayerTimesPanel in the landscape layout.
 * Designed for 10–15 ft readability with clear hierarchy.
 *
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React, { useMemo } from 'react';
import { Sunrise } from 'lucide-react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import {
  calculateApproximateHijriDate,
  getTimeDisplayParts,
} from '../../utils/dateUtils';
import type { TimeFormat } from '../../api/models';

/** Display names for prayer strip (broadcast-style labels) */
const DISPLAY_NAMES: Record<string, string> = {
  Sunrise: 'Shuruq',
  Zuhr: 'Dhuhr',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface PrayerStripProps {
  isRamadan?: boolean;
  imsakTime?: string | null;
  showImsak?: boolean;
  timeFormat?: TimeFormat;
  hijriDateAdjustment?: number;
  showTomorrowJamaat?: boolean;
  tomorrowsJamaats?: TomorrowsJamaatsMap;
  /** Countdown slot rendered below prayer cards, centred */
  countdownSlot?: React.ReactNode;
}

/** Renders time with optional period subtext (e.g. "5:39" + "pm") */
const TimeWithPeriod: React.FC<{
  timeString: string;
  timeFormat: TimeFormat;
  className?: string;
}> = ({ timeString, timeFormat, className = '' }) => {
  if (!timeString) return <span className={className}>—</span>;
  const { main, period } = getTimeDisplayParts(timeString, timeFormat);
  return (
    <span className={className}>
      {main}
      {period != null && (
        <span className="opacity-90 font-semibold ml-0.5 align-baseline text-[0.9em]">
          {period}
        </span>
      )}
    </span>
  );
};

const PrayerStrip: React.FC<PrayerStripProps> = ({
  isRamadan = false,
  imsakTime = null,
  showImsak = false,
  timeFormat = '12h',
  hijriDateAdjustment = 0,
  showTomorrowJamaat = false,
  tomorrowsJamaats = null,
  countdownSlot = null,
}) => {
  const currentTime = useCurrentTime();
  const {
    todaysPrayerTimes,
    isJumuahToday,
    jumuahDisplayTime,
    jumuahKhutbahTime,
  } = usePrayerTimesContext();

  const timeStr24h = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(
    timeStr24h,
    timeFormat,
  );
  const dayName = DAYS[currentTime.getDay()];
  const dateStr = `${currentTime.getDate()} ${MONTHS[currentTime.getMonth()]} ${currentTime.getFullYear()}`;
  const calendarDate = currentTime.getDate();
  const hijriDate = useMemo(
    () => calculateApproximateHijriDate(undefined, hijriDateAdjustment),
    [calendarDate, hijriDateAdjustment],
  );

  const showTomorrowCol = showTomorrowJamaat && !!tomorrowsJamaats;
  const showImsakRow = showImsak && !!imsakTime;

  if (!todaysPrayerTimes || todaysPrayerTimes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full animate-shimmer rounded-lg">
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

  return (
    <div className="landscape-prayer-strip flex flex-col w-full min-h-0 rounded-lg">
      {/* Imsak row — above prayer cards when enabled */}
      {showImsakRow && imsakTime && (
        <div className="shrink-0 flex items-center justify-center py-2 px-4 bg-surface/30">
          <span className="text-prayer-strip-label text-gold/90 uppercase tracking-wider font-bold">
            Imsak{' '}
            <TimeWithPeriod timeString={imsakTime} timeFormat={timeFormat} className="tabular-nums" />
          </span>
        </div>
      )}

      {/* Main row: clock + prayer cards */}
      <div className="flex items-stretch flex-1 min-h-0">
        {/* Clock & date cell */}
        <div className="flex flex-col justify-center shrink-0 w-[15%] min-w-[8rem] px-4 py-3">
        <span className="text-prayer-strip-clock text-gold tabular-nums leading-tight">
          {timeMain}
          {timePeriod != null && (
            <span className="text-prayer-strip-jamaat font-normal text-gold/90 ml-0.5">
              {timePeriod}
            </span>
          )}
        </span>
        <span className="text-prayer-strip-label text-text-secondary mt-1">
          {dayName} {dateStr}
        </span>
        <span className="text-prayer-strip-jamaat text-text-muted mt-0.5">
          {hijriDate}
        </span>
      </div>

      {/* Prayer cards */}
      <div className="flex-1 flex gap-2 px-4 py-3 min-w-0">
        {todaysPrayerTimes.map((prayer) => {
          const isNext = prayer.isNext;
          const isSunrise = prayer.name === 'Sunrise';
          const isJumuahCard =
            isJumuahToday && prayer.name === 'Zuhr';

          const displayName =
            DISPLAY_NAMES[prayer.name] ?? prayer.name;
          const cardTitle = isJumuahCard ? 'Jumuah' : displayName;

          const showImsakInCard =
            showImsak && !!imsakTime && prayer.name === 'Fajr';
          const ramadanLabel = isRamadan && prayer.name === 'Maghrib' ? 'Iftar' : undefined;

          return (
            <div
              key={prayer.name}
              className={`
                flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg px-3 py-1.5
                transition-colors duration-normal
                ${isNext ? 'bg-emerald/15 border-2 border-emerald/40' : 'bg-surface/50 border border-border'}
              `}
            >
              {/* Prayer name + optional Ramadan label */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                <span
                  className={`
                    text-prayer-strip-label uppercase tracking-wider
                    ${isNext ? 'text-emerald-light' : 'text-text-secondary'}
                  `}
                >
                  {cardTitle}
                </span>
                {ramadanLabel && (
                  <span className="text-prayer-strip-label text-gold/80 italic font-semibold">
                    {ramadanLabel}
                  </span>
                )}
              </div>

              {/* Start time — large and bold */}
              <span
                className={`
                  text-prayer-strip-time tabular-nums mt-0.5
                  ${isNext ? 'text-emerald-light' : 'text-text-primary'}
                `}
              >
                <TimeWithPeriod
                  timeString={prayer.time}
                  timeFormat={timeFormat}
                />
              </span>

              {/* Jamaat time only (no "Jamaat" label to reduce text) */}
              {isSunrise ? (
                <Sunrise
                  className="w-6 h-6 text-gold/70 mt-0.5"
                  aria-hidden
                />
              ) : isJumuahCard ? (
                <div className="text-prayer-strip-jamaat text-gold/90 mt-0.5 text-center tabular-nums">
                  {jumuahKhutbahTime && jumuahDisplayTime && (
                    <span>{jumuahKhutbahTime} · {jumuahDisplayTime}</span>
                  )}
                  {jumuahKhutbahTime && !jumuahDisplayTime && (
                    <span>{jumuahKhutbahTime}</span>
                  )}
                  {!jumuahKhutbahTime && jumuahDisplayTime && (
                    <span>{jumuahDisplayTime}</span>
                  )}
                </div>
              ) : prayer.jamaat ? (
                <span className="text-prayer-strip-jamaat text-gold/90 mt-0.5 tabular-nums">
                  <TimeWithPeriod
                    timeString={prayer.jamaat}
                    timeFormat={timeFormat}
                    className="text-gold font-semibold"
                  />
                </span>
              ) : null}

              {/* Imsak (Fajr only) — only when showImsakRow is false; otherwise shown in strip header */}
              {showImsakInCard && !showImsakRow && imsakTime && (
                <span className="text-prayer-strip-jamaat text-gold/80 mt-0.5 italic font-medium tabular-nums">
                  Imsak <TimeWithPeriod timeString={imsakTime} timeFormat={timeFormat} />
                </span>
              )}

              {/* Tomorrow's Jamaat — "Tmrw" + time */}
              {showTomorrowCol && prayer.jamaat && tomorrowsJamaats?.[prayer.name] && (
                <span className="text-prayer-strip-jamaat text-text-muted mt-0.5 tabular-nums">
                  Tmrw{' '}
                  <TimeWithPeriod
                    timeString={tomorrowsJamaats[prayer.name]}
                    timeFormat={timeFormat}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Countdown row — grid keeps centre fixed regardless of label/digit width */}
      {countdownSlot && (
        <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center w-full py-2 px-4">
          <div aria-hidden />
          <div className="flex flex-row items-center justify-center min-w-0">
            {countdownSlot}
          </div>
          <div aria-hidden />
        </div>
      )}
    </div>
  );
};

export default React.memo(PrayerStrip);
