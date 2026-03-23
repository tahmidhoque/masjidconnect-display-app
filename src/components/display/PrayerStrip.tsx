/**
 * PrayerStrip
 *
 * Landscape-only horizontal bar: optional Imsak row, then prayer cue cards in a
 * row, plus a trailing Jumuah card after Isha when upcoming Friday jummah data exists.
 * Clock and countdown live in LandscapeBroadcastHeader above the carousel.
 *
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React from 'react';
import { Sunrise } from 'lucide-react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import {
  getTimeDisplayParts,
} from '../../utils/dateUtils';
import type { TimeFormat } from '../../api/models';

/** Display names for prayer strip (broadcast-style labels) */
const DISPLAY_NAMES: Record<string, string> = {
  Sunrise: 'Shuruq',
  Zuhr: 'Dhuhr',
};

interface PrayerStripProps {
  isRamadan?: boolean;
  imsakTime?: string | null;
  showImsak?: boolean;
  timeFormat?: TimeFormat;
  showTomorrowJamaat?: boolean;
  tomorrowsJamaats?: TomorrowsJamaatsMap;
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
  showTomorrowJamaat = false,
  tomorrowsJamaats = null,
}) => {
  const {
    todaysPrayerTimes,
    upcomingJumuahJamaatRaw,
    upcomingJumuahKhutbahRaw,
  } = usePrayerTimesContext();

  const showTomorrowCol = showTomorrowJamaat && !!tomorrowsJamaats;
  const showImsakRow = showImsak && !!imsakTime;
  const showTrailingJumuah = Boolean(
    upcomingJumuahKhutbahRaw || upcomingJumuahJamaatRaw,
  );

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
        <div className="flex-1 flex gap-2 px-4 py-3 min-w-0">
          {todaysPrayerTimes.map((prayer) => {
            const isNext = prayer.isNext;
            const isSunrise = prayer.name === 'Sunrise';
            const displayName =
              DISPLAY_NAMES[prayer.name] ?? prayer.name;

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

                {showTomorrowCol && (
                  <div className="mt-0.5 w-full min-w-0 min-h-[1.35rem] flex items-center justify-center shrink-0">
                    {prayer.jamaat && tomorrowsJamaats?.[prayer.name] ? (
                      <span className="inline-flex flex-nowrap items-baseline gap-x-0.5 whitespace-nowrap text-prayer-strip-jamaat text-text-muted tabular-nums max-w-full">
                        <span className="shrink-0">Tmw</span>
                        <TimeWithPeriod
                          timeString={tomorrowsJamaats[prayer.name]}
                          timeFormat={timeFormat}
                          className="shrink-0"
                        />
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}

          {showTrailingJumuah && (
            <div
              className="flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg px-3 py-1.5 transition-colors duration-normal bg-surface/50 border border-border"
              aria-label="Jumuah Khutbah and Jamaat"
            >
              <span className="text-prayer-strip-label uppercase tracking-wider text-text-secondary">
                Jumuah
              </span>
              {upcomingJumuahKhutbahRaw ? (
                <span className="text-prayer-strip-time tabular-nums mt-0.5 text-text-primary inline-flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0">
                  <span className="text-text-muted font-semibold uppercase tracking-wide text-[0.85em]">
                  </span>
                  <TimeWithPeriod
                    timeString={upcomingJumuahKhutbahRaw}
                    timeFormat={timeFormat}
                  />
                </span>
              ) : null}
              {upcomingJumuahJamaatRaw ? (
                <span className="text-prayer-strip-jamaat-primary text-gold/90 mt-0.5 tabular-nums text-center inline-flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0">
                  <span className="text-prayer-strip-jamaat text-gold/70 font-semibold uppercase tracking-wide">
                  </span>
                  <TimeWithPeriod
                    timeString={upcomingJumuahJamaatRaw}
                    timeFormat={timeFormat}
                    className="text-gold font-semibold"
                  />
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PrayerStrip);
