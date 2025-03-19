import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { format } from 'date-fns';
import logoGold from '../../assets/logos/logo-notext-gold.svg';
import ContentCarousel from '../common/ContentCarousel';
import PrayerCountdown from '../common/PrayerCountdown';
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
    todaysPrayerTimes,
    nextPrayer,
    currentDate,
    hijriDate,
    isJumuahToday,
    jumuahDisplayTime,
  } = usePrayerTimes();
  
  const { fontSizes } = useResponsiveFontSize();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMobileSilenceReminder, setShowMobileSilenceReminder] = useState(false);
  const [pulseCurrent, setPulseCurrent] = useState(true);

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
  
  // Create pulsing effect for current prayer
  useEffect(() => {
    const pulseTimer = setInterval(() => {
      setPulseCurrent(prev => !prev);
    }, 2000);
    
    return () => clearInterval(pulseTimer);
  }, []);

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
      
      {/* Next Prayer Countdown */}
      {nextPrayer && (
        <Box 
          sx={{ 
            background: 'linear-gradient(90deg, #0A2647 0%, #144272 100%)',
            color: 'white',
            py: 2,
            px: 2.5,
            textAlign: 'center',
            borderBottom: '2px solid',
            borderImage: 'linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Typography sx={{ 
            fontSize: fontSizes.h5,
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            mb: 1,
            color: '#F1C40F',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
          }}>
            Next Prayer: {nextPrayer.name}
          </Typography>
          <PrayerCountdown 
            prayerName={nextPrayer.name}
            prayerTime={nextPrayer.time}
            onCountdownComplete={handleCountdownComplete}
          />
          {nextPrayer.displayJamaat && (
            <Typography sx={{ 
              fontSize: fontSizes.body1,
              fontFamily: "'Poppins', sans-serif",
              mt: 1.5,
              color: '#F1C40F',
              fontWeight: 'medium',
              letterSpacing: '0.5px',
            }}>
              Jamaa't: {nextPrayer.displayJamaat}
            </Typography>
          )}

        </Box>
      )}
      
      {/* Prayer Times Grid */}
      <Box 
        sx={{ 
          bgcolor: 'rgba(245, 245, 245, 0.97)',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'rgba(218, 165, 32, 0.3)',
          overflow: 'hidden',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Subtle geometric pattern overlay for prayer times */}
        <Box 
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'none',
            backgroundSize: '40px 40px',
            backgroundPosition: 'center',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
        
        {/* Column headers */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          mb: 1, 
          px: 1.5,
          py: 0.75,
          background: 'rgba(10, 38, 71, 0.07)',
          borderRadius: '8px',
          position: 'relative',
          zIndex: 1,
        }}>
          <Typography sx={{ 
            fontSize: fontSizes.body2, 
            fontWeight: 'bold', 
            width: '30%',
            color: '#0A2647',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Prayer
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.body2, 
            fontWeight: 'bold', 
            width: '35%', 
            textAlign: 'center',
            color: '#0A2647',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Start
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.body2, 
            fontWeight: 'bold', 
            width: '35%', 
            textAlign: 'right',
            color: '#0A2647',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Jamaa't
          </Typography>
        </Box>
        
        {/* Prayer times list */}
        <Box 
          sx={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: 1.2,
            position: 'relative',
            zIndex: 1,
            mt: 1,
          }}
        >
          {todaysPrayerTimes.map((prayer) => (
            <Box
              key={prayer.name}
              sx={{ 
                p: 1.2, 
                borderRadius: 2,
                background: 'transparent',
                color: (prayer.isNext || prayer.isCurrent) ? 'white' : 'text.primary',
                boxShadow: prayer.isCurrent 
                  ? (pulseCurrent ? '0 0 20px rgba(33, 140, 116, 0.5)' : '0 0 8px rgba(33, 140, 116, 0.3)') 
                  : prayer.isNext
                    ? '0 3px 8px rgba(10, 38, 71, 0.15)'
                    : '0 2px 5px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.5s ease',
                transform: prayer.isCurrent ? 'scale(1.03)' : 'scale(1)',
                border: prayer.isCurrent 
                  ? '2px solid rgba(46, 204, 113, 0.5)' 
                  : prayer.isNext 
                    ? '1px solid rgba(218, 165, 32, 0.3)' 
                    : '1px solid rgba(0, 0, 0, 0.05)',
                minHeight: '48px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {(prayer.isCurrent || prayer.isNext) && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                  <IslamicPatternBackground 
                    variant={prayer.isCurrent ? "dark" : "default"}
                  >
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '100%', 
                      height: '100%', 
                      background: prayer.isNext 
                        ? 'linear-gradient(90deg, #0A2647 0%, #144272 100%)' 
                        : 'linear-gradient(90deg, #218c74 0%, #1e8c68 100%)',
                      opacity: prayer.isCurrent ? 0.85 : 0.85,
                      zIndex: -1
                    }} />
                  </IslamicPatternBackground>
                </Box>
              )}
              
              {/* Prayer Name */}
              <Typography 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: fontSizes.body1,
                  width: '30%',
                  fontFamily: "'Poppins', sans-serif",
                  zIndex: 1,
                  color: prayer.isCurrent 
                    ? '#FFFFFF' 
                    : prayer.isNext 
                      ? '#FFFFFF' 
                      : '#0A2647',
                  pl: 0.5,
                }}
              >
                {prayer.name}
              </Typography>
              
              {/* Time */}
              <Typography 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: fontSizes.h5,
                  width: '35%',
                  textAlign: 'center',
                  fontFamily: "'Poppins', sans-serif",
                  zIndex: 1,
                  color: prayer.isCurrent 
                    ? '#FFFFFF' 
                    : prayer.isNext 
                      ? '#FFFFFF' 
                      : '#144272',
                  letterSpacing: 0.5,
                }}
              >
                {prayer.displayTime}
              </Typography>
              
              {/* Jamaat */}
              <Typography 
                sx={{ 
                  fontWeight: prayer.displayJamaat ? 'medium' : 'normal',
                  fontSize: prayer.displayJamaat ? fontSizes.body1 : fontSizes.caption,
                  width: '35%',
                  textAlign: 'right',
                  fontStyle: prayer.displayJamaat ? 'normal' : 'italic',
                  opacity: prayer.displayJamaat ? 1 : 0.7,
                  fontFamily: "'Poppins', sans-serif",
                  zIndex: 1,
                  color: prayer.isCurrent 
                    ? '#FFFFFF' 
                    : prayer.isNext 
                      ? '#FFFFFF' 
                      : '#144272',
                  pr: 0.5,
                }}
              >
                {prayer.displayJamaat || 'N/A'}
              </Typography>
            </Box>
          ))}
          
          {isJumuahToday && (
            <Box
              sx={{ 
                p: 1.2, 
                borderRadius: 2,
                background: 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)',
                color: '#0A2647',
                boxShadow: '0 3px 10px rgba(218, 165, 32, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '48px',
                mt: 0.8,
                border: '1px solid rgba(218, 165, 32, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Background pattern for Jumuah */}
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.3,
              }}>
                <IslamicPatternBackground 
                  variant="default"
                  height="100%"
                  width="100%"
                />
              </Box>
              
              {/* Prayer Name */}
              <Typography 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: fontSizes.body1,
                  width: '30%',
                  fontFamily: "'Poppins', sans-serif",
                  zIndex: 1,
                  color: '#0A2647',
                  pl: 0.5,
                }}
              >
                Jumu'ah
              </Typography>
              
              {/* Time */}
              <Typography 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: fontSizes.h5,
                  width: '35%',
                  textAlign: 'center',
                  fontFamily: "'Poppins', sans-serif",
                  zIndex: 1,
                  color: '#0A2647',
                  letterSpacing: 0.5,
                }}
              >
                {jumuahDisplayTime}
              </Typography>
              
              {/* Empty space for consistency */}
              <Typography 
                sx={{ 
                  width: '35%',
                  textAlign: 'right',
                  zIndex: 1,
                  pr: 0.5,
                }}
              >
                &nbsp;
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Main Content */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          p: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Background pattern */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <IslamicPatternBackground variant="subtle" opacity={0.15} />
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
              width: '50px',
              height: '50px',
              borderTop: '3px solid rgba(255, 255, 255, 0.5)',
              borderLeft: '3px solid rgba(255, 255, 255, 0.5)',
              borderTopLeftRadius: '14px',
            }} />
            <Box sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50px',
              height: '50px',
              borderTop: '3px solid rgba(255, 255, 255, 0.5)',
              borderRight: '3px solid rgba(255, 255, 255, 0.5)',
              borderTopRightRadius: '14px',
            }} />
            <Box sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '50px',
              height: '50px',
              borderBottom: '3px solid rgba(255, 255, 255, 0.5)',
              borderLeft: '3px solid rgba(255, 255, 255, 0.5)',
              borderBottomLeftRadius: '14px',
            }} />
            <Box sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '50px',
              height: '50px',
              borderBottom: '3px solid rgba(255, 255, 255, 0.5)',
              borderRight: '3px solid rgba(255, 255, 255, 0.5)',
              borderBottomRightRadius: '14px',
            }} />
            
            <Typography 
              sx={{ 
                fontWeight: 'bold', 
                fontSize: fontSizes.huge, 
                mb: 3,
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
          <Box sx={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            p: 0,
            position: 'relative',
            zIndex: 2,
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

export default PortraitDisplay; 