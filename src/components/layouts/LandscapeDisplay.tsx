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
 * LandscapeDisplay component
 * 
 * Main display layout for landscape orientation.
 * Provides a complete view with all required elements.
 */
const LandscapeDisplay: React.FC = () => {
  const { masjidName } = useContent();
  const {
    todaysPrayerTimes,
    nextPrayer,
    currentDate,
    hijriDate,
    isJumuahToday,
    jumuahDisplayTime,
  } = usePrayerTimes();
  
  const { fontSizes, screenSize } = useResponsiveFontSize();
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
            bgcolor: 'rgba(245, 245, 245, 0.97)',
            borderRight: '1px solid',
            borderColor: 'rgba(218, 165, 32, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '4px 0 12px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            position: 'relative',
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
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23E9C46A' width='800px' height='800px' version='1.1' viewBox='173.584 173.617 452.795 453.109' xmlns:bx='https://boxy-svg.com' preserveAspectRatio='none'%3E%3Cpath d='m624.59 395.82-55.105-55.105c-1.1055-1.1055-2.6055-1.7266-4.1719-1.7266h-18.023l12.75-12.75c1.1055-1.1055 1.7305-2.6094 1.7305-4.1758v-77.934c0-3.2578-2.6445-5.9023-5.9023-5.9023h-77.93c-1.5664 0-3.0664 0.62109-4.1758 1.7305l-12.754 12.75v-18.023c0-1.5625-0.62109-3.0664-1.7305-4.1758l-55.105-55.105c-2.3047-2.3047-6.043-2.3047-8.3477 0l-55.105 55.105c-1.1055 1.1055-1.7266 2.6094-1.7266 4.1758v18.027l-12.754-12.754c-1.1055-1.1055-2.6055-1.7305-4.1758-1.7305h-77.93c-3.2578 0-5.9023 2.6445-5.9023 5.9023v27.156c0 3.2578 2.6445 5.9023 5.9023 5.9023 3.2578 0 5.9023-2.6445 5.9023-5.9023v-21.254h69.578l19.379 19.375v69.582h-69.586l-19.367-19.367v-24.715c0-3.2578-2.6445-5.9023-5.9023-5.9023-3.2578 0-5.9023 2.6445-5.9023 5.9023v27.16c0 1.5625 0.62109 3.0664 1.7305 4.1758l12.742 12.746h-18.02c-1.5664 0-3.0664 0.62109-4.1758 1.7305l-55.105 55.105c-2.3047 2.3047-2.3047 6.043 0 8.3477l55.105 55.105c1.1055 1.1016 2.6055 1.7266 4.1758 1.7266h18.023l-12.75 12.75c-1.1055 1.1055-1.7305 2.6094-1.7305 4.1758v77.934c0 3.2578 2.6445 5.9023 5.9023 5.9023h77.93c1.5664 0 3.0664-0.62109 4.1758-1.7305l12.754-12.754v18.027c0 1.5625 0.62109 3.0664 1.7305 4.1758l55.105 55.105c1.1484 1.1484 2.6562 1.7266 4.1719 1.7266s3.0195-0.57812 4.1758-1.7305l55.105-55.105c1.1016-1.1055 1.7266-2.6094 1.7266-4.1719v-18.027l12.754 12.754c1.1055 1.1055 2.6055 1.7305 4.1758 1.7305h77.93c3.2578 0 5.9023-2.6445 5.9023-5.9023l-0.003906-25.98c0-3.2578-2.6445-5.9023-5.9023-5.9023-3.2578 0-5.9023 2.6445-5.9023 5.9023v20.07h-69.578l-19.375-19.371v-69.578h69.586l19.367 19.367v25.895c0 3.2578 2.6445 5.9023 5.9023 5.9023 3.2578 0 5.9023-2.6445 5.9023-5.9023v-28.34c0-1.5625-0.62109-3.0664-1.7305-4.1758l-12.746-12.746h18.023c1.5664 0 3.0664-0.62109 4.1758-1.7305l55.105-55.105c2.3008-2.3047 2.3008-6.043-0.003906-8.3477z'/%3E%3C/svg%3E")`,
              backgroundSize: '40px 40px',
              backgroundPosition: 'center',
              zIndex: 0,
              pointerEvents: 'none',
              opacity: 0.1,
            }}
          />
        
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
          
          {/* Prayer Times Tiles */}
          <Box 
            sx={{ 
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              p: 2,
              gap: screenSize.isLargeScreen ? 1 : 0.5,
              justifyContent: 'space-between',
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Header row */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              mb: 0.5, 
              px: 2,
              py: 0.5,
              background: 'rgba(10, 38, 71, 0.05)',
              borderRadius: '4px',
            }}>
              <Typography sx={{ 
                fontSize: fontSizes.body2, 
                fontWeight: 'bold',
                color: '#0A2647'
              }}>
                Start Time
              </Typography>
              <Typography sx={{ 
                fontSize: fontSizes.body2, 
                fontWeight: 'bold',
                color: '#0A2647'
              }}>
                Prayer
              </Typography>
              <Typography sx={{ 
                fontSize: fontSizes.body2, 
                fontWeight: 'bold',
                color: '#0A2647'
              }}>
                Jamaa't
              </Typography>
            </Box>
            
            {todaysPrayerTimes.map((prayer) => (
              <Box
                key={prayer.name}
                sx={{ 
                  p: screenSize.isLargeScreen ? 1 : 0.75, 
                  borderRadius: 2,
                  background: 'transparent',
                  color: (prayer.isNext || prayer.isCurrent) ? 'white' : 'text.primary',
                  boxShadow: prayer.isCurrent 
                    ? (pulseCurrent ? '0 0 15px rgba(33, 140, 116, 0.5)' : '0 0 5px rgba(33, 140, 116, 0.3)') 
                    : 'rgba(0, 0, 0, 0.05) 0px 2px 5px 0px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.5s ease',
                  transform: prayer.isCurrent ? 'scale(1.02)' : 'scale(1)',
                  border: prayer.isCurrent 
                    ? '2px solid rgba(46, 204, 113, 0.5)' 
                    : prayer.isNext 
                      ? '1px solid rgba(218, 165, 32, 0.3)' 
                      : '1px solid rgba(0, 0, 0, 0.05)',
                  minHeight: screenSize.isLargeScreen ? '60px' : '50px',
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
                        opacity: 0.85,
                        zIndex: -1
                      }} />
                    </IslamicPatternBackground>
                  </Box>
                )}
                
                {/* Time */}
                <Typography 
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: fontSizes.h4,
                    width: '33%',
                    textAlign: 'left',
                    pl: 2,
                    fontFamily: "'Poppins', sans-serif",
                    zIndex: 1,
                    color: prayer.isCurrent 
                      ? '#FFFFFF' 
                      : prayer.isNext 
                        ? '#FFFFFF' 
                        : '#144272',
                  }}
                >
                  {prayer.displayTime}
                </Typography>
                
                {/* Prayer Name */}
                <Typography 
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: fontSizes.h4,
                    width: '33%',
                    textAlign: 'center',
                    fontFamily: "'Poppins', sans-serif",
                    zIndex: 1,
                    color: prayer.isCurrent 
                      ? '#FFFFFF' 
                      : prayer.isNext 
                        ? '#FFFFFF' 
                        : '#0A2647',
                  }}
                >
                  {prayer.name}
                </Typography>
                
                {/* Jamaat Time */}
                <Typography 
                  sx={{ 
                    fontWeight: prayer.displayJamaat ? 'bold' : 'normal',
                    fontSize: prayer.displayJamaat ? fontSizes.h4 : fontSizes.body1,
                    width: '33%',
                    textAlign: 'right',
                    pr: 2,
                    fontStyle: prayer.displayJamaat ? 'normal' : 'italic',
                    opacity: prayer.displayJamaat ? 1 : 0.7,
                    fontFamily: "'Poppins', sans-serif",
                    zIndex: 1,
                    color: prayer.isCurrent 
                      ? '#FFFFFF' 
                      : prayer.isNext 
                        ? '#FFFFFF' 
                        : '#144272',
                  }}
                >
                  {prayer.displayJamaat || 'N/A'}
                </Typography>
              </Box>
            ))}
            
            {isJumuahToday && (
              <Box
                sx={{ 
                  p: screenSize.isLargeScreen ? 1 : 0.75,
                  borderRadius: 2,
                  background: 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)',
                  color: '#0A2647',
                  boxShadow: '0 3px 8px rgba(218, 165, 32, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: screenSize.isLargeScreen ? '60px' : '50px',
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
                  background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23E9C46A' width='800px' height='800px' version='1.1' viewBox='173.584 173.617 452.795 453.109' xmlns:bx='https://boxy-svg.com' preserveAspectRatio='none'%3E%3Cpath d='m624.59 395.82-55.105-55.105c-1.1055-1.1055-2.6055-1.7266-4.1719-1.7266h-18.023l12.75-12.75c1.1055-1.1055 1.7305-2.6094 1.7305-4.1758v-77.934c0-3.2578-2.6445-5.9023-5.9023-5.9023h-77.93c-1.5664 0-3.0664 0.62109-4.1758 1.7305l-12.754 12.75v-18.023c0-1.5625-0.62109-3.0664-1.7305-4.1758l-55.105-55.105c-2.3047-2.3047-6.043-2.3047-8.3477 0l-55.105 55.105c-1.1055 1.1055-1.7266 2.6094-1.7266 4.1758v18.027l-12.754-12.754c-1.1055-1.1055-2.6055-1.7305-4.1758-1.7305h-77.93c-3.2578 0-5.9023 2.6445-5.9023 5.9023v27.156c0 3.2578 2.6445 5.9023 5.9023 5.9023 3.2578 0 5.9023-2.6445 5.9023-5.9023v-21.254h69.578l19.379 19.375v69.582h-69.586l-19.367-19.367v-24.715c0-3.2578-2.6445-5.9023-5.9023-5.9023-3.2578 0-5.9023 2.6445-5.9023 5.9023v27.16c0 1.5625 0.62109 3.0664 1.7305 4.1758l12.742 12.746h-18.02c-1.5664 0-3.0664 0.62109-4.1758 1.7305l-55.105 55.105c-2.3047 2.3047-2.3047 6.043 0 8.3477l55.105 55.105c1.1055 1.1016 2.6055 1.7266 4.1758 1.7266h18.023l-12.75 12.75c-1.1055 1.1055-1.7305 2.6094-1.7305 4.1758v77.934c0 3.2578 2.6445 5.9023 5.9023 5.9023h77.93c1.5664 0 3.0664-0.62109 4.1758-1.7305l12.754-12.754v18.027c0 1.5625 0.62109 3.0664 1.7305 4.1758l55.105 55.105c1.1484 1.1484 2.6562 1.7266 4.1719 1.7266s3.0195-0.57812 4.1758-1.7305l55.105-55.105c1.1016-1.1055 1.7266-2.6094 1.7266-4.1719v-18.027l12.754 12.754c1.1055 1.1055 2.6055 1.7305 4.1758 1.7305h77.93c3.2578 0 5.9023-2.6445 5.9023-5.9023l-0.003906-25.98c0-3.2578-2.6445-5.9023-5.9023-5.9023-3.2578 0-5.9023 2.6445-5.9023 5.9023v20.07h-69.578l-19.375-19.371v-69.578h69.586l19.367 19.367v25.895c0 3.2578 2.6445 5.9023 5.9023 5.9023 3.2578 0 5.9023-2.6445 5.9023-5.9023v-28.34c0-1.5625-0.62109-3.0664-1.7305-4.1758l-12.746-12.746h18.023c1.5664 0 3.0664-0.62109 4.1758-1.7305l55.105-55.105c2.3008-2.3047 2.3008-6.043-0.003906-8.3477z'/%3E%3C/svg%3E")`,
                  backgroundSize: '40px 40px',
                  zIndex: 0,
                  pointerEvents: 'none',
                  opacity: 0.3,
                }} />
                
                {/* Time */}
                <Typography 
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: fontSizes.h4,
                    width: '33%',
                    textAlign: 'left',
                    pl: 2,
                    fontFamily: "'Poppins', sans-serif",
                    zIndex: 1,
                    color: '#0A2647',
                  }}
                >
                  {jumuahDisplayTime}
                </Typography>
                
                {/* Prayer Name */}
                <Typography 
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: fontSizes.h4,
                    width: '33%',
                    textAlign: 'center',
                    fontFamily: "'Poppins', sans-serif",
                    zIndex: 1,
                    color: '#0A2647',
                  }}
                >
                  Jumu'ah
                </Typography>
                
                {/* Empty slot for consistency */}
                <Typography 
                  sx={{ 
                    width: '33%',
                    textAlign: 'right',
                    pr: 2,
                    zIndex: 1,
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