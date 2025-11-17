import React from "react";
import { Box, useTheme, alpha } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { ALERT_COLOR_SCHEMES } from "./EmergencyAlertOverlay";

interface ModernIslamicBackgroundProps {
  children?: React.ReactNode;
}

/**
 * ModernIslamicBackground component
 *
 * Islamic geometric pattern background with gradient that smoothly morphs to alert colors
 * when emergency alerts are active. Features a subtle Islamic pattern overlay for authentic
 * Islamic design aesthetics.
 */
const ModernIslamicBackground: React.FC<ModernIslamicBackgroundProps> = ({
  children,
}) => {
  const theme = useTheme();

  // Get current alert to determine background color
  const currentAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert,
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

  // Create unique IDs for the pattern and emboss filter
  const patternId = React.useMemo(
    () => `modern-islamic-pattern-${Math.random().toString(36).substr(2, 9)}`,
    [],
  );
  const gradientId = React.useMemo(
    () => `modern-gradient-${Math.random().toString(36).substr(2, 9)}`,
    [],
  );
  const embossFilterId = React.useMemo(
    () => `emboss-filter-${Math.random().toString(36).substr(2, 9)}`,
    [],
  );

  // Determine pattern color - very subtle, embossed look
  // Use colors that blend with the background for an embossed effect
  const patternColor = currentAlert
    ? alpha("#ffffff", 0.08) // Very subtle white for alert backgrounds
    : alpha(theme.palette.warning.main, 0.1); // Very subtle gold for default

  const patternOpacity = 0.12; // Very subtle opacity for embossed effect

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
      {/* Islamic Geometric Pattern Overlay */}
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Emboss filter for subtle carved-in effect */}
          <filter
            id={embossFilterId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            {/* Base blur for the pattern */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="blur" />

            {/* Shadow component - offset down and right for depth */}
            <feOffset in="blur" dx="1.5" dy="1.5" result="shadowOffset" />
            <feFlood
              floodColor="black"
              floodOpacity="0.15"
              result="shadowColor"
            />
            <feComposite
              in="shadowColor"
              in2="shadowOffset"
              operator="in"
              result="shadow"
            />

            {/* Light component - offset up and left for highlight */}
            <feOffset in="blur" dx="-1" dy="-1" result="lightOffset" />
            <feFlood
              floodColor="white"
              floodOpacity="0.2"
              result="lightColor"
            />
            <feComposite
              in="lightColor"
              in2="lightOffset"
              operator="in"
              result="light"
            />

            {/* Merge everything together for embossed effect */}
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="light" />
            </feMerge>
          </filter>

          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              stopColor={patternColor}
              stopOpacity={patternOpacity}
            />
            <stop
              offset="100%"
              stopColor={patternColor}
              stopOpacity={patternOpacity * 0.6}
            />
          </linearGradient>

          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={140}
            height={140}
          >
            <g
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={18}
              strokeLinecap="square"
              opacity={1}
              filter={`url(#${embossFilterId})`}
              transform="scale(0.175)"
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
              <path d="M300,300L359.175,300L400,258.579L440.825,300L500,300L500,359.175L541.421,400L500,440.825L500,500L440.825,500L400,541.421L359.175,500L300,500L300,440.825L258.579,400L300,359.175L300,300" />

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

      {/* Content */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default ModernIslamicBackground;
