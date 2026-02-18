/**
 * SilentPhonesGraphic
 *
 * Full-panel graphic displayed in place of the carousel when Jamaat is
 * imminent (within 5 minutes). Shows a UK-style prohibition sign
 * (red circle + diagonal slash) around a smartphone icon, with a clear
 * message asking congregants to silence or switch off their phones.
 *
 * Pure presentational — no state, no effects, no side effects.
 * Inline SVG so it works offline and scales to any display size.
 */

import React from 'react';

const SilentPhonesGraphic: React.FC = () => (
  <div className="panel flex flex-col items-center justify-center h-full gap-6 text-center">
    {/* Prohibition sign — red circle + slash over a smartphone */}
    <div className="animate-subtle-pulse">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        className="w-40 h-40 md:w-52 md:h-52 drop-shadow-lg"
        aria-hidden="true"
      >
        {/* Outer prohibition circle */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="#E63946"
          strokeWidth="10"
        />

        {/* Smartphone body — rounded rectangle */}
        <rect
          x="68"
          y="45"
          width="64"
          height="110"
          rx="8"
          ry="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-text-primary"
        />

        {/* Screen area */}
        <rect
          x="74"
          y="60"
          width="52"
          height="76"
          rx="2"
          ry="2"
          fill="rgba(255,255,255,0.08)"
          stroke="none"
        />

        {/* Home button / bottom bar */}
        <line
          x1="88"
          y1="147"
          x2="112"
          y2="147"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-text-muted"
        />

        {/* Speaker slit at top */}
        <line
          x1="92"
          y1="52"
          x2="108"
          y2="52"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-text-muted"
        />

        {/* Diagonal slash — drawn last so it overlays the phone */}
        <line
          x1="36"
          y1="164"
          x2="164"
          y2="36"
          stroke="#E63946"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </svg>
    </div>

    {/* Message text */}
    <div className="flex flex-col gap-3 max-w-md">
      <h2 className="text-heading text-text-primary font-bold leading-tight">
        Please switch your phone to silent
      </h2>
      <p className="text-body text-text-secondary leading-relaxed">
        or turn it off before Jamaat begins
      </p>
    </div>

    {/* Jamaat badge */}
    <span className="badge badge-gold text-caption uppercase tracking-widest">
      Jamaat is about to begin
    </span>
  </div>
);

export default React.memo(SilentPhonesGraphic);
