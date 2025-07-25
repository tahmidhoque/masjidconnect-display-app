import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
  createContext,
  useContext,
} from "react";
import { Box, Fade } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { refreshAllContent } from "../../store/slices/contentSlice";
import { setOrientation } from "../../store/slices/uiSlice";
import {
  createTestAlert,
  clearCurrentAlert,
} from "../../store/slices/emergencySlice";
import useRotationHandling from "../../hooks/useRotationHandling";
import { ALERT_COLOR_SCHEMES } from "../common/EmergencyAlertOverlay";
import ModernLandscapeDisplay from "../layouts/ModernLandscapeDisplay";
import ModernPortraitDisplay from "../layouts/ModernPortraitDisplay";
import LoadingScreen from "./LoadingScreen";
import logger from "../../utils/logger";
import { isLowPowerDevice } from "../../utils/performanceUtils";

// Animation context for coordinating staggered animations
interface AnimationContextType {
  isAlertTransitioning: boolean;
  getComponentAnimation: (componentId: string) => {
    opacity: number;
    transform: string;
    transition: string;
  };
}

const AnimationContext = createContext<AnimationContextType | null>(null);

export const useDisplayAnimation = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    return {
      isAlertTransitioning: false,
      getComponentAnimation: () => ({
        opacity: 1,
        transform: "scale(1)",
        transition: "none",
      }),
    };
  }
  return context;
};

// Simplified CSS styles for transitions
const TRANSITION_STYLES = {
  container: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    position: "relative",
  },
  content: {
    width: "100%",
    height: "100%",
  },
  rotated: {
    width: "100vh",
    height: "100vw",
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transformOrigin: "center",
  },
};

// Animation keyframes for smooth transitions
const animationStyles = `
  @keyframes morphBackground {
    from {
      filter: hue-rotate(0deg) saturate(1) brightness(1);
    }
    to {
      filter: hue-rotate(var(--target-hue, 0deg)) saturate(var(--target-saturation, 1.2)) brightness(var(--target-brightness, 1.1));
    }
  }
`;

// Component animation timing
const ANIMATION_DELAYS = {
  header: 0,
  prayerCard: 100,
  carousel: 200,
  footer: 300,
};

const ANIMATION_DURATION = 300;

// Memoized landscape and portrait components
const MemoizedLandscapeDisplay = memo(ModernLandscapeDisplay);
const MemoizedPortraitDisplay = memo(ModernPortraitDisplay);

/**
 * DisplayScreen component
 *
 * The main display screen shown after successful authentication.
 * Shows prayer times, current content, and other information.
 * Adapts to the screen orientation (portrait/landscape) based on admin settings.
 *
 * Features staggered dissolve animations where individual components fade
 * sequentially and the background morphs to alert colors smoothly.
 *
 * Keyboard shortcuts for testing:
 * - Ctrl+Shift+1-7: Trigger different alert types
 * - Ctrl+Shift+C: Clear current alert
 * - Ctrl+Shift+R: Random alert type
 */
const DisplayScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux selectors
  const isLoading = useSelector((state: RootState) => state.content.isLoading);
  const screenContent = useSelector(
    (state: RootState) => state.content.screenContent
  );
  const orientation = useSelector((state: RootState) => state.ui.orientation);
  const currentAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert
  );

  // Custom content refresh function to replace useContentUpdates
  const forceRefresh = useCallback(() => {
    dispatch(refreshAllContent({ forceRefresh: true }));
  }, [dispatch]);

  // Animation states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAlertTransitioning, setIsAlertTransitioning] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    "idle" | "dissolving" | "showing" | "restoring"
  >("idle");

  const previousOrientationRef = useRef(orientation);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [visible, setVisible] = useState(false);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current alert config for background morphing
  const getAlertConfig = useCallback(() => {
    if (!currentAlert) return null;

    const alertConfig =
      currentAlert.colorScheme && ALERT_COLOR_SCHEMES[currentAlert.colorScheme]
        ? ALERT_COLOR_SCHEMES[currentAlert.colorScheme]
        : ALERT_COLOR_SCHEMES.RED;

    return alertConfig;
  }, [currentAlert]);

  // Calculate component animations based on current phase
  const getComponentAnimation = useCallback(
    (componentId: string) => {
      if (!isAlertTransitioning) {
        return {
          opacity: 1,
          transform: "scale(1)",
          transition: `opacity ${ANIMATION_DURATION}ms ease-out, transform ${ANIMATION_DURATION}ms ease-out`,
        };
      }

      const delay =
        ANIMATION_DELAYS[componentId as keyof typeof ANIMATION_DELAYS] || 0;
      const isDissolving = animationPhase === "dissolving";
      const isRestoring = animationPhase === "restoring";

      if (isDissolving) {
        return {
          opacity: 0,
          transform: "scale(0.95)",
          transition: `opacity ${ANIMATION_DURATION}ms ease-out ${delay}ms, transform ${ANIMATION_DURATION}ms ease-out ${delay}ms`,
        };
      } else if (isRestoring) {
        // Reverse the delay order for restoration
        const maxDelay = Math.max(...Object.values(ANIMATION_DELAYS));
        const reverseDelay = maxDelay - delay;
        return {
          opacity: 1,
          transform: "scale(1)",
          transition: `opacity ${ANIMATION_DURATION}ms ease-out ${reverseDelay}ms, transform ${ANIMATION_DURATION}ms ease-out ${reverseDelay}ms`,
        };
      }

      return {
        opacity: 0,
        transform: "scale(0.95)",
        transition: `opacity ${ANIMATION_DURATION}ms ease-out, transform ${ANIMATION_DURATION}ms ease-out`,
      };
    },
    [isAlertTransitioning, animationPhase]
  );

  // Alert animation effect with staggered timing
  useEffect(() => {
    if (currentAlert) {
      // Alert is showing - start staggered dissolve
      setIsAlertTransitioning(true);
      setAnimationPhase("dissolving");

      // Auto-clear test alerts when they expire
      if (currentAlert.id.startsWith("test-alert-")) {
        const expiresAt = new Date(currentAlert.expiresAt).getTime();
        const now = Date.now();
        const timeUntilExpiry = Math.max(0, expiresAt - now);

        if (alertTimeoutRef.current) {
          clearTimeout(alertTimeoutRef.current);
        }

        alertTimeoutRef.current = setTimeout(() => {
          dispatch(clearCurrentAlert());
        }, timeUntilExpiry);
      }
    } else {
      // Alert is clearing - start staggered restoration
      if (isAlertTransitioning) {
        setAnimationPhase("restoring");

        // Wait for restoration animation to complete
        const maxDelay = Math.max(...Object.values(ANIMATION_DELAYS));
        setTimeout(() => {
          setIsAlertTransitioning(false);
          setAnimationPhase("idle");
        }, maxDelay + ANIMATION_DURATION + 50);
      }

      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = null;
      }
    }

    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, [currentAlert, dispatch, isAlertTransitioning]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when Ctrl+Shift is pressed
      if (!event.ctrlKey || !event.shiftKey) return;

      const alertTypes = [
        "RED",
        "ORANGE",
        "AMBER",
        "BLUE",
        "GREEN",
        "PURPLE",
        "DARK",
      ];

      switch (event.key) {
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
          event.preventDefault();
          const typeIndex = parseInt(event.key) - 1;
          const alertType = alertTypes[typeIndex];
          logger.info(`Triggering test alert: ${alertType}`);
          dispatch(createTestAlert({ type: alertType, duration: 15 }));
          break;

        case "c":
        case "C":
          event.preventDefault();
          logger.info("Clearing current alert via keyboard shortcut");
          dispatch(clearCurrentAlert());
          break;

        case "r":
        case "R":
          event.preventDefault();
          const randomType =
            alertTypes[Math.floor(Math.random() * alertTypes.length)];
          logger.info(`Triggering random test alert: ${randomType}`);
          dispatch(createTestAlert({ type: randomType, duration: 10 }));
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);

    // Log available shortcuts on mount
    logger.info("Emergency alert keyboard shortcuts available:", {
      "Ctrl+Shift+1-7": "Trigger specific alert types",
      "Ctrl+Shift+C": "Clear current alert",
      "Ctrl+Shift+R": "Random alert type",
    });

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [dispatch]);

  // Add periodic content refresh - interval can be tuned for low power devices
  useEffect(() => {
    const baseInterval = parseInt(
      process.env.REACT_APP_REFRESH_INTERVAL_MS || "300000",
      10
    );
    const intervalMs = isLowPowerDevice() ? baseInterval * 2 : baseInterval;

    const interval = setInterval(() => {
      logger.info("Periodic content refresh");
      forceRefresh();
    }, intervalMs);

    logger.info(`Using refresh interval: ${Math.round(intervalMs / 1000)}s`);

    return () => clearInterval(interval);
  }, [forceRefresh]);

  // Add effect to track orientation changes
  useEffect(() => {
    // Only trigger animation if orientation actually changed
    if (previousOrientationRef.current !== orientation) {
      logger.info(
        `DisplayScreen: Orientation changed from ${previousOrientationRef.current} to ${orientation}`
      );

      // Start transition
      setIsTransitioning(true);

      // Clear any existing timeout
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }

      // After transition completes, clear the transitioning flag
      transitionTimerRef.current = setTimeout(() => {
        setIsTransitioning(false);
        previousOrientationRef.current = orientation;
        transitionTimerRef.current = null;
      }, 500); // Shorter transition duration

      return () => {
        if (transitionTimerRef.current) {
          clearTimeout(transitionTimerRef.current);
        }
      };
    }
  }, [orientation]);

  // Use rotation handling hook to determine if we need to rotate
  const rotationInfo = useRotationHandling(orientation);
  const shouldRotate = rotationInfo.shouldRotate;

  // Memoize the display component based on orientation
  const DisplayComponent = useMemo(() => {
    logger.info(`DisplayScreen: Rendering ${orientation} layout`);
    return orientation === "LANDSCAPE" ? (
      <MemoizedLandscapeDisplay />
    ) : (
      <MemoizedPortraitDisplay />
    );
  }, [orientation]);

  // Force a layout update when component mounts
  useEffect(() => {
    // Initial content refresh when the component mounts
    forceRefresh();
    setVisible(true);
  }, [forceRefresh]);

  // If content is still loading, show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Apply transition styles with alert animations
  const baseOpacity = isTransitioning ? 0.95 : 1;
  const finalOpacity = baseOpacity;

  const contentTransitionStyle = {
    transition: "opacity 300ms ease-in-out",
    opacity: finalOpacity,
  };

  // Animation context value
  const animationContextValue: AnimationContextType = {
    isAlertTransitioning,
    getComponentAnimation,
  };

  return (
    <AnimationContext.Provider value={animationContextValue}>
      <style>{animationStyles}</style>
      <Fade in={visible} timeout={800}>
        <Box sx={{ ...TRANSITION_STYLES.container, position: "relative" }}>
          {/* Main display content with animation context */}
          {shouldRotate ? (
            // Apply rotation transform for mismatched orientation
            <Box
              sx={{
                ...TRANSITION_STYLES.rotated,
                transform: `translate(-50%, -50%) rotate(90deg)`,
                ...contentTransitionStyle,
                zIndex: 1,
              }}
            >
              <Box sx={{ ...TRANSITION_STYLES.content }}>
                {DisplayComponent}
              </Box>
            </Box>
          ) : (
            // No rotation needed
            <Box
              sx={{
                ...TRANSITION_STYLES.content,
                ...contentTransitionStyle,
                zIndex: 1,
              }}
            >
              {DisplayComponent}
            </Box>
          )}
        </Box>
      </Fade>
    </AnimationContext.Provider>
  );
};

export default DisplayScreen;
