/**
 * Tomorrow's prayer-time display modes — mirror of
 * `MasjidConnect-Backend/packages/shared/src/types/layout-behaviour.ts`.
 *
 * `roll-forward` swaps the row to tomorrow after today's slot is done:
 * jamaat prayers wait until the in-progress window ends; Sunrise (no jamaat)
 * rolls once the sunrise time itself has passed. Start/Adhan times roll with
 * jamaat so the whole row stays consistent.
 */

import type { DisplaySettings } from '@/api/models';
import type { TomorrowsJamaatsMap } from '@/hooks/usePrayerTimes';
import { toMinutesFromMidnight } from '@/utils/dateUtils';
import { totalJamaatPhaseWindowForDisplayPrayer } from '@/utils/displaySettingsJamaat';

export const TOMORROW_JAMAAT_DISPLAY_MODES = ['off', 'column', 'roll-forward'] as const;
export type TomorrowJamaatDisplayMode = (typeof TOMORROW_JAMAAT_DISPLAY_MODES)[number];

const SUNRISE_ROW_NAMES = new Set(['sunrise', 'shuruq']);

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
  options?: { isJumuah?: boolean },
): boolean {
  if (!jamaat) return false;
  const jamaatMin = toMinutesFromMidnight(jamaat, prayerName);
  if (jamaatMin < 0) return false;
  const windowMin = totalJamaatPhaseWindowForDisplayPrayer(
    displaySettings ?? null,
    prayerName,
    options,
  );
  return nowMin > jamaatMin + windowMin;
}

/**
 * True once today's timetable slot is finished and roll-forward may swap
 * start + jamaat (and sunrise) to tomorrow.
 *
 * Jamaat prayers: after the full in-progress window.
 * Sunrise / start-only rows: after the start time itself has passed.
 */
export function isPrayerSlotComplete(
  prayerName: string,
  todayStart: string | undefined,
  todayJamaat: string | undefined,
  displaySettings: DisplaySettings | null | undefined,
  nowMin: number,
  options?: { isJumuah?: boolean },
): boolean {
  const isSunrise = SUNRISE_ROW_NAMES.has(prayerName.trim().toLowerCase());
  if (isSunrise || !todayJamaat) {
    if (!todayStart) return false;
    const startMin = toMinutesFromMidnight(todayStart, prayerName);
    if (startMin < 0) return false;
    return nowMin > startMin;
  }
  return isPrayerJamaatPhaseComplete(
    prayerName,
    todayJamaat,
    displaySettings,
    nowMin,
    options,
  );
}

export interface ResolvedJamaatDisplay {
  jamaatTime: string;
  /** Adhan/start time shown in the start column (today or rolled tomorrow). */
  startTime?: string;
  /** Row shows tomorrow's times in the main slot (roll-forward mode). */
  isRollForward: boolean;
  /** Small sublabel when tomorrow's prayer type differs (e.g. Jumuah vs Zuhr). */
  mismatchLabel: string | null;
}

export interface ResolvedPrayerTimesDisplay {
  startTime: string;
  jamaatTime: string | null;
  isRollForward: boolean;
  mismatchLabel: string | null;
}

interface ResolvePrayerTimesDisplayParams {
  prayerName: string;
  todayStart?: string;
  todayJamaat?: string;
  todayIsJumuah?: boolean;
  tomorrowsJamaats: TomorrowsJamaatsMap;
  mode: TomorrowJamaatDisplayMode;
  displaySettings: DisplaySettings | null | undefined;
  nowMin: number;
  jummahLabel: string;
  zuhrLabel: string;
}

type ResolveJamaatDisplayParams = ResolvePrayerTimesDisplayParams;

function jumuahMismatchLabel(
  todayIsJumuah: boolean,
  tomorrowIsJumuah: boolean,
  jummahLabel: string,
  zuhrLabel: string,
): string | null {
  if (tomorrowIsJumuah && !todayIsJumuah) return jummahLabel;
  if (todayIsJumuah && !tomorrowIsJumuah) return zuhrLabel;
  return null;
}

/**
 * Resolves start (Adhan) and jamaat times for a prayer row.
 * Column mode keeps today's times in the main slot (tomorrow is a separate column).
 * Roll-forward swaps start + jamaat (and sunrise) once today's slot is complete.
 */
export function resolvePrayerTimesDisplay({
  prayerName,
  todayStart = '',
  todayJamaat,
  todayIsJumuah = false,
  tomorrowsJamaats,
  mode,
  displaySettings,
  nowMin,
  jummahLabel,
  zuhrLabel,
}: ResolvePrayerTimesDisplayParams): ResolvedPrayerTimesDisplay | null {
  if (!todayStart && !todayJamaat) return null;

  const useRollForward =
    mode === 'roll-forward' &&
    !!tomorrowsJamaats &&
    isPrayerSlotComplete(
      prayerName,
      todayStart,
      todayJamaat,
      displaySettings,
      nowMin,
      { isJumuah: todayIsJumuah },
    );

  if (!useRollForward) {
    return {
      startTime: todayStart,
      jamaatTime: todayJamaat ?? null,
      isRollForward: false,
      mismatchLabel: null,
    };
  }

  const tomorrowEntry = tomorrowsJamaats?.[prayerName];
  const tomorrowStart = tomorrowEntry?.start ?? '';
  const tomorrowJamaat = tomorrowEntry?.jamaat ?? '';
  const hasTomorrow = !!(tomorrowStart || tomorrowJamaat);
  if (!hasTomorrow) {
    return {
      startTime: todayStart,
      jamaatTime: todayJamaat ?? null,
      isRollForward: false,
      mismatchLabel: null,
    };
  }

  return {
    startTime: tomorrowStart || todayStart,
    jamaatTime: tomorrowJamaat || todayJamaat || null,
    isRollForward: true,
    mismatchLabel: jumuahMismatchLabel(
      todayIsJumuah,
      tomorrowEntry?.isJumuah === true,
      jummahLabel,
      zuhrLabel,
    ),
  };
}

/**
 * Resolves which jamaat time to show in the primary jamaat column/tile.
 * Column mode keeps today's jamaat in the main slot (tomorrow is a separate column).
 * When rolling forward, also returns tomorrow's start/Adhan time so the row stays aligned.
 */
export function resolvePrayerJamaatDisplay({
  prayerName,
  todayStart,
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

  const resolved = resolvePrayerTimesDisplay({
    prayerName,
    todayStart,
    todayJamaat,
    todayIsJumuah,
    tomorrowsJamaats,
    mode,
    displaySettings,
    nowMin,
    jummahLabel,
    zuhrLabel,
  });
  if (!resolved?.jamaatTime) return null;

  return {
    jamaatTime: resolved.jamaatTime,
    startTime: resolved.startTime,
    isRollForward: resolved.isRollForward,
    mismatchLabel: resolved.mismatchLabel,
  };
}
