import { useEffect, useRef, useCallback } from 'react';
import { useContent } from '../contexts/ContentContext';
import logger from '../utils/logger';

/**
 * Custom hook to handle kiosk mode-specific behaviors
 * 
 * Optimized for Raspberry Pi stability - reduces memory usage and prevents
 * excessive refreshes that can cause app restarts.
 */
export const useKioskMode = () => {
  const { refreshPrayerTimes, refreshContent, prayerTimes } = useContent();
  const lastRefreshTimeRef = useRef<number>(Date.now());
  
  // Track initialization state
  const initializedRef = useRef<boolean>(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dataRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to refresh all data - optimized for RPi stability
  const refreshData = useCallback(async () => {
    try {
      const currentTime = Date.now();
      const timeSinceLastRefresh = currentTime - lastRefreshTimeRef.current;
      
      // Increased minimum refresh interval for RPi stability (5 minutes instead of 2)
      if (timeSinceLastRefresh < 5 * 60 * 1000) {
        logger.debug('[KioskMode] Skipping refresh - last refresh was less than 5 minutes ago');
        return;
      }
      
      logger.info('[KioskMode] Refreshing data gently...');
      
      // Only refresh prayer times to reduce memory usage and prevent instability
      // Content refresh is more resource-intensive and can cause issues on RPi
      try {
        await refreshPrayerTimes();
        logger.info('[KioskMode] Prayer times refreshed successfully');
        lastRefreshTimeRef.current = currentTime;
      } catch (error) {
        logger.error('[KioskMode] Failed to refresh prayer times:', error);
        // Don't update timestamp on failure to allow retry
      }
      
    } catch (error) {
      logger.error('[KioskMode] Error in refresh data function:', error as Record<string, any>);
    }
  }, [refreshPrayerTimes]);

  // Simplified visibility change handler
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      logger.info('[KioskMode] App became visible, scheduling gentle refresh...');
      
      // Clear any existing timeout to prevent duplicate refreshes
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      // Longer delay to prevent immediate flash and reduce stress on RPi
      refreshTimeoutRef.current = setTimeout(() => {
        refreshData();
        refreshTimeoutRef.current = null;
      }, 3000); // Increased from 2000ms
    }
  }, [refreshData]);

  // Clean up function
  const cleanup = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (backupIntervalRef.current) {
      clearInterval(backupIntervalRef.current);
      backupIntervalRef.current = null;
    }
    if (dataRefreshIntervalRef.current) {
      clearInterval(dataRefreshIntervalRef.current);
      dataRefreshIntervalRef.current = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleVisibilityChange]);

  // Initial setup effect - optimized for RPi
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    logger.info('[KioskMode] Setting up optimized kiosk mode for RPi');
    
    // Add event listeners for visibility and focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial refresh with longer delay to allow app to stabilize
    setTimeout(() => {
      refreshData();
    }, 10000); // Increased from 5000ms
    
    // Set up a backup polling mechanism with longer intervals for RPi stability
    // Check every 20 minutes if we haven't refreshed in 1 hour
    backupIntervalRef.current = setInterval(() => {
      const oneHourMs = 60 * 60 * 1000;
      const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current;
      
      if (timeSinceLastRefresh > oneHourMs) {
        logger.info('[KioskMode] Backup polling: No refresh in 1 hour, triggering refresh');
        refreshData();
      }
    }, 20 * 60 * 1000); // Check every 20 minutes instead of 10
    
    // For data updates, use much longer interval to reduce RPi stress
    dataRefreshIntervalRef.current = setInterval(() => {
      logger.info('[KioskMode] Periodic data refresh triggered');
      refreshData();
    }, 60 * 60 * 1000); // Every 1 hour instead of 30 minutes
    
    // Set up cleanup on unmount
    return cleanup;
  }, [refreshData, handleVisibilityChange, cleanup]);
  
  // Simplified effect to track prayer times changes
  useEffect(() => {
    if (prayerTimes) {
      lastRefreshTimeRef.current = Date.now();
    }
  }, [prayerTimes]);
  
  // Clean up on component unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return {
    refreshData,
    lastRefreshTime: lastRefreshTimeRef.current
  };
};

export default useKioskMode; 