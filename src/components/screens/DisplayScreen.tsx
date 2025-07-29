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
import {
  isLowPowerDevice,
  getDevicePerformanceProfile,
  isHighStrainDevice,
} from "../../utils/performanceUtils";

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

// Get performance-aware animation delays
const getAnimationDelays = () => {
  const profile = getDevicePerformanceProfile();
  const isHighStrain = isHighStrainDevice();

  if (isHighStrain) {
    // No delays for 4K RPi - immediate rendering
    return {
      background: 0,
      layout: 0,
      content: 0,
      alerts: 0,
    };
  } else if (profile.profile === "low") {
    // Reduced delays for low-power devices
    return {
      background: 50,
      layout: 100,
      content: 150,
      alerts: 200,
    };
  } else {
    // Standard delays for more powerful devices
    return {
      background: 100,
      layout: 200,
      content: 300,
      alerts: 400,
    };
  }
};

// Performance-aware constants
const ANIMATION_DELAYS = getAnimationDelays();
const DISPLAY_MOUNT_DURATION = isHighStrainDevice() ? 100 : 500; // Much faster for 4K
const ALERT_ANIMATION_DURATION = isHighStrainDevice() ? 200 : 600;
const FADE_DURATION = isHighStrainDevice() ? 200 : 400;

// Memoized DisplayScreen component
const DisplayScreen: React.FC = memo(() => {
  const dispatch = useDispatch<AppDispatch>();

  // Get performance profile
  const performanceProfile = useMemo(() => getDevicePerformanceProfile(), []);
  const isHighStrain = isHighStrainDevice();
  const shouldDisableAnimations =
    !performanceProfile.recommendations.enableAnimations;

  // Redux selectors
  const orientation = useSelector((state: RootState) => state.ui.orientation);
  const currentAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert
  );

  // Local state with performance optimizations
  const [isMounted, setIsMounted] = useState(isHighStrain); // Immediate for 4K
  const [isDisplayReady, setIsDisplayReady] = useState(isHighStrain); // Immediate for 4K
  const [isAlertTransitioning, setIsAlertTransitioning] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<
    "idle" | "dissolving" | "restoring"
  >("idle");

  // Progressive loading for 4K displays
  const [componentsLoaded, setComponentsLoaded] = useState({
    background: !isHighStrain, // Load immediately if not high strain
    layout: !isHighStrain,
    content: !isHighStrain,
  });

  // Refs
  const mountTimerRef = useRef<NodeJS.Timeout | null>(null);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Rotation handling
  const rotationInfo = useRotationHandling(orientation);

  // Update orientation in Redux when it changes
  useEffect(() => {
    if (rotationInfo.physicalOrientation !== orientation) {
      dispatch(setOrientation(rotationInfo.physicalOrientation));
    }
  }, [rotationInfo.physicalOrientation, orientation, dispatch]);

  // Progressive loading effect for 4K displays
  useEffect(() => {
    if (!isHighStrain) return;

    // Load components progressively with minimal delays for 4K displays
    const timeouts: NodeJS.Timeout[] = [];

    timeouts.push(
      setTimeout(
        () => setComponentsLoaded((prev) => ({ ...prev, background: true })),
        50
      )
    );
    timeouts.push(
      setTimeout(
        () => setComponentsLoaded((prev) => ({ ...prev, layout: true })),
        100
      )
    );
    timeouts.push(
      setTimeout(
        () => setComponentsLoaded((prev) => ({ ...prev, content: true })),
        150
      )
    );

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [isHighStrain]);

  // Performance-aware component animation function
  const getComponentAnimation = useCallback(
    (componentId: string) => {
      if (shouldDisableAnimations || isHighStrain) {
        // No animations for 4K displays - immediate visibility
        return {
          opacity: 1,
          transform: "scale(1)",
          transition: "none",
        };
      }

      const delay =
        ANIMATION_DELAYS[componentId as keyof typeof ANIMATION_DELAYS] || 0;
      const isVisible = isMounted && isDisplayReady && !isAlertTransitioning;
      const isRestoring = animationPhase === "restoring";

      let opacity = 1;
      let transform = "scale(1)";

      if (!isVisible && !isRestoring) {
        opacity = 0;
        transform = "scale(0.95)";
      } else if (isAlertTransitioning && animationPhase === "dissolving") {
        opacity = 0.3;
        transform = "scale(0.98)";
      }

      return {
        opacity,
        transform,
        transition: `opacity ${FADE_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform ${FADE_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
      };
    },
    [
      isMounted,
      isDisplayReady,
      isAlertTransitioning,
      animationPhase,
      shouldDisableAnimations,
      isHighStrain,
    ]
  );

  // Memoize animation context to prevent unnecessary re-renders
  const animationContextValue = useMemo(
    () => ({
      isAlertTransitioning,
      isDisplayReady,
      getComponentAnimation,
    }),
    [isAlertTransitioning, isDisplayReady, getComponentAnimation]
  );

  // Mount and display readiness effect (optimized for 4K)
  useEffect(() => {
    logger.info(
      "[DisplayScreen] Component mounted, starting readiness sequence"
    );

    if (isHighStrain) {
      // Immediate readiness for 4K displays
      setIsMounted(true);
      setIsDisplayReady(true);
      logger.info("[DisplayScreen] 4K Display - immediate readiness");
    } else {
      // Start mount animation for non-4K displays
      setIsMounted(true);

      // Mark display as ready after animation completes
      const readinessDelay =
        DISPLAY_MOUNT_DURATION +
        Math.max(...Object.values(ANIMATION_DELAYS)) +
        200;
      mountTimerRef.current = setTimeout(() => {
        logger.info("[DisplayScreen] Display ready - all animations complete");
        setIsDisplayReady(true);
      }, readinessDelay);
    }

    return () => {
      if (mountTimerRef.current) {
        clearTimeout(mountTimerRef.current);
      }
    };
  }, [isHighStrain]);

  // Alert animation effect (simplified for 4K)
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

        const maxDelay = isHighStrain
          ? 100
          : Math.max(...Object.values(ANIMATION_DELAYS));
        const restoreDelay = isHighStrain
          ? 150
          : maxDelay + ALERT_ANIMATION_DURATION + 50;

        setTimeout(() => {
          setIsAlertTransitioning(false);
          setAnimationPhase("idle");
        }, restoreDelay);
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
  }, [currentAlert, dispatch, isAlertTransitioning, isHighStrain]);

  // Keyboard shortcuts for testing
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;

      if (event.key === "1") {
        dispatch(
          createTestAlert({
            type: "RED",
            duration: 10,
          })
        );
      } else if (event.key === "2") {
        dispatch(
          createTestAlert({
            type: "AMBER",
            duration: 8,
          })
        );
      } else if (event.key === "3") {
        dispatch(
          createTestAlert({
            type: "BLUE",
            duration: 6,
          })
        );
      } else if (event.key === "c") {
        dispatch(clearCurrentAlert());
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [dispatch]);

  // Performance monitoring and content refresh - optimized for 4K
  useEffect(() => {
    const isLowPower = isLowPowerDevice();
    // Longer intervals for 4K displays to reduce load
    const intervalMs = isHighStrain ? 900000 : isLowPower ? 600000 : 300000; // 15min, 10min, or 5min

    const interval = setInterval(() => {
      logger.info("Periodic content refresh");
      dispatch(refreshAllContent({ forceRefresh: true }));
    }, intervalMs);

    return () => clearInterval(interval);
  }, [dispatch, isHighStrain]);

  // Memory management integration for 4K displays
  useEffect(() => {
    if (!isHighStrain) return;

    // Register cleanup callback for display screen
    const { MemoryManager } = require("../../utils/performanceUtils");
    const unregister = MemoryManager.registerCleanupCallback(() => {
      // Clear any cached DOM references
      const images = document.querySelectorAll('img[src^="blob:"]');
      images.forEach((img) => {
        const htmlImg = img as HTMLImageElement;
        if (htmlImg.src && htmlImg.src.startsWith("blob:")) {
          URL.revokeObjectURL(htmlImg.src);
        }
      });

      // Force garbage collection of React fiber nodes
      if (window.gc && typeof window.gc === "function") {
        setTimeout(() => window.gc!(), 100);
      }
    });

    return unregister;
  }, [isHighStrain]);

  // Memoize the display component
  const DisplayComponent = useMemo(() => {
    logger.info(`DisplayScreen: Rendering ${orientation} layout`);
    return orientation === "LANDSCAPE" ? (
      <ModernLandscapeDisplay />
    ) : (
      <ModernPortraitDisplay />
    );
  }, [orientation]);

  // Wait for content to be available (progressive loading for 4K)
  if (!componentsLoaded.background) {
    logger.info("[DisplayScreen] Waiting for background to be available");
    return (
      <Box
        sx={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "primary.main",
        }}
      >
        {/* Minimal loading indicator for 4K */}
        <Box
          sx={{
            color: "white",
            fontSize: isHighStrain ? "1rem" : "1.2rem",
            opacity: 0.7,
          }}
        >
          Loading display...
        </Box>
      </Box>
    );
  }

  return (
    <AnimationContext.Provider value={animationContextValue}>
      <Fade in={isMounted} timeout={FADE_DURATION}>
        <Box
          sx={{
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            position: "fixed",
            top: 0,
            left: 0,
            // 4K optimizations
            willChange: isHighStrain ? "auto" : "transform",
            transform: isHighStrain ? "none" : "translateZ(0)",
            backfaceVisibility: isHighStrain ? "visible" : "hidden",
          }}
        >
          {rotationInfo.shouldRotate && !isHighStrain ? (
            // Only apply rotation if not high strain (4K displays usually don't need rotation)
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
});

export default DisplayScreen;
