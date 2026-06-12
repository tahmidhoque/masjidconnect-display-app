/**
 * ZoneStackLayout
 *
 * Config-driven replacement for the hardcoded Landscape/Portrait layouts.
 * Renders an ordered vertical stack of zones (from a DisplayLayoutConfig
 * orientation block); each zone hosts one registered display component.
 *
 *  - size > 0  → zone shares the remaining vertical space (flex weight)
 *  - size = 0  → zone takes its natural (intrinsic) height
 *  - fontScale → CSS zoom on the zone (scales typography and internal layout
 *                together; cheap on RPi Chromium, same mechanism as
 *                ReferenceViewport scaling)
 *  - spacingScale → multiplies the orientation's base padding and gap
 *
 * Theme overrides arrive as a CSS-variable style object (themeStyle) applied
 * to the root so all Tailwind token utilities re-resolve.
 */

import React from 'react';

export interface RenderedZone {
  id: string;
  /** Component type — used by LayoutRenderer for region partitioning. */
  component?: string;
  /** Explicit region override from layout config. */
  region?: 'main' | 'sidebar' | 'top-band';
  /** Flex weight; 0 = natural height. */
  size: number;
  /** Zoom scale for the zone (1 = none). */
  fontScale: number;
  /** Extra wrapper classes (component-specific constraints, e.g. strip min/max height). */
  className?: string;
  /** Accessible label for the zone region. */
  label?: string;
  node: React.ReactNode;
}

export interface ZoneStackLayoutProps {
  orientation: 'landscape' | 'portrait';
  zones: RenderedZone[];
  /** Multiplier on the orientation's base padding/gap. */
  spacingScale: number;
  /** Prayer-only layout — no content carousel; prayer blocks expand to fill height. */
  prayerOnly?: boolean;
  /** Optional background layer rendered behind everything. */
  background?: React.ReactNode;
  /** CSS-variable overrides for a custom theme (see utils/displayTheme). */
  themeStyle?: React.CSSProperties;
}

/** Base spacing (rem) per orientation — matches the previous hardcoded layouts. */
const BASE_SPACING = {
  landscape: { top: 1, x: 1, bottom: 0, gap: 0.5 },
  portrait: { top: 1.5, x: 1.5, bottom: 1.5, gap: 1 },
} as const;

const ZoneStackLayout: React.FC<ZoneStackLayoutProps> = ({
  orientation,
  zones,
  spacingScale,
  prayerOnly = false,
  background,
  themeStyle,
}) => {
  const base = BASE_SPACING[orientation];
  const stackStyle: React.CSSProperties = {
    paddingTop: `${base.top * spacingScale}rem`,
    paddingLeft: `${base.x * spacingScale}rem`,
    paddingRight: `${base.x * spacingScale}rem`,
    paddingBottom: `${base.bottom * spacingScale}rem`,
    gap: `${base.gap * spacingScale}rem`,
  };

  return (
    <div
      className="relative w-full h-full flex flex-col bg-midnight gpu-accelerated overflow-hidden"
      data-orientation={orientation}
      data-prayer-only={prayerOnly ? 'true' : undefined}
      style={themeStyle}
    >
      {/* Background layer (e.g. subtle Islamic pattern) */}
      {background && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {background}
        </div>
      )}

      {/* Unified overlay — theme-aware tint */}
      <div
        className="absolute inset-0 z-[5] pointer-events-none layout-overlay"
        aria-hidden
      />

      {/* Zone stack */}
      <div className="relative z-10 flex flex-col w-full h-full" style={stackStyle}>
        {zones.map((zone) => {
          const flexible = zone.size > 0;
          const zoneStyle: React.CSSProperties = {
            ...(flexible ? { flex: `${zone.size} 1 0%` } : {}),
            ...(zone.fontScale !== 1 ? { zoom: zone.fontScale } : {}),
          };
          return (
            <div
              key={zone.id}
              className={`${flexible ? 'min-h-0 flex flex-col' : 'shrink-0'} ${zone.className ?? ''}`}
              style={zoneStyle}
              aria-label={zone.label}
            >
              {zone.node}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ZoneStackLayout;
