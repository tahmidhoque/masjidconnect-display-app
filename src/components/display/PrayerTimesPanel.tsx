/**
 * PrayerTimesPanel
 *
 * Displays today's prayer times in a vertical list.
 * Highlights the current/next prayer. Uses the usePrayerTimes hook.
 *
 * During Ramadan mode, shows:
 *  - An Imsak row before Fajr (informational only, never highlighted)
 *  - "Iftar" label next to Maghrib
 *
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React from 'react';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';

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
}

const PrayerTimesPanel: React.FC<PrayerTimesPanelProps> = ({
  isRamadan = false,
  imsakTime = null,
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
          const isCurrent = prayer.isCurrent;
          const ramadanLabel = isRamadan ? RAMADAN_LABELS[prayer.name] : undefined;

          return (
            <React.Fragment key={prayer.name}>
              {/* Imsak row — rendered immediately before Fajr */}
              {showImsak && prayer.name === 'Fajr' && (
                <div
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-transparent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Crescent indicator */}
                    <span className="w-2 h-2 rounded-full shrink-0 bg-gold/40" />
                    <span className="text-body font-medium text-gold/70 italic">
                      Imsak
                    </span>
                    <span className="text-xs text-gold/50 font-normal italic">
                      Suhoor ends
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-body tabular-nums text-gold/70">
                      {imsakTime}
                    </span>
                    {/* Spacer to align with Jamaat column width */}
                    <span className="text-body tabular-nums opacity-0 select-none" aria-hidden>
                      —
                    </span>
                  </div>
                </div>
              )}

              {/* Standard prayer row */}
              <div
                className={`
                  flex items-center justify-between px-3 py-1.5 rounded-lg
                  transition-colors duration-normal
                  ${isNext ? 'bg-emerald/15 border border-emerald/30' : ''}
                  ${isCurrent ? 'animate-subtle-pulse bg-gold/10 border border-gold/20' : ''}
                  ${!isNext && !isCurrent ? 'border border-transparent' : ''}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Indicator dot */}
                  <span
                    className={`
                      w-2 h-2 rounded-full shrink-0
                      ${isNext ? 'bg-emerald' : isCurrent ? 'bg-gold' : 'bg-text-muted/30'}
                    `}
                  />
                  <span className={`text-body font-medium ${isNext ? 'text-emerald-light' : isCurrent ? 'text-gold' : 'text-text-primary'}`}>
                    {prayer.name}
                  </span>

                  {/* Ramadan contextual label (e.g. "Iftar") */}
                  {ramadanLabel && (
                    <span className="text-xs text-gold/60 font-normal italic">
                      {ramadanLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Adhan time */}
                  <span className={`text-body tabular-nums ${isNext ? 'text-emerald-light' : 'text-text-secondary'}`}>
                    {prayer.displayTime || '—'}
                  </span>

                  {/* Jamaat time (if available) */}
                  {prayer.displayJamaat && (
                    <span className="text-body tabular-nums text-gold/80">
                      {prayer.displayJamaat}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Legend — right-aligned to sit under the time columns */}
      <div className="shrink-0 flex items-center justify-end gap-4 mt-1 pt-1 border-t border-border">
        <span className="text-caption text-text-muted">Start</span>
        <span className="text-caption text-gold/60">Jamaat</span>
      </div>
    </div>
  );
};

export default React.memo(PrayerTimesPanel);
