import { useState, useEffect, useCallback, useRef } from "react";
import { PrayerTimes, type DisplaySettings } from "../api/models";
import apiClient from "../api/apiClient";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import { refreshPrayerTimes, loadPrayerTimesFromStorage, selectTimeFormat, selectDisplaySettings, selectMasjidTimezone } from "../store/slices/contentSlice";
import {
  formatTimeToDisplay,
  getNextPrayerTime,
  getTimeUntilNextPrayer,
  parseTimeString,
  toMinutesFromMidnight,
  nowMinutesInTz,
  fetchHijriDate,
  calculateApproximateHijriDate,
} from "../utils/dateUtils";
import { prayerTimesSyncInterval, defaultMasjidTimezone } from "../config/environment";
import { getCurrentForbiddenWindow } from "../utils/forbiddenPrayerTimes";
import type { CurrentForbiddenState } from "../utils/forbiddenPrayerTimes";
import logger from "../utils/logger";
import { totalJamaatPhaseWindowForDisplayPrayer } from "../utils/displaySettingsJamaat";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Dev-only: when set, overrides computed forbiddenPrayer (see useDevKeyboard Ctrl+Shift+F). */
export const FORBIDDEN_PRAYER_FORCE_EVENT = "forbidden-prayer-force-change";

/** Dev-only: dispatched when user cycles highlighted prayer (Ctrl+Shift+P). */
export const NEXT_PRAYER_CYCLE_EVENT = "next-prayer-cycle";

/** Dev-only: dispatched when user toggles "show tomorrow's list" (Ctrl+Shift+T). */
export const SHOW_TOMORROW_LIST_FORCE_EVENT = "show-tomorrow-list-force-change";

declare global {
  interface Window {
    /** Dev: force show/hide forbidden-prayer notice. undefined = use computed; null = hide; object = show with this state. */
    __FORBIDDEN_PRAYER_FORCE?: CurrentForbiddenState | null;
    /** Dev: when set (0-based index), overrides which prayer is shown as "next" / highlighted. undefined = auto. */
    __NEXT_PRAYER_INDEX?: number;
    /** Dev: when true, force showing tomorrow's prayer list (after-Isha); when false, force today; undefined = auto from time. */
    __SHOW_TOMORROW_LIST?: boolean;
  }
}

interface FormattedPrayerTime {
  name: string;
  time: string;
  jamaat?: string;
  displayTime: string;
  displayJamaat?: string;
  isNext: boolean;
  isCurrent: boolean;
  timeUntil: string;
  jamaatTime?: string;
}

/** Map of prayer name to jamaat time for the "tomorrow" relative to displayed date. */
export type TomorrowsJamaatsMap = Record<string, string> | null;

interface PrayerTimesHook {
  todaysPrayerTimes: FormattedPrayerTime[];
  nextPrayer: FormattedPrayerTime | null;
  currentPrayer: FormattedPrayerTime | null;
  currentDate: string;
  hijriDate: string | null;
  isJumuahToday: boolean;
  jumuahTime: string | null;
  jumuahDisplayTime: string | null;
  jumuahKhutbahTime: string | null;
  /** Khutbah time in HH:mm for TimeWithPeriod / strip (API `jummahKhutbah`). */
  jumuahKhutbahRaw: string | null;
  /** Next Friday jamaat (HH:mm) for landscape prayer strip — all week when week data exists. */
  upcomingJumuahJamaatRaw: string | null;
  /** Next Friday khutbah (HH:mm) for landscape prayer strip. */
  upcomingJumuahKhutbahRaw: string | null;
  /** When voluntary (nafl) prayer is discouraged (makruh times). */
  forbiddenPrayer: CurrentForbiddenState | null;
  /** Tomorrow's jamaat times by prayer name (Fajr, Zuhr, Asr, Maghrib, Isha). Null when no tomorrow data. */
  tomorrowsJamaats: TomorrowsJamaatsMap;
}

const PRAYER_NAMES = ["Fajr", "Sunrise", "Zuhr", "Asr", "Maghrib", "Isha"];
const SKIP_PRAYERS = ["Sunrise"]; // Prayers to skip in countdown
/** Prayers that have jamaat times (excludes Sunrise). */
const PRAYERS_WITH_JAMAAT = ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"];

/**
 * Resolve jamaat time from data object with case-insensitive key lookup.
 * Handles backends that return IshaJamaat (capital I) or other casing variants.
 */
function getJamaatTime(data: Record<string, unknown>, lowerName: string): string | undefined {
  const targetKey = `${lowerName}Jamaat`;
  const exact = data[targetKey];
  if (typeof exact === "string") return exact;
  const found = Object.keys(data).find((k) => k.toLowerCase() === targetKey.toLowerCase());
  if (found) {
    const val = data[found];
    return typeof val === "string" ? val : undefined;
  }
  const snake = (data[`${lowerName}_jamaat`] ?? data[`jamaat_${lowerName}`]) as string | undefined;
  return typeof snake === "string" ? snake : undefined;
}

/** Build tomorrow's jamaats map from a day's prayer data. Returns null if no valid jamaats. */
function buildTomorrowsJamaats(dayData: PrayerTimes | null): TomorrowsJamaatsMap {
  if (!dayData || typeof dayData !== "object") return null;
  const data = dayData as unknown as Record<string, unknown>;
  const map: Record<string, string> = {};
  let hasAny = false;
  for (const name of PRAYERS_WITH_JAMAAT) {
    const jamaat = getJamaatTime(data, name.toLowerCase());
    if (jamaat) {
      map[name] = jamaat;
      hasAny = true;
    }
  }
  return hasAny ? map : null;
}

/** Parse YYYY-MM-DD to that calendar day in masjid timezone (noon avoids DST edge cases). */
function parseYmdInTz(dateStr: string, tz: string): dayjs.Dayjs | null {
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(dateStr)) return null;
  const parsed = dayjs.tz(`${dateStr} 12:00:00`, tz);
  return parsed.isValid() ? parsed : null;
}

/**
 * First row in the API week array on or after today whose date is Friday and has jummah fields.
 */
function findUpcomingFridayJummahInWeek(
  dataArr: (PrayerTimes & { date?: string })[],
  todayYmd: string,
  tz: string,
): { jamaat: string | null; khutbah: string | null } | null {
  for (const row of dataArr) {
    const dateStr = row.date;
    if (!dateStr || typeof dateStr !== "string") continue;
    if (dateStr < todayYmd) continue;
    const local = parseYmdInTz(dateStr, tz);
    if (!local || local.day() !== 5) continue;
    const rec = row as unknown as Record<string, unknown>;
    const jamaat =
      typeof rec.jummahJamaat === "string" ? rec.jummahJamaat : null;
    const khutbah =
      typeof rec.jummahKhutbah === "string" ? rec.jummahKhutbah : null;
    if (!jamaat && !khutbah) continue;
    return { jamaat, khutbah };
  }
  return null;
}

