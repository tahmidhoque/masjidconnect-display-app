import React, { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { setPrayerAnnouncement } from "../../store/slices/contentSlice";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import logoGold from "../../assets/logos/logo-notext-gold.svg";
import ContentCarousel from "../common/ContentCarousel";
import IslamicPatternBackgroundDark from "../common/IslamicPatternBackgroundDark";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import logger from "../../utils/logger";
import GlassmorphicHeader from "../common/GlassmorphicHeader";
import GlassmorphicCombinedPrayerCard from "../common/GlassmorphicCombinedPrayerCard";
import GlassmorphicFooter from "../common/GlassmorphicFooter";

/**
 * LandscapeDisplay component
 *
 * Main display layout for landscape orientation with glassmorphic UI design.
 * Provides a complete view with all required elements.
 */
const LandscapeDisplay: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux selectors
  const masjidName = useSelector(
    (state: RootState) => state.content.masjidName
  );
  const showPrayerAnnouncement = useSelector(
    (state: RootState) => state.content.showPrayerAnnouncement
  );
  const prayerAnnouncementName = useSelector(
    (state: RootState) => state.content.prayerAnnouncementName
  );
  const isPrayerJamaat = useSelector(
    (state: RootState) => state.content.isPrayerJamaat
  );

  // Redux action wrapper
  const setPrayerAnnouncementHandler = (
    show: boolean,
    prayerName: string,
    isJamaat: boolean
  ) => {
    dispatch(setPrayerAnnouncement({ show, prayerName, isJamaat }));
  };
  const { currentDate, hijriDate, nextPrayer } = usePrayerTimes();

  const { fontSizes, screenSize, layout } = useResponsiveFontSize();
  const [currentTime, setCurrentTime] = useState(new Date());
  const announcementActiveRef = useRef(false);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Track prayer announcements for debugging
  useEffect(() => {
    // Only log significant changes
    if (showPrayerAnnouncement) {
      logger.info(
        `LandscapeDisplay: Prayer announcement active for ${prayerAnnouncementName}`,
        {
          isJamaat: isPrayerJamaat,
        }
      );
    }
  }, [showPrayerAnnouncement, prayerAnnouncementName, isPrayerJamaat]);

  // Handle prayer countdown reaching zero
  const handleCountdownComplete = (isJamaat: boolean) => {
    // Get prayer name from nextPrayer or use fallback
    let prayerName = "Prayer";

    if (nextPrayer) {
      prayerName = nextPrayer.name;
    } else {
      // Try to determine which prayer time it is based on current time
      const now = new Date();
      const hour = now.getHours();

      // Rough estimate of prayer times based on typical day hours
      if (hour >= 3 && hour < 7) prayerName = "Fajr";
      else if (hour >= 12 && hour < 15) prayerName = "Zuhr";
      else if (hour >= 15 && hour < 18) prayerName = "Asr";
      else if (hour >= 18 && hour < 20) prayerName = "Maghrib";
      else prayerName = "Isha";

      logger.warn(
        `No nextPrayer available, using fallback prayer name: ${prayerName}`
      );
    }

    // Skip Sunrise announcements
    if (prayerName === "Sunrise") {
      logger.info(`Skipping announcement for ${prayerName}`);
      return;
    }

    logger.info(
      `Prayer countdown complete for ${prayerName}, isJamaat: ${isJamaat}`
    );

    // Use a ref to prevent duplicate announcements for the same prayer
    if (announcementActiveRef.current) {
      logger.info(`Ignoring duplicate announcement request for ${prayerName}`);
      return;
    }

    announcementActiveRef.current = true;

    // Force immediate state update for UI reflection
    setTimeout(() => {
      // Double check that the announcement hasn't been shown already
      if (!showPrayerAnnouncement) {
        logger.info(
          `Setting prayer announcement for ${prayerName}, isJamaat: ${isJamaat}`
        );

        try {
          // First set the announcement
          setPrayerAnnouncementHandler(true, prayerName, isJamaat);

          // Add verification to check if announcement state was updated
          setTimeout(() => {
            if (!showPrayerAnnouncement) {
              // If state didn't update, try one more time
              logger.warn(
                `Prayer announcement state didn't update, trying again directly`
              );
              setPrayerAnnouncementHandler(true, prayerName, isJamaat);
            } else {
              logger.info(
                `Prayer announcement verified to be showing for ${prayerName}`
              );
            }
          }, 100);

          // Hide the announcement after 2 minutes
          setTimeout(() => {
            logger.info(`Auto-hiding prayer announcement for ${prayerName}`);
            dispatch(setPrayerAnnouncement({ show: false }));

            // Reset announcement flag after a small delay
            setTimeout(() => {
              announcementActiveRef.current = false;
            }, 1000);
          }, 120000); // 2 minutes
        } catch (error) {
          logger.error(`Error setting prayer announcement: ${error}`);
          announcementActiveRef.current = false;
        }
      } else {
        // Reset announcement flag if we didn't need to show it
        announcementActiveRef.current = false;
      }
    }, 10);
  };

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
      {/* Dark Islamic Pattern Background */}
      <IslamicPatternBackgroundDark />

      {/* Main Content Container */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: "nowrap",
          height: "100%",
          position: "relative",
          gap: 1.5,
          zIndex: 2, // Above the background
          px: 1.5, // Consistent side padding
          py: 1.5, // Consistent top and bottom padding
        }}
      >
        {/* Header */}
        <GlassmorphicHeader
          masjidName={masjidName || "Masjid Connect"}
          currentDate={new Date()}
          hijriDate={hijriDate || ""}
          currentTime={currentTime}
          orientation="landscape"
        />

        {/* Main Content */}
        <Box
          sx={{
            display: "flex",
            flexGrow: 1,
            gap: 2.5,
            overflow: "hidden",
          }}
        >
          {/* Left Column - Prayer Times */}
          <Box
            sx={{
              width: "50%", // Equal width for both columns
              display: "flex",
              flexDirection: "column",
              height: "100%", // Full height
              // overflow: 'hidden',
            }}
          >
            <GlassmorphicCombinedPrayerCard
              orientation="landscape"
              onCountdownComplete={handleCountdownComplete}
            />
          </Box>

          {/* Right Column - Content Display */}
          <Box
            sx={{
              width: "50%", // Equal width for both columns
              display: "flex",
              flexDirection: "column",
              height: "100%", // Ensure full height
              overflow: "hidden",
            }}
          >
            <ContentCarousel variant="landscape" />
          </Box>
        </Box>

        {/* Footer */}
        <GlassmorphicFooter logoSrc={logoGold} orientation="landscape" />
      </Box>
    </Box>
  );
};

export default LandscapeDisplay;
