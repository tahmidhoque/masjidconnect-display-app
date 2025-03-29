import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';

interface IslamicPatternBackgroundDarkProps {
  width?: string | number;
  height?: string | number;
  opacity?: number;
  patternColor?: string;
  patternSize?: number;
  children?: React.ReactNode;
}

/**
 * IslamicPatternBackgroundDark component
 * 
 * A dark version of the Islamic pattern background with a gradient.
 * Designed specifically for the glassmorphic UI design system.
 */
const IslamicPatternBackgroundDark: React.FC<IslamicPatternBackgroundDarkProps> = ({
  width = '100%',
  height = '100%',
  opacity = 0.4,
  patternColor,
  patternSize = 140,
  children,
}) => {
  const theme = useTheme();
  
  // Use provided colors or defaults from theme
  const effectivePatternColor = patternColor || theme.palette.warning.main;
  
  // Create unique IDs
  const patternId = React.useMemo(() => `islamic-pattern-dark-${Math.random().toString(36).substr(2, 9)}`, []);
  const gradientId = React.useMemo(() => `gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  
  return (
    <Box
      sx={{
        width,
        height,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${alpha(theme.palette.primary.main, 0.9)} 100%)`,
        zIndex: -1,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: `radial-gradient(circle at 30% 30%, ${alpha(theme.palette.primary.light, 0.4)} 0%, transparent 40%), 
                       radial-gradient(circle at 70% 70%, ${alpha(theme.palette.secondary.main, 0.4)} 0%, transparent 40%)`,
          zIndex: -1,
        }
      }}
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.palette.warning.main} stopOpacity="0.4" />
            <stop offset="100%" stopColor={theme.palette.warning.light} stopOpacity="0.2" />
          </linearGradient>
          
          <pattern 
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={patternSize}
            height={patternSize}
          >
            <g 
              fill="none" 
              stroke={`url(#${gradientId})`}
              strokeWidth={20}
              strokeLinecap="square"
              opacity={opacity}
              transform={`scale(${patternSize / 800})`}
            >
              {/* Quarter pattern */}
              <g>
                <path d="M0,165.685L217.157,75.736L400,258.579L359.175,300L40.825,300L0,400" />
                <path d="M165.685,0L75.736,217.157L258.579,400L300,359.175L300,40.825L400,0" />
              </g>
              <g transform="rotate(90 400 400)">
                <path d="M0,165.685L217.157,75.736L400,258.579L359.175,300L40.825,300L0,400" />
                <path d="M165.685,0L75.736,217.157L258.579,400L300,359.175L300,40.825L400,0" />
              </g>
              <g transform="rotate(180 400 400)">
                <path d="M0,165.685L217.157,75.736L400,258.579L359.175,300L40.825,300L0,400" />
                <path d="M165.685,0L75.736,217.157L258.579,400L300,359.175L300,40.825L400,0" />
              </g>
              <g transform="rotate(270 400 400)">
                <path d="M0,165.685L217.157,75.736L400,258.579L359.175,300L40.825,300L0,400" />
                <path d="M165.685,0L75.736,217.157L258.579,400L300,359.175L300,40.825L400,0" />
              </g>
              
              {/* Sun pattern */}
              <path
                d="M300,300L359.175,300L400,258.579L440.825,300L500,300L500,359.175L541.421,400L500,440.825L500,500L440.825,500L400,541.421L359.175,500L300,500L300,440.825L258.579,400L300,359.175L300,300"
              />
              
              {/* Dart patterns */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <path
                  key={`dart-${i}`}
                  d="M158.579,300L300,300L300,359.175L258.579,400L158.579,300"
                  transform={`rotate(${angle} 400 400)`}
                />
              ))}
              
              {/* Petal patterns */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <path
                  key={`petal-${i}`}
                  d="M117.157,117.157L217.157,75.736L300,158.579L300,300L158.579,300L75.736,217.157L117.157,117.157"
                  transform={`rotate(${angle} 400 400)`}
                />
              ))}
            </g>
          </pattern>
        </defs>
        
        {/* Main pattern rectangle */}
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      
      {/* Add some floating shapes for visual interest */}
      <Box
        sx={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.2)} 0%, transparent 70%)`,
          top: '20%',
          right: '10%',
          filter: 'blur(40px)',
        }}
      />
      
      <Box
        sx={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.info.main, 0.15)} 0%, transparent 70%)`,
          bottom: '10%',
          left: '5%',
          filter: 'blur(50px)',
        }}
      />
      
      {children}
    </Box>
  );
};

export default IslamicPatternBackgroundDark; 