import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, CssBaseline, Fade } from '@mui/material';
import { BrowserRouter as Router } from 'react-router-dom';
import theme from './theme/theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrientationProvider, useOrientation } from './contexts/OrientationContext';
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
  const { isAuthenticated, isPairing, screenId } = useAuth();
  const { isInitializing, loadingMessage } = useAppInitialization();
  const { orientation } = useOrientation();
  const [showMainScreen, setShowMainScreen] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  // Use a ref to track if we've already transitioned to prevent loops
  const hasTransitionedRef = useRef<boolean>(false);
  const initialLoadTimeRef = useRef<number>(Date.now());

  // Log state changes for debugging
  useEffect(() => {
    console.log("App state:", { 
      isInitializing, 
      isAuthenticated, 
      isPairing,
      showMainScreen,
      isTransitioning,
      hasTransitioned: hasTransitionedRef.current,
      loadingMessage,
      screenId,
      orientation
    });
  }, [isInitializing, isAuthenticated, isPairing, showMainScreen, isTransitioning, loadingMessage, screenId, orientation]);

  // Handle completion of loading screen
  const handleLoadingComplete = () => {
    if (hasTransitionedRef.current || isTransitioning) return;
    
    console.log("App: Loading complete, starting transition to main screen, current orientation:", orientation);
    hasTransitionedRef.current = true;
    setIsTransitioning(true);
    
    // Calculate how long we've been loading
    const loadTime = Date.now() - initialLoadTimeRef.current;
    
    // If we're already authenticated (returning user), add a delay for premium feel
    const transitionDelay = isAuthenticated ? Math.max(0, 1500 - loadTime) : 500;
    
    console.log(`App: Adding transition delay of ${transitionDelay}ms for premium feel`);
    
    // Use a timeout to ensure the loading screen has time to complete its exit animation
    setTimeout(() => {
      setShowMainScreen(true);
      
      // Reset transitioning state after the fade-in completes
      setTimeout(() => {
        setIsTransitioning(false);
      }, 1000);
    }, transitionDelay);
  };

  // Force transition after a delay if initialization is complete but we're still showing loading
  useEffect(() => {
    if (!isInitializing && !showMainScreen && !hasTransitionedRef.current && !isTransitioning) {
      console.log("App: Initialization complete, forcing transition to main screen");
      
      // For authenticated users, ensure we show the loading screen for at least 3 seconds
      // This creates a more premium, high-quality feel
      const elapsedTime = Date.now() - initialLoadTimeRef.current;
      const minLoadTime = isAuthenticated ? 3000 : 1500;
      const delay = Math.max(0, minLoadTime - elapsedTime);
      
      console.log(`App: Ensuring minimum load time of ${minLoadTime}ms (current: ${elapsedTime}ms, adding: ${delay}ms)`);
      
      const timer = setTimeout(() => {
        handleLoadingComplete();
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [isInitializing, showMainScreen, isAuthenticated, isTransitioning]);

  // Determine which screen to show
  if (!showMainScreen) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  // Show the appropriate screen based on authentication state
  return (
    <Fade in={showMainScreen} timeout={1000} mountOnEnter unmountOnExit>
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