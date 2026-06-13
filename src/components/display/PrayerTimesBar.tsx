/**
 * PrayerTimesBar
 *
 * Unified prayer cue tiles + clock + optional countdown. Renders as a horizontal
 * landscape strip or a vertical sidebar column depending on `variant`.
 */

import React, { useMemo } from 'react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import useMasjidTime from '../../hooks/useMasjidTime';
import { calculateApproximateHijriDate, getTimeDisplayParts } from '../../utils/dateUtils';
import type { TimeFormat } from '../../api/models';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings } from '../../store/slices/contentSlice';
import { resolveTerminology } from '../../utils/prayerTerminology';
import {
  resolveTomorrowJamaatMode,
  tomorrowJamaatModeUsesColumn,
  type TomorrowJamaatDisplayMode,
} from '../../utils/tomorrowJamaatDisplay';
import ForbiddenPrayerNotice from './ForbiddenPrayerNotice';
import type { CurrentForbiddenState } from '../../utils/forbiddenPrayerTimes';
import {
  PrayerCueTile,
  PrayerStripClockBlock,
  PrayerStripTileGrid,
  resolveStripPrayerDisplayName,
  TimeWithPeriod,
} from './prayerStripTiles';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type PrayerTimesBarVariant = 'strip' | 'sidebar';

export interface PrayerTimesBarProps {
  variant?: PrayerTimesBarVariant;
  /** Prayer-only stack — expand strip to use remaining vertical space. */
  fillHeight?: boolean;
  hideClock?: boolean;
  masjidName?: string | null;
  isRamadan?: boolean;
  imsakTime?: string | null;
  showImsak?: boolean;
  forbiddenPrayer?: CurrentForbiddenState | null;
  timeFormat?: TimeFormat;
  hijriDateAdjustment?: number;
  showTomorrowJamaat?: boolean;
  tomorrowsJamaats?: TomorrowsJamaatsMap;
  tomorrowJamaatMode?: TomorrowJamaatDisplayMode;
  showDate?: boolean;
  showHijriDate?: boolean;
  showMasjidName?: boolean;
  countdownSlot?: React.ReactNode;
  clockPosition?: 'left' | 'right';
}

