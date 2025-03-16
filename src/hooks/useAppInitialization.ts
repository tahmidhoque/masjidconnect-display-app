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

    const initialize = async () => {
      try {
        // Update loading message based on auth status
        if (!isAuthenticated) {
          if (isMounted) setLoadingMessage('Checking pairing status...');
          
          // Wait a moment before updating message again
          // This is for UX - allowing user to see the loading process
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          if (isMounted) setLoadingMessage('Requesting pairing code...');
        } else if (isAuthenticated && screenId) {
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
          setLoadingMessage('Ready');
          setIsInitializing(false);
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

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, screenId, refreshContent]);

  return {
    isInitializing: isInitializing || isContentLoading,
    loadingMessage,
    orientation,
  };
};

export default useAppInitialization; 