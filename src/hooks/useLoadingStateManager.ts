import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import logger from '../utils/logger';
import { getDevicePerformanceProfile, isHighStrainDevice } from '../utils/performanceUtils';

export type AppPhase = 
  | 'initializing'     // App is starting up
  | 'checking'         // Checking credentials  
  | 'pairing'          // Showing pairing screen
  | 'loading-content'  // Loading display content
  | 'preparing'        // Content loaded, preparing display
  | 'ready'            // Display is ready to show
  | 'displaying';      // Actively displaying content

interface LoadingStateManagerOptions {
  minimumLoadingDuration?: number;
  contentReadyDelay?: number;
  transitionDuration?: number;
}

interface LoadingStateManager {
  currentPhase: AppPhase;
  isLoading: boolean;
  shouldShowLoadingScreen: boolean;
  shouldShowDisplay: boolean;
  isTransitioning: boolean;
  progress: number;
  statusMessage: string;
  forcePhase: (phase: AppPhase) => void;
}

/**
 * Get performance-aware loading durations
 */
const getLoadingDurations = () => {
  const profile = getDevicePerformanceProfile();
  const isHighStrain = isHighStrainDevice();
  
  if (isHighStrain) {
    // Much faster loading for 4K RPi displays
    return {
      minimumLoadingDuration: 800,
      contentReadyDelay: 300,
      transitionDuration: 200,
    };
  } else if (profile.profile === 'low') {
    // Slightly faster for low-power devices
    return {
      minimumLoadingDuration: 1500,
      contentReadyDelay: 600,
      transitionDuration: 400,
    };
  } else {
    // Standard durations for more powerful devices
    return {
      minimumLoadingDuration: 2500,
      contentReadyDelay: 1000,
      transitionDuration: 600,
    };
  }
};

/**
 * useLoadingStateManager - Unified loading state management
 * 
 * Coordinates all loading states across the app to provide smooth,
 * predictable transitions without rapid state changes or flashing.
 * Enhanced with 4K display optimizations and better stability.
 */
