/**
 * IslamicPattern
 *
 * Renders a subtle geometric Islamic-inspired pattern as an SVG background.
 * Uses pure CSS opacity — no blur, no backdrop-filter (RPi-safe).
 *
 * The pattern is a repeating star-and-cross motif drawn with SVG paths.
 * Opacity is kept very low to avoid visual noise.
 */

import React from 'react';

interface IslamicPatternProps {
  /** Base opacity (0-1). Default 0.04 */
  opacity?: number;
}

const IslamicPattern: React.FC<IslamicPatternProps> = ({ opacity = 0.04 }) => (
  <svg
    className="w-full h-full"
    style={{ opacity }}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <pattern id="islamic-star" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        {/* Eight-pointed star formed by two overlapping squares rotated 45° */}
        <rect
          x="20" y="20" width="40" height="40"
          transform="rotate(45 40 40)"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <rect
          x="20" y="20" width="40" height="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        {/* Connecting cross lines */}
        <line x1="0" y1="40" x2="80" y2="40" stroke="currentColor" strokeWidth="0.3" />
        <line x1="40" y1="0" x2="40" y2="80" stroke="currentColor" strokeWidth="0.3" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#islamic-star)" className="text-emerald" />
  </svg>
);

export default React.memo(IslamicPattern);
