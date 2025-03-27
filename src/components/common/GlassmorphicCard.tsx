import React from 'react';
import { Box, BoxProps, useTheme, alpha } from '@mui/material';

export interface GlassmorphicCardProps extends BoxProps {
  /**
   * Blur intensity for the glass effect (1-20)
   * @default 10
   */
  blurIntensity?: number;
  
  /**
   * Background opacity (0-1)
   * @default 0.25
   */
  opacity?: number;
  
  /**
   * Border opacity (0-1)
   * @default 0.2
   */
  borderOpacity?: number;
  
  /**
   * Border width
   * @default 1
   */
  borderWidth?: number;
  
  /**
   * Border radius
   * @default 12
   */
  borderRadius?: number | string;
  
  /**
   * Background color (will be applied with opacity)
   * If not provided, will use white with opacity
   */
  bgColor?: string;
  
  /**
   * Border color (will be applied with opacity)
   * If not provided, will use white with opacity
   */
  borderColor?: string;
  
  /**
   * Optional shadow intensity (0-1)
   * @default 0.2
   */
  shadowIntensity?: number;
  
  /**
   * Whether to use a darker glass effect for higher contrast
   * @default false
   */
  darkMode?: boolean;
  
  /**
   * Whether to add a subtle hover effect
   * @default false
   */
  hoverEffect?: boolean;
  
  /**
   * Whether to add a subtle animation
   * @default false
   */
  animateGlow?: boolean;
  
  /**
   * Children elements
   */
  children?: React.ReactNode;
}

/**
 * GlassmorphicCard component
 * 
 * A reusable card component with a glass morphism effect.
 * This creates a translucent, blurred glass-like appearance.
 */
// import React from 'react';
// import { Box, BoxProps, useTheme, alpha } from '@mui/material';

// export interface GlassmorphicCardProps extends BoxProps {
//   blurIntensity?: number;
//   opacity?: number;
//   borderOpacity?: number;
//   borderWidth?: number;
//   borderRadius?: number | string;
//   bgColor?: string;
//   borderColor?: string;
//   shadowIntensity?: number;
//   children?: React.ReactNode;
// }

const GlassmorphicCard: React.FC<GlassmorphicCardProps> = ({
  blurIntensity = 7.5,
  opacity = 0.3,
  borderOpacity = 0.18,
  borderWidth = 1,
  borderRadius = 8,
  bgColor,
  borderColor,
  shadowIntensity = 0.18,
  children,
  sx,
  ...rest
}) => {
  const theme = useTheme();
  
  // Default colors based on theme
  const defaultBgColor = alpha('#ffffff', opacity);
  const defaultBorderColor = alpha('#ffffff', borderOpacity);
  const effectiveBgColor = bgColor || defaultBgColor;
  const effectiveBorderColor = borderColor || defaultBorderColor;
  
  return (
    <Box
      sx={{
        position: 'relative',
        backdropFilter: `blur(${blurIntensity}px)`,
        WebkitBackdropFilter: `blur(${blurIntensity}px)`,
        backgroundColor: effectiveBgColor,
        border: `${borderWidth}px solid ${effectiveBorderColor}`,
        borderRadius: borderRadius,
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, ${shadowIntensity})`,
        // Adding additional glass-like properties
        borderTop: `1px solid ${alpha('#ffffff', borderOpacity + 0.1)}`,
        borderLeft: `1px solid ${alpha('#ffffff', borderOpacity + 0.1)}`,
        transition: 'all 0.3s ease',
        ...sx
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};

export default GlassmorphicCard;