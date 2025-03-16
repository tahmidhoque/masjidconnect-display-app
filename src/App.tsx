import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrientationProvider } from './contexts/OrientationContext';
import { ContentProvider } from './contexts/ContentContext';
import LoadingScreen from './components/screens/LoadingScreen';
import useAppInitialization from './hooks/useAppInitialization';

/**
 * Main application container that wraps all providers and screens
 */
const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isInitializing } = useAppInitialization();

  // Always show loading screen initially
  if (isInitializing) {
    return <LoadingScreen />;
  }

  // TODO: Replace with actual screen content based on authentication state
  return (
    <>
      {isAuthenticated ? (
        <div>Main Content Screen</div>
      ) : (
        <div>Pairing Screen</div>
      )}
    </>
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