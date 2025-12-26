import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";

interface ModernContentCardProps {
  children?: React.ReactNode;
  title?: string;
  variant?: "landscape" | "portrait";
}

/**
 * ModernContentCard component
 *
 * A clean, modern wrapper for content items in the carousel,
 * replacing the glassmorphic design with better performance.
 */
const ModernContentCard: React.FC<ModernContentCardProps> = ({
  children,
  title,
  variant = "landscape",
}) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem } = useResponsiveFontSize();

  const isPortrait = variant === "portrait";

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)`,
        borderRadius: "8px",
        border: `1px solid rgba(255,255,255,0.2)`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Decorative accent */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.warning.main})`,
        }}
      />

      {/* Title Section */}
      {title && (
        <Box
          sx={{
            p: getSizeRem(isPortrait ? 1 : 1.2),
            borderBottom: `1px solid rgba(255,255,255,0.1)`,
            textAlign: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: fontSizes.h3,
              fontWeight: 600,
              color: theme.palette.warning.main,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {title}
          </Typography>
        </Box>
      )}

      {/* Content Section */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto", // Allow scrolling for long content
          display: "flex",
          flexDirection: "column",
          p: getSizeRem(1),
          // Better text formatting for long content
          "& .MuiTypography-root": {
            wordWrap: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
            lineHeight: 1.6,
          },
          // Specific styling for Arabic text
          "& .arabic-text": {
            direction: "rtl",
            textAlign: "center",
            lineHeight: 1.8,
            letterSpacing: "0.5px",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default ModernContentCard;
