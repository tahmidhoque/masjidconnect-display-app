import React, { useCallback, memo, useMemo, useRef } from "react";
import { Box } from "@mui/material";
import { useAppSelector } from "../../store/hooks";
import { selectLandscapeDisplayData } from "../../store/hooks";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import { useDisplayAnimation } from "../screens/DisplayScreen";
import useCurrentTime from "../../hooks/useCurrentTime";
import ModernIslamicBackground from "../common/ModernIslamicBackground";
import ModernHeader from "../common/ModernHeader";
import ModernPrayerCard from "../common/ModernPrayerCard";
import ContentCarousel from "../common/ContentCarousel";
import ModernFooter from "../common/ModernFooter";
import logoGold from "../../assets/logos/logo-gold.svg";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import {
  isLowPowerDevice,
  PerformanceMonitor,
} from "../../utils/performanceUtils";

// Memoized style objects to prevent recalculation
const containerStyles = {
  height: "100%",
  width: "100%",
  display: "flex",
  flexDirection: "column" as const,
  position: "relative" as const,
  overflow: "hidden" as const,
};

const mainContentStyles = {
  display: "flex",
  flexGrow: 1,
  overflow: "hidden",
};

const leftColumnStyles = {
  width: "50%",
  display: "flex",
  flexDirection: "column" as const,
  height: "100%",
};

const rightColumnStyles = {
  width: "50%",
  display: "flex",
  flexDirection: "column" as const,
  height: "100%",
  overflow: "hidden",
};

/**
 * ModernLandscapeDisplay component
 *
 * A modern, performance-optimized landscape layout with staggered animations.
 * Individual components dissolve sequentially during alert transitions.
 */
const ModernLandscapeDisplay: React.FC = memo(() => {
  // Start performance monitoring
  const endRender = PerformanceMonitor.startRender("ModernLandscapeDisplay");

  // Use optimized selectors to reduce re-renders
  const { masjidName, hasPrayerTimes } = useAppSelector(
    selectLandscapeDisplayData
  );

  // ✅ PERFORMANCE: Use memoized hooks to prevent unnecessary recalculations
  const { getSizeRem } = useResponsiveFontSize();
  const { getComponentAnimation } = useDisplayAnimation();

  // Prayer times hook for date and hijri date - memoized
  const { currentDate, hijriDate } = usePrayerTimes();

  // Use centralized time management to prevent timer conflicts
  const currentTime = useCurrentTime();

  // Use refs to prevent unnecessary recalculations
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isLowPower = useRef(isLowPowerDevice());

  // ✅ PERFORMANCE: Cache previous values to prevent unnecessary re-renders
  const prevValuesRef = useRef({
    masjidName: "",
    currentDate: "",
    hijriDate: "",
    currentTime: "",
  });

  // Handle countdown completion - memoized
  const handleCountdownComplete = useCallback((isJamaat: boolean) => {
    // This will be handled by the prayer countdown component
    console.log("Prayer countdown completed:", isJamaat);
  }, []);

  // Get animations for each component - memoized to prevent recalculation
  const animations = useMemo(
    () => ({
      header: getComponentAnimation("header"),
      prayerCard: getComponentAnimation("prayerCard"),
      carousel: getComponentAnimation("carousel"),
      footer: getComponentAnimation("footer"),
    }),
    [getComponentAnimation]
  );

  // Memoized style objects for better performance - now using getSizeRem values
  const contentStyles = useMemo(
    () => ({
      display: "flex",
      flexDirection: "column" as const,
      flex: "nowrap",
      height: "100%",
      position: "relative" as const,
      gap: getSizeRem(1),
      zIndex: 2,
      px: getSizeRem(1),
      py: getSizeRem(1),
    }),
    [getSizeRem]
  );

  const mainContentWithGap = useMemo(
    () => ({
      ...mainContentStyles,
      gap: getSizeRem(1.5),
    }),
    [getSizeRem]
  );

  const rightColumnWithGap = useMemo(
    () => ({
      ...rightColumnStyles,
      gap: getSizeRem(1),
    }),
    [getSizeRem]
  );

  // ✅ PERFORMANCE: Optimized memoized components with value change detection
  const MemoizedHeader = useMemo(() => {
    const currentMasjidName = masjidName || "MasjidConnect";
    const currentDateStr = currentDate ? currentDate.toString() : "";
    const currentHijriDate = hijriDate || "";
    const currentTimeStr = currentTime ? currentTime.toString() : "";

    // Check if values actually changed
    const prev = prevValuesRef.current;
    const hasChanged =
      prev.masjidName !== currentMasjidName ||
      prev.currentDate !== currentDateStr ||
      prev.hijriDate !== currentHijriDate ||
      prev.currentTime !== currentTimeStr;

    if (hasChanged) {
      prevValuesRef.current = {
        masjidName: currentMasjidName,
        currentDate: currentDateStr,
        hijriDate: currentHijriDate,
        currentTime: currentTimeStr,
      };
    }

    return (
      <ModernHeader
        masjidName={currentMasjidName}
        currentDate={currentDate ? new Date(currentDate) : new Date()}
        hijriDate={currentHijriDate}
        currentTime={currentTime}
        orientation="landscape"
      />
    );
  }, [masjidName, currentDate, hijriDate, currentTime]);

  const MemoizedPrayerCard = useMemo(
    () => (
      <ModernPrayerCard
        orientation="landscape"
        onCountdownComplete={handleCountdownComplete}
      />
    ),
    [handleCountdownComplete]
  );

  // ✅ PERFORMANCE: Static components that never change
  const MemoizedCarousel = useMemo(
    () => <ContentCarousel variant="landscape" />,
    []
  );

  const MemoizedFooter = useMemo(
    () => <ModernFooter logoSrc={logoGold} orientation="landscape" />,
    []
  );

  // ✅ PERFORMANCE: Throttled performance monitoring to prevent log spam
  React.useLayoutEffect(() => {
    endRender();
  });

  // ✅ PERFORMANCE: Skip render if no essential data has changed
  const shouldSkipRender = useMemo(() => {
    if (!hasPrayerTimes) return false;

    const prev = prevValuesRef.current;
    return (
      prev.masjidName === (masjidName || "MasjidConnect") &&
      prev.currentDate === (currentDate ? currentDate.toString() : "") &&
      prev.hijriDate === (hijriDate || "") &&
      prev.currentTime === (currentTime ? currentTime.toString() : "")
    );
  }, [masjidName, currentDate, hijriDate, currentTime, hasPrayerTimes]);

  return (
    <Box ref={containerRef} sx={containerStyles}>
      {/* Modern Islamic Background */}
      <ModernIslamicBackground>
        {/* Main Content Container */}
        <Box ref={contentRef} sx={contentStyles}>
          {/* Header with staggered animation */}
          <Box
            sx={{
              opacity: animations.header.opacity,
              transform: animations.header.transform,
              transition: animations.header.transition,
            }}
          >
            {MemoizedHeader}
          </Box>

          {/* Main Content */}
          <Box sx={mainContentWithGap}>
            {/* Left Column - Prayer Times with staggered animation */}
            <Box
              sx={{
                ...leftColumnStyles,
                opacity: animations.prayerCard.opacity,
                transform: animations.prayerCard.transform,
                transition: animations.prayerCard.transition,
              }}
            >
              {MemoizedPrayerCard}
            </Box>

            {/* Right Column - Content Display with Footer */}
            <Box sx={rightColumnWithGap}>
              {/* Carousel with staggered animation */}
              <Box
                sx={{
                  flex: 1,
                  overflow: "hidden",
                  opacity: animations.carousel.opacity,
                  transform: animations.carousel.transform,
                  transition: animations.carousel.transition,
                }}
              >
                {MemoizedCarousel}
              </Box>

              {/* Footer with staggered animation */}
              <Box
                sx={{
                  opacity: animations.footer.opacity,
                  transform: animations.footer.transform,
                  transition: animations.footer.transition,
                }}
              >
                {MemoizedFooter}
              </Box>
            </Box>
          </Box>
        </Box>
      </ModernIslamicBackground>
    </Box>
  );
});

ModernLandscapeDisplay.displayName = "ModernLandscapeDisplay";

export default ModernLandscapeDisplay;
