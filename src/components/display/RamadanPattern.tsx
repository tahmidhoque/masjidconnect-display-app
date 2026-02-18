/**
 * RamadanPattern
 *
 * Renders an elegant crescent-moon-and-star repeating SVG pattern as a
 * background layer for Ramadan mode. Uses proper filled crescent paths
 * (bezier curves, not circle-masking), mathematically accurate five-pointed
 * stars, and arabesque geometric accents.
 *
 * Tile: 240×240. Elements are layered with varying sub-opacities so the
 * primary crescent/star pair is most prominent while secondary elements
 * add depth without visual noise.
 *
 * Drop-in replacement for IslamicPattern — same props interface.
 * Pure SVG, no filters, no backdrop-filter, RPi-safe.
 */

import React from 'react';

interface RamadanPatternProps {
  /** Base opacity (0-1). Default 0.06 */
  opacity?: number;
}

/**
 * Five-pointed star polygon coordinates.
 * Computed from outer/inner radii at 72° intervals starting from -90° (top).
 */
function starPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerAngle = outerAngle + Math.PI / 5;
    pts.push(
      `${(cx + outerR * Math.cos(outerAngle)).toFixed(1)},${(cy + outerR * Math.sin(outerAngle)).toFixed(1)}`,
    );
    pts.push(
      `${(cx + innerR * Math.cos(innerAngle)).toFixed(1)},${(cy + innerR * Math.sin(innerAngle)).toFixed(1)}`,
    );
  }
  return pts.join(' ');
}

/** Pre-computed star coordinates (avoids recalculation on every render) */
const PRIMARY_STAR = starPoints(108, 50, 11, 4.5);
const SECONDARY_STAR = starPoints(158, 168, 6, 2.5);
const ACCENT_STAR_A = starPoints(32, 165, 4, 1.8);
const ACCENT_STAR_B = starPoints(178, 28, 4, 1.8);
const ACCENT_STAR_C = starPoints(200, 110, 3, 1.3);

const RamadanPattern: React.FC<RamadanPatternProps> = ({ opacity = 0.06 }) => (
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
        width="240"
        height="240"
        patternUnits="userSpaceOnUse"
      >
        {/* ===== Primary crescent moon (opening right) =====
            Drawn as two cubic bezier curves forming a filled shape.
            Outer edge bulges left; inner edge is concave, creating
            pointed tips at top and bottom. */}
        <path
          d="M 70 24
             C 46 24, 24 44, 24 68
             C 24 92, 46 112, 70 112
             C 56 104, 44 88, 44 68
             C 44 48, 56 32, 70 24 Z"
          fill="currentColor"
          opacity="0.6"
        />

        {/* ===== Primary five-pointed star ===== */}
        <polygon
          points={PRIMARY_STAR}
          fill="currentColor"
          opacity="0.55"
        />

        {/* ===== Secondary crescent (mirrored, opening left, smaller) ===== */}
        <path
          d="M 148 128
             C 164 128, 180 140, 180 154
             C 180 168, 164 180, 148 180
             C 158 174, 166 164, 166 154
             C 166 144, 158 134, 148 128 Z"
          fill="currentColor"
          opacity="0.35"
        />

        {/* ===== Secondary star ===== */}
        <polygon
          points={SECONDARY_STAR}
          fill="currentColor"
          opacity="0.3"
        />

        {/* ===== Arabesque framework arcs =====
            Flowing sine-like curves that give the pattern a sense of
            connected geometry, evoking mosque archway lattice work. */}
        <path
          d="M 0,120 Q 60,100 120,120 Q 180,140 240,120"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.4"
        />
        <path
          d="M 120,0 Q 100,60 120,120 Q 140,180 120,240"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.4"
        />

        {/* Diagonal flourishes echoing arabesque vine motifs */}
        <path
          d="M 8,8 Q 24,18 18,36"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.35"
          opacity="0.35"
        />
        <path
          d="M 232,232 Q 216,222 222,204"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.35"
          opacity="0.35"
        />
        <path
          d="M 232,8 Q 216,18 222,36"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.25"
        />
        <path
          d="M 8,232 Q 24,222 18,204"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
          opacity="0.25"
        />

        {/* ===== Accent stars scattered for depth ===== */}
        <polygon points={ACCENT_STAR_A} fill="currentColor" opacity="0.25" />
        <polygon points={ACCENT_STAR_B} fill="currentColor" opacity="0.25" />
        <polygon points={ACCENT_STAR_C} fill="currentColor" opacity="0.2" />

        {/* ===== Four-pointed diamond stars (geometric accents) ===== */}
        <path
          d="M 120 60 L 123 64 L 120 68 L 117 64 Z"
          fill="currentColor"
          opacity="0.3"
        />
        <path
          d="M 60 180 L 62.5 183 L 60 186 L 57.5 183 Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M 195 145 L 197 147.5 L 195 150 L 193 147.5 Z"
          fill="currentColor"
          opacity="0.2"
        />

        {/* ===== Corner/intersection dots ===== */}
        <circle cx="0" cy="0" r="1.5" fill="currentColor" opacity="0.3" />
        <circle cx="240" cy="0" r="1.5" fill="currentColor" opacity="0.3" />
        <circle cx="0" cy="240" r="1.5" fill="currentColor" opacity="0.3" />
        <circle cx="240" cy="240" r="1.5" fill="currentColor" opacity="0.3" />
        <circle cx="120" cy="120" r="2" fill="currentColor" opacity="0.2" />
        <circle cx="0" cy="120" r="1.2" fill="currentColor" opacity="0.2" />
        <circle cx="240" cy="120" r="1.2" fill="currentColor" opacity="0.2" />
        <circle cx="120" cy="0" r="1.2" fill="currentColor" opacity="0.2" />
        <circle cx="120" cy="240" r="1.2" fill="currentColor" opacity="0.2" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#ramadan-crescent)" className="text-gold" />
  </svg>
);

export default React.memo(RamadanPattern);
