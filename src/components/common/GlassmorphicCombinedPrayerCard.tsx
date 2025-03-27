import React, { useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import GlassmorphicCard from './GlassmorphicCard';
import PrayerCountdown from './PrayerCountdown';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { goldGradient } from '../../theme/theme';
import IslamicPatternBackground from './IslamicPatternBackground';

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
    jumuahDisplayTime
  } = usePrayerTimes();
  
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
  `, []);
  
  const isPortrait = orientation === 'portrait';
  const is720p = screenSize.is720p || screenSize.isSmallerThan720p;
  
  // Calculate row height based on screen size
  const rowHeight = isPortrait 
    ? (is720p ? getSizeRem(3.2) : getSizeRem(3.5)) 
    : getSizeRem(2.8);
  
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
            jamaatTime={nextPrayer.jamaat}
            timeUntilNextPrayer={nextPrayer.timeUntil}
            onCountdownComplete={onCountdownComplete}
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
          overflowY: 'auto', // Always allow scrolling if needed
        }}>
          {/* Headers */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              mb: getSizeRem(0.4),
              px: getSizeRem(0.5),
              backgroundColor: alpha(theme.palette.secondary.dark, 0.15),
              py: getSizeRem(0.5),
              borderRadius: '6px',
              border: 'none',
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
                  mb: 0, // No margin between rows
                  transform: prayer.isNext ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.3s ease',
                  zIndex: prayer.isNext ? 5 : 1,
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    py: isPortrait ? getSizeRem(0.5) : getSizeRem(0.4),
                    px: isPortrait ? getSizeRem(0.5) : getSizeRem(0.5),
                    borderRadius: prayer.isNext || prayer.isCurrent ? '8px' : '4px',
                    backgroundColor: prayer.isNext 
                      ? alpha(theme.palette.warning.main, 0.2)
                      : prayer.isCurrent 
                        ? alpha(theme.palette.secondary.dark, 0.2)
                        : 'transparent',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    border: prayer.isNext 
                      ? `1px solid ${alpha(theme.palette.warning.main, 0.3)}`
                      : prayer.isCurrent
                        ? `1px solid ${alpha(theme.palette.secondary.dark, 0.3)}`
                        : 'none',
                    boxShadow: 'none', // Remove box shadows
                    height: rowHeight,
                  }}
                >
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      fontWeight: prayer.isNext || prayer.isCurrent ? 700 : 600,
                      color: prayer.isNext 
                        ? theme.palette.warning.light
                        : '#ffffff',
                      fontFamily: "'Poppins', sans-serif",
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                      textAlign: 'start',
                    }}
                  >
                    {prayer.displayTime}
                  </Typography>
                  
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      textAlign: 'center',
                      fontWeight: prayer.isNext ? 700 : 600,
                      fontFamily: "'Poppins', sans-serif",
                      color: '#ffffff',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5
                    }}
                  >
                    {prayer.name}
                    {prayer.name === 'Zuhr' && isJumuahToday && (
                      <Box component="span" sx={{ 
                        fontSize: fontSizes.caption,
                        bgcolor: alpha(theme.palette.warning.main, 0.2),
                        color: theme.palette.warning.light,
                        px: 0.6,
                        py: 0.1,
                        borderRadius: 0.8,
                        fontWeight: 700,
                        display: 'inline-block',
                      }}>
                        Jumu'ah
                      </Box>
                    )}
                  </Typography>
                  
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      textAlign: 'end',
                      fontWeight: prayer.isNext ? 700 : 600,
                      color: prayer.displayJamaat ? '#ffffff' : alpha('#ffffff', 0.5),
                      fontFamily: "'Poppins', sans-serif",
                      textShadow: prayer.displayJamaat ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none',
                    }}
                  >
                    {prayer.name === 'Zuhr' && isJumuahToday ? jumuahDisplayTime || 'N/A' : prayer.displayJamaat || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            ))}
            
            {/* Jumuah section if applicable */}
            {isJumuahToday && (
              <Box sx={{ 
                mt: getSizeRem(0.2),
                mb: 0,
              }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    py: isPortrait ? getSizeRem(0.5) : getSizeRem(0.4),
                    px: isPortrait ? getSizeRem(0.5) : getSizeRem(0.5),
                    borderRadius: '8px',
                    backgroundColor: alpha(theme.palette.warning.light, 0.15),
                    border: `1px solid ${alpha(theme.palette.warning.light, 0.2)}`,
                    height: rowHeight,
                    color: theme.palette.warning.light,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 'none', // Remove box shadow
                  }}
                >
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      fontWeight: 'bold',
                      textAlign: 'start',
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {jumuahDisplayTime}
                  </Typography>
                  
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    Jumu'ah
                  </Typography>
                  
                  <Typography 
                    sx={{ 
                      textAlign: 'end',
                    }}
                  >
                    &nbsp;
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </GlassmorphicCard>
    </>
  );
};

export default GlassmorphicCombinedPrayerCard; 