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
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>
);

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
          "Service worker controller changed - new version activated"
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
