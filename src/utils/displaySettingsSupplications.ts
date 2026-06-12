/**
 * Timing helpers for portal-controlled scheduled supplications.
 * Supplication text is hard-coded in `scheduledSupplications.ts`.
 */

import type { DisplaySettings } from '@/api/models';

const DEFAULT_POST_ADHAN_DELAY = 0;
const DEFAULT_POST_ADHAN_DURATION = 3;
const DEFAULT_POST_JAMAAT_DURATION = 3;

function clampMinutes(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function isPostAdhanSupplicationEnabled(
  settings: DisplaySettings | null | undefined,
): boolean {
  return settings?.postAdhanSupplication?.enabled === true;
}

export function isPostJamaatSupplicationEnabled(
  settings: DisplaySettings | null | undefined,
): boolean {
  return settings?.postJamaatSupplication?.enabled === true;
}

export function isJamaatBlackoutMode(
  settings: DisplaySettings | null | undefined,
): boolean {
  return settings?.jamaatInProgressMode === 'dark';
}

export function postAdhanSupplicationDelayMinutes(
  settings: DisplaySettings | null | undefined,
): number {
  return clampMinutes(
    settings?.postAdhanSupplication?.delayMinutes,
    0,
    15,
    DEFAULT_POST_ADHAN_DELAY,
  );
}

export function postAdhanSupplicationDurationMinutes(
  settings: DisplaySettings | null | undefined,
): number {
  return clampMinutes(
    settings?.postAdhanSupplication?.durationMinutes,
    1,
    15,
    DEFAULT_POST_ADHAN_DURATION,
  );
}

export function postJamaatSupplicationDurationMinutes(
  settings: DisplaySettings | null | undefined,
): number {
  return clampMinutes(
    settings?.postJamaatSupplication?.durationMinutes,
    1,
    15,
    DEFAULT_POST_JAMAAT_DURATION,
  );
}

/**
 * True when the post-adhan supplication should replace the content carousel.
 * `jamaatLeadMin` — silent-phones lead window; phones graphic wins when closer to jamaat.
 */
export function isPostAdhanSupplicationActive(
  settings: DisplaySettings | null | undefined,
  nowMinutes: number,
  adhanMinutes: number,
  jamaatMinutes: number,
  jamaatLeadMin: number,
): boolean {
  if (!isPostAdhanSupplicationEnabled(settings)) return false;
  if (adhanMinutes < 0 || jamaatMinutes < 0) return false;

  const delay = postAdhanSupplicationDelayMinutes(settings);
  const duration = postAdhanSupplicationDurationMinutes(settings);
  const start = adhanMinutes + delay;
  const end = start + duration;

  if (nowMinutes < start || nowMinutes >= end) return false;
  if (nowMinutes >= jamaatMinutes) return false;
  if (nowMinutes >= jamaatMinutes - jamaatLeadMin) return false;

  return true;
}
