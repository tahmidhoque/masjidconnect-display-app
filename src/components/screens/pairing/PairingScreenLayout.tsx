import React, { ReactNode } from "react";
import { Box, Fade, Divider, useTheme } from "@mui/material";
// Import Orientation type from UI slice or define locally
type Orientation = "LANDSCAPE" | "PORTRAIT";
import logoGold from "../../../assets/logos/logo-gold.svg";

interface PairingScreenLayoutProps {
  orientation: Orientation;
  fadeIn: boolean;
  leftSection: ReactNode;
  rightSection: ReactNode;
}

/**
 * Responsive layout component for the pairing screen
 * Handles both landscape and portrait orientations
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

  // Background style
  const backgroundStyle = {
    background: "linear-gradient(135deg, #0A2647 0%, #144272 100%)",
    color: "#fff",
  };

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
        ...backgroundStyle,
      }}
    >
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
            width: "100%",
            height: "100%",
            padding: 4,
          }}
        >
          {/* Left section (or top section in portrait) */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent:
                orientation === "LANDSCAPE" ? "center" : "flex-start",
              alignItems: "flex-start",
              pr: orientation === "LANDSCAPE" ? 4 : 0,
              pb: orientation === "PORTRAIT" ? 4 : 0,
              position: "relative",
            }}
          >
            {leftSection}
          </Box>

          {/* Vertical divider in landscape mode */}
          {orientation === "LANDSCAPE" && (
            <Divider
              orientation="vertical"
              flexItem
              sx={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                height: "80%",
                alignSelf: "center",
                mx: 2,
              }}
            />
          )}

          {/* Right section (or bottom section in portrait) */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              pl: orientation === "LANDSCAPE" ? 4 : 0,
              pt: orientation === "PORTRAIT" ? 2 : 0,
            }}
          >
            {rightSection}
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default PairingScreenLayout;
