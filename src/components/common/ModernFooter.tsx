import React from "react";
import { Box, Typography, useTheme, Fade } from "@mui/material";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import { useNotifications } from "../../contexts/NotificationContext";

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
        background: `linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)`,
        borderRadius: "8px",
        border: `1px solid rgba(255,255,255,0.1)`,
        position: "relative",
        overflow: "visible", // Allow borders to be visible

        // Modern accent line
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "60px",
          height: "2px",
          background: `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.secondary.main})`,
          borderRadius: "1px",
        },
      }}
    >
      {/* Powered by section - always centered */}
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

      {/* Notification pill - absolutely positioned in corner, doesn't affect layout */}
      {currentNotification && (
        <Fade in={true} timeout={300}>
          <Box
            sx={{
              position: "absolute",
              right: getSizeRem(0.75),
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: getSizeRem(0.5),
              px: getSizeRem(0.75),
              py: getSizeRem(0.3),
              background: `linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`,
              borderRadius: "12px",
              border: `1px solid rgba(255,255,255,0.08)`,
              maxWidth: isPortrait ? "50%" : "240px",
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "2px",
                background: getNotificationColor(currentNotification.type),
                borderRadius: "12px 0 0 12px",
                opacity: 0.7,
              },
            }}
          >
            {/* Icon */}
            {currentNotification.icon && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  color: getNotificationColor(currentNotification.type),
                  "& svg": {
                    fontSize: "0.875rem",
                  },
                }}
              >
                {currentNotification.icon}
              </Box>
            )}

            {/* Text - just show message or title */}
            <Typography
              sx={{
                fontSize: fontSizes.caption,
                color: "rgba(255,255,255,0.85)",
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentNotification.message || currentNotification.title}
            </Typography>
          </Box>
        </Fade>
      )}
    </Box>
  );
};

export default ModernFooter;
