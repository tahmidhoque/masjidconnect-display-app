import React, { useEffect, Suspense, lazy, useCallback } from "react";
import { Box, ThemeProvider, CssBaseline } from "@mui/material";
import { useDispatch } from "react-redux";

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
import { OrientationProvider } from "./contexts/OrientationContext";
import { NotificationProvider } from "./contexts/NotificationContext";
// Clear cached Hijri data to ensure accurate calculation
import "./utils/clearHijriCache";
// ✅ DISABLED: Demo imports that were causing console spam in development
// import "./utils/verifyHijriCalculation";
// import "./utils/factoryResetDemo";
// import "./utils/countdownTest";
import useKioskMode from "./hooks/useKioskMode";
import useInitializationFlow from "./hooks/useInitializationFlow";
import useFactoryReset from "./hooks/useFactoryReset";
import useLoadingStateManager, {
  type AppPhase,
} from "./hooks/useLoadingStateManager";
import { setOffline, setInitializing } from "./store/slices/uiSlice";
import offlineStorage from "./services/offlineStorageService";
import {
  ComponentPreloader,
  initializeMemoryManagement,
  rpiMemoryManager,
} from "./utils/performanceUtils";
import { crashLogger } from "./utils/crashLogger";
import "./utils/crashReportViewer";
import { rpiGPUOptimizer } from "./utils/rpiGpuOptimizer";
import rpiConfig from "./utils/rpiConfig";

