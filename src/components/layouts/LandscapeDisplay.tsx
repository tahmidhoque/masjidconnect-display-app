import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { format } from 'date-fns';
import logoGold from '../../assets/logos/logo-notext-gold.svg';
import ContentCarousel from '../common/ContentCarousel';
import PrayerTimesPanel from '../common/PrayerTimesPanel';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import IslamicPatternBackground from '../common/IslamicPatternBackground';
import logger from '../../utils/logger';

/**
 * LandscapeDisplay component
 * 
 * Main display layout for landscape orientation.
 * Provides a complete view with all required elements.
 */
const LandscapeDisplay: React.FC = () => {
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
  
  const { fontSizes, screenSize, layout } = useResponsiveFontSize();
  const [currentTime, setCurrentTime] = useState(new Date());
  const announcementActiveRef = useRef(false);

  // Log masjid name for debugging
  useEffect(() => {
    console.log("LandscapeDisplay: Masjid name =", masjidName);
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
      logger.info(`LandscapeDisplay: Prayer announcement active for ${prayerAnnouncementName}`, {
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
      background: `linear-gradient(rgba(255, 255, 255, 0.90), rgba(255, 255, 255, 0.90)), url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23DAA520' stroke-width='2' stroke-opacity='0.5'%3E%3Cpath d='M0,50 L50,0 L100,50 L50,100 Z' /%3E%3Cpath d='M25,25 L75,25 L75,75 L25,75 Z' /%3E%3Ccircle cx='50' cy='50' r='25' /%3E%3Ccircle cx='50' cy='50' r='12.5' /%3E%3Cpath d='M25,25 L75,75 M25,75 L75,25' /%3E%3C/g%3E%3C/svg%3E")`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Debug controls */}
      <Button
        onClick={showDebugAnnouncement}
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          zIndex: 99999999,
          fontSize: '10px',
          padding: '4px 8px',
          minWidth: 'unset',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
          }
        }}
      >
        Debug Announcement
      </Button>
      
      {/* Decorative Islamic Pattern at top */}
      <Box 
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '80px',
          background: `url("data:image/svg+xml,%3Csvg width='120' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23DAA520' stroke-width='1.2' stroke-opacity='0.3'%3E%3Cpath d='M0,40 L40,0 L80,40 L120,0 M0,40 L40,80 L80,40 L120,80'/%3E%3Cpath d='M20,40 L40,60 L60,40 L40,20 Z M60,40 L80,60 L100,40 L80,20 Z'/%3E%3Ccircle cx='40' cy='40' r='10' /%3E%3Ccircle cx='80' cy='40' r='10' /%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
          zIndex: 0,
          opacity: 0.7,
        }}
      />
      
      {/* Decorative Islamic Pattern at bottom */}
      <Box 
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '80px',
          background: `url("data:image/svg+xml,%3Csvg width='160' height='90' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23DAA520' stroke-width='2.5' stroke-opacity='0.6'%3E%3Cpath d='M0,45 L40,5 L80,45 L120,5 L160,45 M0,45 L40,85 L80,45 L120,85 L160,45'/%3E%3Cpath d='M20,45 L40,65 L60,45 L40,25 Z M60,45 L80,65 L100,45 L80,25 Z M100,45 L120,65 L140,45 L120,25 Z'/%3E%3Ccircle cx='40' cy='45' r='15' /%3E%3Ccircle cx='80' cy='45' r='15' /%3E%3Ccircle cx='120' cy='45' r='15' /%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
          zIndex: 0,
          opacity: 0.85,
          transform: 'rotate(180deg)',
        }}
      />
      
      {/* Logo Watermark */}
      <Box 
        component="img"
        src={logoGold}
        alt="MasjidConnect"
        sx={{
          position: 'absolute',
          width: '40%',
          maxWidth: '600px',
          opacity: 0.08,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 0 8px rgba(218, 165, 32, 0.3))',
        }}
      />
      
      {/* Header */}
      <Box 
        sx={{ 
          background: 'linear-gradient(90deg, #0A2647 0%, #144272 100%)',
          color: 'white',
          p: 2.5,
          pb: 2,
          borderBottom: '3px solid',
          borderImage: 'linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src={logoGold}
              alt=""
              sx={{ height: '32px', width: 'auto', marginRight: 1 }}
            />
            <Typography 
              sx={{ 
                fontWeight: 'bold',
                fontSize: fontSizes.h3,
                fontFamily: "'Poppins', sans-serif",
                background: 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '0.5px',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            >
              {masjidName || 'Masjid Name'}
            </Typography>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mt: 0.75,
            pl: 0.5,
          }}>
            <Typography sx={{ 
              fontSize: fontSizes.body2,
              fontStyle: 'italic',
              opacity: 0.9,
              mr: 1,
              color: 'rgba(255, 255, 255, 0.85)',
            }}>
              {hijriDate}
            </Typography>
            <Box sx={{ 
              height: '4px', 
              width: '4px', 
              borderRadius: '50%', 
              bgcolor: '#DAA520',
              opacity: 0.9, 
              mx: 0.75 
            }} />
            <Typography sx={{ 
              fontSize: fontSizes.body2,
              opacity: 0.9,
              color: 'rgba(255, 255, 255, 0.85)',
            }}>
              {currentDate}
            </Typography>
          </Box>
        </Box>
        
        <Typography 
          sx={{ 
            fontWeight: 'bold',
            fontSize: fontSizes.h1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            letterSpacing: '2px',
            lineHeight: 1.1,
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {format(currentTime, 'HH:mm')}
        </Typography>
      </Box>
      
      {/* Main Content Area */}
      <Box sx={{ 
        display: 'flex', 
        flexGrow: 1,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Prayer Times Sidebar */}
        <Box 
          sx={{ 
            width: layout.sidebarWidth,
            maxWidth: layout.sidebarWidth,
            minWidth: layout.sidebarWidth,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <PrayerTimesPanel 
            variant="landscape" 
            onCountdownComplete={handleCountdownComplete} 
          />
        </Box>
        
        {/* Main Content */}
        <Box 
          sx={{ 
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 0,
            p: 0,
          }}
        >
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
            <IslamicPatternBackground variant="embossed" />
          </Box>
          
          <ContentCarousel />
        </Box>
      </Box>
      
      {/* Footer */}
      <Box 
        sx={{ 
          background: 'linear-gradient(90deg, #0A2647 0%, #144272 100%)',
          color: 'white',
          p: 1.5,
          borderTop: '3px solid',
          borderImage: 'linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box 
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            mr: 2,
          }}
        >
          <Box 
            component="img"
            src={logoGold}
            alt=""
            sx={{
              height: '30px',
              marginRight: 1,
            }}
          />

        </Box>
      </Box>
    </Box>
  );
};

export default LandscapeDisplay; 