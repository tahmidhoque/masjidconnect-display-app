import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

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
  const { isAuthenticated } = useAuth();

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
    // Only update if orientation actually changed
    if (newOrientation === adminOrientation) return;
    
    setAdminOrientation(newOrientation);
    
    // Store in local storage for persistence
    try {
      localStorage.setItem(ORIENTATION_STORAGE_KEY, newOrientation);
    } catch (error) {
      console.error("Error saving orientation to storage:", error);
    }
  }, [adminOrientation]);

  // Function to check if the requested orientation matches the current effective orientation
  const isOrientationMatching = useCallback((requestedOrientation: Orientation): boolean => {
    const currentOrientation = isAuthenticated && adminOrientation ? adminOrientation : 
                              !isAuthenticated ? 'LANDSCAPE' : deviceOrientation;
    return currentOrientation === requestedOrientation;
  }, [isAuthenticated, adminOrientation, deviceOrientation]);

  // The effective orientation is the admin-set orientation if authenticated,
  // otherwise use device orientation (pairing screen always uses LANDSCAPE)
  const orientation = useMemo(() => {
    return isAuthenticated && adminOrientation ? adminOrientation : 
           !isAuthenticated ? 'LANDSCAPE' : deviceOrientation;
  }, [isAuthenticated, adminOrientation, deviceOrientation]);
  
  // Remove the debug logging useEffect to reduce console spam
  
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