import React, { useState, useEffect, useRef, useCallback, Suspense, lazy, memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import LoadingScreen from './components/screens/LoadingScreen';
import AuthErrorDetector from './components/common/AuthErrorDetector';
import OfflineNotification from './components/OfflineNotification';
import UpdateNotification from './components/common/UpdateNotification';
import ApiErrorBoundary from './components/common/ApiErrorBoundary';
import EmergencyAlert from './components/common/EmergencyAlert';
import theme from './theme/theme';
// Removed useAppInitialization hook as we're managing initialization directly with Redux
import useKioskMode from './hooks/useKioskMode';
import ErrorScreen from './components/screens/ErrorScreen';
import { fetchHijriDateElectronSafe, calculateApproximateHijriDate } from './utils/dateUtils';
import storageService from './services/storageService';

// Redux imports
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';
import { refreshContent, refreshPrayerTimes, refreshSchedule, refreshAllContent } from './store/slices/contentSlice';
import { initializeFromStorage } from './store/slices/authSlice';
import { setDataLoaded, setShowContent, setLoadingMessage, setInitializing } from './store/slices/uiSlice';

// Verify database health early in the app lifecycle
try {
  storageService.verifyDatabaseHealth().catch(err => {
    console.error('Failed to verify database health:', err);
  });
} catch (error) {
  console.error('Error starting database health check:', error);
}

// Lazy load screen components
const DisplayScreen = lazy(() => import('./components/screens/DisplayScreen'));
const PairingScreen = lazy(() => import('./components/screens/PairingScreen'));

// Create a simple AuthenticatedRoute component
interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/pair" replace />;
};

// Main App Routes component defined separately to access auth state
const AppRoutes: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Redux selectors
  const { isInitializing } = useSelector((state: RootState) => state.ui);
  const { isLoading: contentLoading } = useSelector((state: RootState) => state.content);
  const { showContent, dataLoaded } = useSelector((state: RootState) => state.ui);
  
  const [localShowContent, setLocalShowContent] = useState(false);
  const [localDataLoaded, setLocalDataLoaded] = useState(false);
  const initializationAttemptedRef = useRef(false);
  
  // Initialize kiosk mode - this will handle refresh scheduling and focus events
  useKioskMode();
  
  // Function to initialize application data
  const initializeAppData = useCallback(async () => {
    if (initializationAttemptedRef.current) return;
    initializationAttemptedRef.current = true;
    
    try {
      console.log('Initializing app data...');
      dispatch(setLoadingMessage('Verifying database...'));
      
      // First verify database health
      await storageService.verifyDatabaseHealth();
      
      dispatch(setLoadingMessage('Loading content...'));
      
      // Then load essential data using dispatch but without unwrap for now
      dispatch(setLoadingMessage('Loading content...'));
      dispatch(refreshContent({ forceRefresh: false }));
      
      dispatch(setLoadingMessage('Loading prayer times...'));
      dispatch(refreshPrayerTimes());
      
      // Specific fetch of schedule
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        dispatch(setLoadingMessage('Loading schedule...'));
        // Try to refresh the schedule, but don't block on it
        dispatch(refreshSchedule({ forceRefresh: false }));
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give some time for data to load
      } catch (scheduleError) {
        console.error('Error refreshing schedule:', scheduleError);
      }
      
      // Update both local and Redux state
      setLocalDataLoaded(true);
      dispatch(setDataLoaded(true));
      
      // Show content immediately without delay for better performance
      setLocalShowContent(true);
      dispatch(setShowContent(true));
      dispatch(setLoadingMessage('Ready'));
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Still set dataLoaded to true to avoid infinite loading
      setLocalDataLoaded(true);
      dispatch(setDataLoaded(true));
      setLocalShowContent(true);
      dispatch(setShowContent(true));
      dispatch(setLoadingMessage('Ready (with errors)'));
    }
  }, [dispatch]);
  
  // Add effect to load essential data when initializing completes
  useEffect(() => {
    if (!isInitializing && !localDataLoaded) {
      initializeAppData();
    }
  }, [isInitializing, localDataLoaded, initializeAppData]);
  
  // Always render LoadingScreen, but it will fade out based on isInitializing state
  return (
    <>
      <LoadingScreen />
      
      {/* Main content with simpler transitions */}
        <Box sx={{ 
          opacity: localShowContent ? 1 : 0,
          width: '100%', 
          height: '100%',
          position: 'relative',
        // Simpler transition for performance
        transition: 'opacity 0.3s ease',
        }}>
          <OfflineNotification position={{ vertical: 'bottom', horizontal: 'left' }} />
          <UpdateNotification position={{ vertical: 'bottom', horizontal: 'right' }} />
          <AuthErrorDetector />
          <EmergencyAlert />
          {/* Wrap Routes in Suspense for lazy loading */}
          <Suspense fallback={<LoadingScreen isSuspenseFallback={true} />}>
            <Routes>
              <Route path="/" element={<AuthenticatedRoute><DisplayScreen /></AuthenticatedRoute>} />
              <Route path="/pair" element={<PairingScreen onPairingSuccess={initializeAppData} />} />
              <Route path="/loading" element={<LoadingScreen />} />
              <Route path="/error" element={<ErrorScreen />} />
              <Route path="*" element={<Navigate replace to="/" />} />
            </Routes>
          </Suspense>
        </Box>
    </>
  );
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
  
  // Initialize auth from storage on app start
  useEffect(() => {
    dispatch(initializeFromStorage());
  }, [dispatch]);
  
  // Fetch Hijri date early in the app lifecycle, but limit the frequency
  useEffect(() => {
    console.log('Pre-fetching Hijri date from App component...');
    
    // Check if we already have a recent Hijri date (less than 12 hours old)
    const hijriDateTimestamp = localStorage.getItem('hijriDateTimestamp');
    const now = Date.now();
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    
    if (hijriDateTimestamp && (now - parseInt(hijriDateTimestamp, 10)) < twelveHoursMs) {
      console.log('Using cached Hijri date (less than 12 hours old)');
      return;
    }
    
    // Clear any cached Hijri date to force fresh calculation
    localStorage.removeItem('hijriDate');
    localStorage.removeItem('hijriDateTimestamp');
    
    // Use the current date with the correct year
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear();
    const today = `${day}-${month}-${year}`;
    
    // Use a timeout to defer this non-critical operation
    setTimeout(() => {
    // Use our utility function to get the Hijri date
    fetchHijriDateElectronSafe(today)
      .then(hijriDate => {
        console.log('Successfully pre-fetched Hijri date:', hijriDate);
        localStorage.setItem('hijriDate', hijriDate);
        localStorage.setItem('hijriDateTimestamp', Date.now().toString());
      })
      .catch(error => {
        console.error('Error pre-fetching Hijri date:', error);
        // Fall back to calculation method
        try {
          const approximateDate = calculateApproximateHijriDate();
          console.log('Using approximate Hijri date calculation:', approximateDate);
          localStorage.setItem('hijriDate', approximateDate);
          localStorage.setItem('hijriDateTimestamp', Date.now().toString());
        } catch (calcError) {
          console.error('Failed to calculate approximate date:', calcError);
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
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                width: '100vw',
                height: '100vh',
                top: 0,
                left: 0,
                overflow: 'hidden',
                bgcolor: 'background.default',
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