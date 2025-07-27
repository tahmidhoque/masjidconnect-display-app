import React from "react";
import { Box, useTheme, Fade } from "@mui/material";
import ModernIslamicBackground from "../../common/ModernIslamicBackground";
import logoGold from "../../../assets/logos/logo-gold.svg";

interface PairingScreenLayoutProps {
  orientation: "LANDSCAPE" | "PORTRAIT";
  fadeIn: boolean;
  leftSection: React.ReactNode;
  rightSection: React.ReactNode;
}

/**
 * Responsive layout component for the pairing screen
 * Handles both landscape and portrait orientations with consistent background
 */
const PairingScreenLayout: React.FC<PairingScreenLayoutProps> = ({
  orientation,
  fadeIn,
  leftSection,
  rightSection,
}) => {
  const theme = useTheme();

  // Get styles based on orientation
  const getOrientationStyle = () => ({
    transform: orientation === "LANDSCAPE" ? "none" : "rotate(90deg)",
    transformOrigin: "center center",
    height: orientation === "LANDSCAPE" ? "100vh" : "100vw",
    width: orientation === "LANDSCAPE" ? "100vw" : "100vh",
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        ...getOrientationStyle(),
      }}
    >
      <ModernIslamicBackground>
        {/* Responsive logo in top left */}
        <Box
          sx={{
            position: "absolute",
            top: theme.spacing(3),
            left: theme.spacing(4),
            width: orientation === "LANDSCAPE" ? "6vw" : "6vh",
            maxWidth: "80px",
            minWidth: "60px",
            zIndex: 10,
            opacity: 1,
          }}
        >
          <img
            src={logoGold}
            alt="MasjidConnect Logo"
            style={{
              width: "100%",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </Box>

        <Fade in={fadeIn} timeout={1000}>
          <Box
            sx={{
              display: "flex",
              flexDirection: orientation === "LANDSCAPE" ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              gap: orientation === "LANDSCAPE" ? 8 : 4,
              padding: theme.spacing(4),
              color: "#fff",
            }}
          >
            {/* Left section - Instructions and content */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                maxWidth: orientation === "LANDSCAPE" ? "50%" : "100%",
                textAlign: "center",
                gap: 2,
              }}
            >
              {leftSection}
            </Box>

            {/* Right section - QR Code and pairing code */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                maxWidth: orientation === "LANDSCAPE" ? "50%" : "100%",
                gap: 3,
              }}
            >
              {rightSection}
            </Box>
          </Box>
        </Fade>
      </ModernIslamicBackground>
    </Box>
  );
};

export default PairingScreenLayout;
