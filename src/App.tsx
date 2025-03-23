import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, Fade } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrientationProvider } from './contexts/OrientationContext';
import { ContentProvider } from './contexts/ContentContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { EmergencyAlertProvider } from './contexts/EmergencyAlertContext';
import DisplayScreen from './components/screens/DisplayScreen';
import PairingScreen from './components/screens/PairingScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import AuthErrorDetector from './components/common/AuthErrorDetector';
import OfflineNotification from './components/OfflineNotification';
import ApiErrorBoundary from './components/common/ApiErrorBoundary';
import EmergencyAlert from './components/common/EmergencyAlert';
import theme from './theme/theme';
import useAppInitialization from './hooks/useAppInitialization';
import ErrorScreen from './components/screens/ErrorScreen';

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
  const [showContent, setShowContent] = useState(false);
  
  // Add effect to fade in content after initialization completes
  useEffect(() => {
    if (!isInitializing) {
      // Add slight delay to ensure loading screen has time to start fading out
      // This creates an overlapping transition effect
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isInitializing]);
  
  // Always render LoadingScreen, but it will fade out based on isInitializing state
  return (
    <>
      <LoadingScreen />
      
      {/* Main content with improved fade-in effect */}
      <Fade in={showContent} timeout={1200}>
        <Box sx={{ 
          opacity: showContent ? 1 : 0,
          width: '100%', 
          height: '100%',
          position: 'relative',
          // Add transform to create a slight movement effect during transition
          transform: showContent ? 'translateY(0)' : 'translateY(20px)',
          transition: 'transform 1s ease-out, opacity 1.2s ease-in-out',
        }}>
          <OfflineNotification position={{ vertical: 'bottom', horizontal: 'left' }} />
          <AuthErrorDetector />
          <EmergencyAlert />
          <Routes>
            <Route path="/" element={<AuthenticatedRoute><DisplayScreen /></AuthenticatedRoute>} />
            <Route path="/pair" element={<PairingScreen />} />
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