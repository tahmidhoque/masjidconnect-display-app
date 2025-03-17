import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useContent } from '../contexts/ContentContext';
import apiClient from '../api/client';
import masjidDisplayClient from '../api/masjidDisplayClient';
import { Orientation } from '../contexts/OrientationContext';
import logger from '../utils/logger';

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
  const [lastInitializationError, setLastInitializationError] = useState<string | null>(null);
  
  // Use refs to track initialization state to prevent loops
  const initializationStartedRef = useRef<boolean>(false);
  const initializationCompletedRef = useRef<boolean>(false);

  useEffect(() => {
    // Prevent re-initializing if already started or completed
    if (initializationStartedRef.current) {
      return;
    }
    
    // Mark initialization as started
    initializationStartedRef.current = true;
    
    let isMounted = true;
    logger.info("Starting initialization with auth state", { isAuthenticated, screenId });

    const initialize = async () => {
      try {
        // Step 1: Initial delay for UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: Check authentication status
        if (!isAuthenticated) {
          logger.info("Not authenticated, preparing pairing screen");
          if (isMounted) setLoadingMessage('Checking pairing status...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // For unpaired devices, we're ready to show the pairing screen
          if (isMounted) {
            setLoadingMessage('Ready');
            logger.info("Ready to show pairing screen");
            completeInitialization();
          }
        } else {
          logger.info("Authenticated with screenId", { screenId });
          
          // Verify auth state is properly initialized in the client
          if (!masjidDisplayClient.isAuthenticated()) {
            logger.warn("Auth state mismatch between context and client");
            
            // Wait for the client to finish initialization (max 3 seconds)
            if (isMounted) setLoadingMessage('Waiting for auth initialization...');
            let authInitialized = false;
            
            for (let i = 0; i < 30; i++) {
              // Check every 100ms if auth is ready
              if (masjidDisplayClient.isAuthenticated()) {
                logger.info("Auth initialization completed in client");
                authInitialized = true;
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // If still not authenticated in client, log the credentials status
            if (!authInitialized) {
              masjidDisplayClient.logCredentialsStatus();
              setLastInitializationError("Auth initialization failed in client");
              logger.error("Auth initialization timed out");
              // Continue anyway - we'll try to work with what we have
            }
          }
          
          if (isMounted) setLoadingMessage('Fetching content...');
          
          // For already paired displays, explicitly refresh content to ensure we're in sync with the server
          try {
            if (navigator.onLine) {
              logger.info("Explicitly refreshing content for already paired display");
              await refreshContent();
              logger.info("Content refresh completed");
            } else {
              logger.warn("Device is offline, using cached content");
            }
            
            // For authenticated devices, we're ready to show the display screen
            if (isMounted) {
              setLoadingMessage('Ready');
              logger.info("Ready to show display screen");
              completeInitialization();
            }
          } catch (error) {
            logger.error("Error during content refresh", { error });
            setLastInitializationError("Content refresh error");
            
            // Even if there's an error, we should still complete initialization
            if (isMounted) {
              setLoadingMessage('Ready');
              logger.info("Ready to show display screen despite content refresh error");
              completeInitialization();
            }
          }
        }
      } catch (error) {
        logger.error('Initialization error', { error });
        setLastInitializationError(error instanceof Error ? error.message : "Unknown error");
        
        if (isMounted) {
          setLoadingMessage('Failed to initialize');
          completeInitialization();
        }
      }
    };
    
    // Helper function to complete initialization
    const completeInitialization = () => {
      if (!isMounted || initializationCompletedRef.current) return;
      
      // Mark initialization as completed to prevent multiple completions
      initializationCompletedRef.current = true;
      
      // Short delay before completing
      setTimeout(() => {
        if (isMounted) {
          logger.info("Set isInitializing to false", { isAuthenticated });
          setIsInitializing(false);
        }
      }, 500);
    };

    initialize();

    // Force completion after 5 seconds maximum
    const forceCompleteTimer = setTimeout(() => {
      if (isMounted && !initializationCompletedRef.current) {
        logger.warn("Force completing initialization after timeout");
        setLoadingMessage('Ready');
        initializationCompletedRef.current = true;
        setIsInitializing(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(forceCompleteTimer);
    };
  }, [isAuthenticated, screenId, refreshContent]);

  return {
    isInitializing,
    loadingMessage,
    orientation,
    lastError: lastInitializationError
  };
};

export default useAppInitialization; 