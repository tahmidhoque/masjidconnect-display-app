/**
 * PrayerTimesPanel
 *
 * Displays today's prayer times in a vertical list.
 * Highlights the current/next prayer. Uses the usePrayerTimes hook.
 *
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React from 'react';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';

const PrayerTimesPanel: React.FC = () => {
  const { todaysPrayerTimes, nextPrayer, currentPrayer } = usePrayerTimes();

  if (!todaysPrayerTimes || todaysPrayerTimes.length === 0) {
    return (
      <div className="panel flex items-center justify-center h-full animate-shimmer rounded-xl">
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-1 h-full overflow-hidden">
      <h2 className="text-subheading text-gold font-semibold mb-2">Prayer Times</h2>

      <div className="flex flex-col gap-1.5">
        {todaysPrayerTimes.map((prayer) => {
          const isNext = prayer.isNext;
          const isCurrent = prayer.isCurrent;

          return (
            <div
              key={prayer.name}
              className={`
                flex items-center justify-between px-4 py-2.5 rounded-lg
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
          );
        })}
      </div>

      {/* Legend — right-aligned to sit under the time columns */}
      <div className="flex items-center justify-end gap-4 mt-2 pt-2 border-t border-border">
        <span className="text-caption text-text-muted">Adhan</span>
        <span className="text-caption text-gold/60">Jamaat</span>
      </div>
    </div>
  );
};

export default React.memo(PrayerTimesPanel);
