import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import useRotationHandling from "../../hooks/useRotationHandling";
import { useAppSelector } from "../../store/hooks";
import logoGold from "../../assets/logos/logo-gold.svg";
import type { AppPhase } from "../../hooks/useLoadingStateManager";
import { getDevicePerformanceProfile, isHighStrainDevice } from "../../utils/performanceUtils";

// SIMPLIFIED: Removed complex static logo system that was causing flickering
// Now using a simple, stable React component approach

// Animation timing constants - refined for stability and 4K performance
const FADE_IN_DURATION = 800;
const TRANSITION_OUT_DURATION = 600;
const PROGRESS_TRANSITION_DURATION = 400;

// Staggered delays for smooth entrance - reduced for 4K
const SPINNER_FADE_DELAY = 200;
const PROGRESS_FADE_DELAY = 400;
const STATUS_FADE_DELAY = 600;

/**
 * Enhanced Loading Screen Component
 *
 * Provides a smooth, stable loading experience with:
 * - Simple, stable logo rendering (no complex static DOM manipulation)
 * - Smooth progress animations (disabled for 4K RPi)
 * - Phase-based status updates
 * - 4K display optimizations for Raspberry Pi
 */
interface EnhancedLoadingScreenProps {
  currentPhase: AppPhase;
  progress: number;
  statusMessage: string;
  isTransitioning: boolean;
  onTransitionComplete?: () => void;
  orientation?: "LANDSCAPE" | "PORTRAIT";
}

