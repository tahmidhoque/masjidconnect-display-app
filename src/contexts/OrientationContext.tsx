import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { setOrientation, Orientation } from '../store/slices/uiSlice';
import logger from '../utils/logger';

interface OrientationContextType {
  orientation: Orientation;
  isChanging: boolean;
}

const OrientationContext = createContext<OrientationContextType>({
  orientation: 'LANDSCAPE',
  isChanging: false,
});

interface OrientationProviderProps {
  children: React.ReactNode;
}

/**
 * Orientation Provider component
 * 
 * Provides orientation state and transition tracking to React components.
 * Listens to Redux orientation changes and custom events from the orientation service.
 */
export function OrientationProvider({ children }: OrientationProviderProps) {
  const dispatch = useDispatch<AppDispatch>();
  
  // Get orientation from Redux store
  const reduxOrientation = useSelector((state: RootState) => state.ui.orientation);
  
  // Local state for orientation and transition tracking
  const [orientation, setLocalOrientation] = useState<Orientation>(
    (localStorage.getItem('screen_orientation') as Orientation) || reduxOrientation || 'LANDSCAPE'
  );
  const [isChanging, setIsChanging] = useState(false);
  
  // Handle orientation change with transition animation
  const handleOrientationChange = useCallback((newOrientation: Orientation) => {
    if (newOrientation === orientation) {
      // No change needed
      return;
    }
    
    logger.debug('[OrientationContext] Orientation change detected', {
      from: orientation,
      to: newOrientation
    });
    console.log(`🔄 OrientationContext: Changing from ${orientation} to ${newOrientation}`);
    
    // Set changing state for animation
    setIsChanging(true);
    
    // Update local orientation state
    setLocalOrientation(newOrientation);
    
    // Update Redux store
    dispatch(setOrientation(newOrientation));
    
    // Clear changing state after animation duration (300ms)
    setTimeout(() => {
      setIsChanging(false);
      logger.debug('[OrientationContext] Orientation change animation complete');
    }, 300);
  }, [orientation, dispatch]);
  
  // Listen to Redux orientation changes
  useEffect(() => {
    if (reduxOrientation && reduxOrientation !== orientation) {
      handleOrientationChange(reduxOrientation);
    }
  }, [reduxOrientation, orientation, handleOrientationChange]);
  
  // Listen to custom events from orientation service
  useEffect(() => {
    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        orientation: Orientation;
        screenId: string;
        timestamp: number;
      }>;
      
      if (customEvent.detail && customEvent.detail.orientation) {
        const newOrientation = customEvent.detail.orientation;
        if (newOrientation !== orientation) {
          handleOrientationChange(newOrientation);
        }
      }
    };
    
    window.addEventListener('orientation-changed', handleCustomEvent as EventListener);
    
    return () => {
      window.removeEventListener('orientation-changed', handleCustomEvent as EventListener);
    };
  }, [orientation, handleOrientationChange]);
  
  // Initialise orientation from localStorage on mount
  useEffect(() => {
    try {
      const savedOrientation = localStorage.getItem('screen_orientation');
      if (savedOrientation === 'LANDSCAPE' || savedOrientation === 'PORTRAIT') {
        const saved = savedOrientation as Orientation;
        if (saved !== orientation) {
          setLocalOrientation(saved);
          dispatch(setOrientation(saved));
        }
      }
    } catch (error) {
      logger.warn('[OrientationContext] Could not load saved orientation from localStorage', { error });
    }
  }, [dispatch, orientation]); // Only run on mount
  
  const contextValue: OrientationContextType = {
    orientation,
    isChanging,
  };
  
  return (
    <OrientationContext.Provider value={contextValue}>
      {children}
    </OrientationContext.Provider>
  );
}

/**
 * Hook to access orientation context
 */
export const useOrientation = (): OrientationContextType => {
  const context = useContext(OrientationContext);
  if (!context) {
    logger.warn('[useOrientation] useOrientation must be used within OrientationProvider');
    // Return default values if context is not available
    return {
      orientation: 'LANDSCAPE',
      isChanging: false,
    };
  }
  return context;
};

export default OrientationContext;