// Lazy load components for better performance
const PairingScreen = lazy(() =>
  ComponentPreloader.preload(
    "PairingScreen",
    () => import("./components/screens/PairingScreen"),
  ),
);
const DisplayScreen = lazy(() =>
  ComponentPreloader.preload(
    "DisplayScreen",
    () => import("./components/screens/DisplayScreen"),
  ),
);
// ErrorScreen is loaded dynamically when needed
// const ErrorScreen = lazy(() =>
//   ComponentPreloader.preload('ErrorScreen', () => import('./components/screens/ErrorScreen'))
// );

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
      credentialContents,
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
        {} as Record<string, string | null>,
      );

      const hasCredentials = Object.values(credentialValues).some(
        (v) => v !== null,
      );

      if (hasCredentials) {
        logger.warn(
          "[DevMonitor] 🧹 localStorage.clear() called with credentials present!",
          {
            credentials: credentialValues,
            stack: new Error().stack?.split("\n").slice(1, 4).join("\n"),
          },
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

const AppRoutes: React.FC = () => {
  useKioskMode();

  // Initialize the app flow (but don't use its stage directly)
  useInitializationFlow();

  // Use the new unified loading state manager
  const {
    currentPhase,
    shouldShowLoadingScreen,
    shouldShowDisplay,
    isTransitioning,
    progress,
    statusMessage,
  } = useLoadingStateManager({
    minimumLoadingDuration:
      process.env.NODE_ENV === "development" ? 1500 : 2500, // Shorter in dev
    contentReadyDelay: process.env.NODE_ENV === "development" ? 600 : 1000, // Faster in dev
    transitionDuration: 600, // Smooth transition timing
  });

  // Handle loading screen transition completion
  const handleLoadingComplete = useCallback(() => {
    logger.info("[App] Loading screen transition completed");
  }, []);

  // CRITICAL FIX: Validate currentPhase to prevent undefined/invalid states
  const validPhases: AppPhase[] = [
    "initializing",
    "checking",
    "pairing",
    "loading-content",
    "preparing",
    "ready",
    "displaying",
  ];
  const safePhase: AppPhase = validPhases.includes(currentPhase)
    ? currentPhase
    : "initializing";

  logger.info("[App] Current app state:", {
    currentPhase: safePhase,
    originalPhase: currentPhase,
    shouldShowLoadingScreen,
    shouldShowDisplay,
    isTransitioning,
    progress,
  });

  // CRITICAL FIX: Always show loading screen for these phases to prevent gaps
  const shouldForceLoadingScreen =
    safePhase === "initializing" ||
    safePhase === "checking" ||
    safePhase === "loading-content" ||
    safePhase === "preparing" ||
    safePhase === "ready";

  // CRITICAL FIX: Ensure we always render something - never return null
  // Show enhanced loading screen when needed
  if (shouldShowLoadingScreen || shouldForceLoadingScreen) {
    return (
      <EnhancedLoadingScreen
        currentPhase={safePhase}
        progress={progress}
        statusMessage={statusMessage || "Loading..."}
        isTransitioning={isTransitioning}
        onTransitionComplete={handleLoadingComplete}
      />
    );
  }

  // Show appropriate screen based on phase - be more specific about when to show each
  if (safePhase === "pairing") {
    return (
      <Suspense
        fallback={
          <EnhancedLoadingScreen
            currentPhase="checking"
            progress={25}
            statusMessage="Loading pairing..."
            isTransitioning={false}
          />
        }
      >
        <PairingScreen />
      </Suspense>
    );
  }

  if (safePhase === "displaying" && shouldShowDisplay) {
    return (
      <Suspense
        fallback={
          <EnhancedLoadingScreen
            currentPhase="preparing"
            progress={85}
            statusMessage="Loading display..."
            isTransitioning={false}
          />
        }
      >
        <DisplayScreen />
      </Suspense>
    );
  }

  // CRITICAL FIX: Enhanced fallback with logging - ensure something always renders
  logger.warn(
    `[App] ⚠️ Unexpected state detected, showing loading screen as fallback`,
    {
      currentPhase: safePhase,
      originalPhase: currentPhase,
      shouldShowLoadingScreen,
      shouldShowDisplay,
      isTransitioning,
      progress,
    },
  );
  return (
    <EnhancedLoadingScreen
      currentPhase={safePhase}
      progress={progress || 0}
      statusMessage={statusMessage || "Loading..."}
      isTransitioning={isTransitioning}
      onTransitionComplete={handleLoadingComplete}
    />
  );
};

const App: React.FC = () => {
  // Enable localStorage monitoring in development
  useLocalStorageMonitor();

  // Initialize factory reset functionality
  const { isModalOpen, closeModal, confirmReset, isResetting } =
    useFactoryReset();

  // Setup network status listener and offline storage cleanup
  const dispatch = useDispatch();
  useEffect(() => {
    // Initialize offline storage cleanup on startup
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

  // ADDED: Initialize memory management for stability on Raspberry Pi (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Apply performance CSS for RPi
    if (rpiConfig.isRaspberryPi()) {
      rpiConfig.applyPerformanceCSS();
      logger.info(
        "✅ RPi performance mode activated - animations and effects disabled",
      );
    }

    // Initialize memory management only if not disabled
    if (!config.disableMemoryManager) {
      initializeMemoryManagement();
      logger.info("Memory management initialized");
    } else {
      logger.info("⚠️ Memory management disabled by RPi config");
    }
  }, []);

  // Initialize crash logging for debugging restarts
  useEffect(() => {
    crashLogger.initialize();
    logger.info("Application started with crash logging enabled");
  }, []);

  // Initialize RPi GPU optimizations (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Only initialize GPU optimizer if not disabled
    if (!config.disableGPUOptimizer) {
      rpiGPUOptimizer.initialize();
      return () => {
        rpiGPUOptimizer.cleanup();
      };
    } else {
      logger.info("⚠️ GPU optimizer disabled by RPi config");
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

  // CRITICAL FIX: Startup health check to detect and recover from stuck states
  useEffect(() => {
    const HEALTH_CHECK_DELAY = 3000; // 3 seconds
    const STUCK_PHASE_TIMEOUT = 15000; // 15 seconds max for initialization

    const healthCheckTimer = setTimeout(() => {
      // Import store dynamically to avoid circular dependencies
      import("./store").then(({ store }) => {
        const state = store.getState();
        const isInitializing = state.ui?.isInitializing ?? false;
        const initializationStage = state.ui?.initializationStage ?? "unknown";

        logger.info("[App] Startup health check", {
          isInitializing,
          initializationStage,
          timestamp: Date.now(),
        });

        // If still initializing after 3 seconds, log diagnostic info
        if (isInitializing && initializationStage === "checking") {
          logger.warn(
            "[App] ⚠️ Still in checking phase after 3 seconds - may be stuck",
            {
              isInitializing,
              initializationStage,
              authState: {
                isAuthenticated: state.auth?.isAuthenticated ?? false,
                isPairing: state.auth?.isPairing ?? false,
                hasPairingCode: !!state.auth?.pairingCode,
              },
              contentState: {
                isLoading: state.content?.isLoading ?? false,
                hasScreenContent: !!state.content?.screenContent,
                hasPrayerTimes: !!state.content?.prayerTimes,
              },
            },
          );
        }
      });
    }, HEALTH_CHECK_DELAY);

    // Set up a failsafe timeout to force recovery if stuck
    const failsafeTimer = setTimeout(() => {
      import("./store").then(({ store }) => {
        const state = store.getState();
        const isInitializing = state.ui?.isInitializing ?? false;

        if (isInitializing) {
          logger.error(
            "[App] 🚨 FAILSAFE: App stuck in initialization after 15 seconds - forcing recovery",
            {
              isInitializing,
              initializationStage: state.ui?.initializationStage ?? "unknown",
            },
          );

          // Force initialization to complete by dispatching actions
          // This will trigger the initialization flow to proceed
          store.dispatch(setInitializing(false));
        }
      });
    }, STUCK_PHASE_TIMEOUT);

    return () => {
      clearTimeout(healthCheckTimer);
      clearTimeout(failsafeTimer);
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
                // Optimize for performance
                willChange: "auto",
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
              }}
            >
              <Suspense
                fallback={
                  <EnhancedLoadingScreen
                    currentPhase="checking"
                    progress={0}
                    statusMessage="Loading..."
                    isTransitioning={false}
                  />
                }
              >
                <AppRoutes />
              </Suspense>
              <GracefulErrorOverlay />
              <EmergencyAlertOverlay />
              <AnalyticsErrorIntegration />
              <UpdateNotification />
              <RemoteCommandNotification />

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
