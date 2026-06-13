/**
 * Shared strip tile primitives — used by PrayerStrip (horizontal row) and
 * PrayerSidebar (vertical column). Same cue-card look, two orientations.
 */

import React from 'react';
import { Sunrise } from 'lucide-react';
import type { TimeFormat } from '../../api/models';
import type { DisplaySettings } from '../../api/models';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import { getTimeDisplayParts } from '../../utils/dateUtils';
import {
  resolvePrayerJamaatDisplay,
  type TomorrowJamaatDisplayMode,
} from '../../utils/tomorrowJamaatDisplay';
import {
  prayerRowNameToTerminologyKey,
  resolveTerminology,
  type TerminologyMap,
} from '../../utils/prayerTerminology';

export const STRIP_DISPLAY_NAMES: Record<string, string> = {
  Sunrise: 'Shuruq',
  Zuhr: 'Dhuhr',
};

export type StripTileOrientation = 'horizontal' | 'vertical';

export interface StripPrayerRow {
  name: string;
  time: string;
  jamaat?: string;
  isNext: boolean;
  isJumuah?: boolean;
}

export const TimeWithPeriod: React.FC<{
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

export function resolveStripPrayerDisplayName(
  prayer: Pick<StripPrayerRow, 'name' | 'isJumuah'>,
  terminology: TerminologyMap,
): string {
  if (prayer.isJumuah) {
    return resolveTerminology(terminology, 'jummah', 'Jumuah');
  }
  const fallback = STRIP_DISPLAY_NAMES[prayer.name] ?? prayer.name;
  const key = prayerRowNameToTerminologyKey(prayer.name);
  return key ? resolveTerminology(terminology, key, fallback) : fallback;
}

interface PrayerStripClockBlockProps {
  timeMain: string;
  timePeriod: string | null;
  dayName: string;
  dateStr: string;
  hijriDate: string;
  /** Centre-align for sidebar top block; left-align for strip side column. */
  align?: 'start' | 'center';
  ramadanLabel?: string | null;
}

export const PrayerStripClockBlock: React.FC<PrayerStripClockBlockProps> = ({
  timeMain,
  timePeriod,
  dayName,
  dateStr,
  hijriDate,
  align = 'start',
  ramadanLabel = null,
}) => {
  const alignClass = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <div className={`prayer-strip-clock-block flex flex-col justify-center shrink-0 ${alignClass}`}>
      <span className="text-prayer-strip-clock text-gold tabular-nums leading-tight">
        {timeMain}
        {timePeriod != null && (
          <span className="text-prayer-strip-jamaat font-normal text-gold/90 ml-0.5">
            {timePeriod}
          </span>
        )}
      </span>
      {(dayName || dateStr) && (
        <span className="text-prayer-strip-label text-text-secondary mt-1">
          {[dayName, dateStr].filter(Boolean).join(' ')}
        </span>
      )}
      {hijriDate ? (
        <span className="text-prayer-strip-jamaat text-text-muted mt-0.5">{hijriDate}</span>
      ) : null}
      {ramadanLabel && (
        <span className="text-prayer-strip-label text-gold/80 font-semibold mt-1">
          {ramadanLabel}
        </span>
      )}
    </div>
  );
};

interface PrayerCueTileProps {
  prayer: StripPrayerRow;
  displayName: string;
  timeFormat: TimeFormat;
  orientation: StripTileOrientation;
  isRamadan?: boolean;
  imsakTime?: string | null;
  showImsakInCard?: boolean;
  showTomorrowCol?: boolean;
  tomorrowsJamaats?: TomorrowsJamaatsMap | null;
  tomorrowJamaatMode?: TomorrowJamaatDisplayMode;
  displaySettings?: DisplaySettings | null;
  nowMin?: number;
  jummahLabel: string;
  zuhrLabel: string;
  iftarLabel: string;
}

