import React, { useEffect } from "react";
import { Box, Typography, Paper, Fade, alpha, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import logoWhite from "../../assets/logos/logo-notext-white.svg";
import { useOrientation } from "../../contexts/OrientationContext";
import useRotationHandling from "../../hooks/useRotationHandling";

// Define a type for color scheme keys
export type AlertColorSchemeKey =
  | "RED"
  | "ORANGE"
  | "AMBER"
  | "BLUE"
  | "GREEN"
  | "PURPLE"
  | "DARK";

// Modern gradient-based alert color schemes
export const ALERT_COLOR_SCHEMES: Record<
  AlertColorSchemeKey,
  {
    name: string;
    gradient: string;
    textColor: string;
    description: string;
    accentColor: string;
  }
> = {
  RED: {
    name: "Critical Alert",
    gradient: "linear-gradient(135deg, #d32f2f 0%, #f44336 50%, #ef5350 100%)",
    textColor: "#FFFFFF",
    accentColor: "#ffcdd2",
    description: "High urgency, critical emergency alerts",
  },
  ORANGE: {
    name: "Important Alert",
    gradient: "linear-gradient(135deg, #e65100 0%, #ff9800 50%, #ffb74d 100%)",
    textColor: "#FFFFFF",
    accentColor: "#ffe0b2",
    description: "Important alerts requiring attention",
  },
  AMBER: {
    name: "Caution Alert",
    gradient: "linear-gradient(135deg, #ff8f00 0%, #ffc107 50%, #ffeb3b 100%)",
    textColor: "#000000",
    accentColor: "#fff8e1",
    description: "Moderate urgency alerts",
  },
  BLUE: {
    name: "Information Alert",
    gradient: "linear-gradient(135deg, #1565c0 0%, #2196f3 50%, #64b5f6 100%)",
    textColor: "#FFFFFF",
    accentColor: "#e3f2fd",
    description: "Informational emergency alerts",
  },
  GREEN: {
    name: "Success Alert",
    gradient: "linear-gradient(135deg, #2e7d32 0%, #4caf50 50%, #81c784 100%)",
    textColor: "#FFFFFF",
    accentColor: "#e8f5e8",
    description: "Status updates and resolutions",
  },
  PURPLE: {
    name: "Special Alert",
    gradient: "linear-gradient(135deg, #6a1b9a 0%, #9c27b0 50%, #ba68c8 100%)",
    textColor: "#FFFFFF",
    accentColor: "#f3e5f5",
    description: "Special announcements during emergency situations",
  },
  DARK: {
    name: "Urgent Alert",
    gradient: "linear-gradient(135deg, #263238 0%, #37474f 50%, #546e7a 100%)",
    textColor: "#FFFFFF",
    accentColor: "#eceff1",
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
  
  @keyframes pulse {
    0%, 100% {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    50% {
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    }
  }
`;

/**
 * EmergencyAlertOverlay Component
 *
 * Displays a modern emergency alert as a full-screen overlay with gradient backgrounds.
 * Features clean design matching the overall system aesthetic.
 */
const EmergencyAlertOverlay: React.FC = () => {
  const theme = useTheme();
  const currentAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert,
  );
  const hasActiveAlert = currentAlert !== null;
  const { fontSizes } = useResponsiveFontSize();

  // Orientation handling
  const { orientation } = useOrientation();
  const rotationInfo = useRotationHandling(orientation);
  const shouldRotate = rotationInfo.shouldRotate;

  useEffect(() => {
    console.log("🚨 EmergencyAlertOverlay: Alert state changed:", currentAlert);
  }, [currentAlert]);

  if (!hasActiveAlert || !currentAlert) return null;

  // Determine which color scheme to use
  const getAlertConfig = () => {
    // Check if this is one of our predefined color schemes by name
    if (currentAlert.colorScheme) {
      const colorScheme = currentAlert.colorScheme as AlertColorSchemeKey;
      if (isValidColorSchemeKey(colorScheme)) {
        console.log("🚨 Using predefined color scheme:", colorScheme);
        return ALERT_COLOR_SCHEMES[colorScheme];
      }
    }

    // Try to match by color value for backward compatibility
    const alertColor = currentAlert.color || "#f44336";
    const normalizeColor = (color: string) =>
      color.toLowerCase().replace(/\s+/g, "");
    const alertColorNormalized = normalizeColor(alertColor);

    // Simple mapping for common colors to gradients
    if (
      alertColorNormalized.includes("f44336") ||
      alertColorNormalized.includes("red")
    ) {
      return ALERT_COLOR_SCHEMES.RED;
    }
    if (
      alertColorNormalized.includes("ff9800") ||
      alertColorNormalized.includes("orange")
    ) {
      return ALERT_COLOR_SCHEMES.ORANGE;
    }
    if (
      alertColorNormalized.includes("ffc107") ||
      alertColorNormalized.includes("amber")
    ) {
      return ALERT_COLOR_SCHEMES.AMBER;
    }
    if (
      alertColorNormalized.includes("2196f3") ||
      alertColorNormalized.includes("blue")
    ) {
      return ALERT_COLOR_SCHEMES.BLUE;
    }
    if (
      alertColorNormalized.includes("4caf50") ||
      alertColorNormalized.includes("green")
    ) {
      return ALERT_COLOR_SCHEMES.GREEN;
    }
    if (
      alertColorNormalized.includes("9c27b0") ||
      alertColorNormalized.includes("purple")
    ) {
      return ALERT_COLOR_SCHEMES.PURPLE;
    }

    // Default to RED for unknown colors
    console.log("🚨 Unknown color, defaulting to RED scheme");
    return ALERT_COLOR_SCHEMES.RED;
  };

  const alertConfig = getAlertConfig();

  const AlertContent = () => (
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

      {/* Full-screen gradient background */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          background: alertConfig.gradient,
          opacity: 0.15,
        }}
      />

      {/* Alert card with clean modern design */}
      <Paper
        elevation={24}
        sx={{
          width: "85%",
          maxWidth: "1000px",
          maxHeight: "85%",
          borderRadius: 6,
          background: alertConfig.gradient,
          color: alertConfig.textColor,
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
          animation: "fadeInScale 0.6s ease-out, pulse 3s ease-in-out infinite",
          boxShadow: `0 16px 48px ${alpha(theme.palette.common.black, 0.4)}`,
          display: "flex",
          flexDirection: "column",
          border: `2px solid ${alpha(alertConfig.accentColor, 0.3)}`,
        }}
      >
        {/* Header with modern styling */}
        <Box
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            borderBottom: `2px solid ${alpha(alertConfig.textColor, 0.15)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: `linear-gradient(to bottom, ${alpha(
              alertConfig.accentColor,
              0.1,
            )}, transparent)`,
          }}
        >
          <Typography
            variant="h2"
            component="h1"
            sx={{
              textAlign: "center",
              fontWeight: 700,
              fontSize: fontSizes.h2,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textShadow: `2px 2px 4px ${alpha(
                theme.palette.common.black,
                0.3,
              )}`,
              mb: 1,
            }}
          >
            {currentAlert.title || "Emergency Alert"}
          </Typography>
        </Box>

        {/* Content with improved typography */}
        <Box
          sx={{
            p: { xs: 4, sm: 5, md: 6 },
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(to bottom, transparent, ${alpha(
              alertConfig.accentColor,
              0.05,
            )})`,
          }}
        >
          <Typography
            variant="h3"
            sx={{
              textAlign: "center",
              fontSize: fontSizes.h3,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              maxWidth: "100%",
              overflow: "auto",
              fontWeight: 500,
              textShadow: `1px 1px 2px ${alpha(
                theme.palette.common.black,
                0.2,
              )}`,
            }}
          >
            {currentAlert.message || "Emergency alert details not available"}
          </Typography>
        </Box>

        {/* Footer with modern logo treatment */}
        <Box
          sx={{
            p: 3,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderTop: `2px solid ${alpha(alertConfig.textColor, 0.15)}`,
            background: `linear-gradient(to top, ${alpha(
              alertConfig.accentColor,
              0.1,
            )}, transparent)`,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              opacity: 0.9,
            }}
          >
            <Box
              component="img"
              src={logoWhite}
              alt="MasjidConnect"
              sx={{
                height: "32px",
                filter:
                  alertConfig.textColor === "#000000"
                    ? "invert(1) drop-shadow(1px 1px 2px rgba(0,0,0,0.2))"
                    : "drop-shadow(1px 1px 2px rgba(0,0,0,0.3))",
              }}
            />
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: "0.9rem",
                letterSpacing: "0.05em",
                textShadow: `1px 1px 2px ${alpha(
                  theme.palette.common.black,
                  0.2,
                )}`,
              }}
            >
              MasjidConnect
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );

  return (
    <>
      {shouldRotate ? (
        <Box
          sx={{
            position: "fixed",
            top: "50%",
            left: "50%",
            width: "100vh",
            height: "100vw",
            transform: "translate(-50%, -50%) rotate(90deg)",
            transformOrigin: "center",
            zIndex: 110,
          }}
        >
          <AlertContent />
        </Box>
      ) : (
        <AlertContent />
      )}
    </>
  );
};

export default EmergencyAlertOverlay;
