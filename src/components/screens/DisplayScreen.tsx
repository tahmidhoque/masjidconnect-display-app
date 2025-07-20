import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { Box, Fade } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { refreshAllContent } from "../../store/slices/contentSlice";
import { setOrientation } from "../../store/slices/uiSlice";
import useRotationHandling from "../../hooks/useRotationHandling";
import LandscapeDisplay from "../layouts/LandscapeDisplay";
import PortraitDisplay from "../layouts/PortraitDisplay";
import LoadingScreen from "./LoadingScreen";
import logger from "../../utils/logger";
import { isLowPowerDevice } from "../../utils/performanceUtils";

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

// Memoized landscape and portrait components
const MemoizedLandscapeDisplay = memo(LandscapeDisplay);
const MemoizedPortraitDisplay = memo(PortraitDisplay);

/**
 * DisplayScreen component
 *
 * The main display screen shown after successful authentication.
 * Shows prayer times, current content, and other information.
 * Adapts to the screen orientation (portrait/landscape) based on admin settings.
 */
const DisplayScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux selectors
  const isLoading = useSelector((state: RootState) => state.content.isLoading);
  const screenContent = useSelector(
    (state: RootState) => state.content.screenContent
  );
  const orientation = useSelector((state: RootState) => state.ui.orientation);

  // Custom content refresh function to replace useContentUpdates
  const forceRefresh = useCallback(() => {
    dispatch(refreshAllContent({ forceRefresh: true }));
  }, [dispatch]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousOrientationRef = useRef(orientation);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [visible, setVisible] = useState(false);

  // Update orientation from screen content when it changes
  const updateOrientationFromContent = useCallback(() => {
    if (!screenContent) return;

    // Check for orientation in both the new data structure and legacy location
    let newOrientation;

    if (screenContent?.data?.screen?.orientation) {
      newOrientation = screenContent.data.screen.orientation;
    } else if (screenContent?.screen?.orientation) {
      newOrientation = screenContent.screen.orientation;
    }

    // Only update if we found a valid orientation and it's different from current
    if (newOrientation && newOrientation !== orientation) {
      // Check if this update is from initial load vs SSE event
      const lastSseEvent = localStorage.getItem("last_orientation_sse_event");
      if (lastSseEvent) {
        const lastEventTime = parseInt(lastSseEvent, 10);
        const now = Date.now();

        // If we've received an SSE event in the last 10 seconds, don't override it with content data
        if (now - lastEventTime < 10000) {
          return;
        }
      }

      logger.info(
        `DisplayScreen: Updating orientation from content API: ${newOrientation}`
      );
      dispatch(setOrientation(newOrientation));
    }
  }, [screenContent, dispatch, orientation]);

  // Effect to update orientation when content changes
  useEffect(() => {
    updateOrientationFromContent();
  }, [updateOrientationFromContent]);

  // fade in when mounted
  useEffect(() => {
    setVisible(true);
  }, []);

  // Add an effect to force content refresh when the window gains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logger.info("Display became visible - refreshing content");
        forceRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [forceRefresh]);

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
  }, [forceRefresh]);

  // If content is still loading, show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Apply simpler transition styles for better performance
  const transitionStyle = isTransitioning ? { opacity: 0.95 } : { opacity: 1 };
  const contentTransitionStyle = {
    transition: "opacity 300ms ease",
    ...transitionStyle,
  };

  return (
    <Fade in={visible} timeout={800}>
      <Box sx={{ ...TRANSITION_STYLES.container }}>
        {shouldRotate ? (
          // Apply rotation transform for mismatched orientation
        <Box
          sx={{
            ...TRANSITION_STYLES.rotated,
            transform: `translate(-50%, -50%) rotate(90deg)`,
            ...contentTransitionStyle,
          }}
        >
          <Box sx={{ ...TRANSITION_STYLES.content }}>{DisplayComponent}</Box>
        </Box>
      ) : (
        // No rotation needed
        <Box sx={{ ...TRANSITION_STYLES.content, ...contentTransitionStyle }}>
          {DisplayComponent}
        </Box>
      )}
      </Box>
    </Fade>
  );
};

export default memo(DisplayScreen);
