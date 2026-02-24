import { useState, useEffect, useCallback, useRef } from "react";
import { PrayerTimes, TimeFormat } from "../api/models";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import { refreshPrayerTimes, selectTimeFormat } from "../store/slices/contentSlice";
import {
  formatTimeToDisplay,
  getNextPrayerTime,
  getTimeUntilNextPrayer,
  parseTimeString,
  fetchHijriDate,
  calculateApproximateHijriDate,
} from "../utils/dateUtils";
import apiClient from "../api/apiClient";
import logger from "../utils/logger";
import dayjs from "dayjs";

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
}

const PRAYER_NAMES = ["Fajr", "Sunrise", "Zuhr", "Asr", "Maghrib", "Isha"];
const SKIP_PRAYERS = ["Sunrise"]; // Prayers to skip in countdown

export const usePrayerTimes = (): PrayerTimesHook => {
  // Get prayerTimes and timeFormat from Redux store
  const dispatch = useDispatch<AppDispatch>();
  const prayerTimes = useSelector(
    (state: RootState) => state.content.prayerTimes,
  );
  const timeFormat = useSelector(selectTimeFormat);

  // Use refs to prevent unnecessary re-processing
  const lastProcessedTimes = useRef<PrayerTimes | null>(null);
  const lastProcessedDate = useRef<string>("");

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

  // Listen for prayer times updates from data sync service
  useEffect(() => {
    const handlePrayerTimesUpdate = () => {
      logger.info("Prayer times update detected, refreshing data");
      refreshPrayerTimesHandler(true); // Force refresh to bypass debouncing when data sync completes
    };

    window.addEventListener("prayerTimesUpdated", handlePrayerTimesUpdate);

    return () => {
      window.removeEventListener("prayerTimesUpdated", handlePrayerTimesUpdate);
    };
  }, [refreshPrayerTimesHandler]);

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

  // Process prayer times data when it changes
  useEffect(() => {
    // Skip if data hasn't changed
    if (prayerTimes === lastPrayerTimesDataRef.current) {
      return;
    }

    // Update the ref to the new data
    lastPrayerTimesDataRef.current = prayerTimes;

    // Log the prayer times data to help with debugging
    logger.info("Prayer times data received in hook", {
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
      logger.info("Prayer times data is valid, processing", {
        date: todayData?.date,
        hasFajr: !!todayData?.fajr,
        hasZuhr: !!todayData?.zuhr,
        hasAsr: !!todayData?.asr,
      });
      setTimeout(() => processPrayerTimes(), 0);
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

    const currentDate = new Date().toISOString().split("T")[0];

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
  }, [prayerTimes]);

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

      const hijriDateStr = await fetchHijriDate();

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
        const approximateDate = calculateApproximateHijriDate();
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
  }, []);

  // Check for day change and refresh data if needed - memoized
  const checkForDayChange = useCallback(() => {
    const now = dayjs();
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

      // Force refresh prayer times with high priority
      refreshPrayerTimesHandler();

      // Update date information
      setCurrentDate(now.format("dddd, MMMM D, YYYY"));

      // Check if today is Friday (Friday is 5 for dayjs, Sunday is 0)
      setIsJumuahToday(now.day() === 5);

      // Refresh Hijri date
      refreshHijriDate();
    }
  }, [refreshPrayerTimesHandler, refreshHijriDate]);

  // Helper function to determine current prayer - memoized
  const calculateCurrentPrayer = useCallback(
    (prayersList: { name: string; time: string }[]) => {
      const now = new Date();
      let currentPrayer = null;

      // Convert time strings to Date objects for today
      const prayerTimes = prayersList.map((p) => ({
        name: p.name,
        time: p.time,
        date: parseTimeString(p.time),
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
    [],
  );

  // Helper function to determine current and next prayer accurately - memoized
  const calculatePrayersAccurately = useCallback(
    (prayers: FormattedPrayerTime[]) => {
      if (!prayers || prayers.length === 0)
        return { currentIndex: -1, nextIndex: -1 };

      let currentIndex = -1;
      let nextIndex = -1;

      // Get current time for comparison
      const now = dayjs();
      const currentTimeStr = now.format("HH:mm");

      logger.debug(
        `[calculatePrayersAccurately] Calculating prayer status at ${currentTimeStr}`,
        {
          prayerCount: prayers.length,
          currentTime: currentTimeStr,
        },
      );

      // First, create a sorted copy of prayers by time
      // We create new objects to avoid mutating the original array
      const sortedPrayers = prayers
        .map((p) => ({ name: p.name, time: p.time, jamaat: p.jamaat }))
        .sort((a, b) => {
          // Handle special case for Fajr which may appear at end of day but actually be the first prayer
          if (a.time < "03:00" && b.time > "20:00") return -1;
          if (a.time > "20:00" && b.time < "03:00") return 1;
          return a.time.localeCompare(b.time);
        });

      // For "next prayer" / countdown we must skip Sunrise (not a prayer)
      const sortedPrayersForNext = sortedPrayers.filter(
        (p) => !SKIP_PRAYERS.includes(p.name),
      );

      // Log sorted prayers for debugging
      logger.debug(
        "[calculatePrayersAccurately] Sorted prayers:",
        { prayers: sortedPrayers.map(
          (p) =>
            `${p.name}: ${p.time}${p.jamaat ? ` (Jamaat: ${p.jamaat})` : ""}`,
        ) },
      );

      // Special case: if near midnight, handle Isha prayer specially
      if (now.hour() >= 22 || now.hour() < 3) {
        // Check if Isha is one of our prayers
        const ishaIndex = prayers.findIndex((p) => p.name === "Isha");
        const fajrIndex = prayers.findIndex((p) => p.name === "Fajr");

        if (ishaIndex >= 0 && fajrIndex >= 0) {
          const isha = prayers[ishaIndex];
          const fajr = prayers[fajrIndex];

          // Convert to 24-hour clock mental model
          const ishaTime = isha.time;
          const fajrTime = fajr.time;

          // If it's past Isha time and before Fajr time
          if (currentTimeStr >= ishaTime || currentTimeStr < fajrTime) {
            // FIXED: Better logic for late night - consider jamaat time for Isha
            if (
              isha.jamaat &&
              currentTimeStr >= ishaTime &&
              currentTimeStr < isha.jamaat
            ) {
              // Between Isha adhan and jamaat - mark Isha as current, still next for jamaat countdown
              currentIndex = ishaIndex;
              nextIndex = ishaIndex; // Still counting down to jamaat
            } else {
              // Isha is current (past jamaat or no jamaat), Fajr is next
              currentIndex = ishaIndex;
              nextIndex = fajrIndex;
            }

            logger.info(
              "Late night scenario: Isha handling with jamaat consideration",
              {
                ishaTime,
                ishaJamaat: isha.jamaat,
                fajrTime,
                currentTime: currentTimeStr,
                currentPrayer:
                  currentIndex >= 0 ? prayers[currentIndex].name : "none",
                nextPrayer: nextIndex >= 0 ? prayers[nextIndex].name : "none",
              },
            );
          }
        }
      } else {
        // Regular time flow - IMPROVED LOGIC

        // Find the current prayer period and next prayer
        let foundCurrentPrayer = false;

        for (let i = 0; i < sortedPrayers.length; i++) {
          const currentSortedPrayer = sortedPrayers[i];
          const currentPrayerIndex = prayers.findIndex(
            (p) => p.name === currentSortedPrayer.name,
          );

          if (currentPrayerIndex >= 0) {
            const prayer = prayers[currentPrayerIndex];

            // Check if we are in this prayer's time window
            if (currentTimeStr >= prayer.time) {
              // Prayer adhan time has passed

              // Check if we have a next prayer to compare against
              const nextSortedPrayer =
                i < sortedPrayers.length - 1 ? sortedPrayers[i + 1] : null;
              const isLastPrayerOfDay = !nextSortedPrayer;

              // If this is the last prayer of the day, or if we haven't reached the next prayer time yet
              if (isLastPrayerOfDay || currentTimeStr < nextSortedPrayer.time) {
                // We are in this prayer's period
                currentIndex = currentPrayerIndex;
                foundCurrentPrayer = true;

                // Determine what should be "next"
                if (prayer.jamaat && currentTimeStr < prayer.jamaat) {
                  // Between adhan and jamaat time - next is the jamaat of this same prayer
                  nextIndex = currentPrayerIndex;
                  logger.info(
                    `Between ${prayer.name} adhan (${prayer.time}) and jamaat (${prayer.jamaat}) - counting down to jamaat`,
                  );
                } else {
                  // Past jamaat time or no jamaat - next is the next prayer (skip Sunrise)
                  if (isLastPrayerOfDay) {
                    nextIndex = prayers.findIndex(
                      (p) => p.name === sortedPrayersForNext[0].name,
                    );
                  } else {
                    const idxInForNext = sortedPrayersForNext.findIndex(
                      (p) => p.name === currentSortedPrayer.name,
                    );
                    const nextInForNext =
                      idxInForNext >= 0 && idxInForNext < sortedPrayersForNext.length - 1
                        ? sortedPrayersForNext[idxInForNext + 1]
                        : null;
                    nextIndex = nextInForNext
                      ? prayers.findIndex((p) => p.name === nextInForNext.name)
                      : prayers.findIndex(
                          (p) => p.name === sortedPrayersForNext[0].name,
                        );
                  }
                  logger.info(
                    `Past ${prayer.name} jamaat time or no jamaat - next prayer is ${nextIndex >= 0 ? prayers[nextIndex].name : "unknown"}`,
                  );
                }
                break;
              }
            }
          }
        }

        // If no current prayer found, all prayers are in the future
        if (!foundCurrentPrayer) {
          // Next prayer is the first (non-Skip) one that hasn't passed yet
          for (let i = 0; i < sortedPrayersForNext.length; i++) {
            if (sortedPrayersForNext[i].time > currentTimeStr) {
              nextIndex = prayers.findIndex(
                (p) => p.name === sortedPrayersForNext[i].name,
              );
              logger.info(
                `All prayers are in future - next prayer is ${prayers[nextIndex].name}`,
              );
              break;
            }
          }

          // If still no next prayer found, use first (non-Skip) prayer of tomorrow
          if (nextIndex === -1 && sortedPrayersForNext.length > 0) {
            nextIndex = prayers.findIndex(
              (p) => p.name === sortedPrayersForNext[0].name,
            );
            logger.info(
              `All prayers have passed today - next prayer is tomorrow's ${prayers[nextIndex].name}`,
            );
          }
        }
      }

      // REMOVED: The problematic code that was clearing current prayer when jamaat passed
      // This was causing the highlighting to disappear (issue 2a)

      // Log the final result
      logger.debug("[calculatePrayersAccurately] Final result:", {
        currentIndex,
        currentPrayer: currentIndex >= 0 ? prayers[currentIndex].name : "none",
        nextIndex,
        nextPrayer: nextIndex >= 0 ? prayers[nextIndex].name : "none",
      });

      return { currentIndex, nextIndex };
    },
    [],
  );

  // Update formatted prayer times for display
  const updateFormattedPrayerTimes = useCallback(() => {
    if (!prayerTimes) return;

    // Get current date/time
    const now = Date.now();
    const prayers: FormattedPrayerTime[] = [];
    const prayerTimesForCalculation: { name: string; time: string }[] = [];

    // Initialize variables for calculations
    let todayData = prayerTimes;
    let nextPrayerName = "";
    let currentPrayerName = "";

    // Check if we have the data array format and extract today's prayer times if so
    if (
      prayerTimes &&
      prayerTimes.data &&
      Array.isArray(prayerTimes.data) &&
      prayerTimes.data.length > 0
    ) {
      todayData = prayerTimes.data[0];
    }

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
        const { name } = getNextPrayerTime(new Date(), prayerRecord);
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
            ? (() => {
                const base = (todayData[`${lowerName}Jamaat` as keyof PrayerTimes] as string | undefined);
                if (base) return base;
                const data = todayData as unknown as Record<string, unknown>;
                return (data[`${lowerName}_jamaat`] ?? data[`jamaat_${lowerName}`]) as string | undefined;
              })()
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

    // Use the accurate calculation function to determine current and next prayers
    const { currentIndex, nextIndex } = calculatePrayersAccurately(prayers);

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

      // Get the next prayer object
      const nextPrayer = prayers[nextIndex];

      // Current time for comparison
      const now = dayjs();
      const currentTimeStr = now.format("HH:mm");

      // If next prayer has jamaat time and it's after the adhan time and current time is between adhan and jamaat
      // then countdown to jamaat time, otherwise countdown to adhan time
      if (
        nextPrayer.jamaat &&
        nextPrayer.time <= currentTimeStr &&
        nextPrayer.jamaat > currentTimeStr
      ) {
        // Countdown to jamaat time
        nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.jamaat);
        logger.info(
          `Showing countdown to ${nextPrayer.name} jamaat time (${nextPrayer.jamaat})`,
        );

        // Make sure this prayer is not also marked as current when it's between adhan and jamaat
        nextPrayer.isCurrent = false;
      } else {
        // Check if this prayer's time has already passed today
        const [prayerHours, prayerMinutes] = nextPrayer.time
          .split(":")
          .map(Number);
        const prayerTime = dayjs()
          .hour(prayerHours)
          .minute(prayerMinutes)
          .second(0)
          .millisecond(0);

        // If prayer time has passed today, it means we're counting down to tomorrow's occurrence
        // Need to be careful comparing dayjs objects
        // Only consider it passed if it's truly *before* now on the same day
        if (
          now.isAfter(prayerTime) &&
          !(now.hour() < 6 && nextPrayer.name === "Fajr")
        ) {
          logger.info(
            `Prayer time ${nextPrayer.time} is in the past, adjusting to tomorrow`,
          );
          nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time, true); // Pass flag to force tomorrow
        } else {
          // Special handling for after midnight scenario with Isha prayer
          if (now.hour() < 6 && nextPrayer.name === "Fajr") {
            // Use the utility function directly
            nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time);
            logger.info(
              `Showing countdown to ${nextPrayer.name} adhan time (${nextPrayer.time}) - early morning hours`,
            );
          } else {
            // Regular countdown to adhan time
            nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time);
            logger.info(
              `Showing countdown to ${nextPrayer.name} adhan time (${nextPrayer.time})`,
            );
          }
        }
      }

      // Update next prayer in state
      setNextPrayer(nextPrayer);
    } else {
      // Clear next prayer if none was found
      setNextPrayer(null);
    }

    // Update the prayers array in state to trigger render
    setTodaysPrayerTimes(prayers);

    // Set Jumuah time if it's Friday
    if (isJumuahToday && todayData && todayData.jummahJamaat) {
      setJumuahTime(todayData.jummahJamaat);
      setJumuahDisplayTime(formatTimeToDisplay(todayData.jummahJamaat, timeFormat));

      // Set Khutbah time if available
      if (todayData.jummahKhutbah) {
        setJumuahKhutbahTime(formatTimeToDisplay(todayData.jummahKhutbah, timeFormat));
      }
    }
  }, [
    prayerTimes,
    isJumuahToday,
    timeFormat,
    calculateCurrentPrayer,
    calculatePrayersAccurately,
  ]);

  // Initial loading of data
  useEffect(() => {
    try {
      // Set current date
      const date = dayjs();
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
        processPrayerTimes();
      }, 50);

      return () => clearTimeout(timerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerTimes]); // Only depend on prayerTimes

  // Re-process prayer times when timeFormat changes
  useEffect(() => {
    if (prayerTimes && initializedRef.current) {
      // Clear the last processed data to force reprocessing with new format
      lastProcessedTimes.current = null;
      lastProcessedDate.current = "";
      
      // Process with new time format
      const timerId = setTimeout(() => {
        processPrayerTimes();
      }, 10);

      return () => clearTimeout(timerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFormat]); // Only re-process when timeFormat changes

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
  };
};
