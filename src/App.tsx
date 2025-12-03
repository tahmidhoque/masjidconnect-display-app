import React, { useEffect, Suspense, lazy, useCallback, useMemo, useState, useRef } from "react";
import { Box, ThemeProvider, CssBaseline } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import theme from "./theme/theme";
import logger from "./utils/logger";
import ApiErrorBoundary from "./components/common/ApiErrorBoundary";
import GracefulErrorOverlay from "./components/common/GracefulErrorOverlay";
import EmergencyAlertOverlay from "./components/common/EmergencyAlertOverlay";
import AnalyticsErrorIntegration from "./components/common/AnalyticsErrorIntegration";
import UpdateNotification from "./components/common/UpdateNotification";
import RemoteCommandNotification from "./components/common/RemoteCommandNotification";
import FactoryResetModal from "./components/common/FactoryResetModal";
import EnhancedLoadingScreen from "./components/screens/EnhancedLoadingScreen";
import WiFiReconnectOverlay from "./components/common/WiFiReconnectOverlay";
import { selectShowReconnectOverlay, selectCurrentNetwork } from "./store/slices/wifiSlice";
import { OrientationProvider } from "./contexts/OrientationContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import "./utils/clearHijriCache";
import useKioskMode from "./hooks/useKioskMode";
import useAppLoader from "./hooks/useAppLoader";
import useFactoryReset from "./hooks/useFactoryReset";
import { setOffline } from "./store/slices/uiSlice";
import offlineStorage from "./services/offlineStorageService";
import {
  ComponentPreloader,
  initializeMemoryManagement,
  rpiMemoryManager,
  isHighStrainDevice,
} from "./utils/performanceUtils";
import { crashLogger } from "./utils/crashLogger";
import "./utils/crashReportViewer";
import { rpiGPUOptimizer } from "./utils/rpiGpuOptimizer";
import rpiConfig from "./utils/rpiConfig";

// Lazy load components for better performance
const PairingScreen = lazy(() =>
  ComponentPreloader.preload(
    "PairingScreen",
    () => import("./components/screens/PairingScreen")
  )
);
const DisplayScreen = lazy(() =>
  ComponentPreloader.preload(
    "DisplayScreen",
    () => import("./components/screens/DisplayScreen")
  )
);
const WiFiSetupScreen = lazy(() =>
  ComponentPreloader.preload(
    "WiFiSetupScreen",
    () => import("./components/screens/WiFiSetupScreen")
  )
);

// Transition timing constants - designed to prevent flashing
const TRANSITION_DURATION = 800; // ms for fade transitions (smooth feel)
const TRANSITION_DURATION_HIGH_STRAIN = 600; // Slightly faster for high strain devices but still smooth
const MIN_LOADING_DISPLAY = 4500; // Minimum time to show loading screen (4.5s for professional feel)
const MIN_LOADING_DISPLAY_HIGH_STRAIN = 3000; // Shorter for high strain devices (3s)
const POST_READY_DELAY = 500; // Extra delay after loader reports ready before transitioning
const TRANSITION_DEBOUNCE = 100; // Minimum time between transition state changes

