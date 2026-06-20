/**
 * Normalise and format UK vehicle registration marks for display.
 * Accepts common user input (spaces, hyphens, mixed case) and returns
 * an uppercase alphanumeric string suitable for a rear plate overlay.
 */

const PLATE_MAX_LENGTH = 8;

/** Strip to A–Z / 0–9 and uppercase. */
export function normaliseUkPlateInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, PLATE_MAX_LENGTH);
}

/**
 * Format for display with a central space when long enough (current style:
 * AB12 CDE). Shorter or legacy marks are shown without forcing a split.
 */
export function formatUkPlateForDisplay(normalised: string): string {
  if (normalised.length <= 4) return normalised;
  if (normalised.length <= 7) {
    const splitAt = normalised.length - 3;
    return `${normalised.slice(0, splitAt)} ${normalised.slice(splitAt)}`;
  }
  return `${normalised.slice(0, 4)} ${normalised.slice(4)}`;
}

export function isValidUkPlate(normalised: string): boolean {
  return normalised.length >= 2 && normalised.length <= PLATE_MAX_LENGTH;
}
