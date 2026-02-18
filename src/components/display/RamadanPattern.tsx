/**
 * RamadanPattern
 *
 * Renders a subtle crescent-moon-and-star repeating SVG pattern as a
 * background layer for Ramadan mode. Drop-in replacement for IslamicPattern
 * — same props interface, same rendering approach (pure SVG, no filters,
 * no backdrop-filter, RPi-safe).
 *
 * Default opacity is slightly higher (0.05) than IslamicPattern (0.04)
 * for a warmer, more festive feel against the deep green background.
 */

import React from 'react';

interface RamadanPatternProps {
  /** Base opacity (0-1). Default 0.05 */
  opacity?: number;
}

const RamadanPattern: React.FC<RamadanPatternProps> = ({ opacity = 0.05 }) => (
  <svg
    className="w-full h-full"
    style={{ opacity }}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <pattern
        id="ramadan-crescent"
        x="0"
        y="0"
        width="120"
        height="120"
        patternUnits="userSpaceOnUse"
      >
        {/* Crescent moon — two overlapping circles, outer minus inner */}
        <circle
          cx="40"
          cy="40"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
        />
        <circle
          cx="46"
          cy="36"
          r="15"
          fill="var(--color-midnight, #0D3B2E)"
          stroke="none"
        />

        {/* Five-pointed star near the crescent opening */}
        <polygon
          points="72,30 74,36 80,36 75,40 77,46 72,42 67,46 69,40 64,36 70,36"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />

        {/* Subtle connecting arcs for geometric feel */}
        <path
          d="M 0,60 Q 30,50 60,60 Q 90,70 120,60"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
        />
        <path
          d="M 60,0 Q 50,30 60,60 Q 70,90 60,120"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
        />

        {/* Small decorative dots at grid intersections */}
        <circle cx="0" cy="0" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="120" cy="0" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="0" cy="120" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="120" cy="120" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="60" cy="60" r="1.2" fill="currentColor" opacity="0.3" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#ramadan-crescent)" className="text-gold" />
  </svg>
);

export default React.memo(RamadanPattern);
