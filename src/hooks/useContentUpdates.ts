import { useEffect, useCallback, useState, useRef } from 'react';
import { useContent } from '../contexts/ContentContext';
import dataSyncService from '../services/dataSyncService';
import logger from '../utils/logger';

/**
 * Hook to manage content updates and refresh the UI when needed
 */
const useContentUpdates = (pollingInterval: number = 60000) => {
  const { 
    refreshContent, 
    refreshPrayerTimes, 
    refreshSchedule,
    lastUpdated
  } = useContent();
  
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const pollingIntervalRef = useRef<number | null>(null);
  const isRefreshingRef = useRef<boolean>(false);

  // Force content refresh
  const forceRefresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      logger.debug('Already refreshing content, skipping duplicate refresh');
      return;
    }

    isRefreshingRef.current = true;
    logger.info('Forcing content refresh');
    
    try {
      // Use dataSyncService to sync all data and force a refresh
      await dataSyncService.syncAllData(true);
      
      // After sync, refresh the UI with the new data
      await refreshContent(true);
      await refreshPrayerTimes();
      await refreshSchedule(true);
      
      setLastRefreshTime(Date.now());
    } catch (error) {
      logger.error('Error during force refresh:', { error });
    } finally {
      isRefreshingRef.current = false;
    }
  }, [refreshContent, refreshPrayerTimes, refreshSchedule]);

  // Setup regular polling for content updates
  useEffect(() => {
    const startPolling = () => {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current);
      }
      
      // Set up new interval for content refreshes
      pollingIntervalRef.current = window.setInterval(() => {
        logger.debug('Running scheduled content refresh');
        forceRefresh();
      }, pollingInterval);
      
      logger.info(`Content update polling started with interval: ${pollingInterval}ms`);
    };

    // Start polling
    startPolling();

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current);
      }
    };
  }, [forceRefresh, pollingInterval]);

  // Watch for online/offline status changes
  useEffect(() => {
    const handleOnline = () => {
      logger.info('Network connection restored, refreshing content');
      forceRefresh();
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [forceRefresh]);

  return {
    forceRefresh,
    lastRefreshTime
  };
};

export default useContentUpdates; 