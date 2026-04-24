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
 * Start/Jamaat header row so layout does not shift.
 *
 * 12h format: time shown as "5:39" with small "PM" subtext so alignment matches 24h.
 *
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React from 'react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import ForbiddenPrayerNotice from './ForbiddenPrayerNotice';
import type { CurrentForbiddenState } from '../../utils/forbiddenPrayerTimes';
import { getTimeDisplayParts } from '../../utils/dateUtils';
import type { TimeFormat } from '../../api/models';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings } from '../../store/slices/contentSlice';
import { prayerRowNameToTerminologyKey, resolveTerminology } from '../../utils/prayerTerminology';

interface PrayerTimesPanelProps {
  /** Whether Ramadan mode is active — shows Iftar annotation on Maghrib */
  isRamadan?: boolean;
  /**
   * Imsak time in HH:mm (same as other prayers) so the panel formats it with
   * getTimeDisplayParts and shows am/pm as subtext like the rest.
   */
  imsakTime?: string | null;
  /** When true, show Imsak row before Fajr. From displaySettings.showImsak. */
  showImsak?: boolean;
  /** When set, show makruh notice in the header row (from usePrayerTimes). */
  forbiddenPrayer?: CurrentForbiddenState | null;
  /** Time format for the forbidden notice endsAt (from store). */
  timeFormat?: TimeFormat;
  /** When true (portrait), use tighter spacing; when false, add more space below header row. */
  compact?: boolean;
  /** When true, show Tomorrow's Jamaat column after Jamaat. From displaySettings.showTomorrowJamaat. */
  showTomorrowJamaat?: boolean;
  /** Tomorrow's jamaat times by prayer name. Required when showTomorrowJamaat is true. */
  tomorrowsJamaats?: TomorrowsJamaatsMap;
}

/** Time column cell class. Width is owned by the parent grid template
 *  (rowGridClass below) so columns stay aligned regardless of font size.
 *  Default is right-aligned; portrait + 12h uses the LEFT-aligned variant
 *  (TIME_COL_CLASS_LEFT) to keep the whole section visually anchored left
 *  when the am/pm suffix would otherwise add visual weight on the right. */
const TIME_COL_CLASS = 'block text-right tabular-nums';
const TIME_COL_CLASS_LEFT = 'block text-left tabular-nums';

/** Renders time as main (e.g. "5:39") with optional small am/pm subtext.
 *  The wrapping column controls horizontal alignment via TIME_COL_CLASS{_LEFT}. */
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
        <span className="text-caption opacity-90 font-normal ml-0.5 align-baseline text-[0.9em]">{period}</span>
      )}
    </span>
  );
};

