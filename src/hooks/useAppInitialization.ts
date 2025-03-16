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
    console.log("useAppInitialization: Starting initialization with auth state:", isAuthenticated);

    const initialize = async () => {
      try {
        // Step 1: Initial delay for UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: Check authentication status
        if (!isAuthenticated) {
          console.log("useAppInitialization: Not authenticated, preparing pairing screen");
          if (isMounted) setLoadingMessage('Checking pairing status...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // For unpaired devices, we're ready to show the pairing screen
          if (isMounted) {
            setLoadingMessage('Ready');
            console.log("useAppInitialization: Ready to show pairing screen");
          }
        } else {
          console.log("useAppInitialization: Authenticated with screenId:", screenId);
          if (isMounted) setLoadingMessage('Fetching content...');
          
          // Refresh content if authenticated
          await refreshContent();
          
          // Get screen orientation from the server
          try {
            const response = await apiClient.getScreenContent();
            if (response.success && response.data?.screen?.orientation) {
              setOrientation(response.data.screen.orientation as Orientation);
            }
          } catch (error) {
            console.error('Failed to get screen orientation:', error);
          }
          
          // For authenticated devices, we're ready to show the display screen
          if (isMounted) {
            setLoadingMessage('Ready');
            console.log("useAppInitialization: Ready to show display screen");
          }
        }
        
        // Step 3: Complete initialization
        if (isMounted) {
          // Short delay before completing
          setTimeout(() => {
            if (isMounted) {
              setIsInitializing(false);
              console.log("useAppInitialization: Set isInitializing to false, auth state:", isAuthenticated);
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
  }, [isAuthenticated, screenId, refreshContent]);

  return {
    isInitializing,
    loadingMessage,
    orientation,
  };
};

export default useAppInitialization; 