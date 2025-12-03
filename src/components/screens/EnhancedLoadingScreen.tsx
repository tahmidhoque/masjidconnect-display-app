import React, { useState, useEffect, useMemo, useRef, memo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { Check as CheckIcon, Error as ErrorIcon } from "@mui/icons-material";
import useRotationHandling from "../../hooks/useRotationHandling";
import { useAppSelector } from "../../store/hooks";
import logoGold from "../../assets/logos/logo-gold.svg";
import type { AppPhase } from "../../hooks/useLoadingStateManager";
import type { LoadingTask } from "../../hooks/useAppLoader";
import {
  getDevicePerformanceProfile,
  isHighStrainDevice,
} from "../../utils/performanceUtils";

// Note: Fade animations are handled by the parent App.tsx component
// This component renders content immediately without internal fades

/**
 * Enhanced Loading Screen Component
 *
 * Provides a premium, data-driven loading experience with:
 * - Granular task progress indicators
 * - Smooth progress animations
 * - Current task status display
 * - Professional transitions
 * - 4K display optimizations for Raspberry Pi
 */
interface EnhancedLoadingScreenProps {
  currentPhase: AppPhase;
  progress: number;
  statusMessage: string;
  isTransitioning: boolean;
  onTransitionComplete?: () => void;
  orientation?: "LANDSCAPE" | "PORTRAIT";
  tasks?: LoadingTask[];
}

/**
 * Individual task indicator component
 */
const TaskIndicator: React.FC<{
  task: LoadingTask;
  isHighStrain: boolean;
}> = memo(({ task, isHighStrain }) => {
  const theme = useTheme();

  const getStatusIcon = () => {
    switch (task.status) {
      case "complete":
        return (
          <CheckIcon
            sx={{
              fontSize: isHighStrain ? 14 : 16,
              color: theme.palette.success.light,
            }}
          />
        );
      case "error":
        return (
          <ErrorIcon
            sx={{
              fontSize: isHighStrain ? 14 : 16,
              color: theme.palette.error.light,
            }}
          />
        );
      case "loading":
        return (
          <Box
            sx={{
              width: isHighStrain ? 12 : 14,
              height: isHighStrain ? 12 : 14,
              borderRadius: "50%",
              border: `2px solid ${theme.palette.primary.light}`,
              borderTopColor: "transparent",
              animation: isHighStrain ? "none" : "spin 1s linear infinite",
            }}
          />
        );
      case "skipped":
        return (
          <Box
            sx={{
              width: isHighStrain ? 8 : 10,
              height: isHighStrain ? 8 : 10,
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.3)",
            }}
          />
        );
      default:
        return (
          <Box
            sx={{
              width: isHighStrain ? 8 : 10,
              height: isHighStrain ? 8 : 10,
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
            }}
          />
        );
    }
  };

  const getOpacity = () => {
    switch (task.status) {
      case "complete":
      case "loading":
        return 1;
      case "error":
        return 0.9;
      case "skipped":
        return 0.4;
      default:
        return 0.5;
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        opacity: getOpacity(),
        transition: isHighStrain ? "none" : "opacity 0.3s ease",
        py: 0.5,
      }}
    >
      <Box
        sx={{
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {getStatusIcon()}
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: "rgba(255, 255, 255, 0.9)",
          fontSize: isHighStrain ? "0.75rem" : "0.85rem",
          fontWeight: task.status === "loading" ? 500 : 400,
        }}
      >
        {task.label}
        {task.status === "loading" && task.progress > 0 && task.progress < 100 && (
          <Box
            component="span"
            sx={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "0.75rem",
              ml: 1,
            }}
          >
            {Math.round(task.progress)}%
          </Box>
        )}
      </Typography>
    </Box>
  );
});

TaskIndicator.displayName = "TaskIndicator";

/**
 * Main loading screen component
 */
