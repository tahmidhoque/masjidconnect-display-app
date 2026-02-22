/**
 * Orientation utilities for display app.
 * Maps four orientation values to rotation degrees (PRD §3.3).
 */

import type { RotationDegrees, ScreenOrientation } from '@/types/realtime';

/** Default rotation when orientation is invalid (safe fallback). */
export const DEFAULT_ROTATION_DEGREES: RotationDegrees = 0;

/** Mapping from orientation to rotation degrees when rotationDegrees is omitted (PRD §3.3). */
export const ORIENTATION_TO_DEGREES: Record<ScreenOrientation, RotationDegrees> = {
  LANDSCAPE: 0,
  LANDSCAPE_INVERTED: 180,
  PORTRAIT: 90,
  PORTRAIT_INVERTED: 270,
};

const VALID_ORIENTATIONS: ScreenOrientation[] = [
  'LANDSCAPE',
  'LANDSCAPE_INVERTED',
  'PORTRAIT',
  'PORTRAIT_INVERTED',
];

/**
 * Returns rotation in degrees for a given orientation string.
 * Use when payload.rotationDegrees is absent (backward compatibility).
 */
export function orientationToRotationDegrees(orientation: string): RotationDegrees {
  const normalised = String(orientation ?? '').toUpperCase().replace(/-/g, '_');
  if (VALID_ORIENTATIONS.includes(normalised as ScreenOrientation)) {
    return ORIENTATION_TO_DEGREES[normalised as ScreenOrientation];
  }
  return DEFAULT_ROTATION_DEGREES;
}

/**
 * Validates and normalises orientation string to ScreenOrientation.
 * Returns LANDSCAPE for invalid/unknown values (safe fallback, FR-8).
 */
export function parseScreenOrientation(value: unknown): ScreenOrientation {
  const s = String(value ?? '').toUpperCase().replace(/-/g, '_');
  if (VALID_ORIENTATIONS.includes(s as ScreenOrientation)) {
    return s as ScreenOrientation;
  }
  return 'LANDSCAPE';
}

/**
 * Whether the orientation uses portrait layout (content in portrait aspect).
 * LANDSCAPE and LANDSCAPE_INVERTED = false; PORTRAIT and PORTRAIT_INVERTED = true (FR-6).
 */
export function isPortraitLayout(orientation: ScreenOrientation): boolean {
  return orientation === 'PORTRAIT' || orientation === 'PORTRAIT_INVERTED';
}

/**
 * Layout mode for components that only need landscape vs portrait (e.g. ReferenceViewport).
 */
export type LayoutMode = 'LANDSCAPE' | 'PORTRAIT';

export function orientationToLayoutMode(orientation: ScreenOrientation): LayoutMode {
  return isPortraitLayout(orientation) ? 'PORTRAIT' : 'LANDSCAPE';
}

const VALID_DEGREES: RotationDegrees[] = [0, 90, 180, 270];

/**
 * Parses optional rotationDegrees from payload. Returns undefined if invalid or missing.
 */
export function parseRotationDegrees(value: unknown): RotationDegrees | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  if (Number.isInteger(n) && VALID_DEGREES.includes(n as RotationDegrees)) {
    return n as RotationDegrees;
  }
  return undefined;
}
