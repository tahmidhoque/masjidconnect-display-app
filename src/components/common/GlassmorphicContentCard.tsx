import React from 'react';
import { useTheme, alpha, SxProps, Theme } from '@mui/material';
import GlassmorphicCard from './GlassmorphicCard';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';

interface GlassmorphicContentCardProps {
  orientation?: 'portrait' | 'landscape';
  children: React.ReactNode;
  colorType?: 'primary' | 'secondary' | 'info';
  headerBgColor?: string;
  sx?: SxProps<Theme>;
}

/**
 * GlassmorphicContentCard component
 * 
 * A glassmorphic container for content items like announcements, events, etc.
 * Maintains a colored header with the rest of the card using glassmorphic design.
 */
const GlassmorphicContentCard: React.FC<GlassmorphicContentCardProps> = ({
  orientation = 'landscape',
  children,
  colorType = 'primary',
  headerBgColor,
  sx
}) => {
  const theme = useTheme();
  const { getSizeRem } = useResponsiveFontSize();
  
  const isPortrait = orientation === 'portrait';
  
  // Set the color scheme based on colorType
  let bgGradient;
  let borderColor;
  
  switch (colorType) {
    case 'secondary':
      bgGradient = `linear-gradient(135deg, ${alpha(theme.palette.secondary.dark, 0.5)} 0%, ${alpha(theme.palette.secondary.main, 0.5)} 100%)`;
      borderColor = alpha(theme.palette.secondary.main, 0.5);
      break;
    case 'info':
      bgGradient = `linear-gradient(135deg, ${alpha(theme.palette.info.dark, 0.5)} 0%, ${alpha(theme.palette.info.main, 0.5)} 100%)`;
      borderColor = alpha(theme.palette.info.main, 0.5);
      break;
    default:
      bgGradient = `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.5)} 0%, ${alpha(theme.palette.primary.main, 0.5)} 100%)`;
      borderColor = alpha(theme.palette.primary.main, 0.5);
  }
  
  return (
    <GlassmorphicCard
      opacity={0.15}
      borderOpacity={0.25}
      blurIntensity={10}
      borderRadius={4}
      borderWidth={1}
      borderColor={borderColor}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        mb: getSizeRem(1.5),
        color: '#ffffff',
        backgroundImage: bgGradient,
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
        ...sx
      }}
    >
      {children}
    </GlassmorphicCard>
  );
};

export default GlassmorphicContentCard; 