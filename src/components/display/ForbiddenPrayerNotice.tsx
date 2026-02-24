/**
 * ForbiddenPrayerNotice
 *
 * Shows a short caption when the current time falls within a makruh (discouraged)
 * period for voluntary (nafl) prayer. Displays "Voluntary prayer not recommended
 * until [time]" with the end of the current forbidden window.
 *
 * Uses caption styling and muted colour so it does not distract from the main
 * prayer times and countdown.
 */

import React from 'react';
import { Info } from 'lucide-react';
import type { CurrentForbiddenState } from '@/utils/forbiddenPrayerTimes';
import { getTimeDisplayParts } from '@/utils/dateUtils';
import type { TimeFormat } from '@/api/models';

interface ForbiddenPrayerNoticeProps {
  /** When non-null, we are in a forbidden window and should show the notice. */
  forbiddenPrayer: CurrentForbiddenState | null;
  /** Used to format the endsAt time for display (12h/24h). */
  timeFormat: TimeFormat;
  /** When true, no icon and text truncates (e.g. for footer inline use). */
  compact?: boolean;
}

const ForbiddenPrayerNotice: React.FC<ForbiddenPrayerNoticeProps> = ({
  forbiddenPrayer,
  timeFormat,
  compact = false,
}) => {
  if (!forbiddenPrayer) return null;

  const { main, period } = getTimeDisplayParts(forbiddenPrayer.endsAt, timeFormat);
  const displayEndsAtAria = period ? `${main} ${period}` : main;

  return (
    <div
      className={`flex items-center gap-2 shrink-0 min-w-0 ${compact ? 'overflow-hidden' : ''}`}
      role="status"
      aria-live="polite"
    >
      {!compact && (
        <Info className="w-3.5 h-3.5 shrink-0 text-gold/60" aria-hidden />
      )}
      <p
        className={`text-caption text-text-muted ${compact ? 'truncate' : ''}`}
        title={compact ? `Voluntary prayer not recommended until ${displayEndsAtAria}` : undefined}
      >
        Voluntary prayer not recommended until {main}
        {period != null && <span className="opacity-80 font-normal"> {period}</span>}
      </p>
    </div>
  );
};

export default React.memo(ForbiddenPrayerNotice);
