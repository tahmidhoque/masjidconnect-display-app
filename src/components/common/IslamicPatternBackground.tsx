import React from 'react';
import { Box, useTheme } from '@mui/material';

interface IslamicPatternBackgroundProps {
  width?: string | number;
  height?: string | number;
  variant?: 'default' | 'light' | 'dark' | 'subtle' | 'custom';
  opacity?: number;
  patternColor?: string;
  backgroundColor?: string;
  patternSize?: number;
  embossStrength?: 'none' | 'light' | 'medium' | 'strong';
  children?: React.ReactNode;
}

const IslamicPatternBackground: React.FC<IslamicPatternBackgroundProps> = ({
  width = '100%',
  height = '100%',
  variant = 'default',
  opacity,
  patternColor,
  backgroundColor,
  patternSize = 140,
  embossStrength = 'medium',
  children,
}) => {
  const theme = useTheme();
  
  // Define preset configurations based on variants
  const variantConfig = {
    default: {
      patternColor: theme.palette.warning.main,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      opacity: 0.7,
    },
    light: {
      patternColor: theme.palette.warning.main,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      opacity: 0.4,
    },
    dark: {
      patternColor: theme.palette.primary.main,
      backgroundColor: 'rgba(244, 244, 244, 0.9)',
      opacity: 0.6,
    },
    subtle: {
      patternColor: theme.palette.warning.main,
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      opacity: 0.2,
    },
    custom: {
      patternColor: patternColor || theme.palette.warning.main,
      backgroundColor: backgroundColor || 'rgba(255, 255, 255, 0.9)',
      opacity: opacity !== undefined ? opacity : 0.5,
    },
  };
  
  const config = variant === 'custom' 
    ? variantConfig.custom 
    : {
        ...variantConfig[variant],
        ...(patternColor && { patternColor }),
        ...(backgroundColor && { backgroundColor }),
        ...(opacity !== undefined && { opacity }),
      };

  // Create unique IDs
  const patternId = React.useMemo(() => `islamic-pattern-${Math.random().toString(36).substr(2, 9)}`, []);
  const embossFilterId = React.useMemo(() => `emboss-filter-${Math.random().toString(36).substr(2, 9)}`, []);

  // Emboss settings based on strength
  const embossConfig = {
    none: { elevation: 0, blur: 0, specular: 0 },
    light: { elevation: 1, blur: 1, specular: 0.2 },
    medium: { elevation: 2, blur: 1.5, specular: 0.3 },
    strong: { elevation: 3, blur: 2, specular: 0.4 },
  };

  const currentEmboss = embossConfig[embossStrength];

  return (
    <Box
      sx={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: config.backgroundColor,
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
          {/* Emboss filter */}
          {embossStrength !== 'none' && (
            <filter id={embossFilterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation={currentEmboss.blur} result="blur" />
              <feOffset in="blur" dx={1} dy={1} result="offsetBlur" />
              <feSpecularLighting
                in="blur"
                surfaceScale={currentEmboss.elevation}
                specularConstant="1"
                specularExponent="16"
                lightingColor="#white"
                result="specular"
              >
                <fePointLight x="-5000" y="-10000" z="20000" />
              </feSpecularLighting>
              <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular" />
              <feComposite
                in="SourceGraphic"
                in2="specular"
                operator="arithmetic"
                k1="0"
                k2="1"
                k3={currentEmboss.specular}
                k4="0"
              />
            </filter>
          )}

          <pattern 
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={patternSize}
            height={patternSize}
          >
            <g 
              fill="none" 
              stroke={config.patternColor} 
              strokeWidth={20}
              strokeLinecap="square"
              opacity={config.opacity}
              filter={embossStrength !== 'none' ? `url(#${embossFilterId})` : undefined}
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
        <rect 
          width="100%" 
          height="100%" 
          fill={`url(#${patternId})`} 
        />
      </svg>
      {children && (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            zIndex: 1,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
};

export default IslamicPatternBackground;