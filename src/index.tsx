import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import "./index.css";
import "./theme/fonts.css";
import App from "./App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import reportWebVitals from "./reportWebVitals";
import { store, persistor } from "./store";
import { optimizeAppPerformance } from "./utils/performanceUtils";
import LoadingScreen from "./components/screens/LoadingScreen";
import logger from "./utils/logger";

// Import performance CSS
import "./styles/minimal-hardware-acceleration.css";

// Apply performance optimizations after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Small delay to ensure everything is loaded
  setTimeout(() => {
    optimizeAppPerformance();
  }, 100);
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

// CRITICAL FIX: Error boundary component for PersistGate failures
const PersistErrorFallback: React.FC<{
  error: Error;
  resetError: () => void;
}> = ({ error, resetError }) => {
  React.useEffect(() => {
    logger.error("[PersistGate] Redux persist failed to rehydrate", {
      error: error.message,
      stack: error.stack,
    });

    // Attempt to recover by purging corrupted state
    const attemptRecovery = async () => {
      try {
        logger.warn(
          "[PersistGate] Attempting to purge corrupted state and reload",
        );
        await persistor.purge();
        logger.info("[PersistGate] Corrupted state purged, reloading app");
        window.location.reload();
      } catch (recoveryError) {
        logger.error("[PersistGate] Recovery failed", { error: recoveryError });
        // If recovery fails, still try to continue
        resetError();
      }
    };

    // Auto-recover after a short delay
    const recoveryTimer = setTimeout(attemptRecovery, 2000);
    return () => clearTimeout(recoveryTimer);
  }, [error, resetError]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0A2647 0%, #144272 50%, #2A9D8F 100%)",
        color: "white",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <h1>Loading...</h1>
        <p>Recovering from storage error...</p>
      </div>
    </div>
  );
};

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate
        loading={null}
        persistor={persistor}
        onBeforeLift={() => {
          logger.info("[PersistGate] Redux state rehydrated successfully");
        }}
      >
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>,
);

// CRITICAL FIX: Global error handler for persist errors
window.addEventListener("error", (event) => {
  if (
    event.error?.message?.includes("persist") ||
    event.error?.message?.includes("localStorage")
  ) {
    logger.error("[GlobalError] Persist-related error detected", {
      error: event.error?.message,
      stack: event.error?.stack,
    });
  }
});

// CRITICAL FIX: Handle unhandled promise rejections from persist
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.message?.includes("persist") ||
    event.reason?.message?.includes("localStorage")
  ) {
    logger.error("[GlobalError] Persist-related promise rejection", {
      error: event.reason?.message,
      stack: event.reason?.stack,
    });
    // Prevent default browser error handling
    event.preventDefault();
  }
});

// Check if we are NOT running in Electron before registering the service worker
// Service workers don't work well with file:// protocol
// Assuming `window.electron` type is defined globally via preload script typings
if (typeof window.electron === "undefined") {
  // Register service worker for offline functionality only in browser environment
  serviceWorkerRegistration.register({
    onUpdate: (registration) => {
      // When an update is available, show some indicator to the user
      console.log("New version available! Ready to update.");

      // Notify the user that a new version is available
      // This is a display app with no user interaction, so we'll auto-update
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      // Instead of reloading the page, we'll activate the new service worker
      // and wait for the next app refresh cycle via our regular data refresh mechanism
      // This prevents disruptive page reloads
      console.log("New service worker will activate on next app cycle");
    },
    onSuccess: (registration) => {
      console.log("Service worker registered successfully");

      // Listen for controller change (SW activation)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log(
          "Service worker controller changed - new version activated",
        );
        // Don't reload the page here either
      });

      // Prefetch and cache critical assets on successful registration
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CACHE_CRITICAL_ASSETS",
        });
      }
    },
  });
} else {
  console.log("Running in Electron, skipping service worker registration.");
}

// Report web vitals
reportWebVitals();
