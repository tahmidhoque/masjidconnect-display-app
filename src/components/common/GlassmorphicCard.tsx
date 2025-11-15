import React from "react";
import { Box, BoxProps, useTheme, alpha, SxProps, Theme } from "@mui/material";

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
const GlassmorphicCard: React.FC<GlassmorphicCardProps> = ({
  blurIntensity = 7.5,
  opacity = 0.3,
  borderOpacity = 0.18,
  borderWidth = 1,
  borderRadius = 8,
  bgColor,
  borderColor,
  shadowIntensity = 0.18,
  darkMode = false,
  hoverEffect = false,
  animateGlow = false,
  children,
  sx,
  ...rest
}) => {
  const theme = useTheme();

  // Default colors based on theme
  const defaultBgColor = alpha("#ffffff", opacity);
  const defaultBorderColor = alpha("#ffffff", borderOpacity);
  const effectiveBgColor = bgColor || defaultBgColor;
  const effectiveBorderColor = borderColor || defaultBorderColor;

  return (
    <Box
      sx={{
        position: "relative",
        backdropFilter: `blur(${blurIntensity}px)`,
        WebkitBackdropFilter: `blur(${blurIntensity}px)`,
        backgroundColor: effectiveBgColor,
        border: `${borderWidth}px solid ${effectiveBorderColor}`,
        borderRadius: borderRadius,
        boxShadow: `0 8px 32px 0 rgba(0, 0, 0, ${shadowIntensity})`,
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: alpha("#ffffff", borderOpacity + 0.1),
        borderLeftWidth: "1px",
        borderLeftStyle: "solid",
        borderLeftColor: alpha("#ffffff", borderOpacity + 0.1),
        visibility: "visible",
        opacity: 1,
        transition: "none",
        willChange: "backdrop-filter, opacity",
        transform: "translateZ(0)",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.1) 100%)",
          pointerEvents: "none",
          borderRadius: "inherit",
          zIndex: 0,
        },
        "& > *": {
          position: "relative",
          zIndex: 1,
        },
        ...(animateGlow && {
          animation: "glassGlow 3s infinite alternate",
          "@keyframes glassGlow": {
            "0%": {
              boxShadow: `0 8px 32px 0 rgba(0, 0, 0, ${shadowIntensity})`,
            },
            "100%": {
              boxShadow: `0 8px 32px 0 rgba(255, 255, 255, ${shadowIntensity * 0.5})`,
            },
          },
        }),
        ...(hoverEffect && {
          "&:hover": {
            transform: "translateY(-2px) translateZ(0)",
            boxShadow: `0 12px 32px 0 rgba(0, 0, 0, ${shadowIntensity * 1.5})`,
            "&::before": {
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.15) 100%)",
            },
          },
        }),
        ...(sx as any),
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};

export default GlassmorphicCard;
