/**
 * InPrayerScreen
 *
 * Non-distracting display shown in place of the carousel for 5 minutes
 * after Jamaat time is reached. Provides a calm "Jamaat in progress"
 * message with the prayer name, using a muted colour scheme that won't
 * draw attention away from the congregational prayer.
 *
 * Pure presentational — no state, no effects, no side effects.
 */

import React from 'react';

interface InPrayerScreenProps {
  /** Name of the prayer in progress (e.g. "Zuhr", "Asr") */
  prayerName?: string | null;
}

const InPrayerScreen: React.FC<InPrayerScreenProps> = ({ prayerName }) => (
  <div className="panel flex flex-col items-center justify-center h-full gap-5 text-center bg-midnight-dark/40 rounded-xl">
    {/* Decorative crescent — subtle, non-distracting */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="w-20 h-20 text-gold/30"
      aria-hidden="true"
    >
      <path
        d="M50 5 C25 5, 5 25, 5 50 C5 75, 25 95, 50 95 C35 85, 28 68, 28 50 C28 32, 35 15, 50 5Z"
        fill="currentColor"
      />
    </svg>

    {/* Prayer name */}
    {prayerName && (
      <h2 className="text-heading text-gold/80 font-semibold tracking-wide">
        {prayerName}
      </h2>
    )}

    {/* Status message */}
    <p className="text-subheading text-text-muted font-medium">
      Jamaat in progress
    </p>

    {/* Subtle divider */}
    <div className="w-16 h-px bg-border" />

    {/* Calm instruction */}
    <p className="text-caption text-text-muted/60 max-w-xs leading-relaxed">
      Please maintain silence and observe the prayer
    </p>
  </div>
);

export default React.memo(InPrayerScreen);
