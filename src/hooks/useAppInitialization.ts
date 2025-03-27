import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrientation } from '../contexts/OrientationContext';
import { useContent } from '../contexts/ContentContext';

/**
 * Custom hook to handle application initialization
 * Manages loading state and initializes contexts with premium loading experience
 */
const useAppInitialization = () => {
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
  const [initializationStage, setInitializationStage] = useState<string>('start');
  
  // Get context values but guard against being called outside context providers
  const authContext = useRef<any>(null);
  const orientationContext = useRef<any>(null);
  const contentContext = useRef<any>(null);
  
  // Always call hooks at the top level, unconditionally
  const auth = useAuth();
  const orientation = useOrientation();
  const content = useContent();
  
  // Now set the refs with error handling
  try {
    authContext.current = auth;
    orientationContext.current = orientation;
    contentContext.current = content;
  } catch (error) {
    // Context not available yet, will be retried on next render
  }
  
  // Use refs to track initialization state without causing rerenders
  const isInitializingRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const initialTimersCreated = useRef(false);

  // Check if the device has been paired before
  const checkIfPreviouslyPaired = () => {
    const screenId = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
    const apiKey = localStorage.getItem('masjid_api_key') || localStorage.getItem('apiKey');
    return !!(screenId && apiKey);
  };
  
  // Setup initial loading timers
  const setupLoadingTimers = () => {
    if (initialTimersCreated.current) return;
    initialTimersCreated.current = true;
    
    // Enhanced loading sequence with more steps
    const sequence = [
      { message: 'Initializing application...', delay: 1500 },
      { message: 'Checking authentication...', delay: 1500 },
      { message: 'Loading configuration...', delay: 1500 },
      { message: 'Preparing interface...', delay: 1500 }
    ];
    
    // Stagger the messages for a better loading experience
    let totalDelay = 0;
    sequence.forEach((step) => {
      totalDelay += step.delay;
      setTimeout(() => {
        setLoadingMessage(step.message);
      }, totalDelay);
    });
  };

  // Main initialization function
  const initialize = useCallback(async () => {
    // Skip if already initialized
    if (hasInitializedRef.current) {
      return;
    }
    
    // Skip if contexts aren't available yet
    if (!authContext.current || !contentContext.current) {
      return;
    }
    
    // Setup loading sequence timers
    setupLoadingTimers();
    
    // Mark as initialized to prevent duplicate calls
    hasInitializedRef.current = true;
    
    // Track start time to ensure minimum loading time for better UX
    const startTime = Date.now();
    const isAuthenticated = authContext.current?.isAuthenticated;
    const refreshContent = contentContext.current?.refreshContent;
    
    // Check if previously paired by looking directly at localStorage
    const wasPreviouslyPaired = checkIfPreviouslyPaired();
    
    try {
      // Stage 1: Auth check with wait time
      setInitializationStage('auth');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // If authenticated, continue with more detailed initialization
      if (isAuthenticated) {
        // Stage 2: Orientation and screen setup
        setLoadingMessage('Loading screen settings...');
        setInitializationStage('orientation');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Stage 3: Content initialization
        setLoadingMessage('Loading content...');
        setInitializationStage('content');
        if (refreshContent) {
          await refreshContent().catch(() => {});
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Stage 4: Final preparations
        setLoadingMessage('Almost ready...');
        setInitializationStage('finalizing');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Stage 5: Completion - Salam message handled in LoadingScreen
      } else {
        // Not authenticated, check if we were previously paired
        if (wasPreviouslyPaired) {
          // Was paired but needs to reconnect
          setLoadingMessage('Reconnecting to your masjid...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // New device, needs pairing
          setLoadingMessage('Ready to pair with your masjid...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Set final stage - Salam will be handled by LoadingScreen component
      setInitializationStage('complete');
      
      // Minimum total loading time to ensure premium experience
      const elapsedTime = Date.now() - startTime;
      const minimumLoadTime = 12000; // 12 seconds minimum
      
      if (elapsedTime < minimumLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minimumLoadTime - elapsedTime));
      }
    } catch (error) {
      // Silent fail - ensure we still complete initialization
      setInitializationStage('complete');
    } finally {
      // Delay completion for a smooth transition
      setTimeout(() => {
        isInitializingRef.current = false;
        setIsInitializing(false);
      }, 3000);
    }
  }, []);

  // Run initialization on component mount
  useEffect(() => {
    // Only run initialize if contexts are available
    if (authContext.current && contentContext.current) {
      initialize();
    }
  }, [initialize, authContext.current, contentContext.current]);

  return { isInitializing, loadingMessage, initializationStage };
};

export default useAppInitialization; 