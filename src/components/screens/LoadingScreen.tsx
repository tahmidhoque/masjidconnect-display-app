import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, useTheme, Fade } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import useRotationHandling from "../../hooks/useRotationHandling";
import ModernIslamicBackground from "../common/ModernIslamicBackground";
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

// Animation timing for smooth transitions
const LOADING_ANIMATION_DELAYS = {
  logo: 0,
  spinner: 200,
  text: 400,
};

const LOADING_ANIMATION_DURATION = 300;

/**
 * LoadingScreen component
 *
 * Displays a loading screen with smooth staggered animations and consistent background.
 * Uses the same design system as DisplayScreen for seamless transitions.
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

  // State for controlling visibility and animations
  const [showContent, setShowContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Rotation handling
  const rotationInfo = useRotationHandling(orientation);
  const shouldRotate = rotationInfo.shouldRotate;
  const { width: windowWidth, height: windowHeight } = windowDimensions;

  // Set showContent to true on mount with a small delay for smooth entry
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Monitor window resize for responsive rotation handling
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle transition out when loading completes
  useEffect(() => {
    if (!isInitializing && initializationStage === "ready") {
      setIsTransitioning(true);
      // Simple transition timing
      const timer = setTimeout(() => {
        onComplete?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, initializationStage, onComplete]);

  // Get component animation styles
  const getComponentAnimation = (
    componentId: string,
    visible: boolean = true
  ) => {
    if (!visible) {
      return {
        opacity: 0,
        transform: "scale(0.95) translateY(10px)",
        transition: `opacity ${LOADING_ANIMATION_DURATION}ms ease-out, transform ${LOADING_ANIMATION_DURATION}ms ease-out`,
      };
    }

    const delay =
      LOADING_ANIMATION_DELAYS[
        componentId as keyof typeof LOADING_ANIMATION_DELAYS
      ] || 0;

    return {
      opacity: 1,
      transform: "scale(1) translateY(0px)",
      transition: `opacity ${LOADING_ANIMATION_DURATION}ms ease-out ${delay}ms, transform ${LOADING_ANIMATION_DURATION}ms ease-out ${delay}ms`,
    };
  };

  // Determine the current loading message based on app state
  const getDisplayMessage = (): DisplayMessage => {
    if (loadingMessage) {
      return { text: loadingMessage, isArabic: false };
    }

    if (isSuspenseFallback) {
      return { text: "Loading application...", isArabic: false };
    }

    switch (initializationStage) {
      case "checking":
        return { text: "Checking connection...", isArabic: false };
      case "welcome":
        return isAuthenticated
          ? { text: "Welcome back!", isArabic: false }
          : { text: "Initializing...", isArabic: false };
      case "fetching":
        return {
          text: `Loading ${masjidName || "content"}...`,
          isArabic: false,
        };
      default:
        return { text: "Loading...", isArabic: false };
    }
  };

  // Get spinner animation styles
  const getSpinnerAnimation = () => {
    const baseSpinnerAnimation = getComponentAnimation("spinner", showContent);
    return {
      ...baseSpinnerAnimation,
      "&::before": {
        content: '""',
        width: "40px",
        height: "40px",
        margin: "8px",
        borderRadius: "50%",
        border: "4px solid transparent",
        borderTopColor: theme.palette.warning.main,
        animation: "spin 1s ease-in-out infinite",
      },
    };
  };

  // Loading screen content component
  const LoadingContent = () => (
    <ModernIslamicBackground>
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
          px: 3,
        }}
      >
        {/* Logo with staggered animation */}
        <Box
          sx={{
            mb: 4,
            ...getComponentAnimation("logo", showContent),
          }}
        >
          <img
            src={logoGold}
            alt="MasjidConnect"
            style={{
              width: "120px",
              height: "auto",
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
            }}
          />
        </Box>

        {/* Loading spinner with staggered animation */}
        <Box
          sx={{
            mb: 6,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            ...getSpinnerAnimation(),
          }}
        />

        {/* Loading text with staggered animation */}
        <Box
          sx={{
            textAlign: "center",
            maxWidth: "80%",
            ...getComponentAnimation("text", showContent),
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
              textShadow: "0 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            {getDisplayMessage().text}
          </Typography>
        </Box>
      </Box>
    </ModernIslamicBackground>
  );

  return (
    <>
      {/* Add spinner keyframes */}
      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>

      <Box
        sx={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          position: "fixed",
          top: 0,
          left: 0,
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? "scale(0.98)" : "scale(1)",
          transition:
            "opacity 400ms cubic-bezier(0.4, 0, 0.2, 1), transform 400ms cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 100,
        }}
      >
        <Fade in={showContent} timeout={600}>
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
    </>
  );
};

export default LoadingScreen;
