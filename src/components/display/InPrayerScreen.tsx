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
  <div className="flex flex-col items-center justify-center h-full gap-8 text-center bg-midnight-dark/40 rounded-xl px-8">
    {/* Decorative crescent — larger to fill space */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="w-28 h-28 text-gold/30"
      aria-hidden="true"
    >
      <path
        d="M50 5 C25 5, 5 25, 5 50 C5 75, 25 95, 50 95 C35 85, 28 68, 28 50 C28 32, 35 15, 50 5Z"
        fill="currentColor"
      />
    </svg>

    {/* Prayer name — prominent */}
    {prayerName && (
      <h2 className="text-display text-gold/80 font-bold tracking-wide">
        {prayerName}
      </h2>
    )}

    {/* Status message — larger and bolder */}
    <p className="text-heading font-bold text-text-primary">
      Jamaat in progress
    </p>

    {/* Subtle divider */}
    <div className="w-24 h-px bg-border" />

    {/* Calm instruction — body size so it reads clearly */}
    <p className="text-body text-text-muted max-w-md leading-relaxed">
      Please maintain silence and observe the prayer
    </p>
  </div>
);

export default React.memo(InPrayerScreen);