// Development localStorage monitor for debugging credential issues
const useLocalStorageMonitor = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    // On app startup, dump all localStorage contents
    logger.info("[DevMonitor] 🚀 App startup - localStorage contents:");
    const allKeys = Object.keys(localStorage);
    const allContents: Record<string, string> = {};

    allKeys.forEach((key) => {
      allContents[key] = localStorage.getItem(key) || "";
    });

    logger.info("[DevMonitor] All localStorage keys:", allKeys);
    logger.info("[DevMonitor] All localStorage contents:", allContents);

    // Specifically check for credential-related keys
    const credentialKeys = [
      "masjid_api_key",
      "masjid_screen_id",
      "apiKey",
      "screenId",
      "masjidconnect_credentials",
      "isPaired",
      "persist:root",
    ];

    const credentialContents: Record<string, string | null> = {};
    credentialKeys.forEach((key) => {
      credentialContents[key] = localStorage.getItem(key);
    });

    logger.info(
      "[DevMonitor] Credential-related localStorage on startup:",
      credentialContents
    );

    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;
    const originalClear = localStorage.clear;

    // Monitor setItem calls
    localStorage.setItem = function (key: string, value: string) {
      if (credentialKeys.includes(key)) {
        logger.info(`[DevMonitor] 📝 localStorage.setItem("${key}")`, {
          valueLength: value.length,
          valuePreview:
            value.substring(0, 20) + (value.length > 20 ? "..." : ""),
          stack: new Error().stack?.split("\n").slice(1, 4).join("\n"),
        });
      }
      return originalSetItem.call(this, key, value);
    };

    // Monitor removeItem calls
    localStorage.removeItem = function (key: string) {
      if (credentialKeys.includes(key)) {
        logger.warn(`[DevMonitor] 🗑️ localStorage.removeItem("${key}")`, {
          hadValue: !!localStorage.getItem(key),
          stack: new Error().stack?.split("\n").slice(1, 4).join("\n"),
        });
      }
      return originalRemoveItem.call(this, key);
    };

    // Monitor clear calls
    localStorage.clear = function () {
      const credentialValues = credentialKeys.reduce(
        (acc, key) => {
          acc[key] = localStorage.getItem(key);
          return acc;
        },
        {} as Record<string, string | null>
      );

      const hasCredentials = Object.values(credentialValues).some(
        (v) => v !== null
      );

      if (hasCredentials) {
        logger.warn(
          "[DevMonitor] 🧹 localStorage.clear() called with credentials present!",
          {
            credentials: credentialValues,
            stack: new Error().stack?.split("\n").slice(1, 4).join("\n"),
          }
        );
      }

      return originalClear.call(this);
    };

    // Restore original methods on cleanup
    return () => {
      localStorage.setItem = originalSetItem;
      localStorage.removeItem = originalRemoveItem;
      localStorage.clear = originalClear;
    };
  }, []);
};

/**
 * Screen type for transition management
 */
type ScreenType = "loading" | "wifi-setup" | "pairing" | "display";

/**
 * AppRoutes - Simplified routing component with smooth transitions
 * 
 * Uses the unified useAppLoader hook for state management
 * and provides controlled transitions between screens to prevent flashing.
 */
