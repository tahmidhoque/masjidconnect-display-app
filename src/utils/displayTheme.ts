/**
 * Display theme utilities.
 *
 * Converts the admin-configured DisplayThemeOverrides (hex colours) into a
 * CSS-variable style object applied to the layout root. Tailwind v4 utilities
 * (bg-midnight, text-gold, …) resolve through var(--color-*) so inline
 * overrides on the root re-skin every component without per-component changes.
 *
 * Light/dark variants and the layout overlay are derived from the base
 * colours so gradients and tints remain coherent with the custom palette.
 */

import type { DisplayThemeOverrides } from '../types/displayLayout';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse #RRGGBB or #RRGGBBAA. Returns null for anything else. */
function parseHex(hex: string): (Rgb & { a: number }) | null {
  const match = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex);
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
    a: match[2] !== undefined ? parseInt(match[2], 16) / 255 : 1,
  };
}

const toChannel = (value: number): string =>
  Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');

/**
 * Lighten (positive amount) or darken (negative amount) a hex colour by
 * blending towards white/black. Amount is 0–1.
 */
export function shadeHexColour(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 255 : 0;
  const factor = Math.abs(amount);
  const blend = (channel: number) => channel + (target - channel) * factor;
  return `#${toChannel(blend(rgb.r))}${toChannel(blend(rgb.g))}${toChannel(blend(rgb.b))}`;
}

/** Hex → rgba() string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Calculate relative luminance for a hex colour (0 = black, 1 = white).
 * Uses the WCAG formula: L = 0.2126×R + 0.7152×G + 0.0722×B (sRGB).
 */
function getLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/**
 * Build the inline CSS-variable overrides for a custom display theme.
 * Returns undefined when no theme is set (default palette applies).
 *
 * For light backgrounds (luminance > 0.4), surface and border colors are
 * derived as semi-transparent black to maintain contrast. For dark backgrounds,
 * they remain semi-transparent white (the default pattern).
 */
export function buildThemeStyle(
  theme: DisplayThemeOverrides | null | undefined,
): React.CSSProperties | undefined {
  if (!theme) return undefined;

  const textSecondary = parseHex(theme.textSecondary);
  const bgLuminance = getLuminance(theme.background);
  const isLightBackground = bgLuminance > 0.4;

  // Surface and border colors adapt to background luminance
  const surfaceBase = isLightBackground ? '0, 0, 0' : '255, 255, 255';
  const surface = `rgba(${surfaceBase}, ${isLightBackground ? 0.06 : 0.08})`;
  const surfaceHover = `rgba(${surfaceBase}, ${isLightBackground ? 0.1 : 0.12})`;
  const surfaceActive = `rgba(${surfaceBase}, ${isLightBackground ? 0.14 : 0.16})`;
  const border = `rgba(${surfaceBase}, ${isLightBackground ? 0.12 : 0.12})`;
  const borderStrong = `rgba(${surfaceBase}, ${isLightBackground ? 0.24 : 0.2})`;

  return {
    '--color-midnight': theme.background,
    '--color-midnight-light': shadeHexColour(theme.background, 0.18),
    '--color-midnight-dark': shadeHexColour(theme.background, -0.4),
    '--color-emerald': theme.accent,
    '--color-emerald-light': shadeHexColour(theme.accent, 0.18),
    '--color-emerald-dark': shadeHexColour(theme.accent, -0.25),
    '--color-gold': theme.highlight,
    '--color-gold-light': shadeHexColour(theme.highlight, 0.2),
    '--color-gold-dark': shadeHexColour(theme.highlight, -0.18),
    // Dua badges / accents follow the mosque accent rather than a fixed blue.
    '--color-dua': theme.accent,
    '--color-dua-light': shadeHexColour(theme.accent, 0.25),
    '--color-text-primary': theme.textPrimary,
    '--color-text-secondary': textSecondary
      ? hexToRgba(theme.textSecondary, textSecondary.a)
      : theme.textSecondary,
    '--color-text-muted': hexToRgba(theme.textSecondary, 0.5),
    '--color-tomorrow-roll': theme.tomorrowRoll ?? '#8BB8D9',
    '--layout-overlay': hexToRgba(theme.background, 0.25),
    // Adaptive surface and border colors for light/dark backgrounds
    '--color-surface': surface,
    '--color-surface-hover': surfaceHover,
    '--color-surface-active': surfaceActive,
    '--color-border': border,
    '--color-border-strong': borderStrong,
  } as React.CSSProperties;
}
