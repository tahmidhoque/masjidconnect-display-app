import { useEffect, useRef, useCallback } from 'react';
import { useContent } from '../contexts/ContentContext';
import logger from '../utils/logger';

/**
 * Custom hook to handle kiosk mode-specific behaviors
 * 
 * This hook ensures that an Electron app running in kiosk mode stays responsive
 * and refreshes content automatically, even when there's no user interaction.
 */
export const useKioskMode = () => {
  const { refreshPrayerTimes, refreshContent, prayerTimes } = useContent();
  const lastRefreshTimeRef = useRef<number>(Date.now());
  
  // Track initialization state
  const initializedRef = useRef<boolean>(false);
  
  // Function to refresh all data
  const refreshData = useCallback(async () => {
    try {
      logger.info('[KioskMode] Refreshing data...');
      await Promise.all([
        refreshPrayerTimes(),
        refreshContent(true) // Force refresh content
      ]);
      logger.info('[KioskMode] Data refreshed successfully');
      lastRefreshTimeRef.current = Date.now();
    } catch (error) {
      logger.error('[KioskMode] Error refreshing data:', error as Record<string, any>);
    }
  }, [refreshPrayerTimes, refreshContent]);

  // Handle visibility change (tab focus/blur)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      logger.info('[KioskMode] App became visible, refreshing data...');
      refreshData();
    }
  }, [refreshData]);

  // Initial setup effect
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    logger.info('[KioskMode] Setting up kiosk mode behaviors');
    
    // Add event listeners for visibility and focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshData);
    
    // Initial refresh
    refreshData();
    
    // Set up a backup polling mechanism
    // This will check every minute if we haven't refreshed in 5 minutes
    const backupInterval = setInterval(() => {
      const fiveMinutesMs = 5 * 60 * 1000;
      const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current;
      
      if (timeSinceLastRefresh > fiveMinutesMs) {
        logger.info('[KioskMode] Backup polling: No refresh in 5 minutes, triggering refresh');
        refreshData();
      }
    }, 60 * 1000); // Check every minute
    
    // For Electron kiosk mode where visibility might not change,
    // simulate a visibility change every 15 minutes to force refresh
    const kioskRefreshInterval = setInterval(() => {
      logger.info('[KioskMode] Periodic kiosk refresh triggered');
      refreshData();
    }, 15 * 60 * 1000); // Every 15 minutes
    
    return () => {
      // Clean up all event listeners and intervals
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshData);
      clearInterval(backupInterval);
      clearInterval(kioskRefreshInterval);
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