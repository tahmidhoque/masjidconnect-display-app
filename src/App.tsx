import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, Fade } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrientationProvider } from './contexts/OrientationContext';
import { ContentProvider, useContent } from './contexts/ContentContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { EmergencyAlertProvider } from './contexts/EmergencyAlertContext';
import { UpdaterProvider } from './contexts/UpdaterContext';
import DisplayScreen from './components/screens/DisplayScreen';
import PairingScreen from './components/screens/PairingScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import AuthErrorDetector from './components/common/AuthErrorDetector';
import OfflineNotification from './components/OfflineNotification';
import UpdateNotification from './components/common/UpdateNotification';
import ApiErrorBoundary from './components/common/ApiErrorBoundary';
import EmergencyAlert from './components/common/EmergencyAlert';
import theme from './theme/theme';
import useAppInitialization from './hooks/useAppInitialization';
import useKioskMode from './hooks/useKioskMode';
import ErrorScreen from './components/screens/ErrorScreen';
import moment from 'moment';
import { fetchHijriDateElectronSafe, calculateApproximateHijriDate } from './utils/dateUtils';

// Create a simple AuthenticatedRoute component
interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/pair" replace />;
};

// Main App Routes component defined separately to access auth context
const AppRoutes: React.FC = () => {
  const { isInitializing } = useAppInitialization();
  const { refreshContent, refreshPrayerTimes, isLoading: contentLoading } = useContent();
  const [showContent, setShowContent] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const initializationAttemptedRef = useRef(false);
  
  // Initialize kiosk mode - this will handle refresh scheduling and focus events
  useKioskMode();
  
  // Function to initialize application data
  const initializeAppData = useCallback(async () => {
    if (initializationAttemptedRef.current) return;
    initializationAttemptedRef.current = true;
    
    try {
      console.log('Initializing app data...');
      // Load essential data first
      await refreshContent(true); // Force refresh to get latest data
      await refreshPrayerTimes(); // Get latest prayer times
      setDataLoaded(true);
      
      // Add a small delay after data loads before showing content
      setTimeout(() => {
        setShowContent(true);
      }, 800);
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Still set dataLoaded to true to avoid infinite loading
      setDataLoaded(true);
      setShowContent(true);
    }
  }, [refreshContent, refreshPrayerTimes]);
  
  // Add effect to load essential data when initializing completes
  useEffect(() => {
    if (!isInitializing && !dataLoaded) {
      initializeAppData();
    }
  }, [isInitializing, dataLoaded, initializeAppData]);
  
  // Use requestAnimationFrame for smoother fade-in
  useEffect(() => {
    if (showContent) {
      // Force reflow and repaint after content is shown for smoother animations
      requestAnimationFrame(() => {
        const element = document.documentElement;
        // Reading offsetHeight causes a reflow to happen at the optimal time
        // eslint-disable-next-line no-unused-vars
        const _ = element.offsetHeight;
      });
    }
  }, [showContent]);
  
  // Always render LoadingScreen, but it will fade out based on isInitializing state
  return (
    <>
      <LoadingScreen />
      
      {/* Main content with improved fade-in effect */}
      <Fade in={showContent} timeout={800}>
        <Box sx={{ 
          opacity: showContent ? 1 : 0,
          width: '100%', 
          height: '100%',
          position: 'relative',
          // Simple transform for transition
          transform: showContent ? 'none' : 'translateY(10px)',
          transition: 'transform 0.5s ease, opacity 0.8s ease',
        }}>
          <OfflineNotification position={{ vertical: 'bottom', horizontal: 'left' }} />
          <UpdateNotification position={{ vertical: 'bottom', horizontal: 'right' }} />
          <AuthErrorDetector />
          <EmergencyAlert />
          <Routes>
            <Route path="/" element={<AuthenticatedRoute><DisplayScreen /></AuthenticatedRoute>} />
            <Route path="/pair" element={<PairingScreen onPairingSuccess={initializeAppData} />} />
            <Route path="/loading" element={<LoadingScreen />} />
            <Route path="/error" element={<ErrorScreen />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </Box>
      </Fade>
    </>
  );
};

/**
 * App Component
 * 
 * Root component that sets up providers and theme.
 */
const App: React.FC = () => {
  // Fetch Hijri date early in the app lifecycle
  useEffect(() => {
    console.log('Pre-fetching Hijri date from App component...');
    
    // Clear any cached Hijri date to force fresh calculation
    localStorage.removeItem('hijriDate');
    localStorage.removeItem('hijriDateTimestamp');
    console.log('Cleared cached Hijri date for fresh calculation');
    
    // Use the current date with the correct year
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currentDate.getFullYear();
    const today = `${day}-${month}-${year}`;
    
    console.log(`Using current date: ${today}`);
    
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
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <Router>
          <AuthProvider>
            <OrientationProvider>
              <OfflineProvider>
                <ContentProvider>
                  <EmergencyAlertProvider>
                    <UpdaterProvider>
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
                          <AppRoutes />
                        </Box>
                      </ApiErrorBoundary>
                    </UpdaterProvider>
                  </EmergencyAlertProvider>
                </ContentProvider>
              </OfflineProvider>
            </OrientationProvider>
          </AuthProvider>
        </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App; 