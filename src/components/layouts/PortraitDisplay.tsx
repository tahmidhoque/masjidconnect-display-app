import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { format } from 'date-fns';
import logoGold from '../../assets/logos/logo-notext-gold.svg';
import ContentCarousel from '../common/ContentCarousel';
import IslamicPatternBackgroundDark from '../common/IslamicPatternBackgroundDark';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import logger from '../../utils/logger';
import GlassmorphicHeader from '../common/GlassmorphicHeader';
import GlassmorphicCombinedPrayerCard from '../common/GlassmorphicCombinedPrayerCard';
import GlassmorphicFooter from '../common/GlassmorphicFooter';

/**
 * PortraitDisplay component
 * 
 * Main display layout for portrait orientation with glassmorphic UI design.
 * Provides a complete view with all required elements.
 */
const PortraitDisplay: React.FC = () => {
  const { 
    masjidName, 
    setPrayerAnnouncement, 
    showPrayerAnnouncement, 
    prayerAnnouncementName, 
    isPrayerJamaat 
  } = useContent();
  const {
    currentDate,
    hijriDate,
    nextPrayer,
  } = usePrayerTimes();
  
  const { fontSizes, screenSize } = useResponsiveFontSize();
  const [currentTime, setCurrentTime] = useState(new Date());
  const announcementActiveRef = useRef(false);

  // Log masjid name for debugging
  useEffect(() => {
    console.log("PortraitDisplay: Masjid name =", masjidName);
  }, [masjidName]);

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
      logger.info(`PortraitDisplay: Prayer announcement active for ${prayerAnnouncementName}`, {
        isJamaat: isPrayerJamaat
      });
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
      
      logger.warn(`No nextPrayer available, using fallback prayer name: ${prayerName}`);
    }
      
    // Skip Sunrise announcements
    if (prayerName === 'Sunrise') {
      logger.info(`Skipping announcement for ${prayerName}`);
      return;
    }
      
    logger.info(`Prayer countdown complete for ${prayerName}, isJamaat: ${isJamaat}`);
    
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
        logger.info(`Setting prayer announcement for ${prayerName}, isJamaat: ${isJamaat}`);
        
        try {
          // First set the announcement
          setPrayerAnnouncement(true, prayerName, isJamaat);
          
          // Add verification to check if announcement state was updated
          setTimeout(() => {
            if (!showPrayerAnnouncement) {
              // If state didn't update, try one more time
              logger.warn(`Prayer announcement state didn't update, trying again directly`);
              setPrayerAnnouncement(true, prayerName, isJamaat);
            } else {
              logger.info(`Prayer announcement verified to be showing for ${prayerName}`);
            }
          }, 100);
          
          // Hide the announcement after 2 minutes
          setTimeout(() => {
            logger.info(`Auto-hiding prayer announcement for ${prayerName}`);
            setPrayerAnnouncement(false);
            
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

  // Function to manually trigger prayer announcement for testing
  const showDebugAnnouncement = () => {
    logger.info('Debug button clicked - manually showing prayer announcement');
    
    if (announcementActiveRef.current) {
      logger.info('Announcement is already active, resetting it first');
      setPrayerAnnouncement(false);
      setTimeout(() => {
        announcementActiveRef.current = false;
        // Show prayer announcement after brief delay
        triggerManualAnnouncement();
      }, 500);
    } else {
      triggerManualAnnouncement();
    }
  };
  
  const triggerManualAnnouncement = () => {
    // Use nextPrayer if available, otherwise use a fallback
    const prayerToShow = nextPrayer?.name || "Fajr";
    const isJamaatTest = true; // Test with Jamaat mode
    
    announcementActiveRef.current = true;
    logger.info(`Manually showing announcement for ${prayerToShow}, isJamaat: ${isJamaatTest}`);
    
    // Set the prayer announcement
    setPrayerAnnouncement(true, prayerToShow, isJamaatTest);
    
    // Automatically hide after 10 seconds
    setTimeout(() => {
      logger.info('Auto-hiding debug announcement');
      setPrayerAnnouncement(false);
      
      // Reset flag after a short delay
      setTimeout(() => {
        announcementActiveRef.current = false;
      }, 500);
    }, 10000); // Show for 10 seconds
  };

  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%', 
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Dark Islamic Pattern Background */}
      <IslamicPatternBackgroundDark />
      
      {/* Main Content Container */}
      <Box sx={{ 
        height: '100%',
        width: '100%',
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        px: 1.5,
        pt: 0,
        pb: 1.5,
      }}>
        {/* Glassmorphic Header */}
        <GlassmorphicHeader
          masjidName={masjidName || 'Masjid Connect'}
          currentDate={currentDate ? new Date(currentDate) : new Date()}
          hijriDate={hijriDate || ''}
          currentTime={currentTime}
          orientation="portrait"
        />
        
        {/* Combined Prayer Card (Countdown + Times) */}
        <GlassmorphicCombinedPrayerCard
          orientation="portrait"
          onCountdownComplete={handleCountdownComplete}
        />
        
        {/* Content Carousel */}
        <Box sx={{ 
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          mb: 2,
        }}>
          <ContentCarousel variant="portrait" />
        </Box>
        
        {/* Footer with Logo */}
        <GlassmorphicFooter
          logoSrc={logoGold}
          orientation="portrait"
        />
      </Box>
    </Box>
  );
};

export default PortraitDisplay; 