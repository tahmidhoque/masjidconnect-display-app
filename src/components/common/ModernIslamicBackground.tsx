import React from "react";
import { Box, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { ALERT_COLOR_SCHEMES } from "./EmergencyAlertOverlay";

interface ModernIslamicBackgroundProps {
  children?: React.ReactNode;
}

/**
 * ModernIslamicBackground component
 *
 * Clean gradient background that smoothly morphs to alert colors when emergency alerts are active.
 * Creates seamless color transitions without overlays for a professional appearance.
 */
const ModernIslamicBackground: React.FC<ModernIslamicBackgroundProps> = ({
  children,
}) => {
  const theme = useTheme();

  // Get current alert to determine background color
  const currentAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert
  );

  // Calculate background gradient based on alert state
  const getBackgroundGradient = () => {
    if (!currentAlert) {
      // Default gradient
      return `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.secondary.main} 100%)`;
    }

    // Get alert color scheme
    const alertConfig =
      currentAlert.colorScheme && ALERT_COLOR_SCHEMES[currentAlert.colorScheme]
        ? ALERT_COLOR_SCHEMES[currentAlert.colorScheme]
        : ALERT_COLOR_SCHEMES.RED;

    // Create a darker, more subtle version of the alert gradient for background
    const gradient = alertConfig.gradient;

    // Extract colors and create a more subtle background version
    if (gradient.includes("linear-gradient")) {
      // Parse the gradient and create a darker version
      const gradientMatch = gradient.match(/linear-gradient\(([^)]+)\)/);
      if (gradientMatch) {
        const gradientContent = gradientMatch[1];

        // Create a more subtle version by blending with the original theme colors
        switch (currentAlert.colorScheme) {
          case "RED":
            return `linear-gradient(135deg, #2d1b1b 0%, #3d2222 50%, #4a2525 100%)`;
          case "ORANGE":
            return `linear-gradient(135deg, #2d2419 0%, #3d2f1f 50%, #4a3a25 100%)`;
          case "AMBER":
            return `linear-gradient(135deg, #2d2717 0%, #3d331d 50%, #4a4023 100%)`;
          case "BLUE":
            return `linear-gradient(135deg, #1a1f2d 0%, #1f263d 50%, #252d4a 100%)`;
          case "GREEN":
            return `linear-gradient(135deg, #1b2d1b 0%, #22362d 50%, #254a25 100%)`;
          case "PURPLE":
            return `linear-gradient(135deg, #251a2d 0%, #2f1f3d 50%, #3b254a 100%)`;
          case "DARK":
            return `linear-gradient(135deg, #191d21 0%, #1f2326 50%, #252a2f 100%)`;
          default:
            return `linear-gradient(135deg, #2d1b1b 0%, #3d2222 50%, #4a2525 100%)`;
        }
      }
    }

    // Fallback to default if parsing fails
    return `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.secondary.main} 100%)`;
  };

  const backgroundGradient = getBackgroundGradient();

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: backgroundGradient,
        transition: "background 800ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {children}
    </Box>
  );
};

export default ModernIslamicBackground;
