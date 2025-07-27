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
import logger from "../../utils/logger";
import { isLowPowerDevice } from "../../utils/performanceUtils";

// Animation context for coordinating staggered animations
interface AnimationContextType {
  isAlertTransitioning: boolean;
  isDisplayReady: boolean;
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
      isDisplayReady: true,
      getComponentAnimation: () => ({
        opacity: 1,
        transform: "scale(1)",
        transition: "none",
      }),
    };
  }
  return context;
};

// Transition timing constants
const DISPLAY_MOUNT_DURATION = 1200;
const COMPONENT_STAGGER_DELAY = 150;
const ALERT_ANIMATION_DURATION = 300;

// Component animation timing
const ANIMATION_DELAYS = {
  header: 0,
  prayerCard: COMPONENT_STAGGER_DELAY,
  carousel: COMPONENT_STAGGER_DELAY * 2,
  footer: COMPONENT_STAGGER_DELAY * 3,
};

// Memoized landscape and portrait components
const MemoizedLandscapeDisplay = memo(ModernLandscapeDisplay);
const MemoizedPortraitDisplay = memo(ModernPortraitDisplay);

/**
 * DisplayScreen component
 *
 * The main display screen shown after successful authentication.
 * Features coordinated entrance animations and smooth alert transitions.
 */
const DisplayScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux selectors
  const screenContent = useSelector(
    (state: RootState) => state.content.screenContent
  );
  const prayerTimes = useSelector(
    (state: RootState) => state.content.prayerTimes
  );
  const orientation = useSelector((state: RootState) => state.ui.orientation);
  const currentAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert
  );

  // Component readiness and animation states
  const [isDisplayReady, setIsDisplayReady] = useState(false);
  const [isAlertTransitioning, setIsAlertTransitioning] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    "idle" | "dissolving" | "showing" | "restoring"
  >("idle");
  const [isMounted, setIsMounted] = useState(false);

  const previousOrientationRef = useRef(orientation);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Content refresh function
  const forceRefresh = useCallback(() => {
    dispatch(refreshAllContent({ forceRefresh: true }));
  }, [dispatch]);

  // Check if we have content ready to display
  const hasContent = useMemo(() => {
    return screenContent !== null || prayerTimes !== null;
  }, [screenContent, prayerTimes]);

  // Get current alert config for background morphing
  const getAlertConfig = useCallback(() => {
    if (!currentAlert) return null;

    const alertConfig =
      currentAlert.colorScheme && ALERT_COLOR_SCHEMES[currentAlert.colorScheme]
        ? ALERT_COLOR_SCHEMES[currentAlert.colorScheme]
        : ALERT_COLOR_SCHEMES.RED;

    return alertConfig;
  }, [currentAlert]);

  // Calculate component animations
  const getComponentAnimation = useCallback(
    (componentId: string) => {
      if (!isDisplayReady) {
        // Initial mount animation
        const delay =
          ANIMATION_DELAYS[componentId as keyof typeof ANIMATION_DELAYS] || 0;
        return {
          opacity: isMounted ? 1 : 0,
          transform: isMounted
            ? "translateY(0px) scale(1)"
            : "translateY(30px) scale(0.96)",
          transition: `opacity ${DISPLAY_MOUNT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform ${DISPLAY_MOUNT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
        };
      }

      if (!isAlertTransitioning) {
        return {
          opacity: 1,
          transform: "scale(1)",
          transition: `opacity ${ALERT_ANIMATION_DURATION}ms ease-out, transform ${ALERT_ANIMATION_DURATION}ms ease-out`,
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
          transition: `opacity ${ALERT_ANIMATION_DURATION}ms ease-out ${delay}ms, transform ${ALERT_ANIMATION_DURATION}ms ease-out ${delay}ms`,
        };
      } else if (isRestoring) {
        const maxDelay = Math.max(...Object.values(ANIMATION_DELAYS));
        const reverseDelay = maxDelay - delay;
        return {
          opacity: 1,
          transform: "scale(1)",
          transition: `opacity ${ALERT_ANIMATION_DURATION}ms ease-out ${reverseDelay}ms, transform ${ALERT_ANIMATION_DURATION}ms ease-out ${reverseDelay}ms`,
        };
      }

      return {
        opacity: 0,
        transform: "scale(0.95)",
        transition: `opacity ${ALERT_ANIMATION_DURATION}ms ease-out, transform ${ALERT_ANIMATION_DURATION}ms ease-out`,
      };
    },
    [isDisplayReady, isMounted, isAlertTransitioning, animationPhase]
  );

  // Mount and display readiness effect
  useEffect(() => {
    logger.info(
      "[DisplayScreen] Component mounted, starting readiness sequence"
    );

    // Start mount animation immediately
    setIsMounted(true);

    // Mark display as ready after animation completes
    mountTimerRef.current = setTimeout(() => {
      logger.info("[DisplayScreen] Display ready - all animations complete");
      setIsDisplayReady(true);
    }, DISPLAY_MOUNT_DURATION + Math.max(...Object.values(ANIMATION_DELAYS)) + 200);

    return () => {
      if (mountTimerRef.current) {
        clearTimeout(mountTimerRef.current);
      }
    };
  }, []);

  // Alert animation effect
  useEffect(() => {
    if (currentAlert) {
      setIsAlertTransitioning(true);
      setAnimationPhase("dissolving");

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
      if (isAlertTransitioning) {
        setAnimationPhase("restoring");

        const maxDelay = Math.max(...Object.values(ANIMATION_DELAYS));
        setTimeout(() => {
          setIsAlertTransitioning(false);
          setAnimationPhase("idle");
        }, maxDelay + ALERT_ANIMATION_DURATION + 50);
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

  // Keyboard shortcuts for testing
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
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

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [dispatch]);

  // Periodic content refresh
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

    return () => clearInterval(interval);
  }, [forceRefresh]);

  // Rotation handling
  const rotationInfo = useRotationHandling(orientation);
  const shouldRotate = rotationInfo.shouldRotate;

  // Memoize the display component
  const DisplayComponent = useMemo(() => {
    logger.info(`DisplayScreen: Rendering ${orientation} layout`);
    return orientation === "LANDSCAPE" ? (
      <MemoizedLandscapeDisplay />
    ) : (
      <MemoizedPortraitDisplay />
    );
  }, [orientation]);

  // Animation context value
  const animationContextValue: AnimationContextType = {
    isAlertTransitioning,
    isDisplayReady,
    getComponentAnimation,
  };

  // Wait for content to be available
  if (!hasContent) {
    logger.info("[DisplayScreen] Waiting for content to be available");
    return (
      <Box
        sx={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${(theme: any) =>
            theme.palette.primary.dark} 0%, ${(theme: any) =>
            theme.palette.primary.main} 50%, ${(theme: any) =>
            theme.palette.secondary.main} 100%)`,
        }}
      >
        {/* Content loading indicator */}
      </Box>
    );
  }

  return (
    <AnimationContext.Provider value={animationContextValue}>
      <Fade in={isMounted} timeout={800}>
        <Box
          sx={{
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            position: "fixed",
            top: 0,
            left: 0,
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
              {DisplayComponent}
            </Box>
          ) : (
            <Box sx={{ width: "100%", height: "100%" }}>{DisplayComponent}</Box>
          )}
        </Box>
      </Fade>
    </AnimationContext.Provider>
  );
};

export default DisplayScreen;