const PrayerTimesBar: React.FC<PrayerTimesBarProps> = ({
  variant = 'strip',
  fillHeight = false,
  hideClock = false,
  masjidName = null,
  isRamadan = false,
  imsakTime = null,
  showImsak = false,
  forbiddenPrayer = null,
  timeFormat = '12h',
  hijriDateAdjustment = 0,
  showTomorrowJamaat = false,
  tomorrowsJamaats = null,
  tomorrowJamaatMode: tomorrowJamaatModeProp,
  showDate = true,
  showHijriDate = true,
  showMasjidName = false,
  countdownSlot = null,
  clockPosition = 'left',
}) => {
  const isSidebar = variant === 'sidebar';
  const now = useMasjidTime();
  const { todaysPrayerTimes } = usePrayerTimesContext();
  const displaySettings = useAppSelector(selectDisplaySettings);
  const terminology = displaySettings?.terminology;
  const tomorrowJamaatMode =
    tomorrowJamaatModeProp ??
    resolveTomorrowJamaatMode(displaySettings ?? undefined);
  const nowMin = now.hour() * 60 + now.minute() + now.second() / 60;

  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const zuhrLabel = resolveTerminology(terminology, 'zuhr', 'Zuhr');
  const iftarLabel = resolveTerminology(terminology, 'iftar', 'Iftar');

  const timeStr24h = now.format('HH:mm');
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(timeStr24h, timeFormat);
  const dayNameShort = DAYS_SHORT[now.day()];
  const dayNameLong = DAYS_LONG[now.day()];
  const dateStrShort = `${now.date()} ${MONTHS_SHORT[now.month()]} ${now.year()}`;
  const dateStrLong = `${now.date()} ${MONTHS_LONG[now.month()]} ${now.year()}`;
  const hijriDate = useMemo(
    () => calculateApproximateHijriDate(undefined, hijriDateAdjustment),
    [now.date(), hijriDateAdjustment],
  );

  const showTomorrowCol =
    (showTomorrowJamaat || tomorrowJamaatModeUsesColumn(tomorrowJamaatMode)) &&
    !!tomorrowsJamaats;
  const showImsakRow = showImsak && !!imsakTime;

  if (!todaysPrayerTimes || todaysPrayerTimes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center animate-shimmer rounded-lg ${
          isSidebar ? 'h-full min-h-[12rem]' : 'h-full'
        }`}
      >
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

  if (isSidebar) {
    return (
      <div className="landscape-prayer-strip prayer-sidebar flex flex-col h-full min-h-0 rounded-lg overflow-hidden">
        {showImsakRow && imsakTime && (
          <div className="shrink-0 flex items-center justify-center py-2 px-3 bg-surface/30">
            <span className="text-prayer-strip-label text-gold/90 uppercase tracking-wider font-bold">
              Imsak{' '}
              <TimeWithPeriod timeString={imsakTime} timeFormat={timeFormat} className="tabular-nums" />
            </span>
          </div>
        )}

        {!hideClock && (
          <div className="shrink-0 min-h-0 px-2 py-1.5 border-b border-white/10">
            {showMasjidName && masjidName?.trim() && (
              <p className="text-prayer-strip-label font-bold text-gold/90 text-center truncate mb-1.5 px-1">
                {masjidName.trim()}
              </p>
            )}
            <PrayerStripClockBlock
              timeMain={timeMain}
              timePeriod={timePeriod}
              dayName={showDate ? dayNameLong : ''}
              dateStr={showDate ? dateStrLong : ''}
              hijriDate={showHijriDate ? hijriDate : ''}
              align="center"
              ramadanLabel={isRamadan && showHijriDate ? 'Ramadan Mubarak' : null}
            />
          </div>
        )}

        {forbiddenPrayer && (
          <div className="shrink-0 px-2 pt-1.5">
            <ForbiddenPrayerNotice
              forbiddenPrayer={forbiddenPrayer}
              timeFormat={timeFormat}
              compact
            />
          </div>
        )}

        <PrayerStripTileGrid
          orientation="vertical"
          tileCount={todaysPrayerTimes.length}
          columnCount={2}
        >
          {todaysPrayerTimes.map((prayer) => (
            <PrayerCueTile
              key={prayer.name}
              prayer={prayer}
              displayName={resolveStripPrayerDisplayName(prayer, terminology)}
              timeFormat={timeFormat}
              orientation="vertical"
              isRamadan={isRamadan}
              imsakTime={imsakTime}
              showImsakInCard={showImsak && !!imsakTime && prayer.name === 'Fajr' && !showImsakRow}
              showTomorrowCol={showTomorrowCol}
              tomorrowsJamaats={tomorrowsJamaats}
              tomorrowJamaatMode={tomorrowJamaatMode}
              displaySettings={displaySettings ?? null}
              nowMin={nowMin}
              jummahLabel={jummahLabel}
              zuhrLabel={zuhrLabel}
              iftarLabel={iftarLabel}
            />
          ))}
        </PrayerStripTileGrid>

        {countdownSlot ? (
          <div className="prayer-sidebar-countdown shrink-0 w-full min-w-0 py-1.5 px-2 border-t border-white/10">
            {countdownSlot}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`landscape-prayer-strip flex flex-col w-full min-h-0 rounded-lg ${
        fillHeight ? 'flex-1 h-full prayer-strip--focus' : ''
      }`}
    >
      {showImsakRow && imsakTime && (
        <div className="shrink-0 flex items-center justify-center py-2 px-4 bg-surface/30">
          <span className="text-prayer-strip-label text-gold/90 uppercase tracking-wider font-bold">
            Imsak{' '}
            <TimeWithPeriod timeString={imsakTime} timeFormat={timeFormat} className="tabular-nums" />
          </span>
        </div>
      )}

      <div
        className={`flex items-stretch flex-1 min-h-0 ${
          fillHeight ? 'justify-center' : ''
        } ${clockPosition === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {!hideClock && (
          <div className="shrink-0 w-[15%] min-w-[8rem] px-4 py-3">
            <PrayerStripClockBlock
              timeMain={timeMain}
              timePeriod={timePeriod}
              dayName={dayNameShort}
              dateStr={dateStrShort}
              hijriDate={hijriDate}
              align="start"
            />
          </div>
        )}

        <PrayerStripTileGrid orientation="horizontal" tileCount={todaysPrayerTimes.length}>
          {todaysPrayerTimes.map((prayer) => (
            <PrayerCueTile
              key={prayer.name}
              prayer={prayer}
              displayName={resolveStripPrayerDisplayName(prayer, terminology)}
              timeFormat={timeFormat}
              orientation="horizontal"
              isRamadan={isRamadan}
              imsakTime={imsakTime}
              showImsakInCard={showImsak && !!imsakTime && prayer.name === 'Fajr' && !showImsakRow}
              showTomorrowCol={showTomorrowCol}
              tomorrowsJamaats={tomorrowsJamaats}
              tomorrowJamaatMode={tomorrowJamaatMode}
              displaySettings={displaySettings ?? null}
              nowMin={nowMin}
              jummahLabel={jummahLabel}
              zuhrLabel={zuhrLabel}
              iftarLabel={iftarLabel}
            />
          ))}
        </PrayerStripTileGrid>
      </div>

      {countdownSlot ? (
        <div className="shrink-0 w-full min-w-0 py-2 px-4">{countdownSlot}</div>
      ) : null}
    </div>
  );
};

export default React.memo(PrayerTimesBar);
