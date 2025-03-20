import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { format } from 'date-fns';
import logoGold from '../../assets/logos/logo-notext-gold.svg';
import ContentCarousel from '../common/ContentCarousel';
import PrayerTimesPanel from '../common/PrayerTimesPanel';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import IslamicPatternBackground from '../common/IslamicPatternBackground';

/**
 * LandscapeDisplay component
 * 
 * Main display layout for landscape orientation.
 * Provides a complete view with all required elements.
 */
const LandscapeDisplay: React.FC = () => {
  const { masjidName } = useContent();
  const {
    currentDate,
    hijriDate,
  } = usePrayerTimes();
  
  const { fontSizes, screenSize } = useResponsiveFontSize();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMobileSilenceReminder, setShowMobileSilenceReminder] = useState(false);

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

  // Handle prayer countdown reaching zero
  const handleCountdownComplete = () => {
    setShowMobileSilenceReminder(true);
    
    // Hide the reminder after 2 minutes
    setTimeout(() => {
      setShowMobileSilenceReminder(false);
    }, 120000); // 2 minutes
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
      }}>
        {/* Prayer Times Sidebar */}
        <Box 
          sx={{ 
            width: '30%', 
            minWidth: screenSize.isLargeScreen ? '400px' : '350px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
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
            flexGrow: 1, 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            height: '100%',
            p: 0,
          }}
        >
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
            <IslamicPatternBackground variant="subtle" />
          </Box>
          
          {showMobileSilenceReminder ? (
            <Box 
              sx={{
                background: 'linear-gradient(135deg, #F1C40F 0%, #DAA520 100%)',
                color: '#0A2647',
                borderRadius: '16px',
                p: 6,
                textAlign: 'center',
                width: '85%',
                maxWidth: '600px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(218, 165, 32, 0.5)',
                position: 'relative',
                overflow: 'hidden',
                zIndex: 1,
              }}
            >
              {/* Decorative corners */}
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '40px',
                height: '40px',
                borderTop: '3px solid rgba(255, 255, 255, 0.5)',
                borderLeft: '3px solid rgba(255, 255, 255, 0.5)',
              }} />
              <Box sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '40px',
                height: '40px',
                borderTop: '3px solid rgba(255, 255, 255, 0.5)',
                borderRight: '3px solid rgba(255, 255, 255, 0.5)',
              }} />
              <Box sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '40px',
                height: '40px',
                borderBottom: '3px solid rgba(255, 255, 255, 0.5)',
                borderLeft: '3px solid rgba(255, 255, 255, 0.5)',
              }} />
              <Box sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '40px',
                height: '40px',
                borderBottom: '3px solid rgba(255, 255, 255, 0.5)',
                borderRight: '3px solid rgba(255, 255, 255, 0.5)',
              }} />
              
              <Typography 
                sx={{ 
                  fontWeight: 'bold', 
                  fontSize: fontSizes.huge, 
                  mb: 2,
                  fontFamily: "'Poppins', sans-serif",
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                Prayer Time
              </Typography>
              <Typography sx={{ 
                fontSize: fontSizes.h3,
                fontFamily: "'Poppins', sans-serif",
              }}>
                Please silence your mobile devices
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <ContentCarousel />
            </Box>
          )}
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