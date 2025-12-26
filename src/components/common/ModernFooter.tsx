import React, { useState, useEffect } from "react";
import { Box, Typography, useTheme, Fade } from "@mui/material";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import SignalWifiStatusbarConnectedNoInternet4Icon from "@mui/icons-material/SignalWifiStatusbarConnectedNoInternet4";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import { useNotifications } from "../../contexts/NotificationContext";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";

// Delay before showing connection status indicator after component mounts
// This prevents flash of disconnection warning during initial render
const CONNECTION_STATUS_DISPLAY_DELAY_MS = 5000;

interface ModernFooterProps {
  logoSrc?: string;
  orientation?: "portrait" | "landscape";
}

/**
 * ModernFooter component
 *
 * A clean, modern footer design that maintains MasjidConnect branding
 * while improving performance over the glassmorphic version.
 */
const ModernFooter: React.FC<ModernFooterProps> = ({
  logoSrc,
  orientation = "landscape",
}) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem } = useResponsiveFontSize();
  const { getCurrentNotification, removeNotification } = useNotifications();
  const connectionStatus = useConnectionStatus();

  // State to track if we should show connection status indicator
  // Start as false to prevent flash during initial load
  const [canShowConnectionStatus, setCanShowConnectionStatus] = useState(false);

  // Delay showing connection status indicator to prevent flash on startup
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanShowConnectionStatus(true);
    }, CONNECTION_STATUS_DISPLAY_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const isPortrait = orientation === "portrait";
  const currentNotification = getCurrentNotification();

  // Get notification color based on type
  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return theme.palette.success.main;
      case "warning":
        return theme.palette.warning.main;
      case "error":
        return theme.palette.error.main;
      default:
        return theme.palette.info.main;
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: getSizeRem(isPortrait ? 0.8 : 1),
        width: "100%",
        minWidth: 0, // Prevent flex overflow
        boxSizing: "border-box", // Include border in width calculation
        background: currentNotification
          ? `linear-gradient(90deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)`
          : `linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)`,
        borderRadius: "8px",
        border: currentNotification
          ? `1px solid rgba(255,255,255,0.12)`
          : `1px solid rgba(255,255,255,0.1)`,
        position: "relative",
        overflow: "visible", // Allow borders to be visible
        transition: "all 0.5s ease-in-out",

        // Modern accent line - changes colour based on notification
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: currentNotification ? "100%" : "60px",
          height: "2px",
          background: currentNotification
            ? getNotificationColor(currentNotification.type)
            : `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.secondary.main})`,
          borderRadius: "1px",
          transition: "all 0.5s ease-in-out",
          opacity: currentNotification ? 0.6 : 1,
        },
      }}
    >
      {/* Connection status indicator - left side */}
      {/* Only show when there's no notification and after startup delay */}
      {!currentNotification &&
        canShowConnectionStatus &&
        !connectionStatus.hasConnection && (
          <Fade in={true} timeout={500}>
            <Box
              sx={{
                position: "absolute",
                left: getSizeRem(0.75),
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                gap: getSizeRem(0.4),
                px: getSizeRem(0.5),
                py: getSizeRem(0.25),
                background: `linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`,
                borderRadius: "12px",
                border: `1px solid rgba(255,255,255,0.08)`,
                maxWidth: isPortrait ? "45%" : "180px",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  background:
                    connectionStatus.severity === "error"
                      ? theme.palette.error.main
                      : theme.palette.warning.main,
                  borderRadius: "12px 0 0 12px",
                  opacity: 0.7,
                },
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  color:
                    connectionStatus.severity === "error"
                      ? theme.palette.error.main
                      : theme.palette.warning.main,
                  "& svg": {
                    fontSize: "0.75rem",
                  },
                }}
              >
                {connectionStatus.status === "no-internet" ? (
                  <WifiOffIcon />
                ) : (
                  <SignalWifiStatusbarConnectedNoInternet4Icon />
                )}
              </Box>

              {/* Text */}
              <Typography
                sx={{
                  fontSize: fontSizes.caption,
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {connectionStatus.message}
              </Typography>
            </Box>
          </Fade>
        )}

      {/* Notification - takes over full footer when present */}
      <Fade in={!!currentNotification} timeout={500} unmountOnExit>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: getSizeRem(0.8),
            width: "100%",
            px: getSizeRem(2),
          }}
        >
          {/* Notification Icon */}
          {currentNotification?.icon && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                color: getNotificationColor(currentNotification.type),
                "& svg": {
                  fontSize: getSizeRem(1.2),
                },
                flexShrink: 0,
              }}
            >
              {currentNotification.icon}
            </Box>
          )}

          {/* Notification Text */}
          <Typography
            sx={{
              fontSize: fontSizes.body2,
              color: "rgba(255,255,255,0.95)",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "center",
              flex: 1,
            }}
          >
            {currentNotification?.message || currentNotification?.title}
          </Typography>

          {/* Optional Progress Indicator */}
          {currentNotification?.progress !== undefined && (
            <Typography
              sx={{
                fontSize: fontSizes.caption,
                color: getNotificationColor(currentNotification.type),
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {currentNotification.progress}%
            </Typography>
          )}
        </Box>
      </Fade>

      {/* Powered by section - fades in when no notification */}
      <Fade in={!currentNotification} timeout={500} unmountOnExit>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: getSizeRem(1),
            minWidth: 0,
            overflow: "hidden",
            maxWidth: "100%",
          }}
        >
          <Typography
            sx={{
              fontSize: fontSizes.caption,
              color: "rgba(255,255,255,0.7)",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Powered by
          </Typography>

          {logoSrc ? (
            <Box
              component="img"
              src={logoSrc}
              alt="MasjidConnect"
              sx={{
                height: getSizeRem(isPortrait ? 1.5 : 2),
                width: "auto",
                filter: "brightness(1.2)",
                flexShrink: 0,
                maxHeight: "100%",
              }}
            />
          ) : (
            <Typography
              sx={{
                fontSize: fontSizes.caption,
                fontWeight: 700,
                background: `linear-gradient(90deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.light} 100%)`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "'Poppins', sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              MasjidConnect
            </Typography>
          )}
        </Box>
      </Fade>
    </Box>
  );
};

export default ModernFooter;
