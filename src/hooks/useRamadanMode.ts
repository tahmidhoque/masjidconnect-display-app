/**
 * useRamadanMode
 *
 * Detects whether the current Hijri month is Ramadan (month 9) and
 * provides Ramadan-specific data: day counter, Suhoor/Iftar times,
 * fasting state, and live countdowns.
 *
 * Also manages the `data-theme="ramadan"` attribute on `<html>` so
 * the entire CSS theme switches automatically.
 *
 * Detection is purely local — no backend dependency. Uses the existing
 * `calculateApproximateHijriDate()` utility which returns strings like
 * "15 Ramadan 1447 AH".
 *
 * A dev override flag (`__RAMADAN_FORCE`) on `window` allows toggling
 * Ramadan mode for testing outside the actual month (see useDevKeyboard).
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { usePrayerTimes } from './usePrayerTimes';
import { useCurrentTime } from './useCurrentTime';
import { calculateApproximateHijriDate, getTimeUntilNextPrayer } from '../utils/dateUtils';
import logger from '../utils/logger';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RamadanModeData {
  /** Whether the current Hijri month is Ramadan (or forced via dev toggle) */
  isRamadan: boolean;
  /** Current day of Ramadan (1-30), or null when not Ramadan */
  ramadanDay: number | null;
  /** Fajr adhan time — marks end of Suhoor (HH:mm) */
  suhoorEndTime: string | null;
  /** Maghrib adhan time — marks Iftar (HH:mm) */
  iftarTime: string | null;
  /** True when current time is between Fajr and Maghrib */
  isFastingHours: boolean;
  /** Live countdown string to Iftar (during fasting hours only) */
  timeToIftar: string | null;
  /** Live countdown string to Suhoor end (between midnight and Fajr only) */
  timeToSuhoorEnd: string | null;
}

/* ------------------------------------------------------------------ */
/*  Dev-mode force flag                                                */
/*                                                                     */
/*  The toggle (useDevKeyboard Ctrl+Shift+R) sets window.__RAMADAN_FORCE */
/*  and dispatches a 'ramadan-force-change' CustomEvent so the hook     */
/*  can react immediately via useState.                                 */
/* ------------------------------------------------------------------ */

/** Custom event name dispatched by the dev toggle */
export const RAMADAN_FORCE_EVENT = 'ramadan-force-change';

declare global {
  interface Window {
    __RAMADAN_FORCE?: boolean | undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  Hijri date parser                                                  */
/* ------------------------------------------------------------------ */

interface ParsedHijri {
  day: number;
  month: string;
  year: number;
}

/**
 * Parse the string returned by `calculateApproximateHijriDate()`.
 * Expected format: "15 Ramadan 1447 AH"
 */
function parseHijriString(hijri: string): ParsedHijri | null {
  if (!hijri) return null;

  const parts = hijri.replace(/\s*AH\s*$/i, '').trim().split(/\s+/);
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parts[1];
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(year) || !month) return null;
  return { day, month, year };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useRamadanMode = (): RamadanModeData => {
  const currentTime = useCurrentTime();
  const { todaysPrayerTimes } = usePrayerTimes();

  /* ---- Dev force flag as reactive state ---- */
  const [forceFlag, setForceFlag] = useState<boolean | undefined>(
    () => window.__RAMADAN_FORCE,
  );

  useEffect(() => {
    const handleForceChange = () => {
      setForceFlag(window.__RAMADAN_FORCE);
    };
    window.addEventListener(RAMADAN_FORCE_EVENT, handleForceChange);
    return () => window.removeEventListener(RAMADAN_FORCE_EVENT, handleForceChange);
  }, []);

  /* ---- Hijri date (recalculated once per calendar day) ---- */
  const hijriParsed = useMemo(() => {
    const hijriStr = calculateApproximateHijriDate();
    return parseHijriString(hijriStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime.getDate()]);

  /* ---- Ramadan detection ---- */
  const isRamadan = useMemo(() => {
    if (forceFlag === true) return true;
    if (forceFlag === false) return false;
    return hijriParsed?.month === 'Ramadan';
  }, [hijriParsed, forceFlag]);

  const ramadanDay = useMemo(() => {
    if (!isRamadan) return null;
    // When forced and not actually Ramadan, show day 15 as placeholder
    if (hijriParsed?.month !== 'Ramadan') return 15;
    return hijriParsed?.day ?? null;
  }, [isRamadan, hijriParsed]);

  /* ---- Extract Fajr (Suhoor end) and Maghrib (Iftar) times ---- */
  const suhoorEndTime = useMemo(() => {
    if (!isRamadan || !todaysPrayerTimes?.length) return null;
    const fajr = todaysPrayerTimes.find((p) => p.name === 'Fajr');
    return fajr?.time ?? null;
  }, [isRamadan, todaysPrayerTimes]);

  const iftarTime = useMemo(() => {
    if (!isRamadan || !todaysPrayerTimes?.length) return null;
    const maghrib = todaysPrayerTimes.find((p) => p.name === 'Maghrib');
    return maghrib?.time ?? null;
  }, [isRamadan, todaysPrayerTimes]);

  /* ---- Fasting state ---- */
  const isFastingHours = useMemo(() => {
    if (!isRamadan || !suhoorEndTime || !iftarTime) return false;

    const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    return nowHHmm >= suhoorEndTime && nowHHmm < iftarTime;
  }, [isRamadan, suhoorEndTime, iftarTime, currentTime]);

  /* ---- Live countdowns (recomputed every second via currentTime) ---- */
  const timeToIftar = useMemo(() => {
    if (!isRamadan || !isFastingHours || !iftarTime) return null;
    return getTimeUntilNextPrayer(iftarTime, false);
  }, [isRamadan, isFastingHours, iftarTime, currentTime]);

  const timeToSuhoorEnd = useMemo(() => {
    if (!isRamadan || !suhoorEndTime) return null;

    const nowHHmm = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    // Only show suhoor countdown between midnight and Fajr
    if (nowHHmm >= suhoorEndTime) return null;
    return getTimeUntilNextPrayer(suhoorEndTime, false);
  }, [isRamadan, suhoorEndTime, currentTime]);

  /* ---- Theme attribute side effect ---- */
  const applyTheme = useCallback((active: boolean) => {
    if (active) {
      document.documentElement.dataset.theme = 'ramadan';
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, []);

  useEffect(() => {
    applyTheme(isRamadan);
    if (isRamadan) {
      logger.info('[RamadanMode] Ramadan theme activated', { day: ramadanDay });
    }

    return () => {
      // Clean up on unmount — restore default theme
      delete document.documentElement.dataset.theme;
    };
  }, [isRamadan, ramadanDay, applyTheme]);

  return {
    isRamadan,
    ramadanDay,
    suhoorEndTime,
    iftarTime,
    isFastingHours,
    timeToIftar,
    timeToSuhoorEnd,
  };
};

export default useRamadanMode;
