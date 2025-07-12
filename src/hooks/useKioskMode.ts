import { useEffect, useRef, useCallback } from 'react';
import { useContent } from '../contexts/ContentContext';
import logger from '../utils/logger';

/**
 * Custom hook to handle kiosk mode-specific behaviors
 * 
 * This hook ensures that an Electron app running in kiosk mode stays responsive
 * and refreshes content periodically, but avoids unnecessary refreshes that cause flashing.
 */
export const useKioskMode = () => {
  const { refreshPrayerTimes, refreshContent, prayerTimes } = useContent();
  const lastRefreshTimeRef = useRef<number>(Date.now());
  
  // Track initialization state
  const initializedRef = useRef<boolean>(false);
  
  // Function to refresh all data - with smoother refresh to avoid flashing
  const refreshData = useCallback(async () => {
    try {
      const currentTime = Date.now();
      const timeSinceLastRefresh = currentTime - lastRefreshTimeRef.current;
      
      // Don't refresh if it's been less than 2 minutes since last refresh
      if (timeSinceLastRefresh < 2 * 60 * 1000) {
        logger.info('[KioskMode] Skipping refresh - last refresh was less than 2 minutes ago');
        return;
      }
      
      logger.info('[KioskMode] Refreshing data gently...');
      
      // Stagger the refreshes to prevent both happening at once, which causes flashing
      // First refresh prayer times
      await refreshPrayerTimes();
      
      // Wait a moment before refreshing content
      setTimeout(async () => {
        // Use regular refresh instead of force refresh to avoid full remount
        await refreshContent(false);
        logger.info('[KioskMode] Data refreshed successfully');
      }, 5000);
      
      lastRefreshTimeRef.current = currentTime;
    } catch (error) {
      logger.error('[KioskMode] Error refreshing data:', error as Record<string, any>);
    }
  }, [refreshPrayerTimes, refreshContent]);

  // Handle visibility change (tab focus/blur)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      logger.info('[KioskMode] App became visible, scheduling refresh...');
      // Delay refresh slightly to prevent immediate flash when switching tabs
      setTimeout(() => {
        refreshData();
      }, 2000);
    }
  }, [refreshData]);

  // Initial setup effect
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    logger.info('[KioskMode] Setting up kiosk mode behaviors');
    
    // Add event listeners for visibility and focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial refresh with a slight delay
    setTimeout(() => {
      refreshData();
    }, 5000);
    
    // Set up a backup polling mechanism
    // This will check every 10 minutes if we haven't refreshed in 30 minutes
    const backupInterval = setInterval(() => {
      const thirtyMinutesMs = 30 * 60 * 1000;
      const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current;
      
      if (timeSinceLastRefresh > thirtyMinutesMs) {
        logger.info('[KioskMode] Backup polling: No refresh in 30 minutes, triggering refresh');
        refreshData();
      }
    }, 10 * 60 * 1000); // Check every 10 minutes
    
    // For data updates, use smaller interval but don't reload the page
    const dataRefreshInterval = setInterval(() => {
      logger.info('[KioskMode] Periodic data refresh triggered');
      refreshData();
    }, 30 * 60 * 1000); // Every 30 minutes
    
    return () => {
      // Clean up all event listeners and intervals
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(backupInterval);
      clearInterval(dataRefreshInterval);
    };
  }, [refreshData, handleVisibilityChange]);
  
  // Effect to track prayer times changes and update refresh timestamp
  useEffect(() => {
    if (prayerTimes) {
      lastRefreshTimeRef.current = Date.now();
    }
  }, [prayerTimes]);
  
  return {
    refreshData,
    lastRefreshTime: lastRefreshTimeRef.current
  };
};

export default useKioskMode; 