import React, { useEffect, Suspense, lazy, useCallback } from 'react';
import { Box, ThemeProvider, CssBaseline } from '@mui/material';

import theme from './theme/theme';
import logger from './utils/logger';
import ApiErrorBoundary from './components/common/ApiErrorBoundary';
import GracefulErrorOverlay from './components/common/GracefulErrorOverlay';
import EmergencyAlertOverlay from './components/common/EmergencyAlertOverlay';
import AnalyticsErrorIntegration from './components/common/AnalyticsErrorIntegration';
import UpdateNotification from './components/common/UpdateNotification';
import RemoteCommandNotification from './components/common/RemoteCommandNotification';
import FactoryResetModal from './components/common/FactoryResetModal';
import EnhancedLoadingScreen from './components/screens/EnhancedLoadingScreen';
import { OrientationProvider } from './contexts/OrientationContext';
// Clear cached Hijri data to ensure accurate calculation
import './utils/clearHijriCache';
// ✅ DISABLED: Demo imports that were causing console spam in development
// import "./utils/verifyHijriCalculation";
// import "./utils/factoryResetDemo";
// import "./utils/countdownTest";
import useKioskMode from './hooks/useKioskMode';
import useInitializationFlow from './hooks/useInitializationFlow';
import useFactoryReset from './hooks/useFactoryReset';
import useLoadingStateManager from './hooks/useLoadingStateManager';
import { ComponentPreloader, initializeMemoryManagement, rpiMemoryManager } from './utils/performanceUtils';
import { crashLogger } from './utils/crashLogger';
import './utils/crashReportViewer';
import { rpiGPUOptimizer } from './utils/rpiGpuOptimizer';
import rpiConfig from './utils/rpiConfig';

// Lazy load components for better performance
const PairingScreen = lazy(() =>
  ComponentPreloader.preload('PairingScreen', () => import('./components/screens/PairingScreen'))
);
const DisplayScreen = lazy(() =>
  ComponentPreloader.preload('DisplayScreen', () => import('./components/screens/DisplayScreen'))
);
const ErrorScreen = lazy(() =>
  ComponentPreloader.preload('ErrorScreen', () => import('./components/screens/ErrorScreen'))
);

// Development localStorage monitor for debugging credential issues
const useLocalStorageMonitor = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // On app startup, dump all localStorage contents
    logger.info('[DevMonitor] 🚀 App startup - localStorage contents:');
    const allKeys = Object.keys(localStorage);
    const allContents: Record<string, string> = {};

    allKeys.forEach((key) => {
      allContents[key] = localStorage.getItem(key) || '';
    });

    logger.info('[DevMonitor] All localStorage keys:', allKeys);
    logger.info('[DevMonitor] All localStorage contents:', allContents);

    // Specifically check for credential-related keys
    const credentialKeys = [
      'masjid_api_key',
      'masjid_screen_id',
      'apiKey',
      'screenId',
      'masjidconnect_credentials',
      'isPaired',
      'persist:root',
    ];

    const credentialContents: Record<string, string | null> = {};
    credentialKeys.forEach((key) => {
      credentialContents[key] = localStorage.getItem(key);
    });

    logger.info('[DevMonitor] Credential-related localStorage on startup:', credentialContents);

    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;
    const originalClear = localStorage.clear;

    // Monitor setItem calls
    localStorage.setItem = function (key: string, value: string) {
      if (credentialKeys.includes(key)) {
        logger.info(`[DevMonitor] 📝 localStorage.setItem("${key}")`, {
          valueLength: value.length,
          valuePreview: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
          stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
        });
      }
      return originalSetItem.call(this, key, value);
    };

    // Monitor removeItem calls
    localStorage.removeItem = function (key: string) {
      if (credentialKeys.includes(key)) {
        logger.warn(`[DevMonitor] 🗑️ localStorage.removeItem("${key}")`, {
          hadValue: !!localStorage.getItem(key),
          stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
        });
      }
      return originalRemoveItem.call(this, key);
    };

    // Monitor clear calls
    localStorage.clear = function () {
      const credentialValues = credentialKeys.reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {} as Record<string, string | null>);

      const hasCredentials = Object.values(credentialValues).some((v) => v !== null);

      if (hasCredentials) {
        logger.warn('[DevMonitor] 🧹 localStorage.clear() called with credentials present!', {
          credentials: credentialValues,
          stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
        });
      }

      return originalClear.call(this);
    };

    // Restore original methods on cleanup
    return () => {
      localStorage.setItem = originalSetItem;
      localStorage.removeItem = originalRemoveItem;
      localStorage.clear = originalClear;
    };
  }, []);
};

