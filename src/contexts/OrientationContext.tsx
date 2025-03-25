import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import orientationEventService from '../services/orientationEventService';
import logger from '../utils/logger';

export type Orientation = 'LANDSCAPE' | 'PORTRAIT';

const ORIENTATION_STORAGE_KEY = 'masjidconnect:orientation';

interface OrientationContextType {
  orientation: Orientation;
  setAdminOrientation: (orientation: Orientation) => void;
  deviceOrientation: Orientation;
  isOrientationMatching: (requestedOrientation: Orientation) => boolean;
}

const OrientationContext = createContext<OrientationContextType | undefined>(undefined);

interface OrientationProviderProps {
  children: ReactNode;
}

export const OrientationProvider: React.FC<OrientationProviderProps> = ({ children }) => {
  // Initialize from storage if available
  const getStoredOrientation = useCallback((): Orientation | null => {
    try {
      const stored = localStorage.getItem(ORIENTATION_STORAGE_KEY);
      return (stored === 'LANDSCAPE' || stored === 'PORTRAIT') ? stored : null;
    } catch (error) {
      console.error("Error reading orientation from storage:", error);
      return null;
    }
  }, []);
  
  // Track both admin-set orientation and device orientation
  const [adminOrientation, setAdminOrientation] = useState<Orientation | null>(getStoredOrientation());
  const [deviceOrientation, setDeviceOrientation] = useState<Orientation>(
    window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'
  );
  const { isAuthenticated, screenId } = useAuth();

  // Update device orientation based on screen dimensions - use throttling to avoid frequent updates
  useEffect(() => {
    // Debounce the resize handler to avoid excessive updates
    let resizeTimer: NodeJS.Timeout | null = null;
    
    const handleResize = () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      
      resizeTimer = setTimeout(() => {
        const isPortrait = window.innerHeight > window.innerWidth;
        const newOrientation = isPortrait ? 'PORTRAIT' : 'LANDSCAPE';
        
        // Only update state if orientation actually changed
        if (newOrientation !== deviceOrientation) {
          setDeviceOrientation(newOrientation);
        }
      }, 100); // Debounce for 100ms
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Initial check
    handleResize();

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
  }, [deviceOrientation]);
  
  // Save admin orientation to storage when it changes
  const handleSetAdminOrientation = useCallback((newOrientation: Orientation) => {
    // Only update if orientation actually changed and is a valid value
    if (newOrientation === adminOrientation || 
        (newOrientation !== 'LANDSCAPE' && newOrientation !== 'PORTRAIT')) {
      return;
    }
    
    logger.info('OrientationContext: Setting admin orientation', { 
      oldOrientation: adminOrientation, 
      newOrientation 
    });
    
    setAdminOrientation(newOrientation);
    
    // Store in local storage for persistence
    try {
      localStorage.setItem(ORIENTATION_STORAGE_KEY, newOrientation);
    } catch (error) {
      console.error("Error saving orientation to storage:", error);
    }
  }, [adminOrientation]);

  // Initialize orientation event service when authenticated
  useEffect(() => {
    if (isAuthenticated && screenId) {
      logger.info('OrientationContext: Initializing orientation event service');
      
      // Set the current screen ID to filter events
      orientationEventService.setScreenId(screenId);
      
      // Use localhost:3000 for development (matching the working setup)
      const baseURL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
      
      // Try to get masjidId from localStorage if not already there
      if (!localStorage.getItem('masjidId')) {
        // Try to get masjidId from various storage locations
        const possibleMasjidIds = [
          localStorage.getItem('masjid_id'),
          localStorage.getItem('masjidId')
        ];
        
        // Use the first valid masjidId found
        const masjidId = possibleMasjidIds.find(id => id !== null);
        
        if (masjidId) {
          logger.info('OrientationContext: Found masjidId, storing for SSE connection', { masjidId });
          localStorage.setItem('masjidId', masjidId);
        } else {
          logger.warn('OrientationContext: No masjidId found for SSE connection');
        }
      }
      
      // Initialize the orientation event service
      orientationEventService.initialize(baseURL);

      // Set up listener for orientation updates
      const unsubscribe = orientationEventService.addListener((orientation, eventScreenId) => {
        logger.info('OrientationContext: Orientation updated from SSE', { 
          orientation,
          screenId: eventScreenId
        });
        
        // Add extra logging to debug orientation updates
        console.log(`⚠️ OrientationContext: Received orientation update from SSE: ${orientation} for screen ${eventScreenId}`);
        console.log(`⚠️ OrientationContext: Current adminOrientation: ${adminOrientation}, deviceOrientation: ${deviceOrientation}`);
        
        // Force update orientation from SSE event, bypassing the usual checks
        // This ensures the SSE event always takes precedence
        if (orientation && (orientation === 'LANDSCAPE' || orientation === 'PORTRAIT')) {
          console.log(`⚠️ OrientationContext: Forcing orientation update to ${orientation}`);
          
          // Update state directly first
          setAdminOrientation(orientation);
          
          // Then update localStorage directly to ensure it's saved
          try {
            localStorage.setItem(ORIENTATION_STORAGE_KEY, orientation);
            // Also update the timestamp for when we last processed an SSE event
            localStorage.setItem('last_orientation_sse_event', Date.now().toString());
            console.log(`✅ OrientationContext: Updated localStorage with new orientation: ${orientation}`);
          } catch (error) {
            console.error("❌ OrientationContext: Error saving orientation to storage:", error);
          }
        } else {
          console.error(`❌ OrientationContext: Invalid orientation value from SSE: ${orientation}`);
        }
      });

      // Clean up on unmount
      return () => {
        logger.info('OrientationContext: Cleaning up orientation event service');
        unsubscribe();
        orientationEventService.cleanup();
      };
    }
  }, [isAuthenticated, screenId, handleSetAdminOrientation]);

  // Function to check if the requested orientation matches the current effective orientation
  const isOrientationMatching = useCallback((requestedOrientation: Orientation): boolean => {
    const currentOrientation = isAuthenticated && adminOrientation ? adminOrientation : 
                              !isAuthenticated ? 'LANDSCAPE' : deviceOrientation;
    return currentOrientation === requestedOrientation;
  }, [isAuthenticated, adminOrientation, deviceOrientation]);

  // Add effect to log when adminOrientation changes
  useEffect(() => {
    if (adminOrientation) {
      console.log(`🔄 OrientationContext: adminOrientation state updated to: ${adminOrientation}`);
      
      // Double check localStorage matches our state
      const storedOrientation = localStorage.getItem(ORIENTATION_STORAGE_KEY);
      if (storedOrientation !== adminOrientation) {
        console.warn(`⚠️ OrientationContext: localStorage (${storedOrientation}) doesn't match state (${adminOrientation}), updating localStorage`);
        localStorage.setItem(ORIENTATION_STORAGE_KEY, adminOrientation);
      }
    }
  }, [adminOrientation]);

  // The effective orientation is the admin-set orientation if authenticated,
  // otherwise use device orientation (pairing screen always uses LANDSCAPE)
  const orientation = useMemo(() => {
    return isAuthenticated && adminOrientation ? adminOrientation : 
           !isAuthenticated ? 'LANDSCAPE' : deviceOrientation;
  }, [isAuthenticated, adminOrientation, deviceOrientation]);
  
  // Create a memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    orientation, 
    setAdminOrientation: handleSetAdminOrientation,
    deviceOrientation,
    isOrientationMatching
  }), [orientation, handleSetAdminOrientation, deviceOrientation, isOrientationMatching]);

  return (
    <OrientationContext.Provider value={contextValue}>
      {children}
    </OrientationContext.Provider>
  );
};

export const useOrientation = (): OrientationContextType => {
  const context = useContext(OrientationContext);
  if (context === undefined) {
    throw new Error('useOrientation must be used within an OrientationProvider');
  }
  return context;
}; 