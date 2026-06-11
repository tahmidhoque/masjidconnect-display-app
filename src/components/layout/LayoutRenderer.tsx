/**
 * LayoutRenderer
 *
 * Renders a display layout orientation using the configured spatial structure:
 * vertical stack (default), left/right sidebar, or split-top band.
 */

import React, { useMemo } from 'react';
import type {
  LayoutRegion,
  LayoutStructure,
  LayoutStructureOptions,
  LayoutZoneComponent,
} from '../../types/displayLayout';
import { inferZoneRegion } from '../../types/displayLayout';
import ZoneStackLayout, { type RenderedZone } from './ZoneStackLayout';

export interface LayoutRendererProps {
  orientation: 'landscape' | 'portrait';
  structure?: LayoutStructure;
  structureOptions?: LayoutStructureOptions;
  zones: RenderedZone[];
  spacingScale: number;
  background?: React.ReactNode;
  themeStyle?: React.CSSProperties;
}

const DEFAULT_SIDEBAR_WIDTH = 0.22;

const BASE_SPACING = {
  landscape: { top: 1, x: 1, bottom: 0, gap: 0.5 },
  portrait: { top: 1.5, x: 1.5, bottom: 1.5, gap: 1 },
} as const;

function partitionZones(
  zones: RenderedZone[],
  structure: LayoutStructure,
): { sidebar: RenderedZone[]; topBand: RenderedZone[]; main: RenderedZone[] } {
  const sidebar: RenderedZone[] = [];
  const topBand: RenderedZone[] = [];
  const main: RenderedZone[] = [];

  for (const zone of zones) {
    const component = (zone.component ?? 'content') as LayoutZoneComponent;
    const region = inferZoneRegion(structure, component, zone.region);

    if (region === 'sidebar') sidebar.push(zone);
    else if (region === 'top-band') topBand.push(zone);
    else main.push(zone);
  }

  return { sidebar, topBand, main };
}

function ZoneCell({ zone }: { zone: RenderedZone }) {
  const flexible = zone.size > 0;
  const zoneStyle: React.CSSProperties = {
    ...(flexible ? { flex: `${zone.size} 1 0%` } : {}),
    ...(zone.fontScale !== 1 ? { zoom: zone.fontScale } : {}),
  };

  return (
    <div
      className={`${flexible ? 'min-h-0 flex flex-col flex-1' : 'shrink-0'} ${zone.className ?? ''}`}
      style={zoneStyle}
      aria-label={zone.label}
    >
      {zone.node}
    </div>
  );
}

function VerticalZoneList({
  zones,
  gapRem,
  className = '',
}: {
  zones: RenderedZone[];
  gapRem: number;
  className?: string;
}) {
  if (zones.length === 0) return null;

  return (
    <div
      className={`flex flex-col min-h-0 min-w-0 ${className}`}
      style={{ gap: `${gapRem}rem` }}
    >
      {zones.map((zone) => (
        <ZoneCell key={zone.id} zone={zone} />
      ))}
    </div>
  );
}

const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  orientation,
  structure = 'stack',
  structureOptions,
  zones,
  spacingScale,
  background,
  themeStyle,
}) => {
  const partitioned = useMemo(
    () => partitionZones(zones, structure),
    [zones, structure],
  );

  if (structure === 'stack') {
    return (
      <ZoneStackLayout
        orientation={orientation}
        zones={zones}
        spacingScale={spacingScale}
        background={background}
        themeStyle={themeStyle}
      />
    );
  }

  const base = BASE_SPACING[orientation];
  const gapRem = base.gap * spacingScale;
  const sidebarWidth = structureOptions?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;

  const stackStyle: React.CSSProperties = {
    paddingTop: `${base.top * spacingScale}rem`,
    paddingLeft: `${base.x * spacingScale}rem`,
    paddingRight: `${base.x * spacingScale}rem`,
    paddingBottom: `${base.bottom * spacingScale}rem`,
    gap: `${gapRem}rem`,
  };

  return (
    <div
      className="relative w-full h-full flex flex-col bg-midnight gpu-accelerated overflow-hidden"
      data-orientation={orientation}
      data-structure={structure}
      style={themeStyle}
    >
      {background && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {background}
        </div>
      )}
      <div className="absolute inset-0 z-[5] pointer-events-none layout-overlay" aria-hidden />

      <div
        className="relative z-10 flex flex-col w-full h-full min-h-0"
        style={stackStyle}
      >
        {structure === 'split-top' && (
          <>
            <VerticalZoneList zones={partitioned.topBand} gapRem={gapRem} className="shrink-0" />
            <VerticalZoneList zones={partitioned.main} gapRem={gapRem} className="flex-1" />
          </>
        )}

        {(structure === 'sidebar-left' || structure === 'sidebar-right') && (
          <div className="flex flex-row flex-1 min-h-0 min-w-0" style={{ gap: `${gapRem}rem` }}>
            {structure === 'sidebar-left' && partitioned.sidebar.length > 0 && (
              <aside
                className="shrink-0 flex flex-col min-h-0 overflow-hidden"
                style={{
                  width: `${sidebarWidth * 100}%`,
                  minWidth: partitioned.sidebar.some((z) => z.component === 'prayer-sidebar')
                    ? '16rem'
                    : '7rem',
                }}
              >
                <VerticalZoneList zones={partitioned.sidebar} gapRem={gapRem} className="h-full" />
              </aside>
            )}
            <VerticalZoneList zones={partitioned.main} gapRem={gapRem} className="flex-1" />
            {structure === 'sidebar-right' && partitioned.sidebar.length > 0 && (
              <aside
                className="shrink-0 flex flex-col min-h-0 overflow-hidden"
                style={{
                  width: `${sidebarWidth * 100}%`,
                  minWidth: partitioned.sidebar.some((z) => z.component === 'prayer-sidebar')
                    ? '16rem'
                    : '7rem',
                }}
              >
                <VerticalZoneList zones={partitioned.sidebar} gapRem={gapRem} className="h-full" />
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LayoutRenderer;
