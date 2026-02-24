/**
 * PrayerTimesPanel
 *
 * Displays today's prayer times in a vertical list.
 * Highlights only the next prayer; current/previous are not highlighted.
 *
 * During Ramadan mode, shows:
 *  - An Imsak row before Fajr (informational only, never highlighted)
 *  - "Iftar" label next to Maghrib
 *
 * When in a makruh (forbidden) time for voluntary prayer, shows a notice in the
 * Start/Jamaat footer row so layout does not shift.
 *
 * 12h format: time shown as "5:39" with small "PM" subtext so alignment matches 24h.
 *
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React from 'react';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import ForbiddenPrayerNotice from './ForbiddenPrayerNotice';
import type { CurrentForbiddenState } from '../../utils/forbiddenPrayerTimes';
import { getTimeDisplayParts } from '../../utils/dateUtils';
import type { TimeFormat } from '../../api/models';

/** Ramadan-specific labels mapped to prayer names */
const RAMADAN_LABELS: Record<string, string> = {
  Maghrib: 'Iftar',
};

interface PrayerTimesPanelProps {
  /** Whether Ramadan mode is active — shows Imsak row and Iftar annotation */
  isRamadan?: boolean;
  /**
   * Imsak display time (already formatted for 12h/24h) to render before Fajr.
   * Only used when `isRamadan` is true.
   */
  imsakTime?: string | null;
  /** When set, show makruh notice in the footer (from usePrayerTimes). */
  forbiddenPrayer?: CurrentForbiddenState | null;
  /** Time format for the forbidden notice endsAt (from store). */
  timeFormat?: TimeFormat;
}

/** Fixed width for each time column so Start/Jamaat align vertically. Block so text-right takes effect. */
const TIME_COL_CLASS = 'block w-[5.5rem] text-right';
/** Grid for right-side times: two columns + gap so single-time can span both and sit in the middle. */
const TIME_GRID_CLASS = 'grid grid-cols-[5.5rem_5.5rem] gap-x-4 w-[12rem] shrink-0';

/** Renders time as main (e.g. "5:39") with optional small AM/PM subtext. Use inside a right-aligned column. */
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
        <span className="text-caption opacity-80 font-normal ml-0.5 align-baseline">{period}</span>
      )}
    </span>
  );
};

const PrayerTimesPanel: React.FC<PrayerTimesPanelProps> = ({
  isRamadan = false,
  imsakTime = null,
  forbiddenPrayer = null,
  timeFormat = '12h',
}) => {
  const { todaysPrayerTimes } = usePrayerTimes();

  if (!todaysPrayerTimes || todaysPrayerTimes.length === 0) {
    return (
      <div className="panel flex items-center justify-center h-full animate-shimmer rounded-xl">
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

  const showImsak = isRamadan && !!imsakTime;

  return (
    <div className="panel flex flex-col gap-1 flex-1 min-h-0 overflow-hidden py-4 px-5">
      <h2 className="text-subheading text-gold font-semibold mb-1 shrink-0">Prayer Times</h2>

      <div className="flex-1 min-h-0 flex flex-col gap-1 justify-center">
        {todaysPrayerTimes.map((prayer) => {
          const isNext = prayer.isNext;
          const ramadanLabel = isRamadan ? RAMADAN_LABELS[prayer.name] : undefined;

          return (
            <React.Fragment key={prayer.name}>
              {/* Imsak row — rendered immediately before Fajr */}
              {showImsak && prayer.name === 'Fajr' && (
                <div
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-transparent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-gold/40" />
                    <span className="text-body font-medium text-gold/70 italic">Imsak</span>
                    <span className="text-xs text-gold/50 font-normal italic">Suhoor ends</span>
                  </div>

                  <div className={TIME_GRID_CLASS}>
                    <div className="col-span-2 w-full min-w-0 flex justify-center items-center">
                      <TimeWithPeriod
                        timeString={imsakTime ?? ''}
                        timeFormat={timeFormat}
                        className="text-body tabular-nums text-gold/70"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Standard prayer row — only next prayer is highlighted */}
              <div
                className={`
                  flex items-center justify-between px-3 py-1.5 rounded-lg
                  transition-colors duration-normal
                  ${isNext ? 'bg-emerald/15 border border-emerald/30' : 'border border-transparent'}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`
                      w-2 h-2 rounded-full shrink-0
                      ${isNext ? 'bg-emerald' : 'bg-text-muted/30'}
                    `}
                  />
                  <span className={`text-body font-medium ${isNext ? 'text-emerald-light' : 'text-text-primary'}`}>
                    {prayer.name}
                  </span>

                  {ramadanLabel && (
                    <span className="text-xs text-gold/60 font-normal italic">{ramadanLabel}</span>
                  )}
                </div>

                <div className={TIME_GRID_CLASS}>
                  {prayer.jamaat ? (
                    <>
                      <span className={TIME_COL_CLASS}>
                        <TimeWithPeriod
                          timeString={prayer.time}
                          timeFormat={timeFormat}
                          className={`text-body tabular-nums ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}
                        />
                      </span>
                      <span className={TIME_COL_CLASS}>
                        <TimeWithPeriod
                          timeString={prayer.jamaat}
                          timeFormat={timeFormat}
                          className="text-body tabular-nums text-gold/80"
                        />
                      </span>
                    </>
                  ) : (
                    /* Single time (e.g. Sunrise) — span both columns, centered in the gap */
                    <div className="col-span-2 w-full min-w-0 flex justify-center items-center">
                      <TimeWithPeriod
                        timeString={prayer.time}
                        timeFormat={timeFormat}
                        className={`text-body tabular-nums ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Legend — same px-3 as rows so Start/Jamaat align with time columns above */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 mt-1 pt-1 border-t border-border">
        <div className="min-w-0 flex-1 overflow-hidden">
          <ForbiddenPrayerNotice
            forbiddenPrayer={forbiddenPrayer}
            timeFormat={timeFormat}
            compact
          />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className={`text-caption text-text-muted ${TIME_COL_CLASS}`}>Start</span>
          <span className={`text-caption text-gold/60 ${TIME_COL_CLASS}`}>Jamaat</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PrayerTimesPanel);
