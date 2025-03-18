import { useState, useEffect, useCallback } from 'react';
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
  const { isAuthenticated, screenId } = useAuth();
  const { orientation } = useOrientation();
  const { refreshContent } = useContent();

  // Initialize auth context
  const initAuth = useCallback(async () => {
    try {
      setLoadingMessage('Checking authentication...');
      setInitializationStage('auth');
      // Auth context initializes automatically
      
      // Add a slight delay for a more premium feel
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return true;
    } catch (error) {
      console.error('Error initializing auth:', error);
      return false;
    }
  }, []);

  // Initialize orientation context
  const initOrientation = useCallback(async () => {
    try {
      if (isAuthenticated) {
        setLoadingMessage('Loading screen settings...');
        setInitializationStage('orientation');
        // Orientation is loaded from API when authenticated
        
        // Add a slight delay for a more premium feel
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      return true;
    } catch (error) {
      console.error('Error initializing orientation:', error);
      return false;
    }
  }, [isAuthenticated]);

  // Initialize content context
  const initContent = useCallback(async () => {
    try {
      if (isAuthenticated) {
        setLoadingMessage('Loading content...');
        setInitializationStage('content');
        await refreshContent();
        
        // Add a slight delay after content loads for a more premium feel
        await new Promise(resolve => setTimeout(resolve, 700));
      }
      return true;
    } catch (error) {
      console.error('Error initializing content:', error);
      return false;
    }
  }, [refreshContent, isAuthenticated]);

  // Main initialization function
  const initialize = useCallback(async () => {
    console.log('Starting app initialization...');
    
    // Track start time to ensure minimum loading time for better UX
    const startTime = Date.now();
    
    // Initialize all contexts
    const authSuccess = await initAuth();
    
    // If authenticated, update loading message to be more specific
    if (authSuccess && isAuthenticated) {
      setLoadingMessage('Preparing your dashboard...');
      // Add a slight delay for a more premium feel
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const orientationSuccess = await initOrientation();
    const contentSuccess = await initContent();
    
    // Calculate elapsed time
    const elapsedTime = Date.now() - startTime;
    const minLoadTime = isAuthenticated ? 2500 : 1500; // Longer min time for authenticated users
    
    // Ensure minimum loading time for better UX
    if (elapsedTime < minLoadTime) {
      if (isAuthenticated) {
        setLoadingMessage('Almost ready...');
            } else {
        setLoadingMessage('Ready to pair...');
      }
      
      // Add a slight delay before the final message for a more premium feel
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Calculate remaining time to meet minimum loading time
      const remainingTime = minLoadTime - elapsedTime - 500;
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    }
    
    // Set final loading message
    setLoadingMessage(isAuthenticated ? 'Loading complete!' : 'Ready to pair!');
    setInitializationStage('complete');
    
    // Complete initialization
    console.log('App initialization complete!', {
      authSuccess,
      orientationSuccess,
      contentSuccess,
      isAuthenticated,
      screenId,
      orientation,
      totalLoadTime: Date.now() - startTime
    });
    
    // Small delay before setting isInitializing to false for smoother transition
      setTimeout(() => {
          setIsInitializing(false);
    }, 800); // Longer delay for a more premium feel
  }, [initAuth, initOrientation, initContent, isAuthenticated, screenId, orientation]);

  // Run initialization on component mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return { isInitializing, loadingMessage, initializationStage };
};

export default useAppInitialization; 