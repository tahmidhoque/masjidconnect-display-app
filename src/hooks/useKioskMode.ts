import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { refreshPrayerTimes, refreshContent } from '../store/slices/contentSlice';
import logger from '../utils/logger';

/**
 * Custom hook to handle kiosk mode-specific behaviors
 * 
 * CONSERVATIVE MODE: Designed to prevent rapid firing in Electron
 * Uses very infrequent updates to maintain stability
 */
export const useKioskMode = () => {
  const dispatch = useDispatch<AppDispatch>();
  const prayerTimes = useSelector((state: RootState) => state.content.prayerTimes);
  const lastRefreshTimeRef = useRef<number>(Date.now());
  
  // Track initialization state
  const initializedRef = useRef<boolean>(false);
  
  // Function to refresh all data - VERY CONSERVATIVE to prevent flashing
  const refreshData = useCallback(async () => {
    try {
      const currentTime = Date.now();
      const timeSinceLastRefresh = currentTime - lastRefreshTimeRef.current;
      
      // Don't refresh if it's been less than 10 minutes since last refresh (was 2 minutes)
      if (timeSinceLastRefresh < 10 * 60 * 1000) {
        logger.info('[KioskMode] Skipping refresh - last refresh was less than 10 minutes ago');
        return;
      }
      
      logger.info('[KioskMode] Refreshing data conservatively...');
      
      // Only refresh prayer times, let Redux handle content updates
      dispatch(refreshPrayerTimes());
      
      lastRefreshTimeRef.current = currentTime;
      logger.info('[KioskMode] Prayer times refreshed successfully');
    } catch (error) {
      logger.error('[KioskMode] Error refreshing data:', { error });
    }
  }, [dispatch]);

  // Handle visibility change (tab focus/blur) - DEBOUNCED
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      logger.info('[KioskMode] App became visible, scheduling conservative refresh...');
      // Much longer delay to prevent rapid firing (was 2 seconds, now 30 seconds)
      setTimeout(() => {
        refreshData();
      }, 30000);
    }
  }, [refreshData]);

  // Initial setup effect
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    logger.info('[KioskMode] Setting up CONSERVATIVE kiosk mode behaviors');
    
    // Add event listeners for visibility and focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial refresh with longer delay (was 5 seconds, now 2 minutes)
    setTimeout(() => {
      refreshData();
    }, 2 * 60 * 1000);
    
    // MUCH more conservative backup polling - every 2 hours instead of 10 minutes
    const backupInterval = setInterval(() => {
      const twoHoursMs = 2 * 60 * 60 * 1000; // 2 hours instead of 30 minutes
      const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current;
      
      if (timeSinceLastRefresh > twoHoursMs) {
        logger.info('[KioskMode] Backup polling: No refresh in 2 hours, triggering refresh');
        refreshData();
      }
    }, 60 * 60 * 1000); // Check every hour instead of every 10 minutes
    
    // REMOVE the frequent data refresh interval that was causing rapid firing
    // Redux will handle data updates through its own mechanisms
    
    return () => {
      // Clean up all event listeners and intervals
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(backupInterval);
      logger.info('[KioskMode] Cleaned up conservative kiosk mode');
    };
  }, [handleVisibilityChange, refreshData]);

  // Return the refresh function for manual use if needed
  return { refreshData };
};

export default useKioskMode; 