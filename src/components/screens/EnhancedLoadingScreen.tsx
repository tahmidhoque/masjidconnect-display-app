import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import useRotationHandling from "../../hooks/useRotationHandling";
import { useAppSelector } from "../../store/hooks";
import logoGold from "../../assets/logos/logo-gold.svg";
import type { AppPhase } from "../../hooks/useLoadingStateManager";

// SIMPLIFIED: Removed complex static logo system that was causing flickering
// Now using a simple, stable React component approach

// Animation timing constants - refined for stability
const FADE_IN_DURATION = 800;
const TRANSITION_OUT_DURATION = 600;
const PROGRESS_TRANSITION_DURATION = 400;

// Staggered delays for smooth entrance
const SPINNER_FADE_DELAY = 200;
const PROGRESS_FADE_DELAY = 400;
const STATUS_FADE_DELAY = 600;

/**
 * Enhanced Loading Screen Component
 *
 * Provides a smooth, stable loading experience with:
 * - Simple, stable logo rendering (no complex static DOM manipulation)
 * - Smooth progress animations
 * - Phase-based status updates
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

  // Smooth progress animation
  useEffect(() => {
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
  }, [progress]);

  // Immediate visibility for other components
  useEffect(() => {
    setIsFullyVisible(true);
  }, []);

  // Only exit when actually transitioning to display
  useEffect(() => {
    if (currentPhase === "displaying") {
      setIsExiting(true);

      exitTimerRef.current = setTimeout(() => {
        onTransitionComplete?.();
      }, TRANSITION_OUT_DURATION);

      return () => {
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
        }
      };
    }
  }, [currentPhase, onTransitionComplete]);

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

  // Spinner style based on phase
  const getSpinnerStyle = (phase: AppPhase) => {
    const baseSize = 28;
    const borderWidth = 3;

    switch (phase) {
      case "initializing":
      case "checking":
        return {
          width: baseSize,
          height: baseSize,
          border: `${borderWidth}px solid rgba(255, 255, 255, 0.25)`,
          borderTopColor: getProgressColor(phase),
          borderRadius: "50%",
          animation: "spin 2s linear infinite",
          opacity: 0.8,
        };
      case "pairing":
        return {
          width: baseSize,
          height: baseSize,
          border: `${borderWidth}px solid rgba(255, 255, 255, 0.25)`,
          borderTopColor: getProgressColor(phase),
          borderRightColor: getProgressColor(phase),
          borderRadius: "50%",
          animation: "spin 1.5s linear infinite",
          opacity: 0.9,
        };
      case "loading-content":
      case "preparing":
        return {
          width: baseSize + 2,
          height: baseSize + 2,
          border: `${borderWidth}px solid rgba(255, 255, 255, 0.3)`,
          borderTopColor: getProgressColor(phase),
          borderRightColor: getProgressColor(phase),
          borderRadius: "50%",
          animation: "spin 1.2s linear infinite",
          opacity: 1,
        };
      case "ready":
      case "displaying":
        return {
          width: baseSize,
          height: baseSize,
          border: `${borderWidth}px solid rgba(255, 255, 255, 0.25)`,
          borderTopColor: getProgressColor(phase),
          borderRadius: "50%",
          animation: "spin 2.5s linear infinite",
          opacity: 0.7,
        };
      default:
        return {
          width: baseSize,
          height: baseSize,
          border: `${borderWidth}px solid rgba(255, 255, 255, 0.25)`,
          borderTopColor: theme.palette.primary.main,
          borderRadius: "50%",
          animation: "spin 1.5s linear infinite",
          opacity: 0.8,
        };
    }
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
        {/* FIXED: Simple, stable logo - no complex DOM manipulation */}
        <Box
          sx={{
            marginBottom: "32px",
            height: "80px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isFullyVisible ? 1 : 0,
            transition: isFullyVisible ? "none" : "opacity 0.5s ease-in-out",
          }}
        >
          <img
            src={logoGold}
            alt="MasjidConnect"
            style={{
              width: "130px",
              height: "auto",
              maxHeight: "80px",
              filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.3))",
              display: "block",
              // REMOVED: All complex loading states and transitions that were causing flickering
            }}
          />
        </Box>

        {/* Spinner - simplified animations */}
        <Box
          sx={{
            mb: 4,
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isFullyVisible ? 1 : 0,
            transition: isFullyVisible ? "none" : "opacity 0.3s ease-in-out",
          }}
        >
          <Box
            sx={{
              ...getSpinnerStyle(currentPhase),
            }}
          />
        </Box>

        {/* Progress bar - simplified */}
        <Box
          sx={{
            width: "100%",
            maxWidth: "380px",
            mb: 3,
            height: "40px",
            opacity: isFullyVisible ? 1 : 0,
            transition: isFullyVisible ? "none" : "opacity 0.3s ease-in-out",
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: 5,
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
                transition: "width 0.3s ease-out", // Smooth progress animation
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
              fontSize: "0.8rem",
              height: "20px",
              lineHeight: "20px",
            }}
          >
            {Math.round(displayProgress)}%
          </Typography>
        </Box>

        {/* Status message - simplified */}
        <Box
          sx={{
            textAlign: "center",
            maxWidth: "85%",
            minHeight: "80px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            opacity: isFullyVisible ? 1 : 0,
            transition: isFullyVisible ? "none" : "opacity 0.3s ease-in-out",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: "#fff",
              textAlign: "center",
              fontWeight: 500,
              letterSpacing: "0.02em",
              fontSize: "1.4rem",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
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
              fontSize: "0.85rem",
              textTransform: "capitalize",
            }}
          >
            {currentPhase.replace("-", " ")}
            {isTransitioning && " • transitioning"}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Spinner keyframes */}
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
          zIndex: 1000,
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? "scale(0.98)" : "scale(1)",
          transition: isExiting
            ? `opacity ${TRANSITION_OUT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${TRANSITION_OUT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`
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