const PrayerTimesPanel: React.FC<PrayerTimesPanelProps> = ({
  isRamadan = false,
  imsakTime = null,
  showImsak = false,
  forbiddenPrayer = null,
  timeFormat = '12h',
  compact = false,
  showTomorrowJamaat = false,
  tomorrowsJamaats = null,
}) => {
  const { todaysPrayerTimes } = usePrayerTimesContext();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  const adhanLabel = resolveTerminology(terminology, 'adhan', 'Start');
  const jamaatLabel = resolveTerminology(terminology, 'jamaat', 'Jamaat');
  const suhoorLabel = resolveTerminology(terminology, 'suhoor', 'Suhoor');
  const iftarLabel = resolveTerminology(terminology, 'iftar', 'Iftar');
  // Used as a tiny subtext label under the Tomorrow column whenever the
  // prayer type of the tomorrow value differs from today's row label —
  // clarifies that 13:15 isn't Zuhr (today Mon–Thu, tomorrow Fri) or that
  // 13:30 isn't another Jumuah (today Fri, tomorrow Sat). Resolved through
  // terminology so customised masjid labels are honoured.
  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const zuhrLabel = resolveTerminology(terminology, 'zuhr', 'Zuhr');

  if (!todaysPrayerTimes || todaysPrayerTimes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full animate-shimmer rounded-xl">
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

  const showImsakRow = showImsak && !!imsakTime;
  const showTomorrowCol = showTomorrowJamaat && !!tomorrowsJamaats;
  const rowGridClass = showTomorrowCol
    ? 'grid grid-cols-[1fr_7rem_8rem_7rem] gap-x-4 items-center'
    : 'grid grid-cols-[1fr_7.5rem_8.5rem] gap-x-4 items-center';

  // Portrait + 12h: left-align time columns so the whole section reads as
  // anchored to the left edge. All other combinations keep the default
  // right-aligned columns.
  const timeColClass =
    compact && timeFormat === '12h' ? TIME_COL_CLASS_LEFT : TIME_COL_CLASS;

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 overflow-hidden px-4 ${
        compact ? 'py-3' : 'pt-4 pb-1'
      }`}
    >
      {/* Header row — column labels above data; border below separates from prayer rows */}
      <div
        className={`${rowGridClass} shrink-0 gap-2 px-3 border-b border-white/10 ${
          compact ? 'pb-2 mb-1' : 'pb-2 mb-4'
        }`}
      >
        <div className="min-w-0 overflow-hidden">
          <ForbiddenPrayerNotice
            forbiddenPrayer={forbiddenPrayer}
            timeFormat={timeFormat}
            compact
          />
        </div>
        <span className={`text-prayer-col-label text-text-secondary ${timeColClass}`}>{adhanLabel}</span>
        <span className={`text-prayer-col-label text-gold/85 ${timeColClass}`}>{jamaatLabel}</span>
        {showTomorrowCol && (
          <span className={`text-prayer-col-label text-gold/75 ${timeColClass}`}>{`Tomorrow's ${jamaatLabel}`}</span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-0.5 justify-start">
        {todaysPrayerTimes.map((prayer) => {
          const isNext = prayer.isNext;
          const ramadanLabel = isRamadan && prayer.name === 'Maghrib' ? iftarLabel : undefined;

          return (
            <React.Fragment key={prayer.name}>
              {/* Imsak row — rendered immediately before Fajr */}
              {showImsakRow && prayer.name === 'Fajr' && (
                <div className={`${rowGridClass} px-3 py-1.5 rounded-lg`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-prayer font-medium text-gold/70 italic">Imsak</span>
                    <span className="text-caption text-gold/70 font-normal italic">{`${suhoorLabel} ends`}</span>
                  </div>
                  {showTomorrowCol ? (
                    <>
                      <span className={timeColClass}>
                        <TimeWithPeriod
                          timeString={imsakTime ?? ''}
                          timeFormat={timeFormat}
                          className="text-prayer text-gold/70"
                        />
                      </span>
                      <span className={timeColClass}>—</span>
                      <span className={timeColClass}>—</span>
                    </>
                  ) : (
                    <div className="col-span-2 flex justify-center">
                      <TimeWithPeriod
                        timeString={imsakTime ?? ''}
                        timeFormat={timeFormat}
                        className="text-prayer text-gold/70"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Standard prayer row */}
              <div
                className={`
                  ${rowGridClass} px-3 py-1.5 rounded-lg transition-colors duration-normal
                  ${isNext ? 'bg-emerald/20 ring-1 ring-inset ring-emerald/30' : ''}
                `}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-prayer-name ${isNext ? 'text-emerald-light' : 'text-text-primary'}`}>
                    {(() => {
                      // Friday Zuhr slot is replaced by Jumuah upstream; relabel
                      // the row so users don't see "Zuhr" with Jumuah times.
                      if (prayer.isJumuah) {
                        return resolveTerminology(terminology, 'jummah', 'Jumuah');
                      }
                      const key = prayerRowNameToTerminologyKey(prayer.name);
                      return key ? resolveTerminology(terminology, key, prayer.name) : prayer.name;
                    })()}
                  </span>
                  {ramadanLabel && (
                    <span className="text-caption text-gold/75 font-normal italic">{ramadanLabel}</span>
                  )}
                </div>

                {prayer.jamaat ? (
                  <>
                    <span className={timeColClass}>
                      <TimeWithPeriod
                        timeString={prayer.time}
                        timeFormat={timeFormat}
                        className={`text-prayer-time-adhan ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}
                      />
                    </span>
                    <span className={timeColClass}>
                      <TimeWithPeriod
                        timeString={prayer.jamaat}
                        timeFormat={timeFormat}
                        className={`text-prayer-time-jamaat ${isNext ? 'text-emerald-light' : 'text-gold'}`}
                      />
                    </span>
                    {showTomorrowCol && (() => {
                      const tomorrowEntry = tomorrowsJamaats?.[prayer.name];
                      const tomorrowJamaat = tomorrowEntry?.jamaat ?? '';
                      const todayIsJumuah = prayer.isJumuah === true;
                      const tomorrowIsJumuah = tomorrowEntry?.isJumuah === true;
                      // Show a small subtext only when the tomorrow value's
                      // prayer type differs from today's row label, so users
                      // can see at a glance what tomorrow's time is for.
                      const mismatchLabel = !tomorrowJamaat
                        ? null
                        : tomorrowIsJumuah && !todayIsJumuah
                          ? jummahLabel
                          : todayIsJumuah && !tomorrowIsJumuah
                            ? zuhrLabel
                            : null;
                      return (
                        <span className={`${timeColClass} flex flex-col items-end`}>
                          <TimeWithPeriod
                            timeString={tomorrowJamaat}
                            timeFormat={timeFormat}
                            className="text-prayer-time-tomorrow text-gold/75"
                          />
                          {mismatchLabel ? (
                            <span className="text-caption text-text-muted/80 font-normal leading-tight mt-0.5">
                              {mismatchLabel}
                            </span>
                          ) : null}
                        </span>
                      );
                    })()}
                  </>
                ) : showTomorrowCol ? (
                  <>
                    <span className={timeColClass}>
                      <TimeWithPeriod
                        timeString={prayer.time}
                        timeFormat={timeFormat}
                        className={`text-prayer-time-adhan ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}
                      />
                    </span>
                    <span className={timeColClass}>—</span>
                    <span className={timeColClass}>—</span>
                  </>
                ) : (
                  <div className="col-span-2 flex justify-center">
                    <TimeWithPeriod
                      timeString={prayer.time}
                      timeFormat={timeFormat}
                      className={`text-prayer-time-adhan ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}
                    />
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(PrayerTimesPanel);