/**
 * Jummah times for the landscape strip: upcoming Friday from `data`, or flat Friday-only payload.
 */
function resolveUpcomingFridayJummahRaw(
  dataArr: (PrayerTimes & { date?: string })[] | null,
  todayYmd: string,
  tz: string,
  todayData: unknown,
): { jamaat: string | null; khutbah: string | null } | null {
  if (dataArr?.length) {
    const fromWeek = findUpcomingFridayJummahInWeek(dataArr, todayYmd, tz);
    if (fromWeek) return fromWeek;
  }
  const todayLocal = parseYmdInTz(todayYmd, tz);
  if (!todayLocal || todayLocal.day() !== 5) return null;
  if (!todayData || typeof todayData !== "object") return null;
  const rec = todayData as Record<string, unknown>;
  const jamaat =
    typeof rec.jummahJamaat === "string" ? rec.jummahJamaat : null;
  const khutbah =
    typeof rec.jummahKhutbah === "string" ? rec.jummahKhutbah : null;
  if (!jamaat && !khutbah) return null;
  return { jamaat, khutbah };
}

export const usePrayerTimes = (): PrayerTimesHook => {
  // Get prayerTimes and timeFormat from Redux store
  const dispatch = useDispatch<AppDispatch>();
  const prayerTimes = useSelector(
    (state: RootState) => state.content.prayerTimes,
  );
  const timeFormat = useSelector(selectTimeFormat);
  const displaySettings = useSelector(selectDisplaySettings);
  const masjidTimezone = useSelector(selectMasjidTimezone);
  const hijriDateAdjustment = displaySettings?.hijriDateAdjustment ?? 0;

  // Use refs to prevent unnecessary re-processing
  const lastProcessedTimes = useRef<PrayerTimes | null>(null);
  const lastProcessedDate = useRef<string>("");
  /** Dev: number of displayed prayers, set when list is built (for cycle shortcut). */
  const prayersCountRef = useRef(PRAYER_NAMES.length);
  /** Transition-gated diagnostic log: only re-log when current/next changes. */
  const lastSelectionLogRef = useRef<string>("");
  /** DEV one-shot warn key for stuck dev overrides. */
  const devOverrideWarnRef = useRef<string>("");

  // Create refresh function wrapper
  const refreshPrayerTimesHandler = useCallback(
    (forceRefresh: boolean = false) => {
      dispatch(refreshPrayerTimes({ forceRefresh }));
    },
    [dispatch],
  );

  // State for UI display
  const [todaysPrayerTimes, setTodaysPrayerTimes] = useState<
    FormattedPrayerTime[]
  >([]);
  const [nextPrayer, setNextPrayer] = useState<FormattedPrayerTime | null>(
    null,
  );
  const [currentPrayer, setCurrentPrayer] =
    useState<FormattedPrayerTime | null>(null);
  const [currentDate, setCurrentDate] = useState<string>("");
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [isJumuahToday, setIsJumuahToday] = useState<boolean>(false);
  const [jumuahTime, setJumuahTime] = useState<string | null>(null);
  const [jumuahDisplayTime, setJumuahDisplayTime] = useState<string | null>(
    null,
  );
  const [jumuahKhutbahTime, setJumuahKhutbahTime] = useState<string | null>(
    null,
  );
  const [jumuahKhutbahRaw, setJumuahKhutbahRaw] = useState<string | null>(null);
  const [upcomingJumuahJamaatRaw, setUpcomingJumuahJamaatRaw] = useState<
    string | null
  >(null);
  const [upcomingJumuahKhutbahRaw, setUpcomingJumuahKhutbahRaw] = useState<
    string | null
  >(null);
  const [forbiddenPrayer, setForbiddenPrayer] =
    useState<CurrentForbiddenState | null>(null);
  const [tomorrowsJamaats, setTomorrowsJamaats] =
    useState<TomorrowsJamaatsMap>(null);
  /** Dev override: when set (not undefined), use this instead of computed forbiddenPrayer. */
  const [devForbiddenOverride, setDevForbiddenOverride] = useState<
    CurrentForbiddenState | null | undefined
  >(() => (import.meta.env.DEV ? window.__FORBIDDEN_PRAYER_FORCE : undefined));

  // Use refs to track internal state without causing rerenders
  const initializedRef = useRef<boolean>(false);
  const lastPrayerTimesDataRef = useRef<any>(null);
  const currentDayRef = useRef<number>(dayjs().date());
  const calculationsRef = useRef<{
    lastProcessTime: number;
    nextPrayerName: string;
    currentPrayerName: string;
    isProcessing: boolean;
    lastRefreshRequest: number;
  }>({
    lastProcessTime: 0,
    nextPrayerName: "",
    currentPrayerName: "",
    isProcessing: false,
    lastRefreshRequest: 0,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Min interval between calculations to prevent excessive processing
  const MIN_PROCESS_INTERVAL = 5000; // 5 seconds

  // Listen for prayer times updates from syncService (periodic sync or after refresh).
  // Use loadPrayerTimesFromStorage to avoid feedback loop: refreshPrayerTimes would call
  // syncPrayerTimes again, which would fire this event again.
  useEffect(() => {
    const handlePrayerTimesUpdate = () => {
      dispatch(loadPrayerTimesFromStorage());
    };

    window.addEventListener("prayerTimesUpdated", handlePrayerTimesUpdate);

    return () => {
      window.removeEventListener("prayerTimesUpdated", handlePrayerTimesUpdate);
    };
  }, [dispatch]);

  // Set up periodic refresh to ensure components always have fresh prayer time data
  useEffect(() => {
    // Guard against multiple intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Update prayer times every minute to ensure we catch transitions
    intervalRef.current = setInterval(() => {
      // Process the prayer times data only if we need to (time has changed)
      if (prayerTimes && !calculationsRef.current.isProcessing) {
        processPrayerTimes();
      } else if (!prayerTimes && !calculationsRef.current.isProcessing) {
        // If no prayer times data, try to refresh (throttled)
        const now = Date.now();
        if (now - calculationsRef.current.lastRefreshRequest > 30000) {
          // 30 second throttle
          logger.warn("No prayer times data available, requesting refresh");
          calculationsRef.current.lastRefreshRequest = now;
          refreshPrayerTimesHandler(true); // Force refresh on critical data missing
        }
      }
    }, 60000); // Every minute

    // Perform an immediate check for prayer times data (throttled)
    if (!prayerTimes) {
      const now = Date.now();
      if (now - calculationsRef.current.lastRefreshRequest > 10000) {
        // 10 second throttle
        logger.info(
          "Immediate check: No prayer times data available, requesting refresh",
        );
        calculationsRef.current.lastRefreshRequest = now;
        refreshPrayerTimesHandler(true); // Force refresh on initial load
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [prayerTimes, refreshPrayerTimesHandler]);

  // Periodic refresh every 4 hours to ensure long-running displays get fresh prayer times
  useEffect(() => {
    const interval = setInterval(() => {
      refreshPrayerTimesHandler(true);
    }, prayerTimesSyncInterval);
    return () => clearInterval(interval);
  }, [refreshPrayerTimesHandler]);

  // Process prayer times data when it changes
  useEffect(() => {
    // Skip if data hasn't changed
    if (prayerTimes === lastPrayerTimesDataRef.current) {
      return;
    }

    // Update the ref to the new data
    lastPrayerTimesDataRef.current = prayerTimes;

    // Log the prayer times data to help with debugging
    logger.debug("Prayer times data received in hook", {
      hasData: !!prayerTimes,
      dataType: prayerTimes ? typeof prayerTimes : "none",
      hasDataArray:
        prayerTimes &&
        "data" in prayerTimes &&
        Array.isArray((prayerTimes as any).data),
      dataFirstValues: prayerTimes
        ? JSON.stringify({
            date: prayerTimes.date,
            fajr: prayerTimes.fajr,
            sunrise: prayerTimes.sunrise,
            zuhr: prayerTimes.zuhr,
          })
        : "none",
    });

    // Validate the prayerTimes data - handle both array and object formats
    let isDataValid = false;
    let todayData: any = null;

    if (prayerTimes && typeof prayerTimes === "object") {
      // If it's an array, check the first element
      if (Array.isArray(prayerTimes) && prayerTimes.length > 0) {
        todayData = prayerTimes[0];
        isDataValid = !!(
          todayData?.fajr ||
          todayData?.zuhr ||
          todayData?.asr ||
          todayData?.maghrib ||
          todayData?.isha
        );
        logger.debug("Prayer times validation - array format", {
          arrayLength: prayerTimes.length,
          hasTodayData: !!todayData,
          isValid: isDataValid,
        });
      }
      // If it's a direct object with prayer times
      else if (
        (prayerTimes as any).fajr ||
        (prayerTimes as any).zuhr ||
        (prayerTimes as any).asr ||
        (prayerTimes as any).maghrib ||
        (prayerTimes as any).isha
      ) {
        todayData = prayerTimes;
        isDataValid = true;
        logger.debug("Prayer times validation - object format", {
          isValid: isDataValid,
          hasFajr: !!(prayerTimes as any).fajr,
        });
      }
      // If it's a wrapper object with .data property
      else if ((prayerTimes as any).data) {
        const dataProperty = (prayerTimes as any).data;
        if (Array.isArray(dataProperty) && dataProperty.length > 0) {
          todayData = dataProperty[0];
          isDataValid = !!(
            todayData?.fajr ||
            todayData?.zuhr ||
            todayData?.asr ||
            todayData?.maghrib ||
            todayData?.isha
          );
          logger.debug("Prayer times validation - wrapper with array format", {
            arrayLength: dataProperty.length,
            hasTodayData: !!todayData,
            isValid: isDataValid,
          });
        } else if (dataProperty && typeof dataProperty === "object") {
          todayData = dataProperty;
          isDataValid = !!(
            todayData?.fajr ||
            todayData?.zuhr ||
            todayData?.asr ||
            todayData?.maghrib ||
            todayData?.isha
          );
          logger.debug("Prayer times validation - wrapper with object format", {
            isValid: isDataValid,
            hasFajr: !!todayData?.fajr,
          });
        }
      }
    }

    // Process the prayer times data if valid
    if (isDataValid) {
      logger.debug("Prayer times data is valid, processing", {
        date: todayData?.date,
        hasFajr: !!todayData?.fajr,
        hasZuhr: !!todayData?.zuhr,
        hasAsr: !!todayData?.asr,
      });
      // Bypass MIN_PROCESS_INTERVAL — otherwise WS/cache updates can leave on-screen times stale
      // while Redux and IndexedDB already hold the new payload.
      setTimeout(() => processPrayerTimes(true), 0);
    } else {
      // If we have invalid data, log details and request a refresh
      logger.warn(
        "Invalid or incomplete prayer times data, requesting refresh",
        {
          prayerTimesKeys: prayerTimes
            ? Object.keys(prayerTimes).join(", ")
            : "null",
          isArray: prayerTimes ? Array.isArray(prayerTimes) : false,
          arrayLength:
            prayerTimes && Array.isArray(prayerTimes)
              ? prayerTimes.length
              : "n/a",
          hasFajr: todayData?.fajr,
          hasZuhr: todayData?.zuhr,
          hasAsr: todayData?.asr,
        },
      );
      refreshPrayerTimesHandler(); // Normal refresh for validation failures
    }
  }, [prayerTimes, refreshPrayerTimesHandler]);

  // Add effect to check for missing prayer times data
  useEffect(() => {
    // MUCH more conservative validation to prevent rapid firing
    if (!prayerTimes) {
      return; // Don't do anything if no data at all
    }

    // Only check once every 5 minutes, not every 30 seconds
    const lastCheckTime = localStorage.getItem("lastPrayerTimesCheck");
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (lastCheckTime && now - parseInt(lastCheckTime) < fiveMinutes) {
      return; // Skip check if we checked recently
    }

    // Much more lenient validation - only refresh if data is completely broken
    const hasCriticalData =
      prayerTimes &&
      typeof prayerTimes === "object" &&
      (prayerTimes.fajr || prayerTimes.data);

    if (!hasCriticalData) {
      localStorage.setItem("lastPrayerTimesCheck", now.toString());
      logger.warn(
        "Critical prayer times data missing, requesting ONE refresh",
        {
          hasPrayerTimes: !!prayerTimes,
          type: typeof prayerTimes,
        },
      );
      refreshPrayerTimesHandler(true); // Force refresh to bypass debouncing
    }
  }, [prayerTimes, refreshPrayerTimesHandler]);

  // Process prayer times data and update state.
  // When forceReprocess is true (e.g. from the periodic timer), we always recalculate
  // current/next prayer so the countdown advances after reaching zero; we do not
  // update lastProcessedTimes/lastProcessedDate so Redux-driven dedupe is unchanged.
  const processPrayerTimes = useCallback((forceReprocess?: boolean) => {
    if (!prayerTimes || calculationsRef.current.isProcessing) {
      return;
    }

    const tz = masjidTimezone || defaultMasjidTimezone;
    const currentDate = dayjs().tz(tz).format("YYYY-MM-DD");

    if (!forceReprocess) {
      // Check if we've already processed this exact data (Redux-driven path only)
      if (
        lastProcessedTimes.current === prayerTimes &&
        lastProcessedDate.current === currentDate
      ) {
        return; // Skip if already processed this data for today
      }

      // Prevent excessive processing when not forced
      const now = Date.now();
      if (now - calculationsRef.current.lastProcessTime < MIN_PROCESS_INTERVAL) {
        return;
      }
    }

    calculationsRef.current.isProcessing = true;
    calculationsRef.current.lastProcessTime = Date.now();

    try {
      logger.debug("Processing prayer times data");

      if (!forceReprocess) {
        lastProcessedTimes.current = prayerTimes;
        lastProcessedDate.current = currentDate;
      } else if (lastProcessedTimes.current !== prayerTimes) {
        // forceReprocess(true) from the 15s timer keeps the same Redux reference so we skip
        // this branch and avoid breaking countdown-only refreshes. When the reference changes
        // (e.g. content:invalidate → new payload in Redux while MIN_PROCESS_INTERVAL would
        // block a non-forced run), we must update refs so the formatted UI matches storage.
        lastProcessedTimes.current = prayerTimes;
        lastProcessedDate.current = currentDate;
      }

      // Check for date change first
      checkForDayChange();

      // Update formatted prayer times
      updateFormattedPrayerTimes();
    } catch (error) {
      logger.error("Error processing prayer times", { error });
    } finally {
      calculationsRef.current.isProcessing = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkForDayChange and updateFormattedPrayerTimes omitted to avoid definition-order issues
  }, [prayerTimes, masjidTimezone]);

  // Get and update Hijri date - memoized to prevent rerenders
  const refreshHijriDate = useCallback(async () => {
    try {
      logger.info("Fetching Hijri date from API");
      // Set a temporary loading state immediately
      setHijriDate("Loading Hijri date...");

      // Always clear any existing cached Hijri date to force a fresh calculation
      localStorage.removeItem("hijriDate");
      localStorage.removeItem("hijriDateTimestamp");
      logger.info("Cleared cached Hijri date to ensure fresh calculation");

      const hijriDateStr = await fetchHijriDate(undefined, hijriDateAdjustment);

      // Cache the result in localStorage
      localStorage.setItem("hijriDate", hijriDateStr);
      localStorage.setItem("hijriDateTimestamp", Date.now().toString());

      logger.info("Successfully fetched Hijri date", {
        hijriDate: hijriDateStr,
      });
      setHijriDate(hijriDateStr);
    } catch (error) {
      logger.error("Error fetching Hijri date:", { error });

      // Calculate approximate date as fallback
      try {
        const approximateDate = calculateApproximateHijriDate(undefined, hijriDateAdjustment);
        logger.info("Using approximate Hijri date calculation", {
          approximateDate,
        });
        setHijriDate(approximateDate);

        // Cache this approximate date
        localStorage.setItem("hijriDate", approximateDate);
        localStorage.setItem("hijriDateTimestamp", Date.now().toString());
      } catch (calcError) {
        // Last resort fallback if even calculation fails
        logger.error("Even approximate calculation failed:", { calcError });
        setHijriDate("Hijri date unavailable");
      }

      // Schedule a retry in 60 seconds
      setTimeout(() => {
        refreshHijriDate();
      }, 60000);
    }
  }, [hijriDateAdjustment]);

  // Check for day change and refresh data if needed - memoized
  const checkForDayChange = useCallback(() => {
    const tz = masjidTimezone || defaultMasjidTimezone;
    const now = dayjs().tz(tz);
    const newDay = now.date();

    // If the day has changed, force refresh the prayer data
    if (newDay !== currentDayRef.current) {
      logger.info("Day changed - refreshing prayer data", {
        oldDay: currentDayRef.current,
        newDay,
      });
      currentDayRef.current = newDay;

      // Clear all caches first
      apiClient.clearCache();

      // Force refresh prayer times with high priority (bypass debounce)
      refreshPrayerTimesHandler(true);

      // Update date information
      setCurrentDate(now.format("dddd, MMMM D, YYYY"));

      // Check if today is Friday (Friday is 5 for dayjs, Sunday is 0)
      setIsJumuahToday(now.day() === 5);

      // Refresh Hijri date
      refreshHijriDate();
    }
  }, [refreshPrayerTimesHandler, refreshHijriDate, masjidTimezone]);

  // Helper function to determine current prayer - memoized
  const calculateCurrentPrayer = useCallback(
    (prayersList: { name: string; time: string }[]) => {
      const tz = masjidTimezone || defaultMasjidTimezone;
      const now = new Date();
      let currentPrayer = null;

      // Convert time strings to Date objects in the masjid timezone so "now"
      // and prayer instants are compared in the same zone.
      const prayerTimes = prayersList.map((p) => ({
        name: p.name,
        time: p.time,
        date: parseTimeString(p.time, now, tz),
      }));

      // Sort by time
      prayerTimes.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Find the last prayer that has occurred
      for (let i = prayerTimes.length - 1; i >= 0; i--) {
        if (prayerTimes[i].date <= now) {
          currentPrayer = prayerTimes[i].name;
          break;
        }
      }

      // If no prayer today yet, use last prayer from yesterday
      if (!currentPrayer && prayerTimes.length > 0) {
        currentPrayer = prayerTimes[prayerTimes.length - 1].name;
      }

      return currentPrayer;
    },
    [masjidTimezone],
  );

  /**
   * Determine the current and next prayer indexes for today's prayer list.
   *
   * Single ordered selection (no late-night special case). All time
   * comparisons are numeric minutes-from-midnight via `toMinutesFromMidnight`,
   * which is the only safe approach when:
   *   - the device tz differs from masjid tz (e.g. Pi in UTC),
   *   - prayer strings are unpadded (e.g. "9:30"), or
   *   - Maghrib/Isha come back in 12h form (e.g. "7:45" → 19:45).
   *
   * Algorithm:
   *   1. Annotate prayers with `adhanMin` / `jamaatMin`, sort by `adhanMin`.
   *   2. Find the most-recent prayer whose adhan has passed (`lastPassedIdx`).
   *      If none has passed yet today (early morning), conceptually "current"
   *      is yesterday's last prayer — we use the same Isha→Fajr pivot used
   *      between Isha and midnight so the strip always has a "current" mark.
   *   3. If the current pointer landed on a SKIP prayer (Sunrise), shift
   *      "current" to the prayer immediately before it (Fajr).
   *   4. Decide "next": same prayer when we're still inside its jamaat-progress
   *      window or before its jamaat, otherwise the next non-skip prayer
   *      (wrapping to first prayer of the next day).
   */
  const calculatePrayersAccurately = useCallback(
    (prayers: FormattedPrayerTime[], displaySettingsForWindow: DisplaySettings | null) => {
      if (!prayers || prayers.length === 0)
        return { currentIndex: -1, nextIndex: -1 };

      const tz = masjidTimezone || defaultMasjidTimezone;
      const now = dayjs().tz(tz);
      const nowMin = nowMinutesInTz(now.toDate(), tz);

      type AnnotatedPrayer = {
        name: string;
        time: string;
        jamaat?: string;
        adhanMin: number;
        jamaatMin: number;
        originalIndex: number;
      };

      // Annotate with numeric minutes; drop entries with no parseable adhan.
      const annotated: AnnotatedPrayer[] = prayers
        .map((p, idx) => ({
          name: p.name,
          time: p.time,
          jamaat: p.jamaat,
          adhanMin: toMinutesFromMidnight(p.time, p.name),
          jamaatMin: p.jamaat ? toMinutesFromMidnight(p.jamaat, p.name) : -1,
          originalIndex: idx,
        }))
        .filter((p) => p.adhanMin >= 0);

      if (annotated.length === 0) {
        return { currentIndex: -1, nextIndex: -1 };
      }

      // Ascending by adhan minute.
      const sorted = [...annotated].sort((a, b) => a.adhanMin - b.adhanMin);
      const sortedForNext = sorted.filter(
        (p) => !SKIP_PRAYERS.includes(p.name),
      );

      // Find the latest prayer whose adhan has passed.
      let lastPassedIdx = -1;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].adhanMin <= nowMin) {
          lastPassedIdx = i;
          break;
        }
      }

      let currentIndex = -1;
      let nextIndex = -1;

      const findInPrayersByName = (name: string | undefined) =>
        name ? prayers.findIndex((p) => p.name === name) : -1;

      if (lastPassedIdx >= 0) {
        let currentSorted: AnnotatedPrayer | undefined = sorted[lastPassedIdx];

        // Sunrise is not a prayer in our slot list — current = previous prayer.
        if (currentSorted && SKIP_PRAYERS.includes(currentSorted.name)) {
          currentSorted = sorted[lastPassedIdx - 1];
        }

        if (currentSorted) {
          currentIndex = findInPrayersByName(currentSorted.name);

          // Decide "next" relative to the current prayer's jamaat window.
          const totalWindowMin = totalJamaatPhaseWindowForDisplayPrayer(
            displaySettingsForWindow,
            currentSorted.name,
          );
          const hasJamaat = currentSorted.jamaatMin >= 0;
          const beforeJamaat =
            hasJamaat && nowMin < currentSorted.jamaatMin;
          const inJamaatProgress =
            hasJamaat &&
            nowMin >= currentSorted.jamaatMin &&
            nowMin - currentSorted.jamaatMin <= totalWindowMin;

          if (beforeJamaat || inJamaatProgress) {
            nextIndex = currentIndex;
          } else {
            // Advance to the next non-skip prayer in timeline; wrap to start
            // when the current prayer was the last of the day.
            const idxInForNext = sortedForNext.findIndex(
              (p) => p.name === currentSorted!.name,
            );
            const nextEntry =
              idxInForNext >= 0 && idxInForNext < sortedForNext.length - 1
                ? sortedForNext[idxInForNext + 1]
                : sortedForNext[0];
            nextIndex = findInPrayersByName(nextEntry?.name);
          }
        }
      } else {
        // Before today's first prayer — pivot to "yesterday's last prayer
        // current, today's first prayer next" so the strip always shows
        // a current marker (matches the previous late-night branch behaviour).
        const lastSorted = sorted[sorted.length - 1];
        const firstForNext = sortedForNext[0];
        currentIndex = findInPrayersByName(lastSorted?.name);
        nextIndex = findInPrayersByName(firstForNext?.name);
      }

      return { currentIndex, nextIndex };
    },
    [masjidTimezone],
  );

  // Update formatted prayer times for display
  const updateFormattedPrayerTimes = useCallback(() => {
    if (!prayerTimes) return;
    const prayers: FormattedPrayerTime[] = [];
    const prayerTimesForCalculation: { name: string; time: string }[] = [];

    // Initialize variables for calculations
    let todayData = prayerTimes;
    let nextPrayerName = "";
    let currentPrayerName = "";

    // API returns { data: [ day0, day1, ... ] }; resolve today/tomorrow by date field
    // so we show correct day when offline at midnight (data[0] may be yesterday).
    const tz = masjidTimezone || defaultMasjidTimezone;
    const todayInMasjidTz = dayjs().tz(tz).format("YYYY-MM-DD");

    let tomorrowData: PrayerTimes | null = null;
    let dayAfterTomorrowData: PrayerTimes | null = null;
    let dataArr: (PrayerTimes & { date?: string })[] | null = null;
    if (
      prayerTimes &&
      prayerTimes.data &&
      Array.isArray(prayerTimes.data) &&
      prayerTimes.data.length > 0
    ) {
      dataArr = prayerTimes.data as (PrayerTimes & { date?: string })[];
      const todayIndex = dataArr.findIndex((d) => d.date === todayInMasjidTz);

      if (todayIndex >= 0) {
        todayData = dataArr[todayIndex];
        if (todayIndex + 1 < dataArr.length) tomorrowData = dataArr[todayIndex + 1];
        if (todayIndex + 2 < dataArr.length) dayAfterTomorrowData = dataArr[todayIndex + 2];
      } else {
        const firstDate = dataArr[0]?.date;
        if (firstDate && firstDate < todayInMasjidTz) {
          // Offline roll-forward: data[0] is yesterday, data[1] is today
          todayData = dataArr[1] ?? dataArr[0];
          tomorrowData = dataArr[2] ?? null;
          dayAfterTomorrowData = dataArr[3] ?? null;
        } else {
          // No date field or data[0] is today/future: fall back to index-based
          todayData = dataArr[0];
          if (dataArr.length > 1) tomorrowData = dataArr[1];
          if (dataArr.length > 2) dayAfterTomorrowData = dataArr[2];
        }
      }
    }

    const stripJummah = resolveUpcomingFridayJummahRaw(
      dataArr,
      todayInMasjidTz,
      tz,
      todayData,
    );
    const applyStripJummahState = () => {
      setUpcomingJumuahJamaatRaw(stripJummah?.jamaat ?? null);
      setUpcomingJumuahKhutbahRaw(stripJummah?.khutbah ?? null);
    };

    // Helper function to safely extract time
    const extractTime = (key: string): string => {
      if (typeof todayData === "object" && todayData !== null) {
        return (todayData as any)[key] || "";
      }
      return "";
    };

    // Build prayer times for calculation
    PRAYER_NAMES.forEach((name) => {
      // Skip prayers in SKIP_PRAYERS for next prayer calculation
      if (SKIP_PRAYERS.includes(name)) {
        return;
      }

      const lowerName = name.toLowerCase();
      const time = extractTime(lowerName);
      if (time) {
        prayerTimesForCalculation.push({ name, time });
      }
    });

    // Calculate locally
    const prayerRecord: Record<string, string> = {};

    prayerRecord.fajr = extractTime("fajr");
    prayerRecord.sunrise = extractTime("sunrise");
    prayerRecord.zuhr = extractTime("zuhr");
    prayerRecord.asr = extractTime("asr");
    prayerRecord.maghrib = extractTime("maghrib");
    prayerRecord.isha = extractTime("isha");

    if (Object.values(prayerRecord).some((time) => time)) {
      // Only calculate if we have at least one valid time
      try {
        const { name } = getNextPrayerTime(new Date(), prayerRecord, masjidTimezone || defaultMasjidTimezone);
        nextPrayerName = name;

        // Store in ref for later comparisons
        calculationsRef.current.nextPrayerName = nextPrayerName;

        // If we have prayer times array, also calculate current prayer
        if (prayerTimesForCalculation.length > 0) {
          currentPrayerName =
            calculateCurrentPrayer(prayerTimesForCalculation) || "";

          // Store in ref for later comparisons
          calculationsRef.current.currentPrayerName = currentPrayerName;
        }
      } catch (error) {
        logger.error("Error calculating next prayer", { error });
      }
    }

    // Create base prayer objects with times
    PRAYER_NAMES.forEach((name) => {
      try {
        const lowerName = name.toLowerCase();
        const time =
          typeof todayData === "object" && todayData !== null
            ? (todayData[lowerName as keyof PrayerTimes] as string) || ""
            : "";
        const jamaat =
          typeof todayData === "object" && todayData !== null
            ? getJamaatTime(todayData as unknown as Record<string, unknown>, lowerName)
            : undefined;

        // Initialize with default values - we'll update these flags later
        const prayer: FormattedPrayerTime = {
          name,
          time,
          jamaat,
          displayTime: formatTimeToDisplay(time, timeFormat),
          displayJamaat: jamaat ? formatTimeToDisplay(jamaat, timeFormat) : undefined,
          isNext: false,
          isCurrent: false,
          timeUntil: "",
          jamaatTime: jamaat,
        };

        prayers.push(prayer);
      } catch (error) {
        logger.error(`Error processing prayer ${name}`, { error });
      }
    });

    prayersCountRef.current = prayers.length;

    // Use the accurate calculation function to determine current and next prayers
    const { currentIndex, nextIndex: initialNextIndex } =
      calculatePrayersAccurately(prayers, displaySettings ?? null);
    let nextIndex = initialNextIndex;

    // Dev: override next highlighted prayer (cycle via Ctrl+Shift+P)
    if (import.meta.env.DEV && typeof window.__NEXT_PRAYER_INDEX === "number") {
      const override = window.__NEXT_PRAYER_INDEX;
      if (override >= 0 && override < prayers.length) {
        nextIndex = override;
      }
    }

    // DEV one-shot warn when a stuck dev override is silently driving the UI —
    // a stale __NEXT_PRAYER_INDEX or __SHOW_TOMORROW_LIST is the most common
    // explanation for "wrong prayer highlighted" reports.
    if (import.meta.env.DEV) {
      const overrideKey = `${window.__NEXT_PRAYER_INDEX ?? ""}|${window.__SHOW_TOMORROW_LIST ?? ""}`;
      if (
        overrideKey !== "|" &&
        devOverrideWarnRef.current !== overrideKey
      ) {
        devOverrideWarnRef.current = overrideKey;
        logger.warn(
          "[usePrayerTimes] Dev override active — UI is not driven by real time",
          {
            __NEXT_PRAYER_INDEX: window.__NEXT_PRAYER_INDEX,
            __SHOW_TOMORROW_LIST: window.__SHOW_TOMORROW_LIST,
          },
        );
      } else if (
        overrideKey === "|" &&
        devOverrideWarnRef.current !== ""
      ) {
        devOverrideWarnRef.current = "";
      }
    }

    // Transition-gated log of the next-prayer selection so we can trace
    // "wrong prayer at X o'clock" reports without flooding the console.
    const tzForLog = masjidTimezone || defaultMasjidTimezone;
    const nowForLog = dayjs().tz(tzForLog);
    const nextNameLog = nextIndex >= 0 ? prayers[nextIndex]?.name : "none";
    const currentNameLog =
      currentIndex >= 0 ? prayers[currentIndex]?.name : "none";
    const transitionKey = `${currentNameLog}|${nextNameLog}`;
    if (lastSelectionLogRef.current !== transitionKey) {
      lastSelectionLogRef.current = transitionKey;
      const nextEntry = nextIndex >= 0 ? prayers[nextIndex] : null;
      logger.info("[usePrayerTimes] Next-prayer selection", {
        nowHHmm: nowForLog.format("HH:mm"),
        currentPrayer: currentNameLog,
        nextPrayer: nextNameLog,
        adhan: nextEntry?.time,
        jamaat: nextEntry?.jamaat,
        A: nextEntry
          ? toMinutesFromMidnight(nextEntry.time, nextEntry.name)
          : null,
        J: nextEntry?.jamaat
          ? toMinutesFromMidnight(nextEntry.jamaat, nextEntry.name)
          : null,
        nowMin: Math.round(nowMinutesInTz(nowForLog.toDate(), tzForLog)),
      });
    }

    // After Isha the next prayer is tomorrow's Fajr; show next day's list from API data array (data[1])
    const nowDayjs = dayjs().tz(tz);
    const ishaPrayer = prayers.find((p) => p.name === "Isha");
    let ishaTimeToday: dayjs.Dayjs | null = null;
    if (ishaPrayer?.time) {
      const [h, m] = ishaPrayer.time.split(":").map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        ishaTimeToday = nowDayjs.hour(h).minute(m).second(0).millisecond(0);
      }
    }
    // Show tomorrow's list only when we're after Isha (evening): next Fajr is then the next calendar day
    const needTomorrowListFromTime =
      nextIndex === 0 &&
      prayers[0]?.name === "Fajr" &&
      ishaTimeToday != null &&
      nowDayjs.isAfter(ishaTimeToday);
    const devOverride =
      import.meta.env.DEV ? window.__SHOW_TOMORROW_LIST : undefined;
    const needTomorrowList =
      devOverride === true && !!tomorrowData
        ? true
        : devOverride === false
          ? false
          : needTomorrowListFromTime;

    if (!needTomorrowList) {
      setCurrentDate(nowDayjs.format("dddd, MMMM D, YYYY"));
      setIsJumuahToday(nowDayjs.day() === 5);
      setTomorrowsJamaats(buildTomorrowsJamaats(tomorrowData));
    } else if (needTomorrowList && tomorrowData) {
      setTomorrowsJamaats(buildTomorrowsJamaats(dayAfterTomorrowData));
      // Build displayed list from tomorrow's day in the API data array (data[1])
      const prayersFromTomorrow: FormattedPrayerTime[] = [];
      PRAYER_NAMES.forEach((name) => {
        const lowerName = name.toLowerCase();
        const time =
          typeof tomorrowData === "object" && tomorrowData !== null
            ? (tomorrowData[lowerName as keyof PrayerTimes] as string) || ""
            : "";
        const jamaat =
          typeof tomorrowData === "object" && tomorrowData !== null
            ? getJamaatTime(tomorrowData as unknown as Record<string, unknown>, lowerName)
            : undefined;
        prayersFromTomorrow.push({
          name,
          time,
          jamaat,
          displayTime: formatTimeToDisplay(time, timeFormat),
          displayJamaat: jamaat
            ? formatTimeToDisplay(jamaat, timeFormat)
            : undefined,
          isNext: name === "Fajr",
          isCurrent: false,
          timeUntil: "",
          jamaatTime: jamaat,
        });
      });
      const fajrFromTomorrow = prayersFromTomorrow.find((p) => p.name === "Fajr");
      if (fajrFromTomorrow) {
        fajrFromTomorrow.timeUntil = getTimeUntilNextPrayer(
          fajrFromTomorrow.time,
          true,
        );
        setNextPrayer(fajrFromTomorrow);
      }
      // Preserve currentPrayer = Isha during the in-prayer window so usePrayerPhase
      // can correctly show "Jamaat in progress" for the full duration.
      const inIshaInPrayerWindow =
        ishaPrayer?.jamaat &&
        (() => {
          const nowMin =
            nowDayjs.hour() * 60 +
            nowDayjs.minute() +
            nowDayjs.second() / 60;
          const jamaatMin = toMinutesFromMidnight(
            ishaPrayer.jamaat,
            ishaPrayer.name,
          );
          const totalWindowMin = totalJamaatPhaseWindowForDisplayPrayer(
            displaySettings ?? null,
            ishaPrayer.name,
          );
          return (
            jamaatMin >= 0 &&
            nowMin >= jamaatMin &&
            nowMin - jamaatMin <= totalWindowMin
          );
        })();
      setCurrentPrayer(inIshaInPrayerWindow ? ishaPrayer : null);
      setTodaysPrayerTimes(prayersFromTomorrow);
      setCurrentDate(
        nowDayjs.add(1, "day").format("dddd, MMMM D, YYYY"),
      );
      setIsJumuahToday(nowDayjs.add(1, "day").day() === 5);
      const tomorrowObj = tomorrowData as unknown as Record<string, unknown>;
      if (nowDayjs.add(1, "day").day() === 5 && tomorrowObj.jummahJamaat) {
        setJumuahTime((tomorrowObj.jummahJamaat as string) ?? null);
        setJumuahDisplayTime(
          formatTimeToDisplay(
            (tomorrowObj.jummahJamaat as string) ?? "",
            timeFormat,
          ),
        );
        setJumuahKhutbahTime(
          tomorrowObj.jummahKhutbah
            ? formatTimeToDisplay(
                tomorrowObj.jummahKhutbah as string,
                timeFormat,
              )
            : null,
        );
        setJumuahKhutbahRaw(
          typeof tomorrowObj.jummahKhutbah === "string"
            ? tomorrowObj.jummahKhutbah
            : null,
        );
      } else {
        setJumuahTime(null);
        setJumuahDisplayTime(null);
        setJumuahKhutbahTime(null);
        setJumuahKhutbahRaw(null);
      }
      setForbiddenPrayer(
        getCurrentForbiddenWindow(
          tomorrowData as unknown as PrayerTimes,
          new Date(),
          masjidTimezone || defaultMasjidTimezone,
        ) ?? null,
      );
      applyStripJummahState();
      return;
    } else {
      // needTomorrowList but no tomorrowData — fall through with today's list
      setTomorrowsJamaats(buildTomorrowsJamaats(tomorrowData));
    }

    // Apply the calculated flags
    if (currentIndex >= 0) {
      prayers[currentIndex].isCurrent = true;
      setCurrentPrayer(prayers[currentIndex]);
    } else {
      // Clear current prayer if none was found
      setCurrentPrayer(null);
    }

    // Calculate time until next prayer or jamaat
    if (nextIndex >= 0) {
      prayers[nextIndex].isNext = true;

      const nextPrayer = prayers[nextIndex];

      const tz = masjidTimezone || defaultMasjidTimezone;
      const now = dayjs().tz(tz);
      const nowMin = nowMinutesInTz(now.toDate(), tz);
      const adhanMin = toMinutesFromMidnight(nextPrayer.time, nextPrayer.name);
      const jamaatMin = nextPrayer.jamaat
        ? toMinutesFromMidnight(nextPrayer.jamaat, nextPrayer.name)
        : -1;

      // Numeric comparison handles unpadded ("9:30") and 12h Maghrib/Isha
      // values ("7:45" → 19:45), unlike the previous string compare.
      if (jamaatMin >= 0 && nowMin >= adhanMin && nowMin < jamaatMin) {
        // Between adhan and jamaat → countdown to jamaat.
        nextPrayer.timeUntil = getTimeUntilNextPrayer(
          nextPrayer.jamaat!,
          false,
          {},
          tz,
        );
        nextPrayer.isCurrent = false;
      } else if (adhanMin >= 0 && nowMin > adhanMin) {
        // Adhan already passed and we're outside the jamaat window — the
        // next occurrence is tomorrow. Exception: early-morning Fajr where
        // `nowMin` may legitimately be greater (e.g. 02:00 < 04:30 still
        // today, but `nowMin > adhanMin` is false there so we don't hit this
        // branch — kept for symmetry with the previous logic).
        nextPrayer.timeUntil = getTimeUntilNextPrayer(
          nextPrayer.time,
          true,
          {},
          tz,
        );
      } else {
        // Counting down to today's adhan.
        nextPrayer.timeUntil = getTimeUntilNextPrayer(
          nextPrayer.time,
          false,
          {},
          tz,
        );
      }

      setNextPrayer(nextPrayer);
    } else {
      setNextPrayer(null);
    }

    // Update the prayers array in state to trigger render
    setTodaysPrayerTimes(prayers);

    // Compute forbidden (makruh) window for voluntary prayer
    setForbiddenPrayer(
      getCurrentForbiddenWindow(todayData as PrayerTimes, new Date(), masjidTimezone || defaultMasjidTimezone) ?? null,
    );

    // Set Jumuah time if it's Friday — use nowDayjs.day() directly to avoid stale closure
    // (isJumuahToday state may not have updated yet when this effect runs)
    const isFriday = nowDayjs.day() === 5;
    if (isFriday && todayData && todayData.jummahJamaat) {
      setJumuahTime(todayData.jummahJamaat);
      setJumuahDisplayTime(formatTimeToDisplay(todayData.jummahJamaat, timeFormat));
      setJumuahKhutbahTime(
        todayData.jummahKhutbah
          ? formatTimeToDisplay(todayData.jummahKhutbah, timeFormat)
          : null,
      );
      setJumuahKhutbahRaw(todayData.jummahKhutbah ?? null);
    } else {
      setJumuahTime(null);
      setJumuahDisplayTime(null);
      setJumuahKhutbahTime(null);
      setJumuahKhutbahRaw(null);
    }

    applyStripJummahState();
  }, [
    prayerTimes,
    timeFormat,
    masjidTimezone,
    calculateCurrentPrayer,
    calculatePrayersAccurately,
    displaySettings,
  ]);

  // Initial loading of data
  useEffect(() => {
    try {
      // Set current date in the masjid timezone so the displayed date and
      // Friday detection are correct when the Pi runs in UTC.
      const date = dayjs().tz(masjidTimezone || defaultMasjidTimezone);
      setCurrentDate(date.format("dddd, MMMM D, YYYY"));

      // Check if today is Friday (5 for dayjs)
      setIsJumuahToday(date.day() === 5);

      // Initial force refresh on component mount to ensure fresh data
      if (!initializedRef.current) {
        logger.info("Initial prayer times load");
        initializedRef.current = true;

        // Always fetch Hijri date on initial load, don't wait for prayerTimes
        refreshHijriDate();

        // Process prayer times if available
        if (prayerTimes) {
          setTimeout(() => processPrayerTimes(), 10);
        }
      }

      // Set up timer to periodically recalculate current/next prayer so countdown
      // advances after reaching zero. forceReprocess(true) bypasses "already
      // processed today" so we always refresh; interval 15s for snappy transition.
      const timer = setInterval(() => {
        try {
          processPrayerTimes(true);

          // Check if we need to update the Hijri date (once per hour)
          const now = new Date();
          if (now.getMinutes() === 0) {
            // Update at the top of each hour
            refreshHijriDate();
          }
        } catch (error) {
          logger.error("Error in timer update", { error });
        }
      }, 15 * 1000);

      return () => clearInterval(timer);
    } catch (error) {
      logger.error("Error in prayer times initialization", { error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run once

  // Process prayer times whenever they change
  useEffect(() => {
    if (prayerTimes && initializedRef.current) {
      // Add a small timeout to avoid render loop
      const timerId = setTimeout(() => {
        processPrayerTimes(true);
      }, 50);

      return () => clearTimeout(timerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerTimes]); // Only depend on prayerTimes

  // Refresh Hijri date when hijriDateAdjustment changes (e.g. after display_settings content:invalidate)
  useEffect(() => {
    if (initializedRef.current) {
      refreshHijriDate();
    }
  }, [hijriDateAdjustment, refreshHijriDate]);

  // Re-process prayer times when timeFormat changes
  useEffect(() => {
    if (prayerTimes && initializedRef.current) {
      // Clear the last processed data to force reprocessing with new format
      lastProcessedTimes.current = null;
      lastProcessedDate.current = "";
      
      // Process with new time format
      const timerId = setTimeout(() => {
        processPrayerTimes(true);
      }, 10);

      return () => clearTimeout(timerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFormat]); // Only re-process when timeFormat changes

  // Dev: listen for forbidden-prayer force toggle (Ctrl+Shift+F)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = () =>
      setDevForbiddenOverride(window.__FORBIDDEN_PRAYER_FORCE);
    window.addEventListener(FORBIDDEN_PRAYER_FORCE_EVENT, handler);
    return () => window.removeEventListener(FORBIDDEN_PRAYER_FORCE_EVENT, handler);
  }, []);

  // Dev: listen for show-tomorrow-list toggle (Ctrl+Shift+T) — re-process so list updates
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = () => processPrayerTimesRef.current?.(true);
    window.addEventListener(SHOW_TOMORROW_LIST_FORCE_EVENT, handler);
    return () =>
      window.removeEventListener(SHOW_TOMORROW_LIST_FORCE_EVENT, handler);
  }, []);

  // Dev: listen for cycle highlighted prayer (Ctrl+Shift+P)
  const processPrayerTimesRef = useRef(processPrayerTimes);
  processPrayerTimesRef.current = processPrayerTimes;
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = () => {
      const len = prayersCountRef.current;
      if (len === 0) return;
      const cur = window.__NEXT_PRAYER_INDEX;
      const next =
        cur === undefined ? 0 : cur + 1 >= len ? undefined : cur + 1;
      window.__NEXT_PRAYER_INDEX = next;
      logger.info(
        `[DevKeyboard] Highlighted prayer: ${next !== undefined ? `index ${next}` : "auto"}`,
      );
      processPrayerTimesRef.current(true);
    };
    window.addEventListener(NEXT_PRAYER_CYCLE_EVENT, handler);
    return () => window.removeEventListener(NEXT_PRAYER_CYCLE_EVENT, handler);
  }, []);

  const effectiveForbiddenPrayer =
    devForbiddenOverride !== undefined ? devForbiddenOverride : forbiddenPrayer;

  return {
    todaysPrayerTimes,
    nextPrayer,
    currentPrayer,
    currentDate,
    hijriDate,
    isJumuahToday,
    jumuahTime,
    jumuahDisplayTime,
    jumuahKhutbahTime,
    jumuahKhutbahRaw,
    upcomingJumuahJamaatRaw,
    upcomingJumuahKhutbahRaw,
    forbiddenPrayer: effectiveForbiddenPrayer,
    tomorrowsJamaats,
  };
};
