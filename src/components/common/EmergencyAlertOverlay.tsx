import React, { useEffect } from "react";
import { Box, Typography, Paper, Fade, alpha, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import IslamicPatternBackground from "./IslamicPatternBackground";
import logoWhite from "../../assets/logos/logo-notext-white.svg";

// Define a type for color scheme keys
export type AlertColorSchemeKey =
  | "RED"
  | "ORANGE"
  | "AMBER"
  | "BLUE"
  | "GREEN"
  | "PURPLE"
  | "DARK";

// Predefined alert color schemes
export const ALERT_COLOR_SCHEMES: Record<
  AlertColorSchemeKey,
  {
    name: string;
    backgroundColor: string;
    patternColor: string;
    textColor: string;
    description: string;
  }
> = {
  RED: {
    name: "Red Alert",
    backgroundColor: "#f44336",
    patternColor: "rgba(255, 255, 255, 0.6)",
    textColor: "#FFFFFF",
    description: "High urgency, critical emergency alerts",
  },
  ORANGE: {
    name: "Orange Alert",
    backgroundColor: "#ff9800",
    patternColor: "rgba(255, 255, 255, 0.5)",
    textColor: "#000000",
    description: "Important alerts requiring attention",
  },
  AMBER: {
    name: "Amber Alert",
    backgroundColor: "#ffb74d",
    patternColor: "rgba(0, 0, 0, 0.3)",
    textColor: "#000000",
    description: "Moderate urgency alerts",
  },
  BLUE: {
    name: "Blue Alert",
    backgroundColor: "#2196f3",
    patternColor: "rgba(255, 255, 255, 0.6)",
    textColor: "#FFFFFF",
    description: "Informational emergency alerts",
  },
  GREEN: {
    name: "Green Alert",
    backgroundColor: "#4caf50",
    patternColor: "rgba(255, 255, 255, 0.5)",
    textColor: "#000000",
    description: "Status updates and resolutions",
  },
  PURPLE: {
    name: "Purple Alert",
    backgroundColor: "#9c27b0",
    patternColor: "rgba(255, 255, 255, 0.6)",
    textColor: "#FFFFFF",
    description: "Special announcements during emergency situations",
  },
  DARK: {
    name: "Dark Alert",
    backgroundColor: "#263238",
    patternColor: "rgba(255, 255, 255, 0.5)",
    textColor: "#FFFFFF",
    description: "Serious alerts requiring immediate attention",
  },
};

// Type guard function to check if a string is a valid color scheme key
function isValidColorSchemeKey(key: string): key is AlertColorSchemeKey {
  return Object.keys(ALERT_COLOR_SCHEMES).includes(key as AlertColorSchemeKey);
}

// Define animation keyframes
const alertAnimations = `
  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

/**
 * EmergencyAlertOverlay Component
 *
 * Displays an emergency alert as a full-screen overlay with an Islamic pattern background.
 * The alert takes up 80% of the window size with the same opacity as the carousel.
 */
const EmergencyAlertOverlay: React.FC = () => {
  const theme = useTheme();
  const currentAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert
  );
  const hasActiveAlert = currentAlert !== null;
  const { fontSizes, screenSize } = useResponsiveFontSize();

  // Add debug logging
  console.log("🚨 EmergencyAlertOverlay rendering, hasAlert:", !!currentAlert);

  useEffect(() => {
    console.log("🚨 EmergencyAlertOverlay: Alert state changed:", currentAlert);
  }, [currentAlert]);

  if (!hasActiveAlert || !currentAlert) return null;

  // Log when we're about to render an alert
  console.log("🚨 EmergencyAlertOverlay: Rendering alert:", {
    id: currentAlert.id,
    title: currentAlert.title,
    color: currentAlert.color,
    expiresAt: currentAlert.expiresAt,
  });

  // Determine which color scheme to use - either from predefined schemes or custom color
  const getAlertConfig = () => {
    // Get the color from currentAlert, defaulting to red if not set
    const alertColor = currentAlert.color || "#f44336";

    console.log(
      "🚨 Alert color from portal:",
      alertColor,
      "Color scheme:",
      currentAlert.colorScheme
    );

    // Check if this is one of our predefined color schemes by name
    if (currentAlert.colorScheme) {
      const colorScheme = currentAlert.colorScheme as AlertColorSchemeKey;
      if (isValidColorSchemeKey(colorScheme)) {
        console.log("🚨 Using predefined color scheme:", colorScheme);
        return ALERT_COLOR_SCHEMES[colorScheme];
      }
    }

    // Try to match by color value (more flexible matching)
    const normalizeColor = (color: string) =>
      color.toLowerCase().replace(/\s+/g, "");
    const alertColorNormalized = normalizeColor(alertColor);

    // Look through predefined schemes to find a match
    const matchingSchemeEntry = Object.entries(ALERT_COLOR_SCHEMES).find(
      ([key, scheme]) =>
        normalizeColor(scheme.backgroundColor) === alertColorNormalized
    );

    if (matchingSchemeEntry) {
      const [schemeName, scheme] = matchingSchemeEntry;
      console.log("🚨 Matched to predefined scheme by color:", schemeName);
      return scheme;
    }

    console.log("🚨 Using custom color scheme with:", alertColor);

    // If no matching scheme, calculate appropriate colors
    const getContrastText = (bgColor: string): string => {
      // Simple algorithm to determine if text should be dark or light
      const hex = bgColor.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      return luminance > 0.5 ? "#000000" : "#FFFFFF";
    };

    const textColor = getContrastText(alertColor);
    const patternColor =
      textColor === "#FFFFFF"
        ? "rgba(255, 255, 255, 0.6)"
        : "rgba(0, 0, 0, 0.3)";

    return {
      backgroundColor: alertColor,
      patternColor,
      textColor,
    };
  };

  const alertConfig = getAlertConfig();
  console.log("🚨 alertConfig", alertConfig);

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 110,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <style>{alertAnimations}</style>

      {/* Full-screen background with Islamic pattern */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
      >
        <IslamicPatternBackground
          variant="custom"
          backgroundColor={alertConfig.backgroundColor}
          patternColor={alertConfig.patternColor}
          opacity={0.3}
        />
      </Box>

      {/* Alert card - 80% of screen size with same opacity as carousel */}
      <Paper
        elevation={24}
        sx={{
          width: "80%",
          maxWidth: "1200px",
          maxHeight: "80%",
          borderRadius: 4,
          backgroundColor: alpha(alertConfig.backgroundColor, 0.85),
          color: alertConfig.textColor,
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
          animation: "fadeInScale 0.5s ease-out",
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            borderBottom: `1px solid ${alpha(alertConfig.textColor, 0.1)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{
              textAlign: "center",
              fontWeight: "bold",
              fontSize: fontSizes.h3,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {currentAlert.title || "Emergency Alert"}
          </Typography>
        </Box>

        {/* Content */}
        <Box
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="h4"
            sx={{
              textAlign: "center",
              fontSize: fontSizes.h4,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              maxWidth: "100%",
              overflow: "auto",
              mb: 4,
            }}
          >
            {currentAlert.message || "Emergency alert details not available"}
          </Typography>
        </Box>

        {/* Footer with logo */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderTop: `1px solid ${alpha(alertConfig.textColor, 0.1)}`,
            backgroundColor: "transparent",
          }}
        >
          <Box
            component="img"
            src={logoWhite}
            alt="MasjidConnect"
            sx={{
              height: "30px",
              opacity: 0.8,
              filter:
                alertConfig.textColor === "#000000" ? "invert(1)" : "none",
            }}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default EmergencyAlertOverlay;
