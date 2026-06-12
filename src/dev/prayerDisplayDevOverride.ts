/**
 * Dev-only prayer display overrides for keyboard testing.
 * Stripped from production behaviour — guards use `import.meta.env.DEV`.
 */

import logger from '@/utils/logger';
import type { PrayerPhase, PrayerPhaseData } from '@/hooks/usePrayerPhase';

/** Must match `PRAYER_PHASE_FORCE_EVENT` in `usePrayerPhase` (avoid circular import). */
const PRAYER_PHASE_FORCE_EVENT = 'prayer-phase-force-change';

export const PRAYER_DISPLAY_DEV_EVENT = 'prayer-display-dev-change';

export type InPrayerSubPhaseDev =
  | 'jamaat'
  | 'post-jamaat-supplication'
  | 'post-jamaat';

interface PrayerDisplayDevPreset {
  label: string;
  phase?: PrayerPhase;
  inPrayerSubPhase?: InPrayerSubPhaseDev;
  adhanSupplicationActive?: boolean;
}

/** Full carousel-band states for Ctrl+Shift+J (supplications + jamaat flow). */
const PRAYER_DISPLAY_DEV_CYCLE: (PrayerDisplayDevPreset | null)[] = [
  null,
  { label: 'jamaat-soon (silent phones)', phase: 'jamaat-soon' },
  { label: 'post-adhan supplication', phase: 'countdown-jamaat', adhanSupplicationActive: true },
  { label: 'in-prayer / jamaat', phase: 'in-prayer', inPrayerSubPhase: 'jamaat' },
  { label: 'in-prayer / post-jamaat supplication', phase: 'in-prayer', inPrayerSubPhase: 'post-jamaat-supplication' },
  { label: 'in-prayer / post-jamaat carousel', phase: 'in-prayer', inPrayerSubPhase: 'post-jamaat' },
];

declare global {
  interface Window {
    __IN_PRAYER_SUB_PHASE_FORCE?: InPrayerSubPhaseDev;
    __ADHAN_SUPPLICATION_FORCE?: boolean;
    __JAMAAT_BLACKOUT_FORCE?: boolean;
    /** Console fallback — same as Ctrl+Shift+J */
    __devCyclePrayerDisplay?: () => void;
    /** Console fallback — same as Ctrl+Shift+A */
    __devToggleAdhanSupplication?: () => void;
    /** Console fallback — same as Ctrl+Shift+B */
    __devToggleJamaatBlackout?: () => void;
  }
}

function defaultPrayerName(fallback: string | null): string {
  return fallback ?? 'Zuhr';
}

export function dispatchPrayerDisplayDevChange(): void {
  window.dispatchEvent(new Event(PRAYER_DISPLAY_DEV_EVENT));
  window.dispatchEvent(new Event(PRAYER_PHASE_FORCE_EVENT));
}

export function clearPrayerDisplayDevOverrides(): void {
  window.__PRAYER_PHASE_FORCE = undefined;
  window.__IN_PRAYER_SUB_PHASE_FORCE = undefined;
  window.__ADHAN_SUPPLICATION_FORCE = undefined;
  window.__JAMAAT_BLACKOUT_FORCE = undefined;
}

function applyPrayerDisplayDevPreset(preset: PrayerDisplayDevPreset | null): void {
  clearPrayerDisplayDevOverrides();
  if (!preset) {
    logger.info('[DevKeyboard] Prayer display: auto (live schedule)');
    dispatchPrayerDisplayDevChange();
    return;
  }

  if (preset.adhanSupplicationActive) {
    window.__ADHAN_SUPPLICATION_FORCE = true;
  }
  if (preset.phase) {
    window.__PRAYER_PHASE_FORCE = preset.phase;
  }
  if (preset.inPrayerSubPhase) {
    window.__IN_PRAYER_SUB_PHASE_FORCE = preset.inPrayerSubPhase;
  }

  logger.info(`[DevKeyboard] Prayer display force: ${preset.label}`);
  dispatchPrayerDisplayDevChange();
}

function findCurrentCycleIndex(): number {
  const isAuto =
    window.__PRAYER_PHASE_FORCE === undefined &&
    window.__IN_PRAYER_SUB_PHASE_FORCE === undefined &&
    window.__ADHAN_SUPPLICATION_FORCE !== true;

  if (isAuto) return 0;

  const idx = PRAYER_DISPLAY_DEV_CYCLE.findIndex((entry) => {
    if (!entry) return false;
    if (entry.adhanSupplicationActive && window.__ADHAN_SUPPLICATION_FORCE === true) {
      return entry.phase === window.__PRAYER_PHASE_FORCE;
    }
    if (entry.inPrayerSubPhase) {
      return (
        window.__PRAYER_PHASE_FORCE === 'in-prayer' &&
        window.__IN_PRAYER_SUB_PHASE_FORCE === entry.inPrayerSubPhase
      );
    }
    return (
      window.__PRAYER_PHASE_FORCE === entry.phase &&
      window.__ADHAN_SUPPLICATION_FORCE !== true &&
      window.__IN_PRAYER_SUB_PHASE_FORCE === undefined
    );
  });

  return idx >= 0 ? idx : 0;
}

/** Ctrl+Shift+J — cycle through supplication + jamaat display states. */
export function cyclePrayerDisplayDevState(): void {
  if (!import.meta.env.DEV) return;
  const nextIdx = (findCurrentCycleIndex() + 1) % PRAYER_DISPLAY_DEV_CYCLE.length;
  applyPrayerDisplayDevPreset(PRAYER_DISPLAY_DEV_CYCLE[nextIdx]);
}

/** Ctrl+Shift+A — toggle post-adhan supplication without cycling other states. */
export function toggleAdhanSupplicationDevForce(): void {
  if (!import.meta.env.DEV) return;

  if (window.__ADHAN_SUPPLICATION_FORCE === true) {
    window.__ADHAN_SUPPLICATION_FORCE = undefined;
    window.__PRAYER_PHASE_FORCE = undefined;
    logger.info('[DevKeyboard] Post-adhan supplication force: OFF');
  } else {
    window.__ADHAN_SUPPLICATION_FORCE = true;
    window.__PRAYER_PHASE_FORCE = 'countdown-jamaat';
    window.__IN_PRAYER_SUB_PHASE_FORCE = undefined;
    logger.info('[DevKeyboard] Post-adhan supplication force: ON');
  }

  dispatchPrayerDisplayDevChange();
}

/** Ctrl+Shift+B — toggle full black screen during jamaat (dev force). */
export function toggleJamaatBlackoutDevForce(): void {
  if (!import.meta.env.DEV) return;

  if (window.__JAMAAT_BLACKOUT_FORCE === true) {
    window.__JAMAAT_BLACKOUT_FORCE = undefined;
    logger.info('[DevKeyboard] Jamaat blackout force: OFF');
  } else {
    window.__JAMAAT_BLACKOUT_FORCE = true;
    window.__PRAYER_PHASE_FORCE = 'in-prayer';
    window.__IN_PRAYER_SUB_PHASE_FORCE = 'jamaat';
    window.__ADHAN_SUPPLICATION_FORCE = undefined;
    logger.info('[DevKeyboard] Jamaat blackout force: ON (in-prayer / jamaat)');
  }

  dispatchPrayerDisplayDevChange();
}

export function isJamaatBlackoutDevForced(): boolean {
  return import.meta.env.DEV && window.__JAMAAT_BLACKOUT_FORCE === true;
}

/**
 * When any dev override is active, returns the forced phase payload.
 * Called from `usePrayerPhase` before live schedule logic.
 */
export function resolvePrayerDisplayDevOverride(
  prayerName: string | null,
): PrayerPhaseData | null {
  if (!import.meta.env.DEV) return null;

  const name = defaultPrayerName(prayerName);

  if (window.__ADHAN_SUPPLICATION_FORCE === true) {
    return {
      phase: 'countdown-jamaat',
      prayerName: name,
      adhanSupplicationActive: true,
    };
  }

  const phase = window.__PRAYER_PHASE_FORCE;
  const sub = window.__IN_PRAYER_SUB_PHASE_FORCE;

  if (phase === 'in-prayer' || sub) {
    return {
      phase: 'in-prayer',
      prayerName: name,
      inPrayerSubPhase: sub ?? 'jamaat',
    };
  }

  if (phase) {
    return { phase, prayerName: name };
  }

  return null;
}
