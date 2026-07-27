/**
 * JumuahBar
 *
 * Compact bar showing upcoming Friday Khutbah and Jamaat. Supports dual
 * Jumu'ah via `upcomingJumuahSessions` (1st · 2nd). Falls back to the legacy
 * single khutbah/jamaat pair when sessions are empty.
 *
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
  /** Matches screen display setting (12h / 24h / 12h-nop). */
  timeFormat?: TimeFormat;
}

const JumuahBar: React.FC<JumuahBarProps> = ({
  compact = false,
  timeFormat = '12h',
}) => {
  const {
    upcomingJumuahJamaatRaw,
    upcomingJumuahKhutbahRaw,
    upcomingJumuahSessions,
  } = usePrayerTimesContext();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const khutbahLabel = resolveTerminology(terminology, 'khutbah', 'Khutbah');
  const jamaatLabel = resolveTerminology(terminology, 'jamaat', 'Jamaat');

  const sessionLines = useMemo(() => {
    if (upcomingJumuahSessions.length > 0) {
      return upcomingJumuahSessions.map((session, index) => {
        const parts: string[] = [];
        if (session.khutbah) {
          parts.push(
            `${khutbahLabel} ${formatTimeToDisplay(session.khutbah, timeFormat)}`,
          );
        }
        parts.push(
          `${jamaatLabel} ${formatTimeToDisplay(session.jamaat, timeFormat)}`,
        );
        const prefix =
          upcomingJumuahSessions.length > 1
            ? `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} `
            : '';
        return `${prefix}${parts.join(' · ')}`;
      });
    }

    const jamaatDisplay = upcomingJumuahJamaatRaw
      ? formatTimeToDisplay(upcomingJumuahJamaatRaw, timeFormat)
      : null;
    const khutbahDisplay = upcomingJumuahKhutbahRaw
      ? formatTimeToDisplay(upcomingJumuahKhutbahRaw, timeFormat)
      : null;
    if (!jamaatDisplay && !khutbahDisplay) return [];

    const parts: string[] = [];
    if (khutbahDisplay) parts.push(`${khutbahLabel} ${khutbahDisplay}`);
    if (jamaatDisplay) parts.push(`${jamaatLabel} ${jamaatDisplay}`);
    return [parts.join(' · ')];
  }, [
    upcomingJumuahSessions,
    upcomingJumuahJamaatRaw,
    upcomingJumuahKhutbahRaw,
    timeFormat,
    khutbahLabel,
    jamaatLabel,
  ]);

  if (sessionLines.length === 0) return null;

  return (
    <div
      className={`
        flex items-center justify-center rounded-lg border border-gold/20 bg-gold/5
        transition-opacity duration-normal
        ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}
      `}
    >
      <span className="text-gold font-semibold uppercase tracking-wider text-subheading shrink-0">
        {jummahLabel}
      </span>
      <div
        className={`flex flex-col min-w-0 ${compact ? 'ml-2' : 'ml-3'} ${
          sessionLines.length > 1 ? 'gap-0.5' : ''
        }`}
      >
        {sessionLines.map((line) => (
          <span
            key={line}
            className="text-text-primary text-subheading leading-tight"
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  );
};

export default React.memo(JumuahBar);