export default function useLoadingStateManager(
  options: LoadingStateManagerOptions = {}
): LoadingStateManager {
  const performanceDurations = getLoadingDurations();
  const isHighStrain = isHighStrainDevice();
  
  const {
    minimumLoadingDuration = performanceDurations.minimumLoadingDuration,
    contentReadyDelay = performanceDurations.contentReadyDelay,
    transitionDuration = performanceDurations.transitionDuration
  } = options;

  // Redux state
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const isPairing = useSelector((state: RootState) => state.auth.isPairing);
  const pairingCode = useSelector((state: RootState) => state.auth.pairingCode);
  const isInitializing = useSelector((state: RootState) => state.ui.isInitializing);
  const initializationStage = useSelector((state: RootState) => state.ui.initializationStage);
  const contentLoading = useSelector((state: RootState) => state.content.isLoading);
  const screenContent = useSelector((state: RootState) => state.content.screenContent);
  const prayerTimes = useSelector((state: RootState) => state.content.prayerTimes);

  // Internal state
  const [currentPhase, setCurrentPhase] = useState<AppPhase>('initializing');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldShowLoadingScreen, setShouldShowLoadingScreen] = useState(true);
  const [shouldShowDisplay, setShouldShowDisplay] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting up...');

  // Refs for timing control and debouncing
  const phaseStartTime = useRef<number>(Date.now());
  const transitionTimer = useRef<NodeJS.Timeout | null>(null);
  const contentReadyTimer = useRef<NodeJS.Timeout | null>(null);
  const forcePhaseRef = useRef<AppPhase | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastPhaseChangeTime = useRef<number>(Date.now());
  const pendingPhaseRef = useRef<AppPhase | null>(null);

  // Check if we have minimum content to display
  const hasMinimumContent = useCallback(() => {
    return screenContent !== null || prayerTimes !== null;
  }, [screenContent, prayerTimes]);

  // Calculate progress based on current phase
  const calculateProgress = useCallback((phase: AppPhase) => {
    switch (phase) {
      case 'initializing': return 5;
      case 'checking': return 20;
      case 'pairing': return 35;
      case 'loading-content': return 65;
      case 'preparing': return 85;
      case 'ready': return 95;
      case 'displaying': return 100;
      default: return 0;
    }
  }, []);

  // Get status message for current phase
  const getStatusMessage = useCallback((phase: AppPhase) => {
    switch (phase) {
      case 'initializing': return 'Starting up...';
      case 'checking': return 'Checking credentials...';
      case 'pairing': return 'Ready to pair';
      case 'loading-content': return 'Loading content...';
      case 'preparing': return 'Preparing display...';
      case 'ready': return 'Almost ready...';
      case 'displaying': return 'Connected';
      default: return 'Loading...';
    }
  }, []);

  // Force a specific phase (for external control)
  const forcePhase = useCallback((phase: AppPhase) => {
    logger.info(`[LoadingStateManager] Force phase: ${phase}`);
    forcePhaseRef.current = phase;
  }, []);

  // Debounced phase transition to prevent rapid changes
  const transitionToPhaseDebounced = useCallback((newPhase: AppPhase, skipMinimumDuration = false) => {
    const now = Date.now();
    const timeSinceLastChange = now - lastPhaseChangeTime.current;
    const minimumChangeInterval = 500; // Minimum time between phase changes

    // Clear any pending transitions
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    pendingPhaseRef.current = newPhase;

    const executeTransition = () => {
      const pendingPhase = pendingPhaseRef.current;
      if (!pendingPhase || pendingPhase === currentPhase) return;

      const currentTime = Date.now();
      const elapsedTime = currentTime - phaseStartTime.current;
      const minimumTimeRemaining = skipMinimumDuration ? 0 : Math.max(0, minimumLoadingDuration - elapsedTime);

      logger.info(`[LoadingStateManager] Transitioning: ${currentPhase} -> ${pendingPhase}`, {
        elapsedTime,
        minimumTimeRemaining,
        skipMinimumDuration
      });

      const doTransition = () => {
        setIsTransitioning(true);
        setCurrentPhase(pendingPhase);
        setProgress(calculateProgress(pendingPhase));
        setStatusMessage(getStatusMessage(pendingPhase));
        phaseStartTime.current = Date.now();
        lastPhaseChangeTime.current = Date.now();

        // Handle specific phase transitions
        setTimeout(() => {
          setIsTransitioning(false);
          
          // Update display flags based on new phase
          if (pendingPhase === 'pairing') {
            setShouldShowLoadingScreen(false);
            setShouldShowDisplay(false);
          } else if (pendingPhase === 'preparing') {
            // Auto-transition from preparing to ready
            setShouldShowLoadingScreen(true);
            setShouldShowDisplay(false);
            
            contentReadyTimer.current = setTimeout(() => {
              setCurrentPhase('ready');
              setProgress(95);
              setStatusMessage('Almost ready...');
              
              // Then transition to displaying
              setTimeout(() => {
                setShouldShowLoadingScreen(false);
                setShouldShowDisplay(true);
                setCurrentPhase('displaying');
                setProgress(100);
                setStatusMessage('Connected');
              }, 800);
            }, 1000);
          } else if (pendingPhase === 'ready') {
            // Direct transition to displaying from ready
            setShouldShowLoadingScreen(true);
            setShouldShowDisplay(false);
            
            contentReadyTimer.current = setTimeout(() => {
              setShouldShowLoadingScreen(false);
              setShouldShowDisplay(true);
              setCurrentPhase('displaying');
              setProgress(100);
              setStatusMessage('Connected');
            }, contentReadyDelay);
          } else if (pendingPhase === 'displaying') {
            setShouldShowLoadingScreen(false);
            setShouldShowDisplay(true);
          } else {
            setShouldShowLoadingScreen(true);
            setShouldShowDisplay(false);
          }
        }, transitionDuration);
      };

      if (minimumTimeRemaining > 0) {
        transitionTimer.current = setTimeout(doTransition, minimumTimeRemaining);
      } else {
        doTransition();
      }
    };

    // If enough time has passed since last change, execute immediately
    if (timeSinceLastChange >= minimumChangeInterval || skipMinimumDuration) {
      executeTransition();
    } else {
      // Otherwise, debounce it
      const delay = minimumChangeInterval - timeSinceLastChange;
      debounceTimer.current = setTimeout(executeTransition, delay);
    }
  }, [currentPhase, minimumLoadingDuration, contentReadyDelay, transitionDuration, calculateProgress, getStatusMessage]);

  // Main phase determination logic with stability improvements
  useEffect(() => {
    // Check for forced phase first
    if (forcePhaseRef.current && forcePhaseRef.current !== currentPhase) {
      const forcedPhase = forcePhaseRef.current;
      forcePhaseRef.current = null;
      transitionToPhaseDebounced(forcedPhase, true);
      return;
    }

    let targetPhase: AppPhase;

    // Determine target phase based on app state with better logic
    if (!isAuthenticated && !isPairing && !pairingCode) {
      // No authentication, not pairing
      if (isInitializing) {
        targetPhase = initializationStage === 'checking' ? 'checking' : 'initializing';
      } else {
        targetPhase = 'checking';
      }
    } else if (!isAuthenticated && (isPairing || pairingCode)) {
      // In pairing mode
      targetPhase = 'pairing';
    } else if (isAuthenticated && (contentLoading || !hasMinimumContent())) {
      // Authenticated but content not ready
      // CRITICAL FIX: Don't show loading screen for routine prayer time updates
      if (currentPhase === 'displaying' && hasMinimumContent()) {
        // If we're already displaying and have content, stay displaying
        // This prevents loading screen during routine prayer time updates
        targetPhase = 'displaying';
        logger.debug(`[LoadingStateManager] Staying in display mode during routine update`, {
          contentLoading,
          hasContent: hasMinimumContent(),
          currentPhase
        });
      } else {
        // Only show loading if we truly don't have content to display
        targetPhase = 'loading-content';
      }
    } else if (isAuthenticated && hasMinimumContent()) {
      // Authenticated with content - ready to display
      if (currentPhase === 'displaying') {
        targetPhase = 'displaying'; // Stay displaying
      } else if (currentPhase === 'ready') {
        targetPhase = 'ready'; // Let the timer handle transition to displaying
      } else {
        targetPhase = 'preparing'; // First go to preparing, then ready
      }
    } else {
      // Fallback
      targetPhase = 'checking';
    }

    // Only transition if phase actually needs to change and we're not currently transitioning
    if (targetPhase !== currentPhase && !isTransitioning) {
      logger.info(`[LoadingStateManager] Phase change needed: ${currentPhase} -> ${targetPhase}`, {
        isAuthenticated,
        isPairing,
        pairingCode: !!pairingCode,
        isInitializing,
        initializationStage,
        contentLoading,
        hasContent: hasMinimumContent()
      });
      
      transitionToPhaseDebounced(targetPhase);
    }
  }, [
    isAuthenticated,
    isPairing, 
    pairingCode,
    isInitializing,
    initializationStage,
    contentLoading,
    hasMinimumContent,
    currentPhase,
    isTransitioning,
    transitionToPhaseDebounced
  ]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
      if (contentReadyTimer.current) {
        clearTimeout(contentReadyTimer.current);
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Calculate derived loading state - be more conservative about when to hide loading
  const isLoading = currentPhase !== 'displaying' && currentPhase !== 'pairing';
  const actualShouldShowLoading = shouldShowLoadingScreen && currentPhase !== 'displaying';
  const actualShouldShowDisplay = shouldShowDisplay && currentPhase === 'displaying';

  return {
    currentPhase,
    isLoading,
    shouldShowLoadingScreen: actualShouldShowLoading,
    shouldShowDisplay: actualShouldShowDisplay,
    isTransitioning,
    progress,
    statusMessage,
    forcePhase
  };
} 