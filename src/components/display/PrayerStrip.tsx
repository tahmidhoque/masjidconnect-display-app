/**
 * PrayerStrip
 *
 * Landscape-only horizontal bar: optional Imsak row, then clock and dates (left),
 * prayer cue cards, and an optional countdown row. On Fridays the Zuhr slot
 * carries `isJumuah` from the data hook and is relabelled "Jumuah" here via
 * the existing terminology key — Jumuah replaces the Zuhr congregational
 * prayer in the mosque, so we deliberately do NOT surface the regular
 * `zuhrJamaat` under today's Jumuah cue card. The Tomorrow row carries a
 * small subtext ("Jumuah" or "Zuhr") whenever the prayer type of tomorrow's
 * jamaat differs from today's row label so users can tell at a glance what
 * tomorrow's time is for.
 *
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React, { useMemo } from 'react';
import { Sunrise } from 'lucide-react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import useMasjidTime from '../../hooks/useMasjidTime';
import {
  calculateApproximateHijriDate,
  getTimeDisplayParts,
} from '../../utils/dateUtils';
import type { TimeFormat } from '../../api/models';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings } from '../../store/slices/contentSlice';
import { prayerRowNameToTerminologyKey, resolveTerminology } from '../../utils/prayerTerminology';

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
  /** Countdown rendered below prayer cards, centred */
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
  // Masjid-tz wall clock — never device-local. The Pi runs in UTC so reading
  // `Date.getHours()` directly would show the wrong time on the strip.
  const now = useMasjidTime();
  const { todaysPrayerTimes } = usePrayerTimesContext();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;
  // Tiny subtext labels used under the Tomorrow row whenever the prayer type
  // of tomorrow's jamaat differs from today's row label (e.g. today Mon–Thu
  // tomorrow Fri shows "Jumuah" subtext; today Fri tomorrow Sat shows "Zuhr"
  // subtext). Resolved through terminology so customised masjid labels are
  // honoured.
  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const zuhrLabel = resolveTerminology(terminology, 'zuhr', 'Zuhr');

  const timeStr24h = now.format('HH:mm');
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(
    timeStr24h,
    timeFormat,
  );
  const dayName = DAYS[now.day()];
  const dateStr = `${now.date()} ${MONTHS[now.month()]} ${now.year()}`;
  const calendarDate = now.date();
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
      {showImsakRow && imsakTime && (
        <div className="shrink-0 flex items-center justify-center py-2 px-4 bg-surface/30">
          <span className="text-prayer-strip-label text-gold/90 uppercase tracking-wider font-bold">
            Imsak{' '}
            <TimeWithPeriod timeString={imsakTime} timeFormat={timeFormat} className="tabular-nums" />
          </span>
        </div>
      )}

      <div className="flex items-stretch flex-1 min-h-0">
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

        <div className="flex-1 flex gap-2 px-4 py-3 min-w-0">
          {todaysPrayerTimes.map((prayer) => {
            const isNext = prayer.isNext;
            const isSunrise = prayer.name === 'Sunrise';
            const displayName = (() => {
              // Friday Zuhr slot is replaced by Jumuah upstream; relabel the
              // card via the existing `jummah` terminology key so users don't
              // see "Dhuhr"/"Zuhr" with Jumuah times.
              if (prayer.isJumuah) {
                return resolveTerminology(terminology, 'jummah', 'Jumuah');
              }
              const fallback = DISPLAY_NAMES[prayer.name] ?? prayer.name;
              const key = prayerRowNameToTerminologyKey(prayer.name);
              return key ? resolveTerminology(terminology, key, fallback) : fallback;
            })();

            const showImsakInCard =
              showImsak && !!imsakTime && prayer.name === 'Fajr';
            const ramadanLabel =
              isRamadan && prayer.name === 'Maghrib'
                ? resolveTerminology(terminology, 'iftar', 'Iftar')
                : undefined;

            return (
              <div
                key={prayer.name}
                className={`
                  flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg px-3 py-1.5
                  transition-colors duration-normal
                  ${isNext ? 'bg-emerald/15 border-2 border-emerald/40' : 'bg-surface/50 border border-border'}
                `}
              >
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  <span
                    className={`
                      text-prayer-strip-label uppercase tracking-wider
                      ${isNext ? 'text-emerald-light' : 'text-text-secondary'}
                    `}
                  >
                    {displayName}
                  </span>
                  {ramadanLabel && (
                    <span className="text-prayer-strip-label text-gold/80 italic font-semibold">
                      {ramadanLabel}
                    </span>
                  )}
                </div>

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

                {isSunrise ? (
                  <Sunrise
                    className="w-6 h-6 text-gold/70 mt-0.5"
                    aria-hidden
                  />
                ) : prayer.jamaat ? (
                  <span className="text-prayer-strip-jamaat-primary text-gold/90 mt-0.5 tabular-nums">
                    <TimeWithPeriod
                      timeString={prayer.jamaat}
                      timeFormat={timeFormat}
                      className="text-gold font-semibold"
                    />
                  </span>
                ) : null}

                {showImsakInCard && !showImsakRow && imsakTime && (
                  <span className="text-prayer-strip-jamaat text-gold/80 mt-0.5 italic font-medium tabular-nums">
                    Imsak <TimeWithPeriod timeString={imsakTime} timeFormat={timeFormat} />
                  </span>
                )}

                {showTomorrowCol && (() => {
                  const tomorrowEntry = tomorrowsJamaats?.[prayer.name];
                  const tomorrowJamaat = tomorrowEntry?.jamaat;
                  const todayIsJumuah = prayer.isJumuah === true;
                  const tomorrowIsJumuah = tomorrowEntry?.isJumuah === true;
                  // Show a subtext only when the tomorrow value's prayer
                  // type differs from today's row label so users can see at
                  // a glance what tomorrow's time is for.
                  const mismatchLabel = !tomorrowJamaat || !prayer.jamaat
                    ? null
                    : tomorrowIsJumuah && !todayIsJumuah
                      ? jummahLabel
                      : todayIsJumuah && !tomorrowIsJumuah
                        ? zuhrLabel
                        : null;
                  return (
                    <div className="mt-0.5 w-full min-w-0 flex flex-col items-center justify-center shrink-0">
                      {prayer.jamaat && tomorrowJamaat ? (
                        <span className="inline-flex flex-nowrap items-baseline gap-x-0.5 whitespace-nowrap text-prayer-strip-jamaat text-text-muted tabular-nums max-w-full">
                          <span className="shrink-0">Tmw</span>
                          <TimeWithPeriod
                            timeString={tomorrowJamaat}
                            timeFormat={timeFormat}
                            className="shrink-0"
                          />
                        </span>
                      ) : null}
                      {mismatchLabel ? (
                        <span className="text-prayer-strip-jamaat text-text-muted/75 leading-tight whitespace-nowrap">
                          {mismatchLabel}
                        </span>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {countdownSlot ? (
        <div className="shrink-0 w-full min-w-0 py-2 px-4">
          {countdownSlot}
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(PrayerStrip);