const EnhancedLoadingScreen: React.FC<EnhancedLoadingScreenProps> = ({
  currentPhase,
  progress,
  statusMessage,
  isTransitioning,
  onTransitionComplete,
  orientation = "LANDSCAPE",
}) => {
  const theme = useTheme();
  const masjidName = useAppSelector((state) => state.content.masjidName);

  // Get performance profile for optimizations
  const performanceProfile = useMemo(() => getDevicePerformanceProfile(), []);
  const isHighStrain = isHighStrainDevice();
  const shouldDisableAnimations = !performanceProfile.recommendations.enableAnimations;

  // Component state
  const [isFullyVisible, setIsFullyVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Refs for smooth progress updates
  const progressAnimationRef = useRef<number>();
  const targetProgressRef = useRef(progress);
  const exitTimerRef = useRef<NodeJS.Timeout>();

  // Rotation handling
  const rotationInfo = useRotationHandling(orientation);
  const shouldRotate = rotationInfo.shouldRotate;

  // Progressive loading for 4K displays
  const [elementsLoaded, setElementsLoaded] = useState({
    logo: !isHighStrain, // Load immediately if not high strain
    spinner: !isHighStrain,
    progress: !isHighStrain,
    status: !isHighStrain,
  });

  // Progressive loading effect for 4K displays
  useEffect(() => {
    if (!isHighStrain) return;

    // Load elements progressively with delays for 4K displays
    const timeouts: NodeJS.Timeout[] = [];

    timeouts.push(setTimeout(() => setElementsLoaded(prev => ({ ...prev, logo: true })), 100));
    timeouts.push(setTimeout(() => setElementsLoaded(prev => ({ ...prev, spinner: true })), 300));
    timeouts.push(setTimeout(() => setElementsLoaded(prev => ({ ...prev, progress: true })), 500));
    timeouts.push(setTimeout(() => setElementsLoaded(prev => ({ ...prev, status: true })), 700));

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isHighStrain]);

  // Smooth progress animation (disabled for 4K)
  useEffect(() => {
    if (shouldDisableAnimations) {
      // Immediate update for 4K displays
      setDisplayProgress(progress);
      return;
    }

    targetProgressRef.current = progress;

    const animateProgress = () => {
      setDisplayProgress((current) => {
        const target = targetProgressRef.current;
        const difference = target - current;

        if (Math.abs(difference) < 0.1) {
          return target;
        }

        const step = difference * 0.08;
        const newProgress = current + step;

        if (Math.abs(target - newProgress) > 0.1) {
          progressAnimationRef.current = requestAnimationFrame(animateProgress);
        }

        return newProgress;
      });
    };

    if (progressAnimationRef.current) {
      cancelAnimationFrame(progressAnimationRef.current);
    }

    progressAnimationRef.current = requestAnimationFrame(animateProgress);

    return () => {
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
      }
    };
  }, [progress, shouldDisableAnimations]);

  // Immediate visibility for other components (faster for 4K)
  useEffect(() => {
    if (isHighStrain) {
      // Immediate visibility for 4K displays
      setIsFullyVisible(true);
    } else {
      // Small delay for non-4K displays
      const timer = setTimeout(() => setIsFullyVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isHighStrain]);

  // Only exit when actually transitioning to display
  useEffect(() => {
    if (currentPhase === "displaying") {
      setIsExiting(true);

      const exitDuration = isHighStrain ? 300 : TRANSITION_OUT_DURATION; // Faster exit for 4K
      exitTimerRef.current = setTimeout(() => {
        onTransitionComplete?.();
      }, exitDuration);

      return () => {
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
        }
      };
    }
  }, [currentPhase, onTransitionComplete, isHighStrain]);

  // Enhanced status message with context
  const enhancedStatusMessage = useMemo(() => {
    if (currentPhase === "loading-content" && masjidName) {
      return `Loading ${masjidName} content...`;
    }
    return statusMessage;
  }, [currentPhase, statusMessage, masjidName]);

  // Progress bar color based on phase
  const getProgressColor = (phase: AppPhase) => {
    switch (phase) {
      case "initializing":
        return theme.palette.grey[400];
      case "checking":
        return theme.palette.info.main;
      case "pairing":
        return theme.palette.warning.main;
      case "loading-content":
        return theme.palette.primary.main;
      case "preparing":
        return theme.palette.primary.light;
      case "ready":
        return theme.palette.success.main;
      case "displaying":
        return theme.palette.success.light;
      default:
        return theme.palette.primary.main;
    }
  };

  // Spinner style based on phase (simplified for 4K)
  const getSpinnerStyle = (phase: AppPhase) => {
    const baseSize = isHighStrain ? 24 : 28; // Smaller for 4K
    const borderWidth = isHighStrain ? 2 : 3; // Thinner for 4K

    const baseStyle = {
      width: baseSize,
      height: baseSize,
      border: `${borderWidth}px solid rgba(255, 255, 255, 0.25)`,
      borderTopColor: getProgressColor(phase),
      borderRadius: "50%",
      animation: shouldDisableAnimations ? "none" : "spin 2s linear infinite",
      opacity: 0.8,
    };

    return baseStyle;
  };

  // Loading content component
  const LoadingContent = () => (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.secondary.main} 100%)`,
        // 4K optimizations
        willChange: isHighStrain ? "auto" : "transform",
        transform: isHighStrain ? "none" : "translateZ(0)",
      }}
    >
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
          px: 4,
          py: 6,
        }}
      >
        {/* OPTIMIZED: Logo with progressive loading for 4K */}
        {elementsLoaded.logo && (
          <Box
            sx={{
              marginBottom: "32px",
              height: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 1,
              transition: shouldDisableAnimations ? "none" : "opacity 0.3s ease-in-out",
            }}
          >
            <img
              src={logoGold}
              alt="MasjidConnect"
              style={{
                width: isHighStrain ? "100px" : "130px", // Smaller for 4K
                height: "auto",
                maxHeight: "80px",
                filter: isHighStrain ? "none" : "drop-shadow(0 8px 16px rgba(0,0,0,0.3))", // Remove shadow for 4K
                display: "block",
                imageRendering: isHighStrain ? "pixelated" : "auto", // Optimize for 4K
              }}
            />
          </Box>
        )}

        {/* OPTIMIZED: Spinner with progressive loading */}
        {elementsLoaded.spinner && (
          <Box
            sx={{
              mb: 4,
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 1,
              transition: shouldDisableAnimations ? "none" : "opacity 0.3s ease-in-out",
            }}
          >
            <Box
              sx={{
                ...getSpinnerStyle(currentPhase),
              }}
            />
          </Box>
        )}

        {/* OPTIMIZED: Progress bar with progressive loading */}
        {elementsLoaded.progress && (
          <Box
            sx={{
              width: "100%",
              maxWidth: isHighStrain ? "300px" : "380px", // Smaller for 4K
              mb: 3,
              height: "40px",
              opacity: 1,
              transition: shouldDisableAnimations ? "none" : "opacity 0.3s ease-in-out",
            }}
          >
            <Box
              sx={{
                width: "100%",
                height: isHighStrain ? 3 : 5, // Thinner for 4K
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, displayProgress))}%`,
                  backgroundColor: getProgressColor(currentPhase),
                  borderRadius: 3,
                  transition: shouldDisableAnimations ? "none" : "width 0.3s ease-out",
                  transformOrigin: "left",
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textAlign: "right",
                mt: 1,
                color: "rgba(255, 255, 255, 0.75)",
                fontWeight: 500,
                fontSize: isHighStrain ? "0.7rem" : "0.8rem", // Smaller for 4K
                height: "20px",
                lineHeight: "20px",
              }}
            >
              {Math.round(displayProgress)}%
            </Typography>
          </Box>
        )}

        {/* OPTIMIZED: Status message with progressive loading */}
        {elementsLoaded.status && (
          <Box
            sx={{
              textAlign: "center",
              maxWidth: "85%",
              minHeight: "80px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              opacity: 1,
              transition: shouldDisableAnimations ? "none" : "opacity 0.3s ease-in-out",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "#fff",
                textAlign: "center",
                fontWeight: 500,
                letterSpacing: "0.02em",
                fontSize: isHighStrain ? "1.2rem" : "1.4rem", // Smaller for 4K
                textShadow: isHighStrain ? "none" : "0 2px 8px rgba(0,0,0,0.5)", // Remove shadow for 4K
                mb: 0.5,
              }}
            >
              {enhancedStatusMessage}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: "rgba(255, 255, 255, 0.65)",
                textAlign: "center",
                fontWeight: 400,
                fontSize: isHighStrain ? "0.75rem" : "0.85rem", // Smaller for 4K
                textTransform: "capitalize",
              }}
            >
              {currentPhase.replace("-", " ")}
              {isTransitioning && " • transitioning"}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {/* Spinner keyframes - conditional for 4K */}
      {!shouldDisableAnimations && (
        <style>
          {`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      )}

      <Box
        sx={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 1000,
          opacity: isExiting ? 0 : 1,
          transform: isExiting && !shouldDisableAnimations ? "scale(0.98)" : "scale(1)",
          transition: isExiting && !shouldDisableAnimations
            ? `opacity ${isHighStrain ? 300 : TRANSITION_OUT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${isHighStrain ? 300 : TRANSITION_OUT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`
            : "none",
        }}
      >
        {shouldRotate ? (
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "100vh",
              height: "100vw",
              transform: "translate(-50%, -50%) rotate(90deg)",
              transformOrigin: "center",
            }}
          >
            <LoadingContent />
          </Box>
        ) : (
          <Box sx={{ width: "100%", height: "100%" }}>
            <LoadingContent />
          </Box>
        )}
      </Box>
    </>
  );
};

export default EnhancedLoadingScreen;
