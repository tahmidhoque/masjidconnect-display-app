import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Fade } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrientationProvider } from './contexts/OrientationContext';
import { ContentProvider } from './contexts/ContentContext';
import { OfflineProvider } from './contexts/OfflineContext';
import DisplayScreen from './components/screens/DisplayScreen';
import PairingScreen from './components/screens/PairingScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import AuthErrorDetector from './components/common/AuthErrorDetector';
import OfflineNotification from './components/OfflineNotification';
import ApiErrorBoundary from './components/common/ApiErrorBoundary';
import CorsErrorNotification from './components/common/CorsErrorNotification';
import theme from './theme/theme';
import useAppInitialization from './hooks/useAppInitialization';

/**
 * AppContent Component
 * 
 * This component handles the main content display, including loading screens
 * and authentication state.
 */
const AppContent: React.FC = () => {
  const { isAuthenticated, isPaired, setIsPaired } = useAuth();
  const { isInitializing } = useAppInitialization();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [authChecked, setAuthChecked] = useState(false); // Track if we've already done the auth check
  
  // Emergency authentication check on mount - run only once
  useEffect(() => {
    // Skip if we've already run the check
    if (authChecked) return;
    
    console.log('[App] 🚀 Initial mount - one-time emergency auth check');
    
    // Check ALL credential formats
    const apiKey = localStorage.getItem('masjid_api_key') || localStorage.getItem('apiKey');
    const screenId = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
    
    console.log('[App] Emergency auth check found:', {
      hasApiKey: !!apiKey && apiKey.length > 10,
      hasScreenId: !!screenId && screenId.length > 5,
      isAuthenticated,
      isPaired
    });
    
    if (apiKey && screenId && (!isAuthenticated || !isPaired)) {
      console.log('[App] 🔥 EMERGENCY: Found credentials but not authenticated! Forcing auth...');
      setIsPaired(true);
    }
    
    // Mark that we've done the check
    setAuthChecked(true);
  }, [isAuthenticated, isPaired, authChecked, setIsPaired]);
  
  // Log auth state changes
  useEffect(() => {
    console.log('[App] Auth state changed:', { 
      isAuthenticated, 
      isPaired,
      localStorage: {
        masjid_api_key: !!localStorage.getItem('masjid_api_key'),
        masjid_screen_id: !!localStorage.getItem('masjid_screen_id'),
        apiKey: !!localStorage.getItem('apiKey'),
        screenId: !!localStorage.getItem('screenId')
      }
    });
  }, [isAuthenticated, isPaired]);
  
  // Start loading sequence
  useEffect(() => {
    if (isInitialLoad) {
      // Simulate loading time for a more natural app startup experience
      const timer = setTimeout(() => {
        handleLoadingComplete();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad]);
  
  // Handle when loading is complete
  const handleLoadingComplete = () => {
    setIsInitialLoad(false);
  };
  
  if (isInitialLoad || isInitializing) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }
  
  return (
    <Fade in={!isInitialLoad} timeout={800}>
      <div>
        {isAuthenticated && <AuthErrorDetector />}
        <Routes>
          <Route 
            path="*" 
            element={isAuthenticated ? <DisplayScreen /> : <PairingScreen />} 
          />
        </Routes>
      </div>
    </Fade>
  );
};

/**
 * App Component
 * 
 * Root component that sets up providers and theme.
 */
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <Router>
          <AuthProvider>
            <OrientationProvider>
              <OfflineProvider>
                <ContentProvider>
                  <ApiErrorBoundary>
                    <OfflineNotification position={{ vertical: 'bottom', horizontal: 'left' }} />
                    <CorsErrorNotification />
                    <AuthErrorDetector />
                    <AppContent />
                  </ApiErrorBoundary>
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