import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { format } from "date-fns";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";

interface ModernHeaderProps {
  masjidName: string;
  currentDate: Date;
  hijriDate: string;
  currentTime: Date;
  orientation?: "portrait" | "landscape";
}

/**
 * ModernHeader component
 *
 * A clean, modern header design that replaces the glassmorphic header
 * with better performance while maintaining Islamic aesthetics.
 */
const ModernHeader: React.FC<ModernHeaderProps> = ({
  masjidName,
  currentDate,
  hijriDate,
  currentTime,
  orientation = "landscape",
}) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem } = useResponsiveFontSize();

  const isPortrait = orientation === "portrait";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        p: getSizeRem(isPortrait ? 1 : 1.2),
        width: "100%",
        minWidth: 0, // Prevent flex overflow
        boxSizing: "border-box", // Include border in width calculation
        background: `linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)`,
        borderRadius: "8px",
        border: `1px solid rgba(255,255,255,0.2)`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        position: "relative",
        overflow: "visible", // Allow borders to be visible

        // Modern accent line
        "&::before": {
          content: '""',
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "60px",
          height: "3px",
          background: `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`,
          borderRadius: "2px",
        },
      }}
    >
      {/* Left Section - Masjid Info */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0, // Prevent flex overflow
          overflow: "hidden",
          pr: getSizeRem(1),
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontSize: fontSizes.h2,
            fontWeight: 700,
            background: `linear-gradient(90deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.light} 100%)`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 0.5,
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: "0.5px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {masjidName}
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: getSizeRem(1),
            flexWrap: "wrap",
            overflow: "hidden",
          }}
        >
          <Typography
            sx={{
              fontSize: fontSizes.body1,
              color: "rgba(255,255,255,0.9)",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </Typography>

          <Box
            sx={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: theme.palette.warning.main,
              flexShrink: 0,
            }}
          />

          <Typography
            sx={{
              fontSize: fontSizes.body1,
              color: theme.palette.warning.light,
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {hijriDate}
          </Typography>
        </Box>
      </Box>

      {/* Right Section - Current Time */}
      <Box
        sx={{
          textAlign: "right",
          flexShrink: 0,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <Typography
          sx={{
            fontSize: fontSizes.h1,
            fontWeight: 700,
            color: "#fff",
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: "1px",
            textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {format(currentTime, "HH:mm")}
        </Typography>

        <Typography
          sx={{
            fontSize: fontSizes.caption,
            color: "rgba(255,255,255,0.7)",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            mt: -0.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {format(currentTime, "ss")} seconds
        </Typography>
      </Box>
    </Box>
  );
};

export default ModernHeader;
