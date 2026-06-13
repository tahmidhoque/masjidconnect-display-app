/**
 * Display layout config types — mirror of the backend contract in
 * `MasjidConnect-Backend/packages/shared/src/types/display-layout.ts`.
 * Keep both files in sync.
 */

export const DISPLAY_LAYOUT_CONFIG_VERSION = 1 as const;

export const LAYOUT_ZONE_COMPONENTS = [
  'header',
  'prayer-panel',
  'prayer-times',
  'jumuah-bar',
  'countdown',
  'content',
  'footer',
] as const;

export type PrayerTimesLayout = 'strip' | 'sidebar';

export type LayoutZoneComponent = (typeof LAYOUT_ZONE_COMPONENTS)[number];

export const LAYOUT_STRUCTURES = [
  'stack',
  'sidebar-left',
  'sidebar-right',
  'split-top',
] as const;

export type LayoutStructure = (typeof LAYOUT_STRUCTURES)[number];

export const LAYOUT_REGIONS = ['main', 'sidebar', 'top-band'] as const;

export type LayoutRegion = (typeof LAYOUT_REGIONS)[number];

export interface LayoutStructureOptions {
  sidebarWidth?: number;
  stripClockPosition?: 'left' | 'right';
}

export interface LayoutZoneHeaderOptions {
  showDate?: boolean;
  showHijriDate?: boolean;
  showMasjidName?: boolean;
  /** Prayer times bar — embedded countdown (default true). */
  showCountdown?: boolean;
}

export interface LayoutZone {
  id: string;
  component: LayoutZoneComponent;
  visible: boolean;
  size: number;
  fontScale: number;
  region?: LayoutRegion;
  options?: LayoutZoneHeaderOptions;
}

export interface OrientationLayoutConfig {
  structure?: LayoutStructure;
  structureOptions?: LayoutStructureOptions;
  zones: LayoutZone[];
  spacingScale: number;
}

export interface DisplayThemeOverrides {
  background: string;
  accent: string;
  highlight: string;
  textPrimary: string;
  textSecondary: string;
  /** Tomorrow jamaat roll-forward — maps to --color-tomorrow-roll */
  tomorrowRoll: string;
}

export type TomorrowJamaatDisplayMode = 'off' | 'column' | 'roll-forward';

export interface LayoutBehaviourOverrides {
  showImsak?: boolean;
  showTomorrowJamaat?: boolean;
  tomorrowJamaatMode?: TomorrowJamaatDisplayMode;
  showDate?: boolean;
  showHijriDate?: boolean;
  showMasjidName?: boolean;
  minutesAfterJamaatUntilNextPrayer?: number;
  defaultJamaatInProgressMinutes?: number;
  minutesAfterJamaatUntilNextPrayerBySalah?: Partial<
    Record<'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha', number>
  >;
  jamaatInProgressMode?: 'screen' | 'dark';
  timeFormat?: '12h' | '24h';
  postAdhanSupplication?: {
    enabled?: boolean;
    delayMinutes?: number;
    durationMinutes?: number;
  };
  postJamaatSupplication?: {
    enabled?: boolean;
    durationMinutes?: number;
  };
}

export interface DisplayLayoutConfig {
  version: typeof DISPLAY_LAYOUT_CONFIG_VERSION;
  landscape: OrientationLayoutConfig;
  portrait: OrientationLayoutConfig;
  theme: DisplayThemeOverrides | null;
  /** Per-layout behaviour overrides (merged server-side into displaySettings). */
  behaviour?: LayoutBehaviourOverrides | null;
  /**
   * Editor-only hint for which orientation the admin designs first. Both
   * orientations are always rendered; the display app ignores this field.
   */
  primaryOrientation?: "landscape" | "portrait";
}

export interface ScreenLayoutPayload {
  id: string;
  name: string;
  config: DisplayLayoutConfig;
  updatedAt: string;
}

export const DEFAULT_LAYOUT_CONFIG: DisplayLayoutConfig = {
  version: DISPLAY_LAYOUT_CONFIG_VERSION,
  landscape: {
    spacingScale: 1,
    zones: [
      { id: 'zone-content', component: 'content', visible: true, size: 5, fontScale: 1 },
      { id: 'zone-prayer-times', component: 'prayer-times', visible: true, size: 0, fontScale: 1 },
      { id: 'zone-footer', component: 'footer', visible: true, size: 0, fontScale: 1 },
    ],
  },
  portrait: {
    spacingScale: 1,
    zones: [
      { id: 'zone-header', component: 'header', visible: true, size: 0, fontScale: 1 },
      { id: 'zone-prayer-panel', component: 'prayer-panel', visible: true, size: 0, fontScale: 1 },
      { id: 'zone-jumuah', component: 'jumuah-bar', visible: true, size: 0, fontScale: 1 },
      { id: 'zone-countdown', component: 'countdown', visible: true, size: 0, fontScale: 1 },
      { id: 'zone-content', component: 'content', visible: true, size: 1, fontScale: 1 },
      { id: 'zone-footer', component: 'footer', visible: true, size: 0, fontScale: 1 },
    ],
  },
  theme: null,
};

const FONT_SCALE_MIN = 0.7;
const FONT_SCALE_MAX = 1.5;
const SPACING_SCALE_MIN = 0.5;
const SPACING_SCALE_MAX = 2;
const ZONE_SIZE_MAX = 12;
const SIDEBAR_WIDTH_MIN = 0.12;
const SIDEBAR_WIDTH_MAX = 0.4;

const HEX_COLOUR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function inferPrayerTimesLayout(region: LayoutRegion): PrayerTimesLayout {
  return region === 'sidebar' ? 'sidebar' : 'strip';
}

export function inferZoneRegion(
  structure: LayoutStructure,
  component: LayoutZoneComponent,
  explicitRegion?: LayoutRegion,
): LayoutRegion {
  if (explicitRegion) return explicitRegion;

  if (structure === 'split-top') {
    if (
      component === 'prayer-times' ||
      component === 'prayer-panel' ||
      component === 'jumuah-bar' ||
      component === 'header' ||
      component === 'countdown'
    ) {
      return 'top-band';
    }
    return 'main';
  }

  return 'main';
}

export function layoutHasVisibleContent(zones: LayoutZone[]): boolean {
  return zones.some((zone) => zone.visible && zone.component === 'content');
}

export function isPrayerOnlyLayout(zones: LayoutZone[]): boolean {
  const hasVisibleNonFooter = zones.some(
    (zone) => zone.visible && zone.component !== 'footer',
  );
  return hasVisibleNonFooter && !layoutHasVisibleContent(zones);
}

export function layoutMainZonesEmpty(
  zones: LayoutZone[],
  structure: LayoutStructure,
): boolean {
  return !zones.some(
    (zone) =>
      zone.visible &&
      zone.component !== 'footer' &&
      inferZoneRegion(structure, zone.component, zone.region) === 'main',
  );
}

export function resolvePrayerFocusZoneSize(
  zone: LayoutZone,
  zones: LayoutZone[],
  structure: LayoutStructure,
): number {
  if (!isPrayerOnlyLayout(zones)) return zone.size;
  if (zone.size > 0) return zone.size;

  const region = inferZoneRegion(structure, zone.component, zone.region);

  switch (zone.component) {
    case 'prayer-panel':
      return 10;
    case 'prayer-times':
      if (region === 'sidebar') return 1;
      if (region === 'top-band') return 0;
      return 6;
    case 'countdown': {
      const hasFlexiblePrayer = zones.some(
        (entry) =>
          entry.visible &&
          (entry.component === 'prayer-panel' ||
            (entry.component === 'prayer-times' &&
              inferZoneRegion(structure, entry.component, entry.region) === 'main')),
      );
      return hasFlexiblePrayer ? 0 : 4;
    }
    default:
      return 0;
  }
}

function sanitiseStructure(raw: unknown): LayoutStructure {
  if (typeof raw === 'string' && (LAYOUT_STRUCTURES as readonly string[]).includes(raw)) {
    return raw as LayoutStructure;
  }
  return 'stack';
}

function sanitiseStructureOptions(raw: unknown): LayoutStructureOptions | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const options = raw as Record<string, unknown>;
  const result: LayoutStructureOptions = {};
  if (
    typeof options.sidebarWidth === 'number' &&
    Number.isFinite(options.sidebarWidth)
  ) {
    result.sidebarWidth = clamp(options.sidebarWidth, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
  }
  if (options.stripClockPosition === 'left' || options.stripClockPosition === 'right') {
    result.stripClockPosition = options.stripClockPosition;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitiseZone(raw: unknown): LayoutZone | null {
  if (!raw || typeof raw !== 'object') return null;
  const zone = raw as Record<string, unknown>;
  const rawComponent = zone.component;
  if (typeof rawComponent !== 'string') return null;
  const component =
    rawComponent === 'prayer-strip' || rawComponent === 'prayer-sidebar'
      ? 'prayer-times'
      : rawComponent;
  if (!(LAYOUT_ZONE_COMPONENTS as readonly string[]).includes(component)) {
    return null;
  }
  const regionRaw = zone.region;
  const region =
    typeof regionRaw === 'string' &&
    (LAYOUT_REGIONS as readonly string[]).includes(regionRaw)
      ? (regionRaw as LayoutRegion)
      : undefined;

  const optionsRaw = zone.options;
  let options: LayoutZoneHeaderOptions | undefined;
  if (optionsRaw && typeof optionsRaw === 'object') {
    const opts = optionsRaw as Record<string, unknown>;
    const parsed: LayoutZoneHeaderOptions = {};
    if (typeof opts.showDate === 'boolean') parsed.showDate = opts.showDate;
    if (typeof opts.showHijriDate === 'boolean') parsed.showHijriDate = opts.showHijriDate;
    if (typeof opts.showMasjidName === 'boolean') parsed.showMasjidName = opts.showMasjidName;
    if (typeof opts.showCountdown === 'boolean') parsed.showCountdown = opts.showCountdown;
    if (Object.keys(parsed).length > 0) options = parsed;
  }

  const typedComponent = component as LayoutZoneComponent;
  const forceVisible = typedComponent === 'footer';

  return {
    id: typeof zone.id === 'string' && zone.id !== '' ? zone.id : `zone-${component}`,
    component: typedComponent,
    visible: forceVisible ? true : zone.visible !== false,
    size:
      typeof zone.size === 'number' && Number.isFinite(zone.size)
        ? clamp(zone.size, 0, ZONE_SIZE_MAX)
        : 0,
    fontScale:
      typeof zone.fontScale === 'number' && Number.isFinite(zone.fontScale)
        ? clamp(zone.fontScale, FONT_SCALE_MIN, FONT_SCALE_MAX)
        : 1,
    region,
    options,
  };
}

function sanitiseOrientation(raw: unknown): OrientationLayoutConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const orientation = raw as Record<string, unknown>;
  if (!Array.isArray(orientation.zones)) return null;

  const zones: LayoutZone[] = [];
  const seenComponents = new Set<string>();
  for (const rawZone of orientation.zones) {
    const zone = sanitiseZone(rawZone);
    if (!zone) continue;
    if (seenComponents.has(zone.component)) continue;
    seenComponents.add(zone.component);
    zones.push(zone);
  }

  if (!zones.some((z) => z.component === 'footer')) {
    zones.push({
      id: 'zone-footer',
      component: 'footer',
      visible: true,
      size: 0,
      fontScale: 1,
    });
  }

  const hasVisibleFooter = zones.some((z) => z.component === 'footer' && z.visible);
  const hasVisibleNonFooter = zones.some((z) => z.visible && z.component !== 'footer');
  if (zones.length === 0 || !hasVisibleFooter || !hasVisibleNonFooter) return null;

  const footerIndex = zones.findIndex((z) => z.component === 'footer');
  if (footerIndex >= 0 && footerIndex !== zones.length - 1) {
    const [footer] = zones.splice(footerIndex, 1);
    zones.push(footer);
  }

  return {
    structure: sanitiseStructure(orientation.structure),
    structureOptions: sanitiseStructureOptions(orientation.structureOptions),
    zones,
    spacingScale:
      typeof orientation.spacingScale === 'number' &&
      Number.isFinite(orientation.spacingScale)
        ? clamp(orientation.spacingScale, SPACING_SCALE_MIN, SPACING_SCALE_MAX)
        : 1,
  };
}

function sanitiseTheme(raw: unknown): DisplayThemeOverrides | null {
  if (!raw || typeof raw !== 'object') return null;
  const theme = raw as Record<string, unknown>;
  const requiredKeys: Array<keyof DisplayThemeOverrides> = [
    'background',
    'accent',
    'highlight',
    'textPrimary',
    'textSecondary',
  ];
  const result = {} as DisplayThemeOverrides;
  for (const key of requiredKeys) {
    const value = theme[key];
    if (typeof value !== 'string' || !HEX_COLOUR_RE.test(value)) return null;
    result[key] = value;
  }
  const tomorrowRoll = theme.tomorrowRoll;
  result.tomorrowRoll =
    typeof tomorrowRoll === 'string' && HEX_COLOUR_RE.test(tomorrowRoll)
      ? tomorrowRoll
      : '#8BB8D9';
  return result;
}

export function sanitiseLayoutConfig(raw: unknown): DisplayLayoutConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as Record<string, unknown>;
  if (config.version !== DISPLAY_LAYOUT_CONFIG_VERSION) return null;

  const landscape = sanitiseOrientation(config.landscape);
  const portrait = sanitiseOrientation(config.portrait);
  if (!landscape || !portrait) return null;

  return {
    version: DISPLAY_LAYOUT_CONFIG_VERSION,
    landscape,
    portrait,
    theme: sanitiseTheme(config.theme),
  };
}
