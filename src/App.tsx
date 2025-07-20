import React, {
  useEffect,
  Suspense,
  lazy,
  memo,
} from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, Box } from "@mui/material";
import { SnackbarProvider } from "notistack";
import LoadingScreen from "./components/screens/LoadingScreen";
import AuthErrorDetector from "./components/common/AuthErrorDetector";
import UpdateNotification from "./components/common/UpdateNotification";
import ApiErrorBoundary from "./components/common/ApiErrorBoundary";
import EmergencyAlert from "./components/common/EmergencyAlert";
import GracefulErrorOverlay from "./components/common/GracefulErrorOverlay";
import theme from "./theme/theme";
import useKioskMode from "./hooks/useKioskMode";
import ErrorScreen from "./components/screens/ErrorScreen";
import useInitializationFlow from "./hooks/useInitializationFlow";
import {
  fetchHijriDateElectronSafe,
  calculateApproximateHijriDate,
} from "./utils/dateUtils";
import storageService from "./services/storageService";
import networkStatusService from "./services/networkStatusService";

// Redux imports
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./store";
import { store } from "./store";
import { initializeFromStorage } from "./store/slices/authSlice";

// Verify database health early in the app lifecycle
try {
  storageService.verifyDatabaseHealth().catch((err) => {
    console.error("Failed to verify database health:", err);
  });
} catch (error) {
  console.error("Error starting database health check:", error);
}

// Lazy load screen components
const DisplayScreen = lazy(() => import("./components/screens/DisplayScreen"));
const PairingScreen = lazy(() => import("./components/screens/PairingScreen"));

// Create a simple AuthenticatedRoute component
interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({
  children,
}) => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  return isAuthenticated ? <>{children}</> : <Navigate to="/pair" replace />;
};

// Main App Routes component defined separately to access auth state

const AppRoutes: React.FC = () => {
  useKioskMode();
  const { stage } = useInitializationFlow();

  if (stage === "checking" || stage === "welcome" || stage === "fetching") {
    return <LoadingScreen />;
  }

  if (stage === "pairing") {
    return <PairingScreen />;
  }

  return <DisplayScreen />;
};
// Memoize the AppRoutes component to prevent unnecessary re-renders
const MemoizedAppRoutes = memo(AppRoutes);

/**
 * App Component
 *
 * Root component that sets up theme and routing.
 * Redux Provider is configured in index.tsx.
 */
const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Initialize auth from storage and network monitoring on app start
  useEffect(() => {
    dispatch(initializeFromStorage());

    // Initialize network status service
    networkStatusService.initialize();

    // Subscribe to network status updates
    const unsubscribe = networkStatusService.subscribe((status) => {
      // Update Redux state when network status changes
      dispatch({
        type: "errors/updateNetworkStatus",
        payload: status,
      });
    });

    return () => {
      unsubscribe();
      networkStatusService.destroy();
    };
  }, [dispatch]);

  // Fetch Hijri date early in the app lifecycle, but limit the frequency
  useEffect(() => {
    console.log("Pre-fetching Hijri date from App component...");

    // Check if we already have a recent Hijri date (less than 12 hours old)
    const hijriDateTimestamp = localStorage.getItem("hijriDateTimestamp");
    const now = Date.now();
    const twelveHoursMs = 12 * 60 * 60 * 1000;

    if (
      hijriDateTimestamp &&
      now - parseInt(hijriDateTimestamp, 10) < twelveHoursMs
    ) {
      console.log("Using cached Hijri date (less than 12 hours old)");
      return;
    }

    // Clear any cached Hijri date to force fresh calculation
    localStorage.removeItem("hijriDate");
    localStorage.removeItem("hijriDateTimestamp");

    // Use the current date with the correct year
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, "0");
    const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
    const year = currentDate.getFullYear();
    const today = `${day}-${month}-${year}`;

    // Use a timeout to defer this non-critical operation
    setTimeout(() => {
      // Use our utility function to get the Hijri date
      fetchHijriDateElectronSafe(today)
        .then((hijriDate) => {
          console.log("Successfully pre-fetched Hijri date:", hijriDate);
          localStorage.setItem("hijriDate", hijriDate);
          localStorage.setItem("hijriDateTimestamp", Date.now().toString());
        })
        .catch((error) => {
          console.error("Error pre-fetching Hijri date:", error);
          // Fall back to calculation method
          try {
            const approximateDate = calculateApproximateHijriDate();
            console.log(
              "Using approximate Hijri date calculation:",
              approximateDate
            );
            localStorage.setItem("hijriDate", approximateDate);
            localStorage.setItem("hijriDateTimestamp", Date.now().toString());
          } catch (calcError) {
            console.error("Failed to calculate approximate date:", calcError);
          }
        });
    }, 2000); // Defer by 2 seconds to prioritize UI rendering
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <Router>
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
                overflow: "visible", // Changed from hidden to visible
                bgcolor: "background.default",
              }}
            >
              <MemoizedAppRoutes />
            </Box>
          </ApiErrorBoundary>
        </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;
