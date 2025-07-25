import React, {
  useCallback,
  useState,
  useEffect,
  memo,
  useMemo,
  useRef,
} from "react";
import { Box } from "@mui/material";
import { useAppSelector } from "../../store/hooks";
import { selectContentData } from "../../store/hooks";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import { useDisplayAnimation } from "../screens/DisplayScreen";
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
  throttle,
} from "../../utils/performanceUtils";

/**
 * ModernLandscapeDisplay component
 *
 * A modern, performance-optimized landscape layout with staggered animations.
 * Individual components dissolve sequentially during alert transitions.
 */
const ModernLandscapeDisplay: React.FC = memo(() => {
  // Start performance monitoring
  const endRender = PerformanceMonitor.startRender("ModernLandscapeDisplay");

  const { getSizeRem } = useResponsiveFontSize();
  const { getComponentAnimation } = useDisplayAnimation();

  // Redux selectors - using memoized selectors
  const { masjidName } = useAppSelector(selectContentData);

  // Prayer times hook for date and hijri date - memoized
  const { currentDate, hijriDate } = usePrayerTimes();

  // Local state for current time - throttled updates for low-power devices
  const [currentTime, setCurrentTime] = useState(new Date());

  // Throttled time update function
  const updateTime = useMemo(
    () =>
      throttle(
        () => {
          setCurrentTime(new Date());
        },
        isLowPowerDevice() ? 2000 : 1000
      ),
    []
  );

  // Update current time every second (throttled for low-power devices)
  useEffect(() => {
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [updateTime]);

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

  // Use refs to prevent layout recalculations
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Memoized style objects for better performance
  const containerStyles = useMemo(
    () => ({
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column" as const,
      position: "relative" as const,
      overflow: "hidden" as const,
    }),
    []
  );

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

  // End performance monitoring
  React.useLayoutEffect(() => {
    endRender();
  });

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
            <ModernHeader
              masjidName={masjidName || "MasjidConnect"}
              currentDate={currentDate ? new Date(currentDate) : new Date()}
              hijriDate={hijriDate || ""}
              currentTime={currentTime}
              orientation="landscape"
            />
          </Box>

          {/* Main Content */}
          <Box
            sx={{
              display: "flex",
              flexGrow: 1,
              gap: getSizeRem(1.5),
              overflow: "hidden",
            }}
          >
            {/* Left Column - Prayer Times with staggered animation */}
            <Box
              sx={{
                width: "50%",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                opacity: animations.prayerCard.opacity,
                transform: animations.prayerCard.transform,
                transition: animations.prayerCard.transition,
              }}
            >
              <ModernPrayerCard
                orientation="landscape"
                onCountdownComplete={handleCountdownComplete}
              />
            </Box>

            {/* Right Column - Content Display with Footer */}
            <Box
              sx={{
                width: "50%",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
                gap: getSizeRem(1),
              }}
            >
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
                <ContentCarousel variant="landscape" />
              </Box>

              {/* Footer with staggered animation */}
              <Box
                sx={{
                  opacity: animations.footer.opacity,
                  transform: animations.footer.transform,
                  transition: animations.footer.transition,
                }}
              >
                <ModernFooter logoSrc={logoGold} orientation="landscape" />
              </Box>
            </Box>
          </Box>
        </Box>
      </ModernIslamicBackground>
    </Box>
  );
});

export default ModernLandscapeDisplay;
