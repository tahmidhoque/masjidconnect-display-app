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
  // REMOVED: textTransition state that was causing jarring flashing

  const { fontSizes, screenSize, getSizeRem } = useResponsiveFontSize();

  const initializingRef = useRef(true);
  const jamaatTimePassedRef = useRef(false);
  const initialLoadTimestampRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const calculateRemainingTimeRef = useRef<() => void>();
  const lastCountdownStateRef = useRef<boolean>(false); // Track countdown state changes

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

  // Stable timer function that doesn't recreate on every render
  const calculateRemainingTime = useCallback(() => {
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

    try {
      const now = dayjs();

      // Parse prayer time using dayjs
      let prayerDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);

      // Safety check for valid time format
      const [prayerHours, prayerMinutes] = prayerTime.split(":").map(Number);

      if (isNaN(prayerHours) || isNaN(prayerMinutes)) {
        logger.error(
          `[PrayerCountdown] Invalid prayer time format for ${prayerName}: ${prayerTime}`,
        );
        return;
      }

      prayerDayjs = prayerDayjs.hour(prayerHours).minute(prayerMinutes);

      let targetDayjs = prayerDayjs.clone();
      let shouldCountToJamaat = false;

      // Improved logic: Determine which time we should be counting down to
      if (now.isAfter(prayerDayjs)) {
        // Prayer adhan time has passed
        if (jamaatTime && !jamaatTimePassedRef.current) {
          // We have a jamaat time and it hasn't been marked as passed yet
          let jamaatDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);
          const [jamaatHours, jamaatMinutes] = jamaatTime
            .split(":")
            .map(Number);

          if (isNaN(jamaatHours) || isNaN(jamaatMinutes)) {
            logger.error(
              `[PrayerCountdown] Invalid jamaat time format for ${prayerName}: ${jamaatTime}`,
            );
            // Set target to tomorrow's prayer
            targetDayjs = prayerDayjs.clone().add(1, "day");
          } else {
            jamaatDayjs = jamaatDayjs.hour(jamaatHours).minute(jamaatMinutes);

            // If jamaat time is still in the future, switch to counting down to jamaat
            if (now.isBefore(jamaatDayjs)) {
              targetDayjs = jamaatDayjs.clone();
              shouldCountToJamaat = true;

              // Only trigger state change if we're not already counting down to jamaat
              if (!countingDownToJamaat) {
                // FIXED: Smooth transition without flashing animation
                setCountingDownToJamaat(true);
                logger.info(
                  `[PrayerCountdown] Transitioning from ${prayerName} adhan to jamaat countdown`,
                );
              }
            } else {
              // Both prayer and jamaat times have passed
              jamaatTimePassedRef.current = true;

              // Trigger countdown completion for jamaat if it just passed - not during initial load
              const jamaatJustPassed =
                Math.abs(now.diff(jamaatDayjs, "millisecond")) <= 30000;
              const timeSinceLoad =
                Date.now() - initialLoadTimestampRef.current;
              if (
                jamaatJustPassed &&
                timeSinceLoad > 5000 &&
                countingDownToJamaat
              ) {
                logger.info(
                  `[CRITICAL] ${prayerName} jamaat just completed - triggering countdown completion`,
                );
                triggerCountdownComplete(true);
              }

              // Set target to tomorrow's prayer
              targetDayjs = prayerDayjs.clone().add(1, "day");
              // Reset jamaat countdown state for next prayer cycle
              if (countingDownToJamaat) {
                setCountingDownToJamaat(false);
                jamaatTimePassedRef.current = false; // Reset for next day
              }
            }
          }
        } else {
          // Set target to tomorrow if:
          // - There's no jamaat time, OR
          // - We've already processed the prayer-to-jamaat transition
          targetDayjs = prayerDayjs.clone().add(1, "day");
          // Reset states for next day
          if (countingDownToJamaat) {
            setCountingDownToJamaat(false);
            jamaatTimePassedRef.current = false;
          }
        }
      } else {
        // Prayer time hasn't passed yet, count down to prayer time
        if (countingDownToJamaat) {
          setCountingDownToJamaat(false);
        }
      }

      // Calculate time difference - ensure we never show negative values
      const diffMs = Math.max(0, targetDayjs.diff(now, "millisecond"));
      const totalSeconds = Math.floor(diffMs / 1000);

      // Update state with new countdown values using functional updates to avoid stale closures
      setHours(totalSeconds === 0 ? 0 : Math.floor(totalSeconds / 3600));
      setMinutes(
        totalSeconds === 0 ? 0 : Math.floor((totalSeconds % 3600) / 60),
      );
      setSeconds(totalSeconds === 0 ? 0 : totalSeconds % 60);

      // Debug log much less frequently for performance (every 30 seconds)
      if (totalSeconds % 30 === 0) {
        // Only log every 30 seconds, not every second
        logger.debug(
          `[PrayerCountdown] ${prayerName} countdown: ${Math.floor(
            totalSeconds / 3600,
          )}h ${Math.floor((totalSeconds % 3600) / 60)}m ${totalSeconds % 60}s`,
          {
            prayerName,
            prayerTime,
            jamaatTime,
            countingDownToJamaat,
            targetTime: targetDayjs.format("YYYY-MM-DD HH:mm:ss"),
          },
        );
      }

      // IMPROVED: Check if countdown has reached zero with better logic
      if (totalSeconds === 0 && displayTimes) {
        // Only trigger events if not during initial page load
        const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
        if (timeSinceLoad > 5000) {
          if (countingDownToJamaat) {
            logger.info(`[CRITICAL] ${prayerName} jamaat time has arrived`);
            triggerCountdownComplete(true);
            // Move to next prayer countdown
            setTimeout(() => {
              setCountingDownToJamaat(false);
              jamaatTimePassedRef.current = true;
            }, 1000);
          } else {
            logger.info(`[CRITICAL] ${prayerName} time has arrived`);

            // IMPROVED: Better transition logic for jamaat countdown
            if (jamaatTime) {
              let jamaatDayjs = dayjs()
                .hour(0)
                .minute(0)
                .second(0)
                .millisecond(0);
              const [jamaatHours, jamaatMinutes] = jamaatTime
                .split(":")
                .map(Number);

              if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
                jamaatDayjs = jamaatDayjs
                  .hour(jamaatHours)
                  .minute(jamaatMinutes);

                // If jamaat time is still in the future
                if (now.isBefore(jamaatDayjs)) {
                  // Trigger the prayer time completion
                  triggerCountdownComplete(false);

                  // FIXED: Smooth transition to jamaat countdown without flashing
                  setTimeout(() => {
                    setCountingDownToJamaat(true);
                    logger.info(
                      `[PrayerCountdown] Transitioning from ${prayerName} adhan to jamaat countdown`,
                    );
                  }, 1000); // Brief pause before transition

                  return; // Don't set it to tomorrow yet
                }
              }
            }

            // If no jamaat time or jamaat has passed, trigger completion and move to tomorrow
            triggerCountdownComplete(false);
          }
        }
      }

      // Mark initialization as complete
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
    countingDownToJamaat, // Added to dependencies to prevent stale state
  ]);

  // Update the ref whenever calculateRemainingTime changes
  useEffect(() => {
    calculateRemainingTimeRef.current = calculateRemainingTime;
  }, [calculateRemainingTime]);

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
