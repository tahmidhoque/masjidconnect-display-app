import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Fade } from '@mui/material';
import theme from './theme/theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrientationProvider } from './contexts/OrientationContext';
import { ContentProvider } from './contexts/ContentContext';
import LoadingScreen from './components/screens/LoadingScreen';
import PairingScreen from './components/screens/PairingScreen';
import DisplayScreen from './components/screens/DisplayScreen';
import useAppInitialization from './hooks/useAppInitialization';

/**
 * Main application container that wraps all providers and screens
 */
const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isInitializing } = useAppInitialization();
  const [showLoading, setShowLoading] = useState<boolean>(true);
  const [showContent, setShowContent] = useState<boolean>(false);

  // Handle completion of loading screen
  const handleLoadingComplete = () => {
    console.log("App: Loading complete, transitioning to next screen");
    setShowLoading(false);
    // Small delay before showing the next screen
    setTimeout(() => {
      setShowContent(true);
      console.log("App: Showing content screen:", isAuthenticated ? "DisplayScreen" : "PairingScreen");
    }, 500);
  };

  // Log initial state
  useEffect(() => {
    console.log("App: Initial state - isInitializing:", isInitializing, "isAuthenticated:", isAuthenticated);
  }, [isInitializing, isAuthenticated]);

  // Always show loading screen initially
  if (isInitializing || showLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  // Show the appropriate screen based on authentication state
  return (
    <Fade in={showContent} timeout={800}>
      <div>
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <OrientationProvider>
          <ContentProvider>
            <AppContent />
          </ContentProvider>
        </OrientationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App; 