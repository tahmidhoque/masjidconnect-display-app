import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';

interface IslamicPatternBackgroundProps {
  width?: string | number;
  height?: string | number;
  variant?: 'default' | 'light' | 'dark' | 'subtle' | 'embossed' | 'custom';
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
    embossed: {
      // Use colors that will create better emboss effect
      patternColor: patternColor || theme.palette.warning.main,
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      opacity: 0.6,
    },
    custom: {
      patternColor: patternColor || theme.palette.warning.main,
      backgroundColor: backgroundColor || 'rgba(255, 255, 255, 0.9)',
      opacity: opacity !== undefined ? opacity : 0.5,
    },
  };
  
  // Get the base config for the selected variant
  const config = variant === 'custom' 
    ? variantConfig.custom 
    : {
        ...variantConfig[variant],
        ...(patternColor && { patternColor }),
        ...(backgroundColor && { backgroundColor }),
        ...(opacity !== undefined && { opacity }),
      };

  // Define effective emboss strength, stronger for embossed variant
  const effectiveEmbossStrength = variant === 'embossed' 
    ? 'strong' 
    : embossStrength;

  // Create unique IDs
  const patternId = React.useMemo(() => `islamic-pattern-${Math.random().toString(36).substr(2, 9)}`, []);
  const embossFilterId = React.useMemo(() => `emboss-filter-${Math.random().toString(36).substr(2, 9)}`, []);

  // Emboss settings based on strength
  const embossConfig = {
    none: { elevation: 0, blur: 0, specular: 0 },
    light: { elevation: 1, blur: 1, specular: 0.2 },
    medium: { elevation: 2, blur: 1.5, specular: 0.3 },
    strong: { elevation: 5, blur: 2.5, specular: 0.6 },
  };

  const currentEmboss = embossConfig[effectiveEmbossStrength];

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
          {effectiveEmbossStrength !== 'none' && variant === 'embossed' ? (
            // Special emboss filter for embossed variant
            <filter id={embossFilterId} x="-50%" y="-50%" width="200%" height="200%">
              {/* Base blur for the pattern */}
              <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
              
              {/* Shadow component - offset down and right */}
              <feOffset in="blur" dx="3" dy="3" result="shadowOffset" />
              <feFlood floodColor="black" floodOpacity="0.3" result="shadowColor" />
              <feComposite in="shadowColor" in2="shadowOffset" operator="in" result="shadow" />
              
              {/* Light component - offset up and left */}
              <feOffset in="blur" dx="-1.5" dy="-1.5" result="lightOffset" />
              <feFlood floodColor="white" floodOpacity="0.5" result="lightColor" />
              <feComposite in="lightColor" in2="lightOffset" operator="in" result="light" />
              
              {/* Merge everything together */}
              <feMerge>
                <feMergeNode in="shadow" />
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="light" />
              </feMerge>
            </filter>
          ) : (
            effectiveEmbossStrength !== 'none' && (
              <filter id={embossFilterId} x="-50%" y="-50%" width="200%" height="200%">
                {/* Emboss effect created with two components: 
                    1. Base shadow for depth
                    2. Highlight for raised edges */}
                <feGaussianBlur in="SourceAlpha" stdDeviation={currentEmboss.blur} result="blur" />
                
                {/* Create shadow - shifted down-right */}
                <feOffset in="blur" dx={3} dy={3} result="offsetBlur" />
                <feComposite in="offsetBlur" in2="SourceAlpha" operator="out" result="shadow" />
                <feColorMatrix 
                  in="shadow"
                  type="matrix"
                  values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.5 0"
                  result="darkShadow"
                />
                
                {/* Create highlight - shifted up-left */}
                <feOffset in="blur" dx={-2} dy={-2} result="offsetBlurHigh" />
                <feComposite in="offsetBlurHigh" in2="SourceAlpha" operator="out" result="highlight" />
                <feColorMatrix 
                  in="highlight"
                  type="matrix"
                  values="1 0 0 0 1   1 0 0 0 1   1 0 0 0 1   0 0 0 0.7 0"
                  result="lightHighlight"
                />
                
                {/* Add specular lighting for shine effect */}
                <feSpecularLighting
                  in="blur"
                  surfaceScale={currentEmboss.elevation}
                  specularConstant="1.5"
                  specularExponent="25"
                  lightingColor="#white"
                  result="specular"
                >
                  <fePointLight x="-15000" y="-15000" z="15000" />
                </feSpecularLighting>
                <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular" />
                
                {/* Combine all effects */}
                <feMerge>
                  <feMergeNode in="darkShadow" />
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="lightHighlight" />
                  <feMergeNode in="specular" />
                </feMerge>
              </filter>
            )
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
              strokeWidth={variant === 'embossed' ? 25 : 20}
              strokeLinecap="square"
              opacity={config.opacity}
              filter={effectiveEmbossStrength !== 'none' ? `url(#${embossFilterId})` : undefined}
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