const AppRoutes: React.FC = () => {
  useKioskMode();

  // Initialize the app flow (but don't use its stage directly)
  useInitializationFlow();

  // Use the new unified loading state manager
  const { currentPhase, shouldShowLoadingScreen, shouldShowDisplay, isTransitioning, progress, statusMessage } =
    useLoadingStateManager({
      minimumLoadingDuration: process.env.NODE_ENV === 'development' ? 1500 : 2500, // Shorter in dev
      contentReadyDelay: process.env.NODE_ENV === 'development' ? 600 : 1000, // Faster in dev
      transitionDuration: 600, // Smooth transition timing
    });

  // Handle loading screen transition completion
  const handleLoadingComplete = useCallback(() => {
    logger.info('[App] Loading screen transition completed');
  }, []);

  logger.info('[App] Current app state:', {
    currentPhase,
    shouldShowLoadingScreen,
    shouldShowDisplay,
    isTransitioning,
    progress,
  });

  // Always show loading screen for these phases to prevent gaps
  const shouldForceLoadingScreen =
    currentPhase === 'initializing' ||
    currentPhase === 'checking' ||
    currentPhase === 'loading-content' ||
    currentPhase === 'preparing' ||
    currentPhase === 'ready';

  // Show enhanced loading screen when needed
  if (shouldShowLoadingScreen || shouldForceLoadingScreen) {
    return (
      <EnhancedLoadingScreen
        currentPhase={currentPhase}
        progress={progress}
        statusMessage={statusMessage}
        isTransitioning={isTransitioning}
        onTransitionComplete={handleLoadingComplete}
      />
    );
  }

  // Show appropriate screen based on phase - be more specific about when to show each
  if (currentPhase === 'pairing') {
    return (
      <Suspense
        fallback={
          <EnhancedLoadingScreen
            currentPhase="checking"
            progress={25}
            statusMessage="Loading pairing..."
            isTransitioning={false}
          />
        }
      >
        <PairingScreen />
      </Suspense>
    );
  }

  if (currentPhase === 'displaying' && shouldShowDisplay) {
    return (
      <Suspense
        fallback={
          <EnhancedLoadingScreen
            currentPhase="preparing"
            progress={85}
            statusMessage="Loading display..."
            isTransitioning={false}
          />
        }
      >
        <DisplayScreen />
      </Suspense>
    );
  }

  // Fallback to loading screen instead of error screen to prevent white flash
  logger.warn(`[App] Unexpected state, showing loading screen as fallback: ${currentPhase}`);
  return (
    <EnhancedLoadingScreen
      currentPhase={currentPhase}
      progress={progress}
      statusMessage={statusMessage || 'Loading...'}
      isTransitioning={isTransitioning}
      onTransitionComplete={handleLoadingComplete}
    />
  );
};

const App: React.FC = () => {
  // Enable localStorage monitoring in development
  useLocalStorageMonitor();

  // Initialize factory reset functionality
  const { isModalOpen, closeModal, confirmReset, isResetting } = useFactoryReset();

  // ADDED: Initialize memory management for stability on Raspberry Pi (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Apply performance CSS for RPi
    if (rpiConfig.isRaspberryPi()) {
      rpiConfig.applyPerformanceCSS();
      logger.info('✅ RPi performance mode activated - animations and effects disabled');
    }

    // Initialize memory management only if not disabled
    if (!config.disableMemoryManager) {
      initializeMemoryManagement();
      logger.info('Memory management initialized');
    } else {
      logger.info('⚠️ Memory management disabled by RPi config');
    }
  }, []);

  // Initialize crash logging for debugging restarts
  useEffect(() => {
    crashLogger.initialize();
    logger.info('Application started with crash logging enabled');
  }, []);

  // Initialize RPi GPU optimizations (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Only initialize GPU optimizer if not disabled
    if (!config.disableGPUOptimizer) {
      rpiGPUOptimizer.initialize();
      return () => {
        rpiGPUOptimizer.cleanup();
      };
    } else {
      logger.info('⚠️ GPU optimizer disabled by RPi config');
    }
  }, []);

  // Memory monitoring for RPi devices (conditionally)
  useEffect(() => {
    const config = rpiConfig.getConfig();

    // Start memory monitoring for RPi devices (only if not disabled)
    if (process.env.NODE_ENV === 'production' && !config.disableMemoryManager) {
      rpiMemoryManager.startMonitoring();
    }

    // Cleanup function to prevent memory leaks
    return () => {
      // Stop memory monitoring
      if (!config.disableMemoryManager) {
        rpiMemoryManager.stopMonitoring();
      }

      // Clear any remaining timeouts/intervals
      if (window.gc) {
        window.gc(); // Force garbage collection if available
      }
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ApiErrorBoundary>
        <OrientationProvider>
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
              // Use the same gradient as ModernIslamicBackground to prevent flashing
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.secondary.main} 100%)`,
              // Optimize for performance
              willChange: 'auto',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          >
                <Suspense fallback={
                  <EnhancedLoadingScreen 
                    currentPhase="checking" 
                    progress={0} 
                    statusMessage="Loading..." 
                    isTransitioning={false} 
                  />
                }>
                  <AppRoutes />
                </Suspense>
                <GracefulErrorOverlay />
                <EmergencyAlertOverlay />
                <AnalyticsErrorIntegration />
                <UpdateNotification />
                <RemoteCommandNotification />

            {/* Factory Reset Modal */}
            <FactoryResetModal
              open={isModalOpen}
              onConfirm={confirmReset}
              onCancel={closeModal}
              isResetting={isResetting}
            />
          </Box>
        </OrientationProvider>
      </ApiErrorBoundary>
    </ThemeProvider>
  );
};

export default App;
