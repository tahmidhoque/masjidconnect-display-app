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
   * Imsak time in HH:mm (same as other prayers) so the panel formats it with
   * getTimeDisplayParts and shows am/pm as subtext like the rest.
   */
  imsakTime?: string | null;
  /** When set, show makruh notice in the footer (from usePrayerTimes). */
  forbiddenPrayer?: CurrentForbiddenState | null;
  /** Time format for the forbidden notice endsAt (from store). */
  timeFormat?: TimeFormat;
  /** When true (portrait), use tighter spacing; when false (landscape), add more space above legend so separator line sits lower. */
  compact?: boolean;
}

/** Fixed width for each time column so Start/Jamaat align vertically. */
const TIME_COL_CLASS = 'block w-[7rem] text-right tabular-nums';
/** Grid: prayer name | Start | Jamaat — same structure for every row so columns align. */
const ROW_GRID_CLASS = 'grid grid-cols-[1fr_7rem_7rem] gap-x-4 items-center';

/** Renders time as main (e.g. "5:39") with optional small am/pm subtext. Use inside a right-aligned column. */
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
        <span className="text-caption opacity-80 font-normal ml-0.5 align-baseline text-[0.85em]">{period}</span>
      )}
    </span>
  );
};

const PrayerTimesPanel: React.FC<PrayerTimesPanelProps> = ({
  isRamadan = false,
  imsakTime = null,
  forbiddenPrayer = null,
  timeFormat = '12h',
  compact = false,
}) => {
  const { todaysPrayerTimes } = usePrayerTimes();

  if (!todaysPrayerTimes || todaysPrayerTimes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full animate-shimmer rounded-xl">
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

  const showImsak = isRamadan && !!imsakTime;

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 overflow-hidden px-4 ${
        compact ? 'py-3' : 'pt-4 pb-1'
      }`}
    >
      <div className="flex-1 min-h-0 flex flex-col gap-0.5 justify-center">
        {todaysPrayerTimes.map((prayer) => {
          const isNext = prayer.isNext;
          const ramadanLabel = isRamadan ? RAMADAN_LABELS[prayer.name] : undefined;

          return (
            <React.Fragment key={prayer.name}>
              {/* Imsak row — rendered immediately before Fajr */}
              {showImsak && prayer.name === 'Fajr' && (
                <div className={`${ROW_GRID_CLASS} px-3 py-1.5 rounded-lg`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-gold/40" />
                    <span className="text-prayer font-medium text-gold/70 italic">Imsak</span>
                    <span className="text-caption text-gold/50 font-normal italic">Suhoor ends</span>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <TimeWithPeriod
                      timeString={imsakTime ?? ''}
                      timeFormat={timeFormat}
                      className="text-prayer text-gold/70"
                    />
                  </div>
                </div>
              )}

              {/* Standard prayer row */}
              <div
                className={`
                  ${ROW_GRID_CLASS} px-3 py-1.5 rounded-lg
                  transition-colors duration-normal
                  ${isNext ? 'bg-emerald/15' : ''}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`
                      w-2 h-2 rounded-full shrink-0
                      ${isNext ? 'bg-emerald' : 'bg-text-muted/30'}
                    `}
                  />
                  <span className={`text-prayer font-medium ${isNext ? 'text-emerald-light' : 'text-text-primary'}`}>
                    {prayer.name}
                  </span>
                  {ramadanLabel && (
                    <span className="text-caption text-gold/60 font-normal italic">{ramadanLabel}</span>
                  )}
                </div>

                {prayer.jamaat ? (
                  <>
                    <span className={TIME_COL_CLASS}>
                      <TimeWithPeriod
                        timeString={prayer.time}
                        timeFormat={timeFormat}
                        className={`text-prayer ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}
                      />
                    </span>
                    <span className={TIME_COL_CLASS}>
                      <TimeWithPeriod
                        timeString={prayer.jamaat}
                        timeFormat={timeFormat}
                        className="text-prayer text-gold/80"
                      />
                    </span>
                  </>
                ) : (
                  <div className="col-span-2 flex justify-center">
                    <TimeWithPeriod
                      timeString={prayer.time}
                      timeFormat={timeFormat}
                      className={`text-prayer ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}
                    />
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Legend — distinct block so row highlight never bleeds; border sits below last row */}
      <div
        className={`${ROW_GRID_CLASS} shrink-0 gap-2 px-3 pt-2 border-t border-white/10 ${
          compact ? 'mt-0.5' : 'mt-4'
        }`}
      >
        <div className="min-w-0 overflow-hidden">
          <ForbiddenPrayerNotice
            forbiddenPrayer={forbiddenPrayer}
            timeFormat={timeFormat}
            compact
          />
        </div>
        <span className={`text-subheading text-text-muted font-medium ${TIME_COL_CLASS}`}>Start</span>
        <span className={`text-subheading text-gold/80 font-medium ${TIME_COL_CLASS}`}>Jamaat</span>
      </div>
    </div>
  );
};

export default React.memo(PrayerTimesPanel);
