/**
 * Unit tests for orientation utils.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROTATION_DEGREES,
  ORIENTATION_TO_DEGREES,
  orientationToRotationDegrees,
  parseScreenOrientation,
  isPortraitLayout,
  orientationToLayoutMode,
  parseRotationDegrees,
} from './orientation';

describe('orientationToRotationDegrees', () => {
  it('maps valid orientations to degrees', () => {
    expect(orientationToRotationDegrees('LANDSCAPE')).toBe(0);
    expect(orientationToRotationDegrees('LANDSCAPE_INVERTED')).toBe(180);
    expect(orientationToRotationDegrees('PORTRAIT')).toBe(90);
    expect(orientationToRotationDegrees('PORTRAIT_INVERTED')).toBe(270);
  });

  it('normalises hyphen to underscore', () => {
    expect(orientationToRotationDegrees('landscape-inverted')).toBe(180);
  });

  it('returns DEFAULT_ROTATION_DEGREES for invalid input', () => {
    expect(orientationToRotationDegrees('')).toBe(DEFAULT_ROTATION_DEGREES);
    expect(orientationToRotationDegrees('INVALID')).toBe(DEFAULT_ROTATION_DEGREES);
    expect(orientationToRotationDegrees('portrait')).toBe(90); // lower case normalised
  });
});

describe('parseScreenOrientation', () => {
  it('returns valid orientation for known values', () => {
    expect(parseScreenOrientation('LANDSCAPE')).toBe('LANDSCAPE');
    expect(parseScreenOrientation('PORTRAIT')).toBe('PORTRAIT');
    expect(parseScreenOrientation('landscape')).toBe('LANDSCAPE');
  });

  it('returns LANDSCAPE for invalid or unknown values', () => {
    expect(parseScreenOrientation('')).toBe('LANDSCAPE');
    expect(parseScreenOrientation('UNKNOWN')).toBe('LANDSCAPE');
    expect(parseScreenOrientation(null)).toBe('LANDSCAPE');
    expect(parseScreenOrientation(undefined)).toBe('LANDSCAPE');
  });
});

describe('isPortraitLayout', () => {
  it('returns true for PORTRAIT and PORTRAIT_INVERTED', () => {
    expect(isPortraitLayout('PORTRAIT')).toBe(true);
    expect(isPortraitLayout('PORTRAIT_INVERTED')).toBe(true);
  });

  it('returns false for LANDSCAPE and LANDSCAPE_INVERTED', () => {
    expect(isPortraitLayout('LANDSCAPE')).toBe(false);
    expect(isPortraitLayout('LANDSCAPE_INVERTED')).toBe(false);
  });
});

describe('orientationToLayoutMode', () => {
  it('returns PORTRAIT for portrait orientations', () => {
    expect(orientationToLayoutMode('PORTRAIT')).toBe('PORTRAIT');
    expect(orientationToLayoutMode('PORTRAIT_INVERTED')).toBe('PORTRAIT');
  });

  it('returns LANDSCAPE for landscape orientations', () => {
    expect(orientationToLayoutMode('LANDSCAPE')).toBe('LANDSCAPE');
    expect(orientationToLayoutMode('LANDSCAPE_INVERTED')).toBe('LANDSCAPE');
  });
});

describe('ORIENTATION_TO_DEGREES', () => {
  it('has all four orientations', () => {
    expect(ORIENTATION_TO_DEGREES.LANDSCAPE).toBe(0);
    expect(ORIENTATION_TO_DEGREES.LANDSCAPE_INVERTED).toBe(180);
    expect(ORIENTATION_TO_DEGREES.PORTRAIT).toBe(90);
    expect(ORIENTATION_TO_DEGREES.PORTRAIT_INVERTED).toBe(270);
  });
});

describe('parseRotationDegrees', () => {
  it('returns valid degrees for 0, 90, 180, 270', () => {
    expect(parseRotationDegrees(0)).toBe(0);
    expect(parseRotationDegrees(90)).toBe(90);
    expect(parseRotationDegrees(180)).toBe(180);
    expect(parseRotationDegrees(270)).toBe(270);
  });

  it('returns undefined for invalid values', () => {
    expect(parseRotationDegrees(45)).toBeUndefined();
    expect(parseRotationDegrees(-90)).toBeUndefined();
    expect(parseRotationDegrees(null)).toBeUndefined();
    expect(parseRotationDegrees(undefined)).toBeUndefined();
    expect(parseRotationDegrees('not-a-number')).toBeUndefined();
  });
});
