import React, { useMemo, useCallback } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import GlassmorphicCard from './GlassmorphicCard';
import PrayerCountdown from './PrayerCountdown';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { goldGradient } from '../../theme/theme';
import IslamicPatternBackground from './IslamicPatternBackground';
import { useContent } from '../../contexts/ContentContext';
import logger from '../../utils/logger';

interface GlassmorphicCombinedPrayerCardProps {
  orientation?: 'portrait' | 'landscape';
  onCountdownComplete?: (isJamaat: boolean) => void;
}

/**
 * GlassmorphicCombinedPrayerCard component
 * 
 * A unified glassmorphic card that combines the prayer countdown and prayer times
 * for better space utilization and visual coherence.
 */
const GlassmorphicCombinedPrayerCard: React.FC<GlassmorphicCombinedPrayerCardProps> = ({
  orientation = 'landscape',
  onCountdownComplete
}) => {
  const theme = useTheme();
  const { fontSizes, layout, screenSize, getSizeRem } = useResponsiveFontSize();
  const { 
    todaysPrayerTimes,
    nextPrayer,
    isJumuahToday,
    jumuahDisplayTime,
    jumuahKhutbahTime
  } = usePrayerTimes();
  
  const { refreshPrayerTimes, prayerTimes } = useContent();
  
  // Animation for the shimmer effect
  const cardAnimation = useMemo(() => `
    @keyframes shimmer {
      0% {
        background-position: -100% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    
    @keyframes pulseGlow {
      0% {
        box-shadow: 0 4px 10px rgba(42, 157, 143, 0.4), 0 0 15px rgba(42, 157, 143, 0.3);
      }
      50% {
        box-shadow: 0 4px 18px rgba(42, 157, 143, 0.6), 0 0 25px rgba(42, 157, 143, 0.5);
      }
      100% {
        box-shadow: 0 4px 10px rgba(42, 157, 143, 0.4), 0 0 15px rgba(42, 157, 143, 0.3);
      }
    }
    
    @keyframes currentPrayerGlow {
      0% {
        box-shadow: 0 2px 8px rgba(20, 66, 114, 0.4);
      }
      50% {
        box-shadow: 0 2px 15px rgba(20, 66, 114, 0.7);
      }
      100% {
        box-shadow: 0 2px 8px rgba(20, 66, 114, 0.4);
      }
    }

    @keyframes subtlePulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.01);
        opacity: 0.96;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `, []);
  
  const isPortrait = orientation === 'portrait';
  const is720p = screenSize.is720p || screenSize.isSmallerThan720p;
  
  // Calculate row height based on screen size
  const rowHeight = isPortrait 
    ? (is720p ? getSizeRem(3.2) : getSizeRem(3.5)) 
    : getSizeRem(2.8);
    
  // Common padding for consistent spacing across header and rows
  const commonPadding = {
    px: isPortrait ? getSizeRem(1.2) : getSizeRem(1),
    py: isPortrait ? getSizeRem(0.5) : getSizeRem(0.4)
  };
  
  // Check if Jumuah data is available
  const hasJumuahData = useMemo(() => {
    return Boolean(
      isJumuahToday && (
        jumuahDisplayTime || 
        jumuahKhutbahTime ||
        (prayerTimes && 
          (prayerTimes.jummahKhutbah || 
           prayerTimes.jummahJamaat ||
           (prayerTimes.data && 
            prayerTimes.data[0] && 
            (prayerTimes.data[0].jummahKhutbah || 
             prayerTimes.data[0].jummahJamaat))))
      )
    );
  }, [isJumuahToday, jumuahDisplayTime, jumuahKhutbahTime, prayerTimes]);
  
  // Handle countdown completion
  const handleCountdownComplete = useCallback((isJamaat: boolean) => {
    logger.info(`[GlassmorphicCombinedPrayerCard] Countdown completed for ${isJamaat ? 'jamaat' : 'adhan'} time`);
    
    // Ensure we immediately refresh prayer times to get the next prayer
    refreshPrayerTimes();
    
    // Pass the event up to parent component if provided
    if (onCountdownComplete) {
      onCountdownComplete(isJamaat);
    }
  }, [refreshPrayerTimes, onCountdownComplete]);

  // Helper to get background color for prayer row
  const getPrayerBackgroundColor = (prayer: any) => {
    if (prayer.isNext) {
      return alpha(theme.palette.warning.main, 0.2);
    } else if (prayer.isCurrent) {
      return alpha(theme.palette.secondary.dark, 0.2);
    } 
    return 'transparent';
  };

  // Helper to get border for prayer row
  const getPrayerBorder = (prayer: any) => {
    if (prayer.isNext) {
      return `1px solid ${alpha(theme.palette.warning.main, 0.3)}`;
    } else if (prayer.isCurrent) {
      return `1px solid ${alpha(theme.palette.secondary.dark, 0.3)}`;
    } 
    return 'none';
  };
  
  if (!nextPrayer) {
    return null;
  }
  
  return (
    <>
      <style>{cardAnimation}</style>
      <GlassmorphicCard
        opacity={0.2}
        blurIntensity={8}
        borderRadius={4}
        borderWidth={1}
        borderOpacity={0.3}
        borderColor={theme.palette.warning.main}
        shadowIntensity={0.35}
        sx={{
          width: '100%',
          height: '100%', // Fill available height
          color: '#fff',
          overflow: 'hidden',
          ml: isPortrait ? 0 : 1, // No left margin in portrait
          mr: isPortrait ? 0 : 0.5, // No right margin in portrait
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.7)} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
          borderTop: `1px solid ${alpha('#ffffff', 0.5)}`,
          borderLeft: `1px solid ${alpha('#ffffff', 0.5)}`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '200%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
            animation: 'shimmer 4s infinite linear',
            zIndex: 0
          }
        }}
      >
        {/* Countdown Section */}
        <Box sx={{ 
          p: isPortrait ? getSizeRem(1.2) : getSizeRem(1),
          pb: isPortrait ? getSizeRem(0.8) : getSizeRem(0.6),
          borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
          position: 'relative',
          zIndex: 1,
          background: `linear-gradient(to bottom, ${alpha(theme.palette.secondary.dark, 0.2)}, transparent)`,
        }}>
          <Typography 
            sx={{ 
              fontSize: isPortrait ? fontSizes.h4 : fontSizes.h5,
              fontWeight: 700,
              backgroundImage: goldGradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: isPortrait ? getSizeRem(0.5) : getSizeRem(0.5),
              fontFamily: "'Poppins', sans-serif",
              letterSpacing: '0.5px',
              textAlign: 'center',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
            }}
          >
            Next Prayer: <strong>{nextPrayer.name}</strong>
          </Typography>
          
          <PrayerCountdown
            prayerName={nextPrayer.name}
            prayerTime={nextPrayer.time}
            jamaatTime={nextPrayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime ? jumuahDisplayTime : nextPrayer.jamaat}
            timeUntilNextPrayer={nextPrayer.timeUntil}
            onCountdownComplete={handleCountdownComplete}
          />
        </Box>
        
        {/* Prayer Times Section */}
        <Box sx={{ 
          p: isPortrait ? getSizeRem(0.8) : getSizeRem(0.8),
          pt: isPortrait ? getSizeRem(0.8) : getSizeRem(0.8),
          position: 'relative',
          zIndex: 1,
          flex: 1, // Flexbox to expand and fill available space
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden', // Always allow scrolling if needed
        }}>
          {/* Headers */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              mb: getSizeRem(0.4),
              ...commonPadding,
              backgroundColor: alpha(theme.palette.info.main, 0.25), // Sky blue header
              borderRadius: '6px',
              border: 'none',
              alignItems: 'center', // Vertically center content
              height: rowHeight,
            }}
          >
            <Typography 
              sx={{ 
                fontSize: isPortrait ? fontSizes.body1 : fontSizes.body2,
                fontWeight: 700,
                opacity: 0.95,
                fontFamily: "'Poppins', sans-serif",
                textAlign: 'start',
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                height: '100%',
              }}
            >
              Start Time
            </Typography>
            <Typography 
              sx={{ 
                fontSize: isPortrait ? fontSizes.body1 : fontSizes.body2,
                fontWeight: 700,
                opacity: 0.95,
                textAlign: 'center',
                fontFamily: "'Poppins', sans-serif",
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              Prayer
            </Typography>
            <Typography 
              sx={{ 
                fontSize: isPortrait ? fontSizes.body1 : fontSizes.body2,
                fontWeight: 700,
                opacity: 0.95,
                textAlign: 'end',
                fontFamily: "'Poppins', sans-serif",
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
              }}
            >
              Jamaa't
            </Typography>
          </Box>
          
          {/* Prayer Time Rows */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            gap: 0, // No gap between rows
            backgroundImage: 'none', // Remove the background pattern
            mt: getSizeRem(0.2),
            pb: getSizeRem(0.2),
          }}>
            {todaysPrayerTimes.map((prayer, index) => (
              <Box key={prayer.name} 
                sx={{ 
                  mb: getSizeRem(0.3), // Add spacing between rows
                  transition: 'all 0.3s ease',
                  zIndex: prayer.isNext ? 5 : 1,
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    ...commonPadding,
                    borderRadius: prayer.isNext || prayer.isCurrent ? '8px' : '4px',
                    backgroundColor: getPrayerBackgroundColor(prayer),
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    border: getPrayerBorder(prayer),
                    boxShadow: prayer.isNext ? `0 2px 12px ${alpha(theme.palette.warning.main, 0.35)}` : 'none', // Add shadow for next prayer
                    height: rowHeight,
                    alignItems: 'center', // Vertically center content
                    animation: prayer.isNext ? 'subtlePulse 3s infinite ease-in-out' : 'none', // Add pulse animation for next prayer
                  }}
                >
                  <Box 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      gap: getSizeRem(0.5),
                    }}
                  >
                    <Typography 
                      sx={{ 
                        fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                        fontWeight: (prayer.isNext || prayer.isCurrent || (prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData)) ? 700 : 600,
                        color: prayer.isNext 
                          ? theme.palette.warning.light
                          : prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData
                          ? theme.palette.warning.light
                          : '#ffffff',
                        fontFamily: "'Poppins', sans-serif",
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        textAlign: 'start',
                      }}
                    >
                      {prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData && jumuahKhutbahTime 
                        ? jumuahKhutbahTime
                        : prayer.displayTime}
                    </Typography>
                    
                    {prayer.name === 'Zuhr' && isJumuahToday && (
                      <GlassmorphicCard
                        opacity={0.15}
                        blurIntensity={6}
                        borderRadius={8}
                        borderWidth={1}
                        borderOpacity={0.3}
                        borderColor={theme.palette.warning.main}
                        shadowIntensity={0.2}
                        sx={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          px: getSizeRem(0.6),
                          py: getSizeRem(0.1),
                          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.dark, 0.4)} 0%, ${alpha(theme.palette.warning.main, 0.4)} 100%)`,
                        }}
                      >
                        <Typography sx={{ 
                          fontSize: fontSizes.caption,
                          color: theme.palette.warning.light,
                          fontWeight: 700,
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        }}>
                          Khutbah
                        </Typography>
                      </GlassmorphicCard>
                    )}
                  </Box>
                  
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      textAlign: 'center',
                      fontWeight: prayer.isNext || (prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData) ? 700 : 600,
                      fontFamily: "'Poppins', sans-serif",
                      color: '#ffffff',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isPortrait ? getSizeRem(1) : getSizeRem(0.8), // Increased gap for Jumu'ah tag
                      height: '100%',
                    }}
                  >
                    {prayer.name}
                    {prayer.name === 'Zuhr' && isJumuahToday && (
                      <GlassmorphicCard
                        opacity={0.15}
                        blurIntensity={6}
                        borderRadius={8}
                        borderWidth={1}
                        borderOpacity={0.3}
                        borderColor={theme.palette.warning.main}
                        shadowIntensity={0.2}
                        sx={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          px: getSizeRem(0.6),
                          py: getSizeRem(0.1),
                          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.dark, 0.4)} 0%, ${alpha(theme.palette.warning.main, 0.4)} 100%)`,
                        }}
                      >
                        <Typography sx={{ 
                          fontSize: fontSizes.caption,
                          color: theme.palette.warning.light,
                          fontWeight: 700,
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        }}>
                          Jumu'ah
                        </Typography>
                      </GlassmorphicCard>
                    )}
                  </Typography>
                  
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      textAlign: 'end',
                      fontWeight: prayer.isNext || (prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData) ? 700 : 600,
                      color: (prayer.displayJamaat || (prayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime)) ? '#ffffff' : alpha('#ffffff', 0.5),
                      fontFamily: "'Poppins', sans-serif",
                      textShadow: (prayer.displayJamaat || (prayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime)) ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                    }}
                  >
                    {prayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime ? jumuahDisplayTime : prayer.displayJamaat || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </GlassmorphicCard>
    </>
  );
};

export default GlassmorphicCombinedPrayerCard; 