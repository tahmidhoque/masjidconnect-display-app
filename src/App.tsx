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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Log state changes for debugging
  useEffect(() => {
    console.log("App state:", { isInitializing, isAuthenticated, isLoading });
  }, [isInitializing, isAuthenticated, isLoading]);

  // Handle completion of loading screen
  const handleLoadingComplete = () => {
    console.log("App: Loading complete, transitioning to next screen");
    setIsLoading(false);
  };

  // Determine which screen to show
  if (isInitializing || isLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  // Show the appropriate screen based on authentication state
  return (
    <Fade in={!isLoading} timeout={800}>
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