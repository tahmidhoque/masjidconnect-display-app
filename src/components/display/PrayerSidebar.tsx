/**
 * PrayerSidebar
 *
 * Vertical column of strip cue tiles — same tiles as the landscape prayer strip,
 * oriented top-to-bottom with a clock block above and countdown below.
 *
 * GPU-safe: no backdrop-filter, no heavy box-shadow.
 */

import React, { useMemo } from 'react';
import useMasjidTime from '../../hooks/useMasjidTime';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import type { TimeFormat } from '../../api/models';
import { calculateApproximateHijriDate, getTimeDisplayParts } from '../../utils/dateUtils';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings } from '../../store/slices/contentSlice';
import { resolveTerminology } from '../../utils/prayerTerminology';
import ForbiddenPrayerNotice from './ForbiddenPrayerNotice';
import type { CurrentForbiddenState } from '../../utils/forbiddenPrayerTimes';
import {
  PrayerCueTile,
  PrayerStripClockBlock,
  PrayerStripTileGrid,
  resolveStripPrayerDisplayName,
  TimeWithPeriod,
} from './prayerStripTiles';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface PrayerSidebarProps {
  isRamadan?: boolean;
  imsakTime?: string | null;
  showImsak?: boolean;
  forbiddenPrayer?: CurrentForbiddenState | null;
  timeFormat?: TimeFormat;
  hijriDateAdjustment?: number;
  showTomorrowJamaat?: boolean;
  tomorrowsJamaats?: TomorrowsJamaatsMap;
  countdownSlot?: React.ReactNode;
}

const PrayerSidebar: React.FC<PrayerSidebarProps> = ({
  isRamadan = false,
  imsakTime = null,
  showImsak = false,
  forbiddenPrayer = null,
  timeFormat = '12h',
  hijriDateAdjustment = 0,
  showTomorrowJamaat = false,
  tomorrowsJamaats = null,
  countdownSlot = null,
}) => {
  const now = useMasjidTime();
  const { todaysPrayerTimes } = usePrayerTimesContext();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const zuhrLabel = resolveTerminology(terminology, 'zuhr', 'Zuhr');
  const iftarLabel = resolveTerminology(terminology, 'iftar', 'Iftar');

  const timeStr24h = now.format('HH:mm');
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(timeStr24h, timeFormat);
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
      <div className="flex items-center justify-center h-full min-h-[12rem] animate-shimmer rounded-lg">
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

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

      <div className="shrink-0 px-2.5 py-2 border-b border-white/10">
        <PrayerStripClockBlock
          timeMain={timeMain}
          timePeriod={timePeriod}
          dayName={dayName}
          dateStr={dateStr}
          hijriDate={hijriDate}
          align="center"
          ramadanLabel={isRamadan ? 'Ramadan Mubarak' : null}
        />
      </div>

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
            jummahLabel={jummahLabel}
            zuhrLabel={zuhrLabel}
            iftarLabel={iftarLabel}
          />
        ))}
      </PrayerStripTileGrid>

      {countdownSlot ? (
        <div className="prayer-sidebar-countdown shrink-0 w-full min-w-0 py-2 px-3 border-t border-white/10">
          {countdownSlot}
        </div>
      ) : null}
    </div>
  );
};

export default React.memo(PrayerSidebar);
