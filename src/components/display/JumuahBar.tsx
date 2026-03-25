/**
 * JumuahBar
 *
 * Portrait layout: compact bar between the prayer times panel and the countdown
 * showing the upcoming Friday Khutbah and Jamaat (same source as the landscape
 * prayer strip), whenever the API provides jummah times in the week data.
 *
 * Uses gold-tinted styling to draw attention without overwhelming the display.
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React, { useMemo } from 'react';
import type { TimeFormat } from '../../api/models';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import { formatTimeToDisplay } from '../../utils/dateUtils';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings } from '../../store/slices/contentSlice';
import { resolveTerminology } from '../../utils/prayerTerminology';

interface JumuahBarProps {
  /** When true (landscape), use tighter spacing */
  compact?: boolean;
  /** Matches screen display setting (12h / 24h). */
  timeFormat?: TimeFormat;
}

const JumuahBar: React.FC<JumuahBarProps> = ({
  compact = false,
  timeFormat = '12h',
}) => {
  const { upcomingJumuahJamaatRaw, upcomingJumuahKhutbahRaw } =
    usePrayerTimesContext();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  const jamaatDisplay = useMemo(
    () =>
      upcomingJumuahJamaatRaw
        ? formatTimeToDisplay(upcomingJumuahJamaatRaw, timeFormat)
        : null,
    [upcomingJumuahJamaatRaw, timeFormat],
  );
  const khutbahDisplay = useMemo(
    () =>
      upcomingJumuahKhutbahRaw
        ? formatTimeToDisplay(upcomingJumuahKhutbahRaw, timeFormat)
        : null,
    [upcomingJumuahKhutbahRaw, timeFormat],
  );

  const hasJamaat = !!jamaatDisplay;
  const hasKhutbah = !!khutbahDisplay;

  if (!hasJamaat && !hasKhutbah) return null;

  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const khutbahLabel = resolveTerminology(terminology, 'khutbah', 'Khutbah');
  const jamaatLabel = resolveTerminology(terminology, 'jamaat', 'Jamaat');

  const parts: string[] = [];
  if (hasKhutbah) parts.push(`${khutbahLabel} ${khutbahDisplay}`);
  if (hasJamaat) parts.push(`${jamaatLabel} ${jamaatDisplay}`);
  const content = parts.join(' · ');

  return (
    <div
      className={`
        flex items-center justify-center rounded-lg border border-gold/20 bg-gold/5
        transition-opacity duration-normal
        ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}
      `}
    >
      <span className="text-gold font-semibold uppercase tracking-wider text-subheading">
        {jummahLabel}
      </span>
      <span className={`text-text-primary text-subheading ${compact ? 'ml-2' : 'ml-3'}`}>
        {content}
      </span>
    </div>
  );
};

export default React.memo(JumuahBar);
