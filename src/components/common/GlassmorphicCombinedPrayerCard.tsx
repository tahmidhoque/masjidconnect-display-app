import React from 'react';
import { Box, Typography, Divider, useTheme, alpha } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import GlassmorphicCard from './GlassmorphicCard';
import PrayerCountdown from './PrayerCountdown';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { goldGradient } from '../../theme/theme';

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
  const { fontSizes, getSizeRem } = useResponsiveFontSize();
  const { 
    todaysPrayerTimes,
    nextPrayer,
    isJumuahToday,
    jumuahDisplayTime
  } = usePrayerTimes();
  
  // Animation for the shimmer effect only
  const cardAnimation = `
    @keyframes shimmer {
      0% {
        background-position: -100% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
  `;
  
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
          ml: 1, // Margin left to match header
          mr: 0.5, // Margin right
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
          p: getSizeRem(1),
          pb: getSizeRem(0.6),
          borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
          position: 'relative',
          zIndex: 1,
          background: `linear-gradient(to bottom, ${alpha(theme.palette.secondary.dark, 0.2)}, transparent)`,
        }}>
          <Typography 
            sx={{ 
              fontSize: fontSizes.h5,
              fontWeight: 700,
              backgroundImage: goldGradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: getSizeRem(0.5),
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
          p: getSizeRem(0.8),
          pt: getSizeRem(0.6),
          position: 'relative',
          zIndex: 1,
          flex: 1, // Flexbox to expand and fill available space
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Headers */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              mb: getSizeRem(0.3),
              px: getSizeRem(0.5),
            }}
          >
            <Typography 
              sx={{ 
                fontSize: fontSizes.body1,
                fontWeight: 700,
                opacity: 0.85,
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
                fontSize: fontSizes.body1,
                fontWeight: 700,
                opacity: 0.85,
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
                fontSize: fontSizes.body1,
                fontWeight: 700,
                opacity: 0.85,
                textAlign: 'end',
                fontFamily: "'Poppins', sans-serif",
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              }}
            >
              Jamaa't
            </Typography>
          </Box>
          
          <Divider sx={{ backgroundColor: alpha(theme.palette.warning.main, 0.3), height: '1px', mb: 0.5 }} />
          
          {/* Prayer Time Rows */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {todaysPrayerTimes.map((prayer, index) => (
              <Box key={prayer.name} sx={{ mb: todaysPrayerTimes.length-1 === index ? 0 : getSizeRem(0.4) }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    py: getSizeRem(0.4),
                    px: getSizeRem(0.5),
                    borderRadius: 1,
                    backgroundColor: prayer.isNext 
                      ? alpha(theme.palette.warning.main, 0.15)
                      : prayer.isCurrent 
                        ? alpha(theme.palette.primary.light, 0.1)
                        : 'transparent',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Typography 
                    sx={{ 
                      fontSize: fontSizes.body1,
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
                      fontSize: fontSizes.body1,
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
                      fontSize: fontSizes.body1,
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
          </Box>
        </Box>
      </GlassmorphicCard>
    </>
  );
};

export default GlassmorphicCombinedPrayerCard; 