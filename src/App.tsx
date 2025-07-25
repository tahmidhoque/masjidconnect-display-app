import React, { useEffect, Suspense, lazy } from "react";
import { Box, ThemeProvider, CssBaseline } from "@mui/material";

import theme from "./theme/theme";
import logger from "./utils/logger";
import ApiErrorBoundary from "./components/common/ApiErrorBoundary";
import GracefulErrorOverlay from "./components/common/GracefulErrorOverlay";
import EmergencyAlertOverlay from "./components/common/EmergencyAlertOverlay";
import useKioskMode from "./hooks/useKioskMode";
import useInitializationFlow from "./hooks/useInitializationFlow";
import { ComponentPreloader } from "./utils/performanceUtils";

// Store
import { useAppSelector } from "./store/hooks";

// Lazy load components for better performance
const LoadingScreen = lazy(() =>
  ComponentPreloader.preload(
    "LoadingScreen",
    () => import("./components/screens/LoadingScreen")
  )
);
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
const ErrorScreen = lazy(() =>
  ComponentPreloader.preload(
    "ErrorScreen",
    () => import("./components/screens/ErrorScreen")
  )
);

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
      const credentialValues = credentialKeys.reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {} as Record<string, string | null>);

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

const AppRoutes: React.FC = () => {
  useKioskMode();
  const { stage } = useInitializationFlow();
  const isInitializing = useAppSelector((state) => state.ui.isInitializing);

  // Show loading screen during initialization, but allow pairing screen to show
  if (
    stage === "checking" ||
    stage === "welcome" ||
    stage === "fetching" ||
    (isInitializing && stage !== "pairing")
  ) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <LoadingScreen />
      </Suspense>
    );
  }

  switch (stage) {
    case "pairing":
      return (
        <Suspense fallback={<div>Loading...</div>}>
          <PairingScreen />
        </Suspense>
      );
    case "ready":
      return (
        <Suspense fallback={<div>Loading...</div>}>
          <DisplayScreen />
        </Suspense>
      );
    default:
      return (
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorScreen message="Unknown initialization stage" />
        </Suspense>
      );
  }
};

const App: React.FC = () => {
  // Enable localStorage monitoring in development
  useLocalStorageMonitor();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ApiErrorBoundary>
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
          <AppRoutes />
          <GracefulErrorOverlay />
          <EmergencyAlertOverlay />
        </Box>
      </ApiErrorBoundary>
    </ThemeProvider>
  );
};

export default App;
