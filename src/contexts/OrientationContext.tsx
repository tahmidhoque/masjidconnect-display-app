import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const getStoredOrientation = (): Orientation | null => {
    try {
      const stored = localStorage.getItem(ORIENTATION_STORAGE_KEY);
      return (stored === 'LANDSCAPE' || stored === 'PORTRAIT') ? stored : null;
    } catch (error) {
      console.error("Error reading orientation from storage:", error);
      return null;
    }
  };
  
  // Track both admin-set orientation and device orientation
  const [adminOrientation, setAdminOrientation] = useState<Orientation | null>(getStoredOrientation());
  const [deviceOrientation, setDeviceOrientation] = useState<Orientation>(
    window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'
  );
  const { isAuthenticated } = useAuth();

  // Update device orientation based on screen dimensions
  useEffect(() => {
    const handleResize = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setDeviceOrientation(isPortrait ? 'PORTRAIT' : 'LANDSCAPE');
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Initial check
    handleResize();

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Save admin orientation to storage when it changes
  const handleSetAdminOrientation = (newOrientation: Orientation) => {
    console.log("OrientationContext: Setting admin orientation to:", newOrientation);
    setAdminOrientation(newOrientation);
    
    // Store in local storage for persistence
    try {
      localStorage.setItem(ORIENTATION_STORAGE_KEY, newOrientation);
    } catch (error) {
      console.error("Error saving orientation to storage:", error);
    }
  };

  // Function to check if the requested orientation matches the current effective orientation
  const isOrientationMatching = (requestedOrientation: Orientation): boolean => {
    const currentOrientation = isAuthenticated && adminOrientation ? adminOrientation : 
                              !isAuthenticated ? 'LANDSCAPE' : deviceOrientation;
    return currentOrientation === requestedOrientation;
  };

  // The effective orientation is the admin-set orientation if authenticated,
  // otherwise use device orientation (pairing screen always uses LANDSCAPE)
  const orientation = isAuthenticated && adminOrientation ? adminOrientation : 
                      !isAuthenticated ? 'LANDSCAPE' : deviceOrientation;
                      
  // Log orientation for debugging
  useEffect(() => {
    console.log("OrientationContext: Current orientation:", {
      orientation,
      adminOrientation,
      deviceOrientation,
      isAuthenticated
    });
  }, [orientation, adminOrientation, deviceOrientation, isAuthenticated]);

  return (
    <OrientationContext.Provider 
      value={{ 
        orientation, 
        setAdminOrientation: handleSetAdminOrientation,
        deviceOrientation,
        isOrientationMatching
      }}
    >
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