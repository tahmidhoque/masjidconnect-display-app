import React from 'react';
import { useTheme, alpha, SxProps, Theme, Box } from '@mui/material';
import GlassmorphicCard from './GlassmorphicCard';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';

interface GlassmorphicContentCardProps {
  orientation?: 'portrait' | 'landscape';
  children: React.ReactNode;
  colorType?: 'primary' | 'secondary' | 'info';
  headerBgColor?: string;
  isUrgent?: boolean;
  sx?: SxProps<Theme>;
  contentTypeColor?: string;
}

/**
 * GlassmorphicContentCard component
 * 
 * A glassmorphic container for content items like announcements, events, etc.
 * Uses colored glass effect based on content type throughout the card.
 * Supports special styling for urgent content.
 */
const GlassmorphicContentCard: React.FC<GlassmorphicContentCardProps> = ({
  orientation = 'landscape',
  children,
  colorType = 'primary',
  headerBgColor,
  isUrgent = false,
  contentTypeColor,
  sx
}) => {
  const theme = useTheme();
  const { getSizeRem } = useResponsiveFontSize();
  
  const isPortrait = orientation === 'portrait';
  
  // Set the color scheme based on colorType with more prominent coloring
  let accentColor;
  let bgColor;
  
  switch (colorType) {
    case 'secondary':
      accentColor = theme.palette.secondary.main;
      bgColor = alpha(theme.palette.secondary.main, 0.12);
      break;
    case 'info':
      accentColor = theme.palette.info.main;
      bgColor = alpha(theme.palette.info.main, 0.12);
      break;
    default:
      accentColor = theme.palette.primary.main;
      bgColor = alpha(theme.palette.primary.main, 0.12);
  }
  
  // Emergency/urgent styling override - more prominent
  if (isUrgent) {
    accentColor = theme.palette.error.main;
    bgColor = alpha(theme.palette.error.main, 0.15);
  }

  // Override with explicit content type color if provided
  if (contentTypeColor) {
    // Use the contentTypeColor directly as the background
    bgColor = contentTypeColor;
  }
  
  return (
    <GlassmorphicCard
      opacity={0.25} // Increased opacity for more visible colored glass
      borderOpacity={0.3}
      blurIntensity={10}
      borderRadius={4}
      borderWidth={isUrgent ? 2 : 1}
      borderColor={alpha(accentColor, isUrgent ? 0.5 : 0.4)}
      bgColor={bgColor}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#ffffff',
        boxShadow: isUrgent 
          ? `0 8px 20px ${alpha(accentColor, 0.25)}, 0 0 15px ${alpha(accentColor, 0.25)}`
          : '0 8px 20px rgba(0, 0, 0, 0.15)',
        animation: isUrgent ? 'subtle-pulse 3s infinite ease-in-out' : 'none',
        '@keyframes subtle-pulse': {
          '0%': { boxShadow: `0 8px 20px ${alpha(accentColor, 0.25)}, 0 0 15px ${alpha(accentColor, 0.25)}` },
          '50%': { boxShadow: `0 8px 20px ${alpha(accentColor, 0.35)}, 0 0 15px ${alpha(accentColor, 0.3)}` },
          '100%': { boxShadow: `0 8px 20px ${alpha(accentColor, 0.25)}, 0 0 15px ${alpha(accentColor, 0.25)}` },
        },
        // Metallic effect with accent color tint
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(135deg, ${alpha(accentColor, 0.1)}, ${alpha(accentColor, 0.05)})`,
          zIndex: 0,
          pointerEvents: 'none'
        },
        // Force the glass effect to be ready immediately
        visibility: 'visible',
        opacity: 1,
        transition: 'none',
        ...sx
      }}
    >
      {children}
    </GlassmorphicCard>
  );
};

export default GlassmorphicContentCard; 