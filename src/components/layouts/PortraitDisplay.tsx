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
 * PortraitDisplay component
 * 
 * Main display layout for portrait orientation.
 * Provides a complete view with all required elements.
 */
const PortraitDisplay: React.FC = () => {
  const { masjidName } = useContent();
  const {
    currentDate,
    hijriDate,
  } = usePrayerTimes();
  
  const { fontSizes, screenSize } = useResponsiveFontSize();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMobileSilenceReminder, setShowMobileSilenceReminder] = useState(false);

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
      background: 'rgba(255, 255, 255, 0.98)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Main background pattern */}
      
      {/* Logo Watermark */}
      <Box 
        component="img"
        src={logoGold}
        alt="MasjidConnect"
        sx={{
          position: 'absolute',
          width: '60%',
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
          p: screenSize.is720p ? 1.8 : 2.5,
          pb: screenSize.is720p ? 1.5 : 2,
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
            color: '#E9C46A',
            letterSpacing: '2px',
            lineHeight: 1.1,
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {format(currentTime, 'HH:mm')}
        </Typography>
      </Box>
      
      {/* Prayer Times Panel */}
      <PrayerTimesPanel 
        variant="portrait" 
        onCountdownComplete={handleCountdownComplete} 
      />
      
      {/* Main Content */}
      <Box sx={{ 
        flex: 1,
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden',
        p: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 0,
      }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <IslamicPatternBackground variant="subtle" />
        </Box>
        
        {showMobileSilenceReminder ? (
          <Box 
            sx={{
              background: 'linear-gradient(135deg, #F1C40F 0%, #DAA520 100%)',
              color: '#0A2647',
              borderRadius: '16px',
              p: screenSize.is720p ? 3 : 5,
              textAlign: 'center',
              width: '90%',
              mx: 'auto',
              mt: screenSize.is720p ? 2 : 4,
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
                fontSize: fontSizes.h1, 
                mb: 2,
                fontFamily: "'Poppins', sans-serif",
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              Prayer Time
            </Typography>
            <Typography sx={{ 
              fontSize: fontSizes.h4,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Please silence your mobile devices
            </Typography>
          </Box>
        ) : (
          <Box sx={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            p: screenSize.is720p ? 1 : 2,
          }}>
            <ContentCarousel />
          </Box>
        )}
      </Box>
      
      {/* Footer */}
      <Box 
        sx={{ 
          background: 'linear-gradient(90deg, #0A2647 0%, #144272 100%)',
          color: 'white',
          p: screenSize.is720p ? 1 : 1.5,
          borderTop: '3px solid',
          borderImage: 'linear-gradient(90deg, #E9C46A 0%, #F1C40F 100%) 1',
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

export default PortraitDisplay; 