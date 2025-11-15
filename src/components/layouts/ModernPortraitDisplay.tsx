import React, { useCallback } from "react";
import { Box } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
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

/**
 * ModernPortraitDisplay component
 *
 * A modern, performance-optimized portrait layout with staggered animations.
 * Individual components dissolve sequentially during alert transitions.
 */
const ModernPortraitDisplay: React.FC = () => {
  const { getSizeRem } = useResponsiveFontSize();
  const { getComponentAnimation } = useDisplayAnimation();

  // Redux selectors
  const masjidName = useSelector(
    (state: RootState) => state.content.masjidName
  );

  // Prayer times hook for date and hijri date
  const { currentDate, hijriDate } = usePrayerTimes();

  // Use centralized time management to prevent timer conflicts
  const currentTime = useCurrentTime();

  // Handle countdown completion
  const handleCountdownComplete = useCallback((isJamaat: boolean) => {
    // This will be handled by the prayer countdown component
    console.log("Prayer countdown completed:", isJamaat);
  }, []);

  // Get animations for each component
  const headerAnimation = getComponentAnimation("header");
  const prayerCardAnimation = getComponentAnimation("prayerCard");
  const carouselAnimation = getComponentAnimation("carousel");
  const footerAnimation = getComponentAnimation("footer");

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Modern Islamic Background */}
      <ModernIslamicBackground>
        {/* Main Content Container */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: "nowrap",
            height: "100%",
            width: "100%",
            minWidth: 0, // Prevent flex overflow
            position: "relative",
            gap: getSizeRem(1),
            zIndex: 2,
            px: getSizeRem(1),
            py: getSizeRem(1),
            overflow: "hidden", // Prevent content from clipping
          }}
        >
          {/* Header with staggered animation */}
          <Box
            sx={{
              opacity: headerAnimation.opacity,
              transform: headerAnimation.transform,
              transition: headerAnimation.transition,
            }}
          >
            <ModernHeader
              masjidName={masjidName || "MasjidConnect"}
              currentDate={currentDate ? new Date(currentDate) : new Date()}
              hijriDate={hijriDate || ""}
              currentTime={currentTime}
              orientation="portrait"
            />
          </Box>

          {/* Main Content - Stacked vertically for portrait */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              gap: getSizeRem(1.5),
              overflow: "hidden",
              minWidth: 0, // Prevent flex overflow
              minHeight: 0, // Important for proper flex behavior
            }}
          >
            {/* Prayer Times Section with staggered animation */}
            <Box
              sx={{
                flex: "0 0 auto",
                opacity: prayerCardAnimation.opacity,
                transform: prayerCardAnimation.transform,
                transition: prayerCardAnimation.transition,
              }}
            >
              <ModernPrayerCard
                orientation="portrait"
                onCountdownComplete={handleCountdownComplete}
              />
            </Box>

            {/* Content Carousel Section with staggered animation */}
            <Box
              sx={{
                flex: 1,
                overflow: "hidden",
                opacity: carouselAnimation.opacity,
                transform: carouselAnimation.transform,
                transition: carouselAnimation.transition,
              }}
            >
              <ContentCarousel variant="portrait" />
            </Box>

            {/* Footer with staggered animation */}
            <Box
              sx={{
                flex: "0 0 auto",
                opacity: footerAnimation.opacity,
                transform: footerAnimation.transform,
                transition: footerAnimation.transition,
              }}
            >
              <ModernFooter logoSrc={logoGold} orientation="portrait" />
            </Box>
          </Box>
        </Box>
      </ModernIslamicBackground>
    </Box>
  );
};

export default ModernPortraitDisplay;
