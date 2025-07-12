import React, { useMemo } from 'react';
import { Box, useTheme } from '@mui/material';
import { isLowPowerDevice } from '../../utils/performanceUtils';

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
  const isLowPower = isLowPowerDevice();
  
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

  // For low-power devices, use simplified CSS gradients instead of complex SVG
  const backgroundStyle = useMemo(() => {
    if (isLowPower) {
      // Use simple CSS gradients for better performance
      return {
        background: `
          linear-gradient(45deg, ${config.patternColor}22 25%, transparent 25%, transparent 75%, ${config.patternColor}22 75%),
          linear-gradient(-45deg, ${config.patternColor}22 25%, transparent 25%, transparent 75%, ${config.patternColor}22 75%)
        `,
        backgroundSize: `${patternSize}px ${patternSize}px`,
        backgroundPosition: '0 0, 0 0',
        opacity: config.opacity,
      };
    }

    // For more powerful devices, use the original SVG pattern
    return {};
  }, [isLowPower, config.patternColor, config.opacity, patternSize]);

  // For low-power devices, return a simplified version
  if (isLowPower) {
    return (
      <Box
        sx={{
          width,
          height,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: config.backgroundColor,
          ...backgroundStyle,
        }}
      >
        {children}
      </Box>
    );
  }

  // Original complex SVG implementation for more powerful devices
  const patternId = useMemo(() => `islamic-pattern-${Math.random().toString(36).substr(2, 9)}`, []);
  const embossFilterId = useMemo(() => `emboss-filter-${Math.random().toString(36).substr(2, 9)}`, []);

  // Emboss settings based on strength
  const embossConfig = {
    none: { elevation: 0, blur: 0, specular: 0 },
    light: { elevation: 1, blur: 1, specular: 0.2 },
    medium: { elevation: 2, blur: 1.5, specular: 0.3 },
    strong: { elevation: 5, blur: 2.5, specular: 0.6 },
  };

  const currentEmboss = embossConfig[embossStrength as keyof typeof embossConfig];

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
          {embossStrength !== 'none' && variant === 'embossed' ? (
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
            embossStrength !== 'none' && (
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
              strokeWidth="1"
              opacity={config.opacity}
              filter={embossStrength !== 'none' ? `url(#${embossFilterId})` : undefined}
            >
              {/* Simplified geometric pattern for better performance */}
              <path d={`M 0 0 L ${patternSize} 0 L ${patternSize} ${patternSize} L 0 ${patternSize} Z`} />
              <path d={`M ${patternSize/2} 0 L ${patternSize/2} ${patternSize}`} />
              <path d={`M 0 ${patternSize/2} L ${patternSize} ${patternSize/2}`} />
              <circle cx={patternSize/2} cy={patternSize/2} r={patternSize/8} />
            </g>
          </pattern>
        </defs>
        
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      {children}
    </Box>
  );
};

export default IslamicPatternBackground;