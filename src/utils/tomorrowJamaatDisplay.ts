/**
 * Tomorrow's jamaat display modes — mirror of
 * `MasjidConnect-Backend/packages/shared/src/types/layout-behaviour.ts`.
 */

import type { DisplaySettings } from '@/api/models';
import type { TomorrowsJamaatsMap } from '@/hooks/usePrayerTimes';
import { toMinutesFromMidnight } from '@/utils/dateUtils';
import { totalJamaatPhaseWindowForDisplayPrayer } from '@/utils/displaySettingsJamaat';

export const TOMORROW_JAMAAT_DISPLAY_MODES = ['off', 'column', 'roll-forward'] as const;
export type TomorrowJamaatDisplayMode = (typeof TOMORROW_JAMAAT_DISPLAY_MODES)[number];

export function resolveTomorrowJamaatMode(
  raw: {
    tomorrowJamaatMode?: unknown;
    showTomorrowJamaat?: unknown;
  } | null | undefined,
): TomorrowJamaatDisplayMode {
  const mode = raw?.tomorrowJamaatMode;
  if (mode === 'off' || mode === 'column' || mode === 'roll-forward') {
    return mode;
  }
  if (raw?.showTomorrowJamaat === true) return 'column';
  return 'off';
}

export function tomorrowJamaatModeUsesColumn(mode: TomorrowJamaatDisplayMode): boolean {
  return mode === 'column';
}

/** True once the full jamaat phase (in progress + supplication + delay) has ended. */
export function isPrayerJamaatPhaseComplete(
  prayerName: string,
  jamaat: string | undefined,
  displaySettings: DisplaySettings | null | undefined,
  nowMin: number,
): boolean {
  if (!jamaat) return false;
  const jamaatMin = toMinutesFromMidnight(jamaat, prayerName);
  if (jamaatMin < 0) return false;
  const windowMin = totalJamaatPhaseWindowForDisplayPrayer(displaySettings ?? null, prayerName);
  return nowMin > jamaatMin + windowMin;
}

export interface ResolvedJamaatDisplay {
  jamaatTime: string;
  /** Row shows tomorrow's jamaat in the main slot (roll-forward mode). */
  isRollForward: boolean;
  /** Small sublabel when tomorrow's prayer type differs (e.g. Jumuah vs Zuhr). */
  mismatchLabel: string | null;
}

interface ResolveJamaatDisplayParams {
  prayerName: string;
  todayJamaat?: string;
  todayIsJumuah?: boolean;
  tomorrowsJamaats: TomorrowsJamaatsMap;
  mode: TomorrowJamaatDisplayMode;
  displaySettings: DisplaySettings | null | undefined;
  nowMin: number;
  jummahLabel: string;
  zuhrLabel: string;
}

/**
 * Resolves which jamaat time to show in the primary jamaat column/tile.
 * Column mode keeps today's jamaat in the main slot (tomorrow is a separate column).
 */
export function resolvePrayerJamaatDisplay({
  prayerName,
  todayJamaat,
  todayIsJumuah = false,
  tomorrowsJamaats,
  mode,
  displaySettings,
  nowMin,
  jummahLabel,
  zuhrLabel,
}: ResolveJamaatDisplayParams): ResolvedJamaatDisplay | null {
  if (!todayJamaat) return null;

  const useRollForward =
    mode === 'roll-forward' &&
    !!tomorrowsJamaats &&
    isPrayerJamaatPhaseComplete(prayerName, todayJamaat, displaySettings, nowMin);

  if (!useRollForward) {
    return {
      jamaatTime: todayJamaat,
      isRollForward: false,
      mismatchLabel: null,
    };
  }

  const tomorrowEntry = tomorrowsJamaats?.[prayerName];
  const tomorrowJamaat = tomorrowEntry?.jamaat ?? '';
  if (!tomorrowJamaat) {
    return {
      jamaatTime: todayJamaat,
      isRollForward: false,
      mismatchLabel: null,
    };
  }

  const tomorrowIsJumuah = tomorrowEntry?.isJumuah === true;
  const mismatchLabel = tomorrowIsJumuah && !todayIsJumuah
    ? jummahLabel
    : todayIsJumuah && !tomorrowIsJumuah
      ? zuhrLabel
      : null;

  return {
    jamaatTime: tomorrowJamaat,
    isRollForward: true,
    mismatchLabel,
  };
}
