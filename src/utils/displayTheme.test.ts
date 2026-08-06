/**
 * Tests for display theme CSS-variable mapping.
 */

import { describe, it, expect } from 'vitest';
import { buildThemeStyle, shadeHexColour } from './displayTheme';
import type { DisplayThemeOverrides } from '../types/displayLayout';

const PURPLE_THEME: DisplayThemeOverrides = {
  background: '#241546',
  accent: '#A98AE0',
  highlight: '#F0C674',
  textPrimary: '#FFFFFF',
  textSecondary: '#CFBCEC',
  tomorrowRoll: '#9DB6E0',
};

describe('buildThemeStyle', () => {
  it('returns undefined when no theme is set', () => {
    expect(buildThemeStyle(null)).toBeUndefined();
    expect(buildThemeStyle(undefined)).toBeUndefined();
  });

  it('maps mosque colours onto the token CSS variables used across the app', () => {
    const style = buildThemeStyle(PURPLE_THEME) as Record<string, string>;

    expect(style['--color-midnight']).toBe('#241546');
    expect(style['--color-emerald']).toBe('#A98AE0');
    expect(style['--color-gold']).toBe('#F0C674');
    expect(style['--color-text-primary']).toBe('#FFFFFF');
    expect(style['--color-tomorrow-roll']).toBe('#9DB6E0');
    // Dua accents follow the mosque accent (not a hard-coded blue).
    expect(style['--color-dua']).toBe('#A98AE0');
    expect(style['--color-dua-light']).toBe(shadeHexColour('#A98AE0', 0.25));
  });
});
