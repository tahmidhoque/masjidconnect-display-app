/**
 * InPrayerScreen
 *
 * Non-distracting display shown in place of the carousel for 10 minutes
 * after Jamaat time is reached. Provides a calm "Jamaat in progress"
 * message with the prayer name, using a muted colour scheme that won't
 * draw attention away from the congregational prayer.
 *
 * `landscapeSplit` — landscape: 2×1 grid (prayer rug motif | copy) so the motif
 * can stay large while status text stays readable in the carousel band.
 *
 * Pure presentational — no state, no effects, no side effects.
 */

import React from 'react';

import prayerRugJamaatUrl from '../../assets/prayer-rug-jamaat.png';

export interface InPrayerScreenProps {
  /** Name of the prayer in progress (e.g. "Zuhr", "Asr") */
  prayerName?: string | null;
  /** When 'post-jamaat': show "In progress"; else show "Jamaat in progress" */
  statusMessage?: 'jamaat' | 'post-jamaat';
  /** Landscape: two-column row — large motif left, messages right. */
  landscapeSplit?: boolean;
}

/** Muted prayer-rug icon (line art PNG): invert for dark UI, similar to prior gold/30 crescent. */
const PrayerRugMotif: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src={prayerRugJamaatUrl}
    alt=""
    aria-hidden
    className={`object-contain brightness-0 invert opacity-30 ${className ?? ''}`}
  />
);

const InPrayerScreen: React.FC<InPrayerScreenProps> = ({
  prayerName,
  statusMessage,
  landscapeSplit = false,
}) => {
  const statusText =
    statusMessage === 'post-jamaat' ? 'In progress' : 'Jamaat in progress';

  if (landscapeSplit) {
    return (
      <div className="in-prayer-screen--split grid grid-cols-[1.12fr_1fr] h-full min-h-0 max-h-full overflow-hidden gap-x-5 items-center bg-midnight-dark/40 rounded-xl px-5 py-3">
        <div className="flex items-center justify-center min-h-0 min-w-0 h-full">
          <div className="flex items-center justify-center h-full max-h-[14rem] w-full max-w-[14rem]">
            <PrayerRugMotif className="h-full w-full max-h-[14rem] max-w-[14rem]" />
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 min-w-0 text-left items-start py-1">
          {prayerName ? (
            <h2 className="text-gold/80 font-bold tracking-wide in-prayer-screen-split-name">
              {prayerName}
            </h2>
          ) : null}
          <p className="text-text-primary font-bold in-prayer-screen-split-status">
            {statusText}
          </p>
          <div className="w-full max-w-xs h-px bg-border my-4" />
          <p className="text-body text-text-muted leading-relaxed max-w-md">
            Please maintain silence and observe the prayer
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 w-full max-w-full flex-col items-center justify-center gap-8 text-center bg-midnight-dark/40 rounded-xl px-8 py-4">
      <PrayerRugMotif className="w-28 h-28 shrink-0" />
      {prayerName && (
        <h2 className="text-display text-gold/80 font-bold tracking-wide">
          {prayerName}
        </h2>
      )}
      <p className="text-heading font-bold text-text-primary">{statusText}</p>
      <div className="w-24 h-px bg-border" />
      <p className="text-body text-text-muted max-w-md leading-relaxed">
        Please maintain silence and observe the prayer
      </p>
    </div>
  );
};

export default React.memo(InPrayerScreen);
