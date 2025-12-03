import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import logger from "../../utils/logger";
import dayjs from "dayjs";

interface PrayerCountdownProps {
  prayerTime: string;
  jamaatTime?: string;
  prayerName: string;
  onCountdownComplete?: (isJamaat: boolean) => void;
  displayTimes?: boolean;
  timeUntilNextPrayer?: string;
}

const PrayerCountdown: React.FC<PrayerCountdownProps> = ({
  prayerTime,
  jamaatTime,
  prayerName,
  onCountdownComplete,
  displayTimes = true,
  timeUntilNextPrayer,
}) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [countingDownToJamaat, setCountingDownToJamaat] = useState(false);

  const { fontSizes, screenSize, getSizeRem } = useResponsiveFontSize();

  const initializingRef = useRef(true);
  const initialLoadTimestampRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const calculateRemainingTimeRef = useRef<() => void>();
  
  // Track completion status to avoid triggering multiple times
  const prayerCompletionTriggeredRef = useRef(false);
  const jamaatCompletionTriggeredRef = useRef(false);
  // Track the last prayer/jamaat times to detect prop changes
  const lastPrayerTimeRef = useRef<string>("");
  const lastJamaatTimeRef = useRef<string | undefined>("");

  /**
   * Helper: Parse time string (HH:MM) into a dayjs object for today
   */
  const parseTimeToday = useCallback((timeStr: string): dayjs.Dayjs | null => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
      return null;
    }
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) {
      return null;
    }
    return dayjs().hour(h).minute(m).second(0).millisecond(0);
  }, []);

  // Create stable callback for countdown completion
  const triggerCountdownComplete = useCallback(
    (isJamaat: boolean) => {
      if (onCountdownComplete) {
        logger.info(
          `[PrayerCountdown] Triggering countdown completion for ${prayerName}, isJamaat: ${isJamaat}`,
        );
        onCountdownComplete(isJamaat);
      }
    },
    [onCountdownComplete, prayerName],
  );

  /**
   * SIMPLIFIED countdown calculation logic:
   * 1. If prayer time is in the future -> count down to prayer time
   * 2. If prayer time passed BUT jamaat is in the future -> count down to jamaat
   * 3. If both passed -> show 00:00:00 and signal completion (let parent handle next prayer)
   * 
   * NO "add 1 day" logic - this component only handles the current prayer times passed via props
   */
  const calculateRemainingTime = useCallback(() => {
    if (!prayerTime) {
      logger.error("No prayer time provided for countdown");
      return;
    }

    // Validate prayer time format
    if (!/^\d{1,2}:\d{2}$/.test(prayerTime)) {
      logger.error(
        `Invalid prayer time format for ${prayerName}: ${prayerTime}`,
      );
      return;
    }

    try {
      const now = dayjs();
      let prayerDayjs = parseTimeToday(prayerTime);

      if (!prayerDayjs) {
        logger.error(`[PrayerCountdown] Could not parse prayer time: ${prayerTime}`);
        return;
      }

      // If prayer time is in the past, it must be tomorrow's prayer
      // (parent component already determined this is the next prayer)
      if (now.isAfter(prayerDayjs)) {
        prayerDayjs = prayerDayjs.add(1, "day");
        logger.debug(
          `[PrayerCountdown] ${prayerName} time ${prayerTime} is in the past, adjusted to tomorrow: ${prayerDayjs.format("YYYY-MM-DD HH:mm")}`,
        );
      }

      let targetDayjs: dayjs.Dayjs | null = null;
      let shouldCountToJamaat = false;

      // SIMPLIFIED LOGIC: Determine target time
      if (now.isBefore(prayerDayjs)) {
        // Case 1: Prayer time is still in the future - count down to prayer time
        targetDayjs = prayerDayjs;
        shouldCountToJamaat = false;

        // Reset jamaat countdown state if we're back to counting to prayer
        if (countingDownToJamaat) {
          setCountingDownToJamaat(false);
        }
      } else if (jamaatTime) {
        // Prayer time has passed, check jamaat time
        const jamaatDayjs = parseTimeToday(jamaatTime);
        
        if (jamaatDayjs && now.isBefore(jamaatDayjs)) {
          // Case 2: Prayer passed but jamaat is in the future - count down to jamaat
          targetDayjs = jamaatDayjs;
          shouldCountToJamaat = true;

          // Update state to show jamaat countdown
          if (!countingDownToJamaat) {
            setCountingDownToJamaat(true);
            logger.info(
              `[PrayerCountdown] Switching to ${prayerName} jamaat countdown`,
            );
          }
        } else {
          // Case 3: Both prayer and jamaat times have passed
          targetDayjs = null;
        }
      } else {
        // Case 3: Prayer passed and no jamaat time
        targetDayjs = null;
      }

      // Calculate countdown values
      let totalSeconds = 0;
      if (targetDayjs) {
        const diffMs = Math.max(0, targetDayjs.diff(now, "millisecond"));
        totalSeconds = Math.floor(diffMs / 1000);
      }

      // Update display state
      setHours(Math.floor(totalSeconds / 3600));
      setMinutes(Math.floor((totalSeconds % 3600) / 60));
      setSeconds(totalSeconds % 60);

      // Debug logging (every 30 seconds to reduce noise)
      if (totalSeconds % 30 === 0 || totalSeconds === 0) {
        logger.debug(
          `[PrayerCountdown] ${prayerName} countdown: ${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m ${totalSeconds % 60}s`,
          {
            prayerName,
            prayerTime,
            jamaatTime,
            countingDownToJamaat: shouldCountToJamaat,
            targetTime: targetDayjs?.format("HH:mm:ss") || "completed",
          },
        );
      }

      // Handle countdown completion - only trigger once per prayer/jamaat
      const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
      const isInitialized = timeSinceLoad > 3000;

      if (totalSeconds === 0 && isInitialized && displayTimes) {
        if (shouldCountToJamaat || countingDownToJamaat) {
          // Jamaat countdown reached zero
          if (!jamaatCompletionTriggeredRef.current) {
            jamaatCompletionTriggeredRef.current = true;
            logger.info(`[PrayerCountdown] ${prayerName} jamaat time reached - triggering completion`);
            triggerCountdownComplete(true);
            
            // Reset jamaat state
            setTimeout(() => {
              setCountingDownToJamaat(false);
            }, 500);
          }
        } else if (targetDayjs === null) {
          // Both prayer and jamaat have passed (or no jamaat exists)
          if (!prayerCompletionTriggeredRef.current && !jamaatCompletionTriggeredRef.current) {
            // Check if we should trigger for prayer time completion
            const prayerJustPassed = prayerDayjs && Math.abs(now.diff(prayerDayjs, "second")) <= 5;
            
            if (prayerJustPassed) {
              prayerCompletionTriggeredRef.current = true;
              logger.info(`[PrayerCountdown] ${prayerName} prayer time reached - triggering completion`);
              triggerCountdownComplete(false);
              
              // If there's a jamaat time, switch to jamaat countdown
              if (jamaatTime) {
                const jamaatDayjs = parseTimeToday(jamaatTime);
                if (jamaatDayjs && now.isBefore(jamaatDayjs)) {
                  setTimeout(() => {
                    setCountingDownToJamaat(true);
                    logger.info(`[PrayerCountdown] Transitioning to ${prayerName} jamaat countdown`);
                  }, 500);
                }
              }
            } else if (!prayerCompletionTriggeredRef.current) {
              // Prayer time passed but not "just passed" - likely page loaded after prayer time
              // Still trigger completion so parent can move to next prayer
              prayerCompletionTriggeredRef.current = true;
              logger.info(`[PrayerCountdown] ${prayerName} already passed - triggering completion for next prayer`);
              triggerCountdownComplete(false);
            }
          }
        }
      }

      // Mark initialization complete
      if (initializingRef.current) {
        initializingRef.current = false;
      }
    } catch (error) {
      logger.error(`[PrayerCountdown] Error in countdown calculation:`, {
        prayerName,
        prayerTime,
        jamaatTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    prayerTime,
    jamaatTime,
    prayerName,
    displayTimes,
    triggerCountdownComplete,
    countingDownToJamaat,
    parseTimeToday,
  ]);

  // Update the ref whenever calculateRemainingTime changes
  useEffect(() => {
    calculateRemainingTimeRef.current = calculateRemainingTime;
  }, [calculateRemainingTime]);

  // Reset completion tracking refs when prayer changes (new prayer loaded)
  useEffect(() => {
    // Check if props have actually changed
    if (lastPrayerTimeRef.current !== prayerTime || lastJamaatTimeRef.current !== jamaatTime) {
      logger.debug(`[PrayerCountdown] Prayer changed from ${lastPrayerTimeRef.current} to ${prayerTime}, resetting completion refs`);
      
      // Reset completion tracking for the new prayer
      prayerCompletionTriggeredRef.current = false;
      jamaatCompletionTriggeredRef.current = false;
      
      // Reset countdown state
      setCountingDownToJamaat(false);
      
      // Update tracked values
      lastPrayerTimeRef.current = prayerTime;
      lastJamaatTimeRef.current = jamaatTime;
      
      // Reset initialization timestamp for the new prayer
      initialLoadTimestampRef.current = Date.now();
    }
  }, [prayerTime, jamaatTime]);

  // Main effect to set up timer - ONLY depends on stable values
  useEffect(() => {
    if (!prayerTime) {
      logger.error("No prayer time provided for countdown");
      return;
    }

    // Validate prayer time format - must be HH:MM format
    const isValidTimeFormat = /^\d{1,2}:\d{2}$/.test(prayerTime);
    if (!isValidTimeFormat) {
      logger.error(
        `Invalid prayer time format for ${prayerName}: ${prayerTime}`,
      );
      return;
    }

    // Set up initial time using pre-calculated value if available
    if (initializingRef.current && timeUntilNextPrayer) {
      try {
        if (
          timeUntilNextPrayer.includes("hr") ||
          timeUntilNextPrayer.includes("min")
        ) {
          const hourMatch = timeUntilNextPrayer.match(/(\d+)\s*hr/);
          const minuteMatch = timeUntilNextPrayer.match(/(\d+)\s*min/);

          const h = hourMatch ? parseInt(hourMatch[1], 10) : 0;
          const m = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;

          setHours(h);
          setMinutes(m);
          setSeconds(0);

          logger.debug(
            `[PrayerCountdown] Initial time set for ${prayerName} from pre-calculated value: ${h}hr ${m}min`,
          );
        }
      } catch (error) {
        logger.warn(
          "Error parsing pre-calculated time, will calculate fresh:",
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    }

    // Calculate time immediately
    if (calculateRemainingTimeRef.current) {
      calculateRemainingTimeRef.current();
    }

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Set up interval for countdown with more precise timing
    timerRef.current = setInterval(() => {
      if (calculateRemainingTimeRef.current) {
        calculateRemainingTimeRef.current();
      }
    }, 1000);

    // Clean up interval on component unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // CRITICAL: Only include stable dependencies - NOT hours, minutes, seconds, or calculateRemainingTime
  }, [prayerTime, jamaatTime, prayerName, displayTimes]);

  // Helper functions for display formatting
  const formatTimeDisplay = (value: number): string => {
    return value.toString().padStart(2, "0");
  };

  const isPortrait = !screenSize.isLandscape;

  if (!displayTimes) {
    return null;
  }

  return (
    <Box
      sx={{
        textAlign: "center",
        // REMOVED: jarring textTransition animation - now always stable
        opacity: 1,
      }}
    >
      <Typography
        sx={{
          fontSize: isPortrait
            ? screenSize.is720p
              ? fontSizes.h6
              : fontSizes.h6
            : fontSizes.body1,
          fontWeight: 600,
          textAlign: "center",
          opacity: 0.9,
          fontFamily: "'Poppins', sans-serif",
          mb: isPortrait ? getSizeRem(0.4) : getSizeRem(0.3),
          color: "#fff",
          letterSpacing: "0.5px",
        }}
      >
        {countingDownToJamaat
          ? `${prayerName} Jamaa't will be in`
          : `${prayerName} will be in`}
      </Typography>

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          gap: isPortrait ? getSizeRem(0.1) : getSizeRem(0.1),
        }}
      >
        {/* Hours */}
        <Box
          sx={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: isPortrait ? getSizeRem(4) : getSizeRem(3),
          }}
        >
          <Typography
            sx={{
              fontSize: isPortrait
                ? screenSize.is720p
                  ? fontSizes.h2
                  : fontSizes.h3
                : fontSizes.h3,
              fontWeight: "bold",
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: "#F1C40F",
              letterSpacing: "0px",
              textShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
            }}
          >
            {formatTimeDisplay(hours)}
          </Typography>
          <Typography
            sx={{
              fontSize: isPortrait ? fontSizes.caption : fontSizes.caption,
              color: "rgba(255, 255, 255, 0.7)",
              fontWeight: 500,
              mt: isPortrait ? getSizeRem(0.1) : getSizeRem(0.05),
              letterSpacing: "0.5px",
            }}
          >
            HOURS
          </Typography>
        </Box>

        {/* Separator */}
        <Typography
          sx={{
            fontSize: isPortrait
              ? screenSize.is720p
                ? fontSizes.h2
                : fontSizes.h3
              : fontSizes.h3,
            fontWeight: "bold",
            color: "#F1C40F",
            mx: isPortrait ? getSizeRem(0.2) : getSizeRem(0.1),
            lineHeight: 1,
          }}
        >
          :
        </Typography>

        {/* Minutes */}
        <Box
          sx={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: isPortrait ? getSizeRem(4) : getSizeRem(3),
          }}
        >
          <Typography
            sx={{
              fontSize: isPortrait
                ? screenSize.is720p
                  ? fontSizes.h2
                  : fontSizes.h3
                : fontSizes.h3,
              fontWeight: "bold",
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: "#F1C40F",
              letterSpacing: "0px",
              textShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
            }}
          >
            {formatTimeDisplay(minutes)}
          </Typography>
          <Typography
            sx={{
              fontSize: isPortrait ? fontSizes.caption : fontSizes.caption,
              color: "rgba(255, 255, 255, 0.7)",
              fontWeight: 500,
              mt: isPortrait ? getSizeRem(0.1) : getSizeRem(0.05),
              letterSpacing: "0.5px",
            }}
          >
            MINUTES
          </Typography>
        </Box>

        {/* Separator */}
        <Typography
          sx={{
            fontSize: isPortrait
              ? screenSize.is720p
                ? fontSizes.h2
                : fontSizes.h3
              : fontSizes.h3,
            fontWeight: "bold",
            color: "#F1C40F",
            mx: isPortrait ? getSizeRem(0.2) : getSizeRem(0.1),
            lineHeight: 1,
          }}
        >
          :
        </Typography>

        {/* Seconds */}
        <Box
          sx={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: isPortrait ? getSizeRem(4) : getSizeRem(3),
          }}
        >
          <Typography
            sx={{
              fontSize: isPortrait
                ? screenSize.is720p
                  ? fontSizes.h2
                  : fontSizes.h3
                : fontSizes.h3,
              fontWeight: "bold",
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: "#F1C40F",
              letterSpacing: "0px",
              textShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
            }}
          >
            {formatTimeDisplay(seconds)}
          </Typography>
          <Typography
            sx={{
              fontSize: isPortrait ? fontSizes.caption : fontSizes.caption,
              color: "rgba(255, 255, 255, 0.7)",
              fontWeight: 500,
              mt: isPortrait ? getSizeRem(0.1) : getSizeRem(0.05),
              letterSpacing: "0.5px",
            }}
          >
            SECONDS
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default PrayerCountdown;
