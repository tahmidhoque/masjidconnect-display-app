import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { format } from 'date-fns';
import GlassmorphicCard from './GlassmorphicCard';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { goldGradient } from '../../theme/theme';

interface GlassmorphicHeaderProps {
  masjidName: string;
  currentDate: Date;
  hijriDate: string;
  currentTime: Date;
  orientation?: 'portrait' | 'landscape';
}

/**
 * GlassmorphicHeader component
 * 
 * A glassmorphic header for the display page showing masjid name, date and time.
 */
const GlassmorphicHeader: React.FC<GlassmorphicHeaderProps> = ({
  masjidName,
  currentDate,
  hijriDate,
  currentTime,
  orientation = 'landscape'
}) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem } = useResponsiveFontSize();
  
  const isPortrait = orientation === 'portrait';
  
  return (
    <GlassmorphicCard
      opacity={0.2}
      blurIntensity={8}
      borderRadius={isPortrait ? '0 0 4px 4px' : 4}
      borderWidth={1}
      borderOpacity={0.25}
      borderColor={`linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.7)} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`}
      shadowIntensity={0.3}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.7)} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
        p: getSizeRem(isPortrait ? 1 : 1.5),
        pb: getSizeRem(isPortrait ? 1.5 : 1.5),
        width: '100%',
        color: '#fff',
        backdropFilter: 'blur(8px)',
        backgroundColor: alpha(theme.palette.primary.dark, 0.3),
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        borderTop: `1px solid ${alpha('#ffffff', 0.5)}`,
        borderLeft: `1px solid ${alpha('#ffffff', 0.5)}`,
      }}
    >
      <Box>
        <Typography 
          variant="h4" 
          sx={{ 
            fontSize: fontSizes.h2,
            fontWeight: 700,
            backgroundImage: goldGradient,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5,
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
          }}
        >
          {masjidName}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: getSizeRem(1) }}>
          <Typography 
            sx={{ 
              fontSize: fontSizes.body1,
              color: '#fff',
              opacity: 0.9,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </Typography>
          
          <Typography 
            sx={{ 
              fontSize: fontSizes.body1,
              color: alpha(theme.palette.warning.main, 0.9),
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            • {hijriDate}
          </Typography>
        </Box>
      </Box>
      
      <Typography 
        variant="h3" 
        sx={{ 
          fontSize: fontSizes.h1,
          fontWeight: 700,
          fontFamily: "'Poppins', sans-serif",
          color: '#fff',
          textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        {format(currentTime, 'HH:mm')}
      </Typography>
    </GlassmorphicCard>
  );
};

export default GlassmorphicHeader; 