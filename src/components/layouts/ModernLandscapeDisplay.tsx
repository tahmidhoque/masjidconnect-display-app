import React, { useCallback, useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import { useDisplayAnimation } from "../screens/DisplayScreen";
import ModernIslamicBackground from "../common/ModernIslamicBackground";
import ModernHeader from "../common/ModernHeader";
import ModernPrayerCard from "../common/ModernPrayerCard";
import ContentCarousel from "../common/ContentCarousel";
import ModernFooter from "../common/ModernFooter";
import logoGold from "../../assets/logos/logo-gold.svg";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";

/**
 * ModernLandscapeDisplay component
 *
 * A modern, performance-optimized landscape layout with staggered animations.
 * Individual components dissolve sequentially during alert transitions.
 */
const ModernLandscapeDisplay: React.FC = () => {
  const { getSizeRem } = useResponsiveFontSize();
  const { getComponentAnimation } = useDisplayAnimation();

  // Redux selectors
  const masjidName = useSelector(
    (state: RootState) => state.content.masjidName
  );

  // Prayer times hook for date and hijri date
  const { currentDate, hijriDate } = usePrayerTimes();

  // Local state for current time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
            position: "relative",
            gap: getSizeRem(1),
            zIndex: 2,
            px: getSizeRem(1),
            py: getSizeRem(1),
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
                opacity: prayerCardAnimation.opacity,
                transform: prayerCardAnimation.transform,
                transition: prayerCardAnimation.transition,
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
                  opacity: carouselAnimation.opacity,
                  transform: carouselAnimation.transform,
                  transition: carouselAnimation.transition,
                }}
              >
                <ContentCarousel variant="landscape" />
              </Box>

              {/* Footer with staggered animation */}
              <Box
                sx={{
                  opacity: footerAnimation.opacity,
                  transform: footerAnimation.transform,
                  transition: footerAnimation.transition,
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
};

export default ModernLandscapeDisplay;
