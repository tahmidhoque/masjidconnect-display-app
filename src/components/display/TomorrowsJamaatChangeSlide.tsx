/**
 * TomorrowsJamaatChangeSlide
 *
 * Carousel-band slide shown alongside SilentPhonesGraphic during the
 * `jamaat-soon` window. Announces the next day's jamaat time when it
 * differs from today's — gated by JamaatSoonSlot to Zuhr / Asr / Isha
 * only.
 *
 * `landscapeSplit` — landscape: 2×1 grid (calendar motif | copy) so the
 * motif stays large while the time remains the dominant element in the
 * carousel band. Portrait stacks centrally.
 *
 * Pure presentational — no state, no effects, no side effects.
 */

import React from 'react';
import { useAppSelector } from '../../store/hooks';
import {
  selectDisplaySettings,
  selectTimeFormat,
} from '../../store/slices/contentSlice';
import {
  prayerRowNameToTerminologyKey,
  resolveTerminology,
} from '../../utils/prayerTerminology';
import { getTimeDisplayParts } from '../../utils/dateUtils';

export interface TomorrowsJamaatChangeSlideProps {
  /** Prayer name (Zuhr | Asr | Isha) — slot enforces eligibility. */
  prayerName: string;
  /** Tomorrow's jamaat time in HH:mm (24-hour). */
  tomorrowTime: string;
  /** Landscape: two-column row — calendar motif left, copy and time right. */
  landscapeSplit?: boolean;
}

/**
 * Inline calendar motif with a "tomorrow" indicator (next-day arrow).
 * Uses currentColor on the page chrome so it inherits text-gold/30 etc.,
 * with a gold accent on the active "tomorrow" day cell.
 */
const TomorrowCalendarMotif: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 200"
    className={className}
    aria-hidden="true"
  >
    {/* Calendar body */}
    <rect
      x="30"
      y="46"
      width="140"
      height="124"
      rx="12"
      ry="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
    />
    {/* Header band */}
    <rect
      x="30"
      y="46"
      width="140"
      height="30"
      rx="12"
      ry="12"
      fill="currentColor"
      opacity="0.18"
    />
    {/* Header divider */}
    <line
      x1="30"
      y1="76"
      x2="170"
      y2="76"
      stroke="currentColor"
      strokeWidth="4"
    />
    {/* Binder rings */}
    <line
      x1="62"
      y1="32"
      x2="62"
      y2="60"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
    />
    <line
      x1="138"
      y1="32"
      x2="138"
      y2="60"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
    />
    {/* Today cell (muted) */}
    <rect
      x="48"
      y="92"
      width="44"
      height="36"
      rx="4"
      ry="4"
      fill="currentColor"
      opacity="0.18"
    />
    {/* Tomorrow cell (gold accent) */}
    <rect
      x="108"
      y="92"
      width="44"
      height="36"
      rx="4"
      ry="4"
      fill="#E9C46A"
      opacity="0.85"
    />
    {/*
      Arrow from today → tomorrow.
      Drawn as a single straight horizontal shaft + chevron head so it reads
      unambiguously as direction (the previous arc looked like a smile).
      Sits below the cells, anchored at the same y so it tracks them visually.
    */}
    <line
      x1="60"
      y1="150"
      x2="138"
      y2="150"
      stroke="#E9C46A"
      strokeWidth="7"
      strokeLinecap="round"
    />
    <polyline
      points="124,138 142,150 124,162"
      fill="none"
      stroke="#E9C46A"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TomorrowsJamaatChangeSlide: React.FC<
  TomorrowsJamaatChangeSlideProps
> = ({ prayerName, tomorrowTime, landscapeSplit = false }) => {
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;
  const timeFormat = useAppSelector(selectTimeFormat);

  const jamaatLabel = resolveTerminology(terminology, 'jamaat', 'Jamaat');
  const terminologyKey = prayerRowNameToTerminologyKey(prayerName);
  const displayPrayerName = terminologyKey
    ? resolveTerminology(terminology, terminologyKey, prayerName)
    : prayerName;

  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(
    tomorrowTime,
    timeFormat,
  );

  if (landscapeSplit) {
    return (
      <div className="tomorrows-jamaat-change--split panel grid grid-cols-[1.12fr_1fr] h-full min-h-0 max-h-full overflow-hidden gap-x-5 items-center">
        <div className="flex items-center justify-center min-h-0 min-w-0 h-full py-1">
          <div className="flex items-center justify-center h-full max-h-[16rem] w-full max-w-[16rem] text-text-primary">
            <TomorrowCalendarMotif className="h-full w-full max-h-[16rem] max-w-[16rem] drop-shadow-lg object-contain" />
          </div>
        </div>
        <div className="flex flex-col justify-center gap-y-3 min-w-0 min-h-0 py-1 text-left items-start">
          <span className="badge badge-gold text-caption uppercase tracking-widest shrink-0">
            From tomorrow
          </span>
          <h2 className="text-text-primary font-bold leading-snug tomorrows-jamaat-change-split-title">
            {displayPrayerName} {jamaatLabel} will be at
          </h2>
          <span className="inline-flex items-baseline gap-x-2 text-gold font-extrabold tabular-nums leading-none tomorrows-jamaat-change-split-time">
            <span>{timeMain}</span>
            {timePeriod ? (
              <span className="tomorrows-jamaat-change-split-period uppercase font-bold">
                {timePeriod}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col items-center justify-center h-full min-h-0 max-h-full overflow-hidden gap-y-8 text-center">
      <span className="badge badge-gold text-caption uppercase tracking-widest shrink-0">
        From tomorrow
      </span>
      <div className="flex flex-col items-center gap-y-4 max-w-lg w-full min-w-0">
        <h2 className="text-heading text-text-primary font-bold leading-snug">
          {displayPrayerName} {jamaatLabel} will be at
        </h2>
        <span className="inline-flex items-baseline gap-x-3 text-gold font-extrabold tabular-nums leading-none tomorrows-jamaat-change-time">
          <span>{timeMain}</span>
          {timePeriod ? (
            <span className="tomorrows-jamaat-change-period uppercase font-bold">
              {timePeriod}
            </span>
          ) : null}
        </span>
      </div>
      <p className="text-body text-text-secondary leading-relaxed font-semibold max-w-md">
        Please make a note of the new time
      </p>
    </div>
  );
};

export default React.memo(TomorrowsJamaatChangeSlide);
