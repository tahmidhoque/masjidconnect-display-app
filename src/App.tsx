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
  const { isInitializing, loadingMessage } = useAppInitialization();
  const [showLoading, setShowLoading] = useState<boolean>(true);
  const [showContent, setShowContent] = useState<boolean>(false);

  // Handle transitions between screens
  useEffect(() => {
    let transitionTimer: NodeJS.Timeout;

    // If initialization is complete, schedule the transition
    if (!isInitializing && loadingMessage === 'Ready') {
      transitionTimer = setTimeout(() => {
        setShowLoading(false);
        
        // Small delay before showing the next screen
        setTimeout(() => {
          setShowContent(true);
        }, 500);
      }, 3000); // Wait for the loading screen animations to complete
    }

    return () => {
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, [isInitializing, loadingMessage]);

  // Always show loading screen initially
  if (showLoading) {
    return <LoadingScreen />;
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