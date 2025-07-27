import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";

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

  const isPortrait = orientation === "portrait";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: getSizeRem(isPortrait ? 0.8 : 1),
        width: "100%",
        background: `linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)`,
        borderRadius: isPortrait ? "8px 8px 0 0" : "8px",
        border: `1px solid rgba(255,255,255,0.1)`,
        borderBottom: isPortrait ? "none" : `1px solid rgba(255,255,255,0.1)`,
        position: "relative",

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
      <Box sx={{ display: "flex", alignItems: "center", gap: getSizeRem(1) }}>
        <Typography
          sx={{
            fontSize: fontSizes.caption,
            color: "rgba(255,255,255,0.7)",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
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
            }}
          >
            MasjidConnect
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ModernFooter;
