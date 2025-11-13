import { Middleware, MiddlewareAPI, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '../index';
import orientationEventService from '../../services/orientationEventService';
import { setOrientation } from '../slices/uiSlice';
import { selectIsAuthenticated } from '../slices/authSlice';
import logger from '../../utils/logger';

// Track if we've set up listeners to avoid duplicates
let listenersSetup = false;

/**
 * Orientation middleware handles SSE connections and orientation updates
 */
export const orientationMiddleware: Middleware = (api: any) => {
  
  // Set up orientation service listeners
  const setupOrientationListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;
    
    logger.debug('[OrientationMiddleware] Setting up orientation service listeners');
    
    // Listen for orientation changes from the service
    orientationEventService.addListener((orientation, screenId) => {
      logger.debug('[OrientationMiddleware] Orientation change received from service', { 
        orientation, 
        screenId 
      });
      console.log(`🔄 OrientationMiddleware: Orientation changed to ${orientation} for screen ${screenId}`);
      
      // Dispatch Redux action to update orientation state
      api.dispatch(setOrientation(orientation));
    });
  };
  
  // Set up listeners once
  setupOrientationListeners();
  
  return (next) => (action: any) => {
    const result = next(action);
    const state = api.getState();
    
    // Handle specific actions
    switch (action.type) {
      case 'auth/initializeFromStorage/fulfilled':
      case 'auth/checkPairingStatus/fulfilled': {
        // When authentication is successful, initialize orientation service
        const isAuthenticated = selectIsAuthenticated(state);
        
        if (isAuthenticated) {
          // Check if credentials are in localStorage
          const screenId = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
          
          if (screenId) {
            // Set screen ID in the service
            orientationEventService.setScreenId(screenId);
            
            const baseURL = process.env.NODE_ENV === 'development' 
              ? 'http://localhost:3000' 
              : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
            
            logger.debug('[OrientationMiddleware] Authentication successful with credentials, initializing orientation service', {
              screenId,
              baseURL
            });
            console.log(`🔄 OrientationMiddleware: Initializing orientation service for screen ${screenId}`);
            
            // Initialize the orientation service
            orientationEventService.initialize(baseURL);
            
            // Load saved orientation from localStorage and update Redux if available
            try {
              const savedOrientation = localStorage.getItem('screen_orientation');
              if (savedOrientation === 'LANDSCAPE' || savedOrientation === 'PORTRAIT') {
                logger.debug('[OrientationMiddleware] Loading saved orientation from localStorage', {
                  orientation: savedOrientation
                });
                api.dispatch(setOrientation(savedOrientation as 'LANDSCAPE' | 'PORTRAIT'));
              }
            } catch (error) {
              logger.warn('[OrientationMiddleware] Could not load saved orientation', { error });
            }
          } else {
            logger.warn('[OrientationMiddleware] Authentication successful but no screen ID found, delaying orientation service initialization');
            // Retry after a short delay to allow credentials to be stored
            setTimeout(() => {
              const screenIdNow = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
              if (screenIdNow) {
                orientationEventService.setScreenId(screenIdNow);
                
                const baseURL = process.env.NODE_ENV === 'development' 
                  ? 'http://localhost:3000' 
                  : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
                
                logger.debug('[OrientationMiddleware] Screen ID now available, initializing orientation service');
                console.log(`🔄 OrientationMiddleware: Initializing orientation service for screen ${screenIdNow}`);
                orientationEventService.initialize(baseURL);
                
                // Load saved orientation
                try {
                  const savedOrientation = localStorage.getItem('screen_orientation');
                  if (savedOrientation === 'LANDSCAPE' || savedOrientation === 'PORTRAIT') {
                    api.dispatch(setOrientation(savedOrientation as 'LANDSCAPE' | 'PORTRAIT'));
                  }
                } catch (error) {
                  logger.warn('[OrientationMiddleware] Could not load saved orientation', { error });
                }
              }
            }, 1000);
          }
        }
        break;
      }
      
      case 'auth/logout': {
        // When logging out, cleanup orientation service
        logger.debug('[OrientationMiddleware] Logout detected, cleaning up orientation service');
        orientationEventService.cleanup();
        break;
      }
      
      case 'ui/setOffline': {
        // Handle offline/online status changes
        const isOffline = action.payload;
        
        if (!isOffline) {
          // Coming back online - reinitialize if needed
          logger.debug('[OrientationMiddleware] Device came back online');
          
          const isAuthenticated = selectIsAuthenticated(state);
          
          if (isAuthenticated) {
            const screenId = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
            
            if (screenId) {
              // Small delay to ensure network is stable
              setTimeout(() => {
                logger.debug('[OrientationMiddleware] Reinitializing orientation service after coming online');
                orientationEventService.setScreenId(screenId);
                
                const baseURL = process.env.NODE_ENV === 'development' 
                  ? 'http://localhost:3000' 
                  : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
                
                orientationEventService.initialize(baseURL);
              }, 2000);
            }
          }
        }
        break;
      }
    }
    
    return result;
  };
};

// Cleanup function for the middleware
export const cleanupOrientationMiddleware = () => {
  // Reset listeners flag so they can be set up again if needed
  listenersSetup = false;
  
  logger.debug('[OrientationMiddleware] Cleaned up');
};

