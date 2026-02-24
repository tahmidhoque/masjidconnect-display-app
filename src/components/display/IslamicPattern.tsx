/**
 * IslamicPattern
 *
 * Renders the "modern" Islamic geometric background: quarter motif only (two curved
 * paths × 4 rotations), no sun/darts/petals. Dual-layer emboss (shadow + highlight)
 * in tone-on-tone with the background — subtle white/dark only, no accent colour —
 * so it reads as a light emboss of the bg, not a busy overlay. RPi-safe, no SVG filters.
 */

import React from 'react';

const PATTERN_SIZE = 140;
const SCALE = PATTERN_SIZE / 800; // 0.175 — paths are in 800×800 space
const QUARTER_CX = 400;
const QUARTER_CY = 400;

/** Quarter paths from backup ModernIslamicBackground (scale 0.175, origin 400,400). */
const QUARTER_PATH_1 =
  'M0,165.685L217.157,75.736L400,258.579L359.175,300L40.825,300L0,400';
const QUARTER_PATH_2 =
  'M165.685,0L75.736,217.157L258.579,400L300,359.175L300,40.825L400,0';

interface IslamicPatternProps {
  /** Base opacity (0–1) for main stroke. Default 0.02 — very faint, texture-only. */
  opacity?: number;
  /** Whether to show shadow/highlight emboss layers. Default true. */
  emboss?: boolean;
}

/** Single tile of the quarter motif (two paths × 4 rotations). */
const QuarterTile: React.FC<{
  stroke: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  transform?: string;
}> = ({
  stroke,
  strokeOpacity = 1,
  strokeWidth = 8,
  transform,
}) => (
  <g
    fill="none"
    stroke={stroke}
    strokeOpacity={strokeOpacity}
    strokeWidth={strokeWidth}
    strokeLinecap="square"
    transform={transform}
  >
    <g transform={`scale(${SCALE})`}>
      <g transform={`rotate(0 ${QUARTER_CX} ${QUARTER_CY})`}>
        <path d={QUARTER_PATH_1} />
        <path d={QUARTER_PATH_2} />
      </g>
      <g transform={`rotate(90 ${QUARTER_CX} ${QUARTER_CY})`}>
        <path d={QUARTER_PATH_1} />
        <path d={QUARTER_PATH_2} />
      </g>
      <g transform={`rotate(180 ${QUARTER_CX} ${QUARTER_CY})`}>
        <path d={QUARTER_PATH_1} />
        <path d={QUARTER_PATH_2} />
      </g>
      <g transform={`rotate(270 ${QUARTER_CX} ${QUARTER_CY})`}>
        <path d={QUARTER_PATH_1} />
        <path d={QUARTER_PATH_2} />
      </g>
    </g>
  </g>
);

const IslamicPattern: React.FC<IslamicPatternProps> = ({
  opacity = 0.02,
  emboss = true,
}) => {
  const patternId = `islamic-modern-${React.useId().replace(/:/g, '')}`;
  return (
    <svg
      className="w-full h-full"
      style={{ opacity: 1 }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          x="0"
          y="0"
          width={PATTERN_SIZE}
          height={PATTERN_SIZE}
          patternUnits="userSpaceOnUse"
        >
          {emboss && (
            <QuarterTile
              stroke="rgba(0,0,0,0.04)"
              transform="translate(1, 1)"
            />
          )}
          <QuarterTile
            stroke="rgba(255,255,255,1)"
            strokeOpacity={opacity}
          />
          {emboss && (
            <QuarterTile
              stroke="rgba(255,255,255,0.025)"
              transform="translate(-0.5, -0.5)"
            />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};

export default React.memo(IslamicPattern);
