/**
 * JumuahBar
 *
 * Compact bar showing Friday Khutbah and Jamaat times. Renders every entry in
 * `jumuahSessions[]` when the API provides dual (or more) congregations, and
 * falls back to the legacy single khutbah/jamaat pair when the array is absent.
 *
 * Uses gold-tinted styling to draw attention without overwhelming the display.
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React, { useMemo } from 'react';
import type { JumuahSession, TimeFormat } from '../../api/models';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import { formatTimeToDisplay } from '../../utils/dateUtils';
import { useAppSelector } from '../../store/hooks';
import { selectDisplaySettings } from '../../store/slices/contentSlice';
import { resolveTerminology } from '../../utils/prayerTerminology';

interface JumuahBarProps {
  /** When true (landscape), use tighter spacing */
  compact?: boolean;
  /** Matches screen display setting (12h / 12h-nop / 24h). */
  timeFormat?: TimeFormat;
}

function sessionTimeLine(
  session: JumuahSession,
  timeFormat: TimeFormat,
  khutbahLabel: string,
  jamaatLabel: string,
): string {
  const parts: string[] = [];
  if (session.khutbah) {
    parts.push(`${khutbahLabel} ${formatTimeToDisplay(session.khutbah, timeFormat)}`);
  }
  if (session.jamaat) {
    parts.push(`${jamaatLabel} ${formatTimeToDisplay(session.jamaat, timeFormat)}`);
  }
  return parts.join(' · ');
}

const JumuahBar: React.FC<JumuahBarProps> = ({
  compact = false,
  timeFormat = '12h',
}) => {
  const {
    upcomingJumuahSessions,
    upcomingJumuahJamaatRaw,
    upcomingJumuahKhutbahRaw,
  } = usePrayerTimesContext();
  const terminology = useAppSelector(selectDisplaySettings)?.terminology;

  const sessions = useMemo((): JumuahSession[] => {
    if (upcomingJumuahSessions && upcomingJumuahSessions.length > 0) {
      return upcomingJumuahSessions;
    }
    if (!upcomingJumuahJamaatRaw && !upcomingJumuahKhutbahRaw) return [];
    return [
      {
        label: "Jumu'ah",
        khutbah: upcomingJumuahKhutbahRaw,
        jamaat: upcomingJumuahJamaatRaw ?? '',
      },
    ].filter((session) => session.jamaat || session.khutbah);
  }, [upcomingJumuahSessions, upcomingJumuahJamaatRaw, upcomingJumuahKhutbahRaw]);

  if (sessions.length === 0) return null;

  const jummahLabel = resolveTerminology(terminology, 'jummah', 'Jumuah');
  const khutbahLabel = resolveTerminology(terminology, 'khutbah', 'Khutbah');
  const jamaatLabel = resolveTerminology(terminology, 'jamaat', 'Jamaat');
  const showSessionLabels = sessions.length > 1;

  return (
    <div
      className={`
        flex items-center justify-center rounded-lg border border-gold/20 bg-gold/5
        min-h-0 w-full
        transition-opacity duration-normal
        ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}
      `}
    >
      <span className="text-gold font-semibold uppercase tracking-wider text-subheading shrink-0">
        {jummahLabel}
      </span>
      <div
        className={`flex flex-wrap items-center justify-center min-w-0 ${
          compact ? 'ml-2 gap-x-3 gap-y-1' : 'ml-3 gap-x-5 gap-y-1'
        }`}
      >
        {sessions.map((session, index) => {
          const line = sessionTimeLine(session, timeFormat, khutbahLabel, jamaatLabel);
          if (!line) return null;
          return (
            <span
              key={`${session.label}-${session.jamaat}-${index}`}
              className="text-text-primary text-subheading whitespace-nowrap"
            >
              {showSessionLabels ? (
                <span className="text-gold/90 font-semibold mr-1.5">{session.label}</span>
              ) : null}
              {line}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(JumuahBar);
