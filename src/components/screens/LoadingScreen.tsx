import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, useTheme, Fade } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import useRotationHandling from "../../hooks/useRotationHandling";
import logoGold from "../../assets/logos/logo-gold.svg";
import logger from "../../utils/logger";

interface LoadingScreenProps {
  onComplete?: () => void;
  isSuspenseFallback?: boolean;
}

// Interface for the display message object
interface DisplayMessage {
  text: string;
  isArabic: boolean;
}

/**
 * LoadingScreen component
 *
 * Displays a loading screen with the MasjidConnect logo and a loading animation
 * while the app checks pairing status and fetches content.
 * Shows different messages based on authentication status and initialization stage.
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onComplete,
  isSuspenseFallback = false,
}) => {
  const theme = useTheme();

  // Redux selectors
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const orientation = useSelector((state: RootState) => state.ui.orientation);
  const masjidName = useSelector(
    (state: RootState) => state.content.masjidName
  );
  const contentLoading = useSelector(
    (state: RootState) => state.content.isLoading
  );
  const loadingMessage = useSelector(
    (state: RootState) => state.ui.loadingMessage
  );
  const isInitializing = useSelector(
    (state: RootState) => state.ui.isInitializing
  );
  const initializationStage = useSelector(
    (state: RootState) => state.ui.initializationStage
  );

  // Animation and content states
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const hasCompletedRef = useRef(false);

  // Track orientation for proper rendering
  const { shouldRotate } = useRotationHandling(orientation);

  // Calculate viewport dimensions
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Simple spinner animation effect - runs independently
  useEffect(() => {
    const animationInterval = setInterval(() => {
      setRotationAngle((prev) => (prev + 2) % 360);
    }, 30);

    return () => clearInterval(animationInterval);
  }, []);

  // Fade in the content initially
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Handle completion when initialization is done
  useEffect(() => {
    if (
      !isInitializing &&
      initializationStage === "ready" &&
      !hasCompletedRef.current &&
      onComplete
    ) {
      hasCompletedRef.current = true;
      // Add a brief delay to ensure smooth transition
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, [isInitializing, initializationStage, onComplete]);

  // Get display message based on initialization state
  const getDisplayMessage = (): DisplayMessage => {
    // If used as Suspense fallback, show a simple message
    if (isSuspenseFallback) {
      return { text: "Loading...", isArabic: false };
    }

    // Use the loading message from Redux state if available
    if (loadingMessage) {
      // Check if this is a completion message
      if (loadingMessage === "Ready" && isAuthenticated && masjidName) {
        return { text: `السلام عليكم - ${masjidName}`, isArabic: true };
      } else if (loadingMessage === "Ready") {
        return { text: "السلام عليكم", isArabic: true };
      }

      return { text: loadingMessage, isArabic: false };
    }

    // Fallback messages based on state
    if (isAuthenticated) {
      if (contentLoading) {
        return { text: "Loading latest content...", isArabic: false };
      }
      return { text: "Loading your dashboard...", isArabic: false };
    } else {
      return { text: "Initializing...", isArabic: false };
    }
  };

  // Custom Islamic geometric pattern loader
  const CustomLoader = () => {
    const goldColor = theme.palette.warning.main; // Gold color
    const emeraldColor = "#2A9D8F"; // Emerald Green from brand guidelines
    const skyBlueColor = "#66D1FF"; // Sky Blue from brand guidelines

    // Don't show spinner for completion messages
    const message = getDisplayMessage();
    const isCompletionMessage = message.isArabic || message.text === "Ready";

    if (isCompletionMessage) {
      return null;
    }

    return (
      <Box
        sx={{ position: "relative", width: 120, height: 120, marginBottom: 3 }}
      >
        {/* Outer rotating ring */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: `4px solid ${goldColor}`,
            borderTopColor: "transparent",
            transform: `rotate(${rotationAngle}deg)`,
          }}
        />

        {/* Middle rotating ring */}
        <Box
          sx={{
            position: "absolute",
            top: "15%",
            left: "15%",
            width: "70%",
            height: "70%",
            borderRadius: "50%",
            border: `4px solid ${emeraldColor}`,
            borderRightColor: "transparent",
            transform: `rotate(${-rotationAngle * 1.5}deg)`,
          }}
        />

        {/* Inner geometric pattern */}
        <Box
          sx={{
            position: "absolute",
            top: "30%",
            left: "30%",
            width: "40%",
            height: "40%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Eight-pointed star - central Islamic motif */}
          <svg width="100%" height="100%" viewBox="0 0 40 40">
            <polygon
              points="20,0 25,15 40,20 25,25 20,40 15,25 0,20 15,15"
              fill={skyBlueColor}
              transform={`rotate(${rotationAngle * 0.5})`}
              style={{ transformOrigin: "center" }}
            />
          </svg>
        </Box>
      </Box>
    );
  };

  // Main content to be displayed
  const LoadingContent = () => (
    <Box
      sx={{
        background: "linear-gradient(135deg, #0A2647 0%, #144272 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        height: "100%",
        padding: "5vh 0",
      }}
    >
      {/* Empty top space for balance */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Logo container - fixed height to prevent movement */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 2,
          position: "relative",
        }}
      >
        <Box
          sx={{
            width: 280,
            height: 240,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: theme.palette.warning.main,
          }}
        >
          <img
            src={logoGold}
            alt="MasjidConnect Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              animation: getDisplayMessage().isArabic
                ? "logoGlow 2s infinite"
                : "none",
            }}
          />
        </Box>
      </Box>

      {/* Bottom section with spinner and message */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "auto",
          flexGrow: 1,
          justifyContent: "flex-end",
          minHeight: "240px",
          position: "relative",
          "@keyframes logoGlow": {
            "0%": { filter: "brightness(1)" },
            "50%": { filter: "brightness(1.3)" },
            "100%": { filter: "brightness(1)" },
          },
        }}
      >
        {/* Spinner container */}
        <Box
          sx={{
            height: "auto",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            marginBottom: 4,
          }}
        >
          <CustomLoader />
        </Box>

        {/* Message container */}
        <Box
          sx={{
            width: "100%",
            position: "relative",
            textAlign: "center",
            padding: "0 24px",
            marginBottom: 4,
          }}
        >
          <Typography
            variant={getDisplayMessage().isArabic ? "arabicText" : "body1"}
            sx={{
              color: "#fff",
              textAlign: "center",
              fontWeight: 400,
              letterSpacing: "0.05em",
              fontSize: getDisplayMessage().isArabic ? "1.8rem" : "1.4rem",
              transition: "font-size 0.5s ease",
              textShadow: "0 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            {getDisplayMessage().text}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
        backgroundColor: theme.palette.background.default,
        opacity: 1,
        transition: "opacity 1.2s ease-in-out",
        "&.fade-out": {
          opacity: 0,
        },
        zIndex: 100,
      }}
      className={
        !isInitializing && initializationStage === "ready"
          ? "fade-out"
          : undefined
      }
    >
      <Fade in={showContent} timeout={800}>
        {shouldRotate ? (
          // Portrait orientation with rotation transform
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: windowHeight,
              height: windowWidth,
              transform: "translate(-50%, -50%) rotate(90deg)",
              transformOrigin: "center",
            }}
          >
            <LoadingContent />
          </Box>
        ) : (
          // Landscape orientation or no rotation needed
          <Box sx={{ width: "100%", height: "100%" }}>
            <LoadingContent />
          </Box>
        )}
      </Fade>
    </Box>
  );
};

export default LoadingScreen;
