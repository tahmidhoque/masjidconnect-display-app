import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, CssBaseline, Fade } from '@mui/material';
import { BrowserRouter as Router } from 'react-router-dom';
import theme from './theme/theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrientationProvider } from './contexts/OrientationContext';
import { ContentProvider } from './contexts/ContentContext';
import LoadingScreen from './components/screens/LoadingScreen';
import PairingScreen from './components/screens/PairingScreen';
import DisplayScreen from './components/screens/DisplayScreen';
import useAppInitialization from './hooks/useAppInitialization';
import { SnackbarProvider } from 'notistack';
import AuthErrorDetector from './components/common/AuthErrorDetector';

/**
 * Main application container that wraps all providers and screens
 */
const AppContent: React.FC = () => {
  const { isAuthenticated, isPairing } = useAuth();
  const { isInitializing } = useAppInitialization();
  const [showMainScreen, setShowMainScreen] = useState<boolean>(false);
  
  // Use a ref to track if we've already transitioned to prevent loops
  const hasTransitionedRef = useRef<boolean>(false);

  // Log state changes for debugging
  useEffect(() => {
    console.log("App state:", { 
      isInitializing, 
      isAuthenticated, 
      isPairing,
      showMainScreen,
      hasTransitioned: hasTransitionedRef.current
    });
  }, [isInitializing, isAuthenticated, isPairing, showMainScreen]);

  // Handle completion of loading screen
  const handleLoadingComplete = () => {
    if (hasTransitionedRef.current) return;
    
    console.log("App: Loading complete, transitioning to main screen");
    hasTransitionedRef.current = true;
    setShowMainScreen(true);
  };

  // Force transition after a delay if initialization is complete but we're still showing loading
  useEffect(() => {
    if (!isInitializing && !showMainScreen && !hasTransitionedRef.current) {
      console.log("App: Initialization complete, forcing transition to main screen");
      const timer = setTimeout(() => {
        handleLoadingComplete();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isInitializing, showMainScreen]);

  // Determine which screen to show
  if (!showMainScreen) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  // Show the appropriate screen based on authentication state
  return (
    <Fade in={showMainScreen} timeout={800}>
      <div>
        {isAuthenticated && <AuthErrorDetector />}
        {isAuthenticated ? <DisplayScreen /> : <PairingScreen />}
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
    <Router>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3}>
          <AuthProvider>
            <OrientationProvider>
              <ContentProvider>
                <AppContent />
              </ContentProvider>
            </OrientationProvider>
          </AuthProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App; 