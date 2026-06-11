/**
 * PrayerSidebar
 *
 * Vertical 2-column grid of strip cue tiles with an optional compact strip clock
 * on top when no separate `header` layout block is present.
 *
 * GPU-safe: no backdrop-filter, no heavy box-shadow.
 */

import React from 'react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import type { TomorrowsJamaatsMap } from '../../hooks/usePrayerTimes';
import type { TimeFormat } from '../../api/models';
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
import useMasjidTime from '../../hooks/useMasjidTime';
import { calculateApproximateHijriDate, getTimeDisplayParts } from '../../utils/dateUtils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface PrayerSidebarProps {
  /** When true, omit the built-in strip clock (a `header` block is in the layout). */
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
  showDate?: boolean;
  showHijriDate?: boolean;
  showMasjidName?: boolean;
  countdownSlot?: React.ReactNode;
}

const PrayerSidebar: React.FC<PrayerSidebarProps> = ({
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
  showDate = true,
  showHijriDate = true,
  showMasjidName = false,
  countdownSlot = null,
}) => {
  const now = useMasjidTime();
  const { todaysPrayerTimes } = usePrayerTimesContext();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const zuhrLabel = resolveTerminology(terminology, 'zuhr', 'Zuhr');
  const iftarLabel = resolveTerminology(terminology, 'iftar', 'Iftar');

  const showTomorrowCol = showTomorrowJamaat && !!tomorrowsJamaats;
  const showImsakRow = showImsak && !!imsakTime;

  if (!todaysPrayerTimes || todaysPrayerTimes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[12rem] animate-shimmer rounded-lg">
        <p className="text-text-muted text-body">Loading prayer times…</p>
      </div>
    );
  }

  const stripClock = (() => {
    const timeStr24h = now.format('HH:mm');
    const { main: timeMain, period: timePeriod } = getTimeDisplayParts(timeStr24h, timeFormat);
    const dayName = DAYS[now.day()];
    const dateStr = `${now.date()} ${MONTHS[now.month()]} ${now.year()}`;
    const hijriDate = calculateApproximateHijriDate(undefined, hijriDateAdjustment);
    return (
      <div className="shrink-0 px-2.5 py-2 border-b border-white/10">
        {showMasjidName && masjidName?.trim() && (
          <p className="text-prayer-strip-label font-bold text-gold/90 text-center truncate mb-1.5 px-1">
            {masjidName.trim()}
          </p>
        )}
        <PrayerStripClockBlock
          timeMain={timeMain}
          timePeriod={timePeriod}
          dayName={showDate ? dayName : ''}
          dateStr={showDate ? dateStr : ''}
          hijriDate={showHijriDate ? hijriDate : ''}
          align="center"
          ramadanLabel={isRamadan && showHijriDate ? 'Ramadan Mubarak' : null}
        />
      </div>
    );
  })();

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

      {!hideClock && <div className="shrink-0 min-h-0">{stripClock}</div>}

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