const EnhancedLoadingScreen: React.FC<EnhancedLoadingScreenProps> = memo(
  ({
    currentPhase,
    progress,
    statusMessage,
    isTransitioning,
    onTransitionComplete,
    orientation: orientationProp,
    tasks = [],
  }) => {
    const theme = useTheme();
    const masjidName = useAppSelector((state) => state.content.masjidName);
    const reduxOrientation = useAppSelector((state) => state.ui.orientation);
    const orientation = useMemo(
      () => orientationProp || reduxOrientation || "LANDSCAPE",
      [orientationProp, reduxOrientation]
    );

    // Performance settings
    const performanceProfile = useMemo(() => getDevicePerformanceProfile(), []);
    const isHighStrain = isHighStrainDevice();
    const shouldDisableAnimations =
      !performanceProfile.recommendations.enableAnimations;

    // Component state
    const [displayProgress, setDisplayProgress] = useState(0);

    // Refs
    const progressAnimationRef = useRef<number>();
    const targetProgressRef = useRef(progress);

    // Rotation handling
    const rotationInfo = useRotationHandling(orientation);
    const shouldRotate = rotationInfo.shouldRotate;

    // Smooth progress animation
    useEffect(() => {
      if (shouldDisableAnimations) {
        setDisplayProgress(progress);
        return;
      }

      targetProgressRef.current = progress;

      const animateProgress = () => {
        setDisplayProgress((current) => {
          const target = targetProgressRef.current;
          const difference = target - current;

          if (Math.abs(difference) < 0.5) {
            return target;
          }

          const step = difference * 0.1;
          const newProgress = current + step;

          if (Math.abs(target - newProgress) > 0.5) {
            progressAnimationRef.current =
              requestAnimationFrame(animateProgress);
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

    // Enhanced status message
    const enhancedStatusMessage = useMemo(() => {
      if (currentPhase === "loading" && masjidName) {
        return `Loading ${masjidName}...`;
      }
      return statusMessage;
    }, [currentPhase, statusMessage, masjidName]);

    // Progress bar colour based on phase
    const progressColour = useMemo(() => {
      switch (currentPhase) {
        case "initializing":
          return theme.palette.grey[400];
        case "pairing":
          return theme.palette.warning.main;
        case "loading":
          return theme.palette.primary.main;
        case "displaying":
          return theme.palette.success.main;
        default:
          return theme.palette.primary.main;
      }
    }, [currentPhase, theme]);

    /**
     * Loading content - rendered inline to prevent remounting on re-renders
     * No Fade wrappers - the parent App.tsx handles the fade-out transition
     * This ensures content is always immediately visible when the component mounts
     */
    const loadingContent = (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.secondary.main} 100%)`,
          backgroundColor: theme.palette.primary.dark,
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
          {/* Logo and Branding - always visible, no fade */}
          <Box
            sx={{
              marginBottom: 5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                width: isHighStrain ? "120px" : "160px",
                height: isHighStrain ? "120px" : "160px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: isHighStrain ? "none" : "blur(10px)",
                boxShadow: isHighStrain
                  ? "none"
                  : "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                mb: 3,
              }}
            >
              <img
                src={logoGold}
                alt="MasjidConnect"
                style={{
                  width: isHighStrain ? "70px" : "100px",
                  height: "auto",
                  filter: isHighStrain
                    ? "none"
                    : "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
                  display: "block",
                }}
              />
            </Box>
            <Typography
              variant="h4"
              sx={{
                color: "#fff",
                fontWeight: 600,
                letterSpacing: "0.05em",
                fontSize: isHighStrain ? "1.5rem" : "2rem",
                textShadow: isHighStrain
                  ? "none"
                  : "0 2px 12px rgba(0,0,0,0.4)",
                mb: 0.5,
              }}
            >
              MasjidConnect
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255, 255, 255, 0.6)",
                fontWeight: 400,
                letterSpacing: "0.15em",
                fontSize: isHighStrain ? "0.7rem" : "0.8rem",
                textTransform: "uppercase",
              }}
            >
              Digital Display System
            </Typography>
          </Box>

          {/* Main Status Message - always visible */}
          <Typography
            variant="h5"
            sx={{
              color: "#fff",
              textAlign: "center",
              fontWeight: 500,
              letterSpacing: "0.02em",
              fontSize: isHighStrain ? "1.3rem" : "1.5rem",
              textShadow: isHighStrain
                ? "none"
                : "0 2px 8px rgba(0,0,0,0.4)",
              mb: 3,
            }}
          >
            {enhancedStatusMessage}
          </Typography>

          {/* Progress Bar - always visible */}
          <Box
            sx={{
              width: "100%",
              maxWidth: isHighStrain ? "320px" : "400px",
              mb: 4,
            }}
          >
            <Box
              sx={{
                width: "100%",
                height: isHighStrain ? 4 : 6,
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.15)",
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
                  backgroundColor: progressColour,
                  borderRadius: 3,
                  transition: shouldDisableAnimations
                    ? "none"
                    : "width 0.3s ease-out, background-color 0.3s ease",
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textAlign: "right",
                mt: 1,
                color: "rgba(255, 255, 255, 0.7)",
                fontWeight: 500,
                fontSize: isHighStrain ? "0.7rem" : "0.8rem",
              }}
            >
              {Math.round(displayProgress)}%
            </Typography>
          </Box>

          {/* Task List - always visible when tasks exist */}
          {tasks.length > 0 && (
            <Box
              sx={{
                width: "100%",
                maxWidth: isHighStrain ? "320px" : "400px",
                px: 2,
              }}
            >
              <Box
                sx={{
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  borderRadius: 2,
                  p: 2,
                  backdropFilter: isHighStrain ? "none" : "blur(8px)",
                }}
              >
                {tasks
                  .filter((task) => task.status !== "skipped")
                  .map((task) => (
                    <TaskIndicator
                      key={task.id}
                      task={task}
                      isHighStrain={isHighStrain}
                    />
                  ))}
              </Box>
            </Box>
          )}

          {/* Phase indicator (small text) */}
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: isHighStrain ? "0.65rem" : "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {currentPhase === "displaying" ? "Ready" : currentPhase}
            </Typography>
          </Box>
        </Box>
      </Box>
    );

    return (
      <>
        {/* Spinner keyframes */}
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
            backgroundColor: theme.palette.primary.dark,
            // Transitions are now handled by the parent component (App.tsx)
            // This component stays fully opaque and lets the parent fade it out
          }}
        >
          {/* Rotated container for portrait orientation */}
          <Box
            className={shouldRotate ? "rotation-container no-acceleration" : ""}
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "max(100vh, 100vw)",
              height: "max(100vh, 100vw)",
              transform: shouldRotate
                ? "translate(-50%, -50%) rotate(90deg)"
                : "none",
              transformOrigin: "center center",
              opacity: shouldRotate ? 1 : 0,
              pointerEvents: shouldRotate ? "auto" : "none",
              overflow: "hidden",
              willChange: isHighStrain ? "auto" : "transform",
              backfaceVisibility: "hidden",
              minWidth: "100vh",
              minHeight: "100vw",
            }}
          >
            {loadingContent}
          </Box>

          {/* Non-rotated container for landscape orientation */}
          <Box
            sx={{
              width: "100%",
              height: "100%",
              opacity: shouldRotate ? 0 : 1,
              pointerEvents: shouldRotate ? "none" : "auto",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            {loadingContent}
          </Box>
        </Box>
      </>
    );
  }
);

EnhancedLoadingScreen.displayName = "EnhancedLoadingScreen";

export default EnhancedLoadingScreen;