const AppRoutes: React.FC = () => {
  useKioskMode();

  // Performance settings
  const isHighStrain = useMemo(() => isHighStrainDevice(), []);
  const minLoadingDisplay = isHighStrain ? MIN_LOADING_DISPLAY_HIGH_STRAIN : MIN_LOADING_DISPLAY;
  const transitionDuration = isHighStrain ? TRANSITION_DURATION_HIGH_STRAIN : TRANSITION_DURATION;
  const postReadyDelay = isHighStrain ? POST_READY_DELAY / 2 : POST_READY_DELAY;

  // Use the unified app loader for loading state
  const {
    phase,
    overallProgress,
    currentTask,
    tasks,
    needsWiFiSetup,
    needsPairing,
    hasPairingCode,
    error,
  } = useAppLoader();

  // Transition state management - prevents flashing by controlling when screens actually change
  const [activeScreen, setActiveScreen] = useState<ScreenType>("loading");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(true);
  const [loadingOverlayMounted, setLoadingOverlayMounted] = useState(true);
  const loadingStartTimeRef = useRef<number>(Date.now());
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTransitionTimeRef = useRef<number>(0);

  // Handle WiFi connection success
  const handleWiFiConnected = useCallback(() => {
    logger.info("[App] WiFi connected, continuing initialisation");
  }, []);

  // Handle loading screen transition completion
  const handleLoadingComplete = useCallback(() => {
    logger.info("[App] Loading screen transition completed");
  }, []);

  /**
   * Determine what screen should be shown based on app loader state
   */
  const targetScreen = useMemo((): ScreenType => {
    if (phase === "wifi-setup" || needsWiFiSetup) {
      return "wifi-setup";
    }
    if ((phase === "pairing" || needsPairing) && hasPairingCode) {
      return "pairing";
    }
    if (phase === "ready") {
      return "display";
    }
    return "loading";
  }, [phase, needsWiFiSetup, needsPairing, hasPairingCode]);

  /**
   * Map app loader phase to loading screen phase
   */
  const loadingPhase = useMemo(() => {
    switch (phase) {
      case "startup":
        return "initializing" as const;
      case "wifi-setup":
        return "initializing" as const;
      case "pairing":
        return "pairing" as const;
      case "loading":
        return "loading" as const;
      case "ready":
        return "displaying" as const;
      default:
        return "initializing" as const;
    }
  }, [phase]);

  /**
   * Clear all transition-related timeouts
   */
  const clearAllTimeouts = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (fadeOutTimeoutRef.current) {
      clearTimeout(fadeOutTimeoutRef.current);
      fadeOutTimeoutRef.current = null;
    }
  }, []);

  /**
   * Handle screen transitions with minimum display times
   * This prevents jarring flashes by ensuring:
   * 1. Loading screen shows for a minimum duration (4.5s standard, 3s RPi)
   * 2. Transitions fade smoothly using a single opacity transition
   * 3. Content only renders after loading screen starts fading
   * 4. Debounce rapid state changes to prevent flicker
   */
  useEffect(() => {
    // Don't transition if we're already transitioning
    if (isTransitioning) return;

    // Don't transition if target is the same as current
    if (targetScreen === activeScreen) return;

    // Debounce - prevent rapid transitions
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < TRANSITION_DEBOUNCE) {
      logger.debug("[App] Transition debounced", {
        timeSinceLastTransition: now - lastTransitionTimeRef.current,
      });
      return;
    }

    // Calculate time since loading started
    const elapsedTime = Date.now() - loadingStartTimeRef.current;
    
    // If transitioning away from loading, ensure minimum display time
    if (activeScreen === "loading" && targetScreen !== "loading") {
      // Calculate remaining time to meet minimum display requirement
      const remainingTime = Math.max(0, minLoadingDisplay - elapsedTime) + postReadyDelay;
      
      logger.info("[App] Preparing screen transition", {
        from: activeScreen,
        to: targetScreen,
        elapsedTime,
        remainingTime,
        minLoadingDisplay,
        postReadyDelay,
      });

      // Clear any existing timeouts
      clearAllTimeouts();

      // Schedule the transition to start after minimum time
      transitionTimeoutRef.current = setTimeout(() => {
        logger.info("[App] Starting screen transition", {
          from: activeScreen,
          to: targetScreen,
          timestamp: Date.now(),
        });
        
        // Mark as transitioning to prevent new transitions
        setIsTransitioning(true);
        lastTransitionTimeRef.current = Date.now();
        
        // Start fading out the loading screen
        setLoadingOverlayVisible(false);
        
        // After the fade completes, update the active screen and unmount overlay
        fadeOutTimeoutRef.current = setTimeout(() => {
          setActiveScreen(targetScreen);
          setLoadingOverlayMounted(false);
          setIsTransitioning(false);
          logger.info("[App] Screen transition complete", { 
            to: targetScreen,
            timestamp: Date.now(),
          });
        }, transitionDuration);
      }, remainingTime);
    } else {
      // For non-loading transitions (e.g., between wifi-setup and pairing)
      logger.info("[App] Direct screen transition", {
        from: activeScreen,
        to: targetScreen,
      });
      
      clearAllTimeouts();
      lastTransitionTimeRef.current = Date.now();
      setIsTransitioning(true);
      
      // Brief transition between non-loading screens
      transitionTimeoutRef.current = setTimeout(() => {
        setActiveScreen(targetScreen);
        setIsTransitioning(false);
        
        // If transitioning back to loading, reset everything
        if (targetScreen === "loading") {
          loadingStartTimeRef.current = Date.now();
          setLoadingOverlayMounted(true);
          setLoadingOverlayVisible(true);
        }
      }, transitionDuration / 2);
    }

    // Cleanup
    return () => {
      clearAllTimeouts();
    };
  }, [targetScreen, activeScreen, isTransitioning, minLoadingDisplay, transitionDuration, postReadyDelay, clearAllTimeouts]);

  // Log phase changes with timestamps for debugging
  useEffect(() => {
    logger.info("[App] Current app state:", {
      timestamp: Date.now(),
      phase,
      loadingPhase,
      overallProgress,
      currentTask,
      needsWiFiSetup,
      needsPairing,
      hasPairingCode,
      activeScreen,
      targetScreen,
      isTransitioning,
      loadingOverlayVisible,
      loadingOverlayMounted,
      elapsedSinceLoadingStart: Date.now() - loadingStartTimeRef.current,
    });
  }, [
    phase,
    loadingPhase,
    overallProgress,
    currentTask,
    needsWiFiSetup,
    needsPairing,
    hasPairingCode,
    activeScreen,
    targetScreen,
    isTransitioning,
    loadingOverlayVisible,
    loadingOverlayMounted,
  ]);

  /**
   * Cleanup all timeouts on unmount to prevent memory leaks
   * and avoid state updates after component unmounts
   */
  useEffect(() => {
    return () => {
      logger.info("[App] AppRoutes unmounting, cleaning up");
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  /**
   * Render the loading screen overlay
   * Uses separate mounted/visible states to ensure smooth fade-out:
   * - loadingOverlayMounted: Whether the component is in the DOM
   * - loadingOverlayVisible: Whether the component is visible (controls opacity)
   * 
   * Sequence: visible=false triggers fade, then mounted=false removes from DOM
   */
  const renderLoadingOverlay = () => {
    // Don't render if not mounted (component has been fully removed after fade)
    if (!loadingOverlayMounted) return null;

    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 1100, // Above other content to cover during transitions
          // Opacity controlled by loadingOverlayVisible state
          opacity: loadingOverlayVisible ? 1 : 0,
          // Smooth ease-out transition for professional feel
          transition: `opacity ${transitionDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          // Disable pointer events when fading out
          pointerEvents: loadingOverlayVisible ? "auto" : "none",
          // GPU acceleration for smooth animation
          willChange: isTransitioning ? "opacity" : "auto",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        }}
      >
        <EnhancedLoadingScreen
          currentPhase={loadingPhase}
          progress={overallProgress}
          statusMessage={currentTask}
          isTransitioning={false} // We handle transitions at this level now
          onTransitionComplete={handleLoadingComplete}
          tasks={tasks}
        />
      </Box>
    );
  };

  /**
   * Render the appropriate content screen
   * 
   * Content is only rendered when:
   * 1. We're transitioning away from loading (to preload behind the fading overlay)
   * 2. We've completed the transition to a non-loading screen
   * 
   * No Fade wrappers here - the loading overlay's opacity transition is the only
   * visual transition the user sees, preventing double-fade artifacts.
   */
  const renderContentScreen = () => {
    // Don't render content if we're on the loading screen and not yet transitioning
    // This prevents content from appearing before the loading overlay starts fading
    if (activeScreen === "loading" && !isTransitioning) {
      return null;
    }

    // Determine which screen to render:
    // - During transition: render the target screen (behind the fading overlay)
    // - After transition: render the active screen
    const screenToRender = isTransitioning ? targetScreen : activeScreen;

    // Don't render loading screen as content (it's handled by the overlay)
    if (screenToRender === "loading") {
      return null;
    }

    // Render content without additional Fade wrappers to prevent double-fading
    // The loading overlay handles the fade-out; content just appears behind it
    const renderScreen = () => {
      switch (screenToRender) {
        case "wifi-setup":
          return (
            <Suspense fallback={null}>
              <WiFiSetupScreen onConnected={handleWiFiConnected} />
            </Suspense>
          );

        case "pairing":
          return (
            <Suspense fallback={null}>
              <PairingScreen />
            </Suspense>
          );

        case "display":
          return (
            <Suspense fallback={null}>
              <DisplayScreen />
            </Suspense>
          );

        default:
          return null;
      }
    };

    return (
      <Box 
        sx={{ 
          width: "100%", 
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {renderScreen()}
      </Box>
    );
  };

  return (
    <>
      {/* Content screen - rendered behind loading overlay */}
      {renderContentScreen()}
      
      {/* Loading screen overlay - fades out when transitioning */}
      {renderLoadingOverlay()}
    </>
  );
};

/**
 * App - Main application component
 */
const App: React.FC = () => {
  // Enable localStorage monitoring in development
  useLocalStorageMonitor();

  // Initialise factory reset functionality
  const { isModalOpen, closeModal, confirmReset, isResetting } =
    useFactoryReset();

  // WiFi reconnect overlay state
  const showReconnectOverlay = useSelector(selectShowReconnectOverlay);
  const currentNetwork = useSelector(selectCurrentNetwork);

  // Setup network status listener and offline storage cleanup
  const dispatch = useDispatch();
  useEffect(() => {
    // Initialise offline storage cleanup on startup
    offlineStorage.clearExpiredContent().catch((error) => {
      logger.error("[App] Error clearing expired cache on startup", { error });
    });

    // Setup network status listeners
    const handleOnline = () => {
      dispatch(setOffline(false));
      logger.info("[App] Network connection restored");
    };

    const handleOffline = () => {
      dispatch(setOffline(true));
      logger.warn("[App] Network connection lost");
    };

    // Set initial offline state
    dispatch(setOffline(!navigator.onLine));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [dispatch]);

  // Initialise memory management for stability on Raspberry Pi (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Apply performance CSS for RPi
    if (rpiConfig.isRaspberryPi()) {
      rpiConfig.applyPerformanceCSS();
      logger.info(
        "✅ RPi performance mode activated - animations and effects disabled"
      );
    }

    // Initialise memory management only if not disabled
    if (!config.disableMemoryManager) {
      initializeMemoryManagement();
      logger.info("Memory management initialised");
    } else {
      logger.info("⚠️ Memory management disabled by RPi config");
    }
  }, []);

  // Initialise crash logging for debugging restarts
  useEffect(() => {
    crashLogger.initialize();
    logger.info("Application started with crash logging enabled");
  }, []);

  // Initialise RPi GPU optimisations (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Only initialise GPU optimiser if not disabled
    if (!config.disableGPUOptimizer) {
      rpiGPUOptimizer.initialize();
      return () => {
        rpiGPUOptimizer.cleanup();
      };
    } else {
      logger.info("⚠️ GPU optimiser disabled by RPi config");
    }
  }, []);

  // Memory monitoring for RPi devices (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Start memory monitoring for RPi devices (only if not disabled)
    if (process.env.NODE_ENV === "production" && !config.disableMemoryManager) {
      rpiMemoryManager.startMonitoring();
    }

    // Cleanup function to prevent memory leaks
    return () => {
      // Stop memory monitoring
      if (!config.disableMemoryManager) {
        rpiMemoryManager.stopMonitoring();
      }

      // Clear any remaining timeouts/intervals
      if (window.gc) {
        window.gc(); // Force garbage collection if available
      }
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ApiErrorBoundary>
        <OrientationProvider>
          <NotificationProvider>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                position: "fixed",
                width: "100vw",
                height: "100vh",
                top: 0,
                left: 0,
                overflow: "hidden",
                // Use the same gradient as ModernIslamicBackground to prevent flashing
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.secondary.main} 100%)`,
                // Optimise for performance
                willChange: "auto",
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
              }}
            >
              <AppRoutes />
              <GracefulErrorOverlay />
              <EmergencyAlertOverlay />
              <AnalyticsErrorIntegration />
              <UpdateNotification />
              <RemoteCommandNotification />

              {/* WiFi Reconnect Overlay - shown when connection drops after pairing */}
              {showReconnectOverlay && (
                <WiFiReconnectOverlay
                  lastNetwork={currentNetwork?.ssid || null}
                  onReconnected={() => {
                    logger.info("[App] WiFi reconnected via overlay");
                  }}
                />
              )}

              {/* Factory Reset Modal */}
              <FactoryResetModal
                open={isModalOpen}
                onConfirm={confirmReset}
                onCancel={closeModal}
                isResetting={isResetting}
              />
            </Box>
          </NotificationProvider>
        </OrientationProvider>
      </ApiErrorBoundary>
    </ThemeProvider>
  );
};

export default App;