export const PrayerCueTile: React.FC<PrayerCueTileProps> = ({
  prayer,
  displayName,
  timeFormat,
  orientation,
  isRamadan = false,
  imsakTime = null,
  showImsakInCard = false,
  showTomorrowCol = false,
  tomorrowsJamaats = null,
  tomorrowJamaatMode = 'off',
  displaySettings = null,
  nowMin = 0,
  jummahLabel,
  zuhrLabel,
  iftarLabel,
}) => {
  const isNext = prayer.isNext;
  const isSunrise = prayer.name === 'Sunrise';
  const ramadanLabel =
    isRamadan && prayer.name === 'Maghrib' ? iftarLabel : undefined;
  const resolvedJamaat = prayer.jamaat
    ? resolvePrayerJamaatDisplay({
        prayerName: prayer.name,
        todayJamaat: prayer.jamaat,
        todayIsJumuah: prayer.isJumuah,
        tomorrowsJamaats: tomorrowsJamaats ?? null,
        mode: tomorrowJamaatMode,
        displaySettings,
        nowMin,
        jummahLabel,
        zuhrLabel,
      })
    : null;
  const isRollForward = resolvedJamaat?.isRollForward === true;
  const tomorrowAbbrev = resolveTerminology(
    displaySettings?.terminology,
    'tomorrowAbbrev',
    'Tmw',
  );

  const sizeClass =
    orientation === 'horizontal'
      ? 'flex-1 min-w-0'
      : 'prayer-cue-tile--vertical min-h-0 min-w-0';

  const isVertical = orientation === 'vertical';
  const padClass = isVertical ? 'px-1 py-1' : 'px-2 py-1';

  return (
    <div
      className={`
        prayer-cue-tile ${sizeClass} ${padClass} flex flex-col items-center justify-center gap-0.5
        rounded-lg transition-colors duration-normal overflow-hidden
        ${isNext ? 'bg-emerald/15 border-2 border-emerald/40' : 'bg-surface/50 border border-border'}
        ${isRollForward && !isNext ? 'prayer-cue-tile--roll-forward' : ''}
      `}
    >
      <div className="flex items-center gap-1 flex-wrap justify-center max-w-full">
        <span
          className={`
            text-prayer-strip-label uppercase tracking-wider text-center
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
          text-prayer-strip-time tabular-nums mt-0.5 text-center leading-none
          ${isNext ? 'text-emerald-light' : 'text-text-primary'}
        `}
      >
        <TimeWithPeriod timeString={prayer.time} timeFormat={timeFormat} />
      </span>

      {isSunrise ? (
        <Sunrise
          className={`text-gold/70 mt-0.5 shrink-0 ${isVertical ? 'prayer-cue-tile-sunrise' : 'w-6 h-6'}`}
          aria-hidden
        />
      ) : prayer.jamaat && resolvedJamaat ? (
        <span
          className={`text-prayer-strip-jamaat-primary mt-0.5 tabular-nums text-center leading-none ${
            isNext
              ? 'text-emerald-light'
              : isRollForward
                ? 'text-prayer-time-roll-forward'
                : 'text-gold/90'
          }`}
        >
          <TimeWithPeriod
            timeString={resolvedJamaat.jamaatTime}
            timeFormat={timeFormat}
            className={isRollForward ? '' : 'text-gold font-semibold'}
          />
        </span>
      ) : null}

      {showImsakInCard && imsakTime && (
        <span className="text-prayer-strip-jamaat text-gold/80 mt-0.5 italic font-medium tabular-nums text-center leading-tight">
          Imsak <TimeWithPeriod timeString={imsakTime} timeFormat={timeFormat} />
        </span>
      )}

      {showTomorrowCol && (() => {
        const tomorrowEntry = tomorrowsJamaats?.[prayer.name];
        const tomorrowJamaat = tomorrowEntry?.jamaat;
        const todayIsJumuah = prayer.isJumuah === true;
        const tomorrowIsJumuah = tomorrowEntry?.isJumuah === true;
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
              <span className="inline-flex flex-nowrap items-baseline gap-x-0.5 whitespace-nowrap text-prayer-strip-jamaat text-text-muted tabular-nums max-w-full leading-tight">
                <span className="shrink-0">{tomorrowAbbrev}</span>
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
};

interface PrayerStripTileGridProps {
  orientation: StripTileOrientation;
  tileCount: number;
  /** Vertical sidebar only — number of tile columns (default 2). */
  columnCount?: number;
  children: React.ReactNode;
  className?: string;
}

export const PrayerStripTileGrid: React.FC<PrayerStripTileGridProps> = ({
  orientation,
  tileCount,
  columnCount = 2,
  children,
  className = '',
}) => {
  if (orientation === 'horizontal') {
    return (
      <div
        className={`prayer-strip-tiles prayer-strip-tiles--horizontal flex flex-1 gap-2 px-4 py-3 min-w-0 min-h-0 ${className}`}
      >
        {children}
      </div>
    );
  }

  const cols = Math.max(1, columnCount);
  const rows = Math.ceil(tileCount / cols);
  const colsClass = cols > 1 ? `prayer-strip-tiles--cols-${cols}` : '';

  return (
    <div
      className={`prayer-strip-tiles prayer-strip-tiles--vertical ${colsClass} flex-1 min-h-0 min-w-0 ${className}`}
      style={
        {
          '--tile-columns': cols,
          '--tile-rows': rows,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
};
