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
        // Update loading message based on auth status
        if (!isAuthenticated) {
          console.log("useAppInitialization: Not authenticated, checking pairing status");
          if (isMounted) setLoadingMessage('Checking pairing status...');
          
          // Wait a moment before updating message again
          // This is for UX - allowing user to see the loading process
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          if (isMounted) setLoadingMessage('Requesting pairing code...');
        } else if (isAuthenticated && screenId) {
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
          
          // Give a bit more time before completing initialization
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Complete initialization
        if (isMounted) {
          console.log("useAppInitialization: Initialization complete");
          setLoadingMessage('Ready');
          
          // Ensure we set isInitializing to false after a short delay
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

    // Add a safety timeout to ensure initialization completes
    const safetyTimer = setTimeout(() => {
      if (isMounted && isInitializing) {
        console.log("useAppInitialization: Safety timeout reached, forcing completion");
        setLoadingMessage('Ready');
        setIsInitializing(false);
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [isAuthenticated, screenId, refreshContent, isInitializing]);

  return {
    isInitializing: isInitializing || isContentLoading,
    loadingMessage,
    orientation,
  };
};

export default useAppInitialization; 