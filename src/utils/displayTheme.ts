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
 * Build the inline CSS-variable overrides for a custom display theme.
 * Returns undefined when no theme is set (default palette applies).
 */
export function buildThemeStyle(
  theme: DisplayThemeOverrides | null | undefined,
): React.CSSProperties | undefined {
  if (!theme) return undefined;

  const textSecondary = parseHex(theme.textSecondary);

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
    '--color-text-primary': theme.textPrimary,
    '--color-text-secondary': textSecondary
      ? hexToRgba(theme.textSecondary, textSecondary.a)
      : theme.textSecondary,
    '--color-text-muted': hexToRgba(theme.textSecondary, 0.5),
    '--color-tomorrow-roll': theme.tomorrowRoll ?? '#8BB8D9',
    '--layout-overlay': hexToRgba(theme.background, 0.25),
  } as React.CSSProperties;
}
