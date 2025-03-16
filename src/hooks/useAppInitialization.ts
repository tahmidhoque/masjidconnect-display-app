import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useContent } from '../contexts/ContentContext';
import apiClient from '../api/client';
import { Orientation } from '../contexts/OrientationContext';

/**
 * Hook for handling app initialization
 * 
 * Manages the loading state while the app checks authentication status,
 * fetches initial content, and prepares for display.
 */
export const useAppInitialization = () => {
  const { isAuthenticated, screenId } = useAuth();
  const { refreshContent, isLoading: isContentLoading } = useContent();
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
  const [orientation, setOrientation] = useState<Orientation>('LANDSCAPE');

  useEffect(() => {
    let isMounted = true;
    console.log("useAppInitialization: Starting initialization");

    const initialize = async () => {
      try {
        // Step 1: Initial delay for UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: Check authentication status
        if (!isAuthenticated) {
          console.log("useAppInitialization: Not authenticated, preparing pairing screen");
          if (isMounted) setLoadingMessage('Checking pairing status...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log("useAppInitialization: Authenticated, fetching content");
          if (isMounted) setLoadingMessage('Fetching content...');
          await refreshContent();
        }
        
        // Step 3: Complete initialization
        if (isMounted) {
          console.log("useAppInitialization: Initialization complete");
          setLoadingMessage('Ready');
          
          // Short delay before completing
          setTimeout(() => {
            if (isMounted) {
              setIsInitializing(false);
              console.log("useAppInitialization: Set isInitializing to false");
            }
          }, 500);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        if (isMounted) {
          setLoadingMessage('Failed to initialize');
          setIsInitializing(false);
        }
      }
    };

    initialize();

    // Force completion after 3 seconds maximum
    const forceCompleteTimer = setTimeout(() => {
      if (isMounted) {
        console.log("useAppInitialization: Force completing initialization after timeout");
        setLoadingMessage('Ready');
        setIsInitializing(false);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(forceCompleteTimer);
    };
  }, [isAuthenticated, refreshContent]);

  return {
    isInitializing,
    loadingMessage,
    orientation,
  };
};

export default useAppInitialization; 