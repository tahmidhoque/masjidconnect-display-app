import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ScreenContent, PrayerTimes, PrayerStatus, Event, Schedule } from '../api/models';
import masjidDisplayClient from '../api/masjidDisplayClient';
import storageService from '../services/storageService';
import dataSyncService from '../services/dataSyncService';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';

interface ContentContextType {
  isLoading: boolean;
  screenContent: ScreenContent | null;
  prayerTimes: PrayerTimes | null;
  prayerStatus: PrayerStatus | null;
  schedule: Schedule | null;
  events: Event[] | null;
  masjidName: string | null;
  masjidTimezone: string | null;
  refreshContent: (forceRefresh?: boolean) => Promise<void>;
  refreshPrayerStatus: () => Promise<void>;
  refreshPrayerTimes: () => Promise<void>;
  lastUpdated: Date | null;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

interface ContentProviderProps {
  children: ReactNode;
}

export const ContentProvider: React.FC<ContentProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [screenContent, setScreenContent] = useState<ScreenContent | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [prayerStatus, setPrayerStatus] = useState<PrayerStatus | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [masjidName, setMasjidName] = useState<string | null>(null);
  const [masjidTimezone, setMasjidTimezone] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const MIN_REFRESH_INTERVAL = 5000; // 5 seconds

  useEffect(() => {
    if (isAuthenticated) {
      // First, invalidate all caches to ensure fresh data
      masjidDisplayClient.invalidateAllCaches();
      
      // Initialize data sync service
      dataSyncService.initialize();
      
      // Load content
      loadContent();
    }

    // Cleanup on unmount
    return () => {
      dataSyncService.cleanup();
    };
  }, [isAuthenticated]);

  const loadContent = async (): Promise<void> => {
    setIsLoading(true);

    try {
      logger.info("ContentContext: Loading initial content");
      
      // First try to load from storage
      const storedContent = await storageService.getScreenContent();
      if (storedContent) {
        processScreenContent(storedContent);
        logger.info("ContentContext: Loaded content from storage");
      }

      // Always try to fetch fresh data when app loads
      if (navigator.onLine) {
        logger.info("ContentContext: Fetching fresh data on startup");
        // Force fetch to skip cache
        await refreshContent(true);
      }
    } catch (error) {
      console.error('Error loading content:', error);
      logger.error("ContentContext: Error loading initial content", { error });
    } finally {
      // Ensure loading state is set to false even if there are errors
      setIsLoading(false);
    }
  };

  const refreshContent = async (forceRefresh: boolean = false): Promise<void> => {
    if (!isAuthenticated) {
      logger.warn("ContentContext: Not authenticated, skipping refresh");
      return;
    }

    // Implement throttling to prevent infinite loops
    const now = Date.now();
    if (now - lastRefreshTime < MIN_REFRESH_INTERVAL && !forceRefresh) {
      logger.debug("ContentContext: Throttling refresh - too frequent calls");
      return;
    }
    
    setLastRefreshTime(now);

    try {
      logger.info("ContentContext: Starting content refresh", { forceRefresh });
      
      // Ensure we're syncing all data from the server
      await dataSyncService.syncAllData(forceRefresh);
      
      // Load updated content from storage
      const updatedContent = await storageService.getScreenContent();
      if (updatedContent) {
        logger.info("ContentContext: Processing updated screen content");
        processScreenContent(updatedContent);
      } else {
        logger.warn("ContentContext: No updated content found in storage after sync");
      }
      
      // Also refresh prayer status and events
      const updatedPrayerStatus = await storageService.getPrayerStatus();
      if (updatedPrayerStatus) {
        setPrayerStatus(updatedPrayerStatus);
      }
      
      const updatedEvents = await storageService.getEvents();
      if (updatedEvents) {
        setEvents(updatedEvents);
      }
      
      // Update last updated time
      setLastUpdated(new Date());
      logger.info("ContentContext: Content refresh completed successfully");
    } catch (error) {
      console.error('Error refreshing content:', error);
      logger.error("ContentContext: Error refreshing content", { error });
    }
  };

  const processScreenContent = (content: ScreenContent): void => {
    setScreenContent(content);
    setPrayerTimes(content.prayerTimes);
    setSchedule(content.schedule);
    
    if (content.masjid) {
      setMasjidName(content.masjid.name);
      setMasjidTimezone(content.masjid.timezone);
    }
  };

  useEffect(() => {
    // Load stored prayer status and events
    const loadAdditionalData = async (): Promise<void> => {
      try {
        const storedPrayerStatus = await storageService.getPrayerStatus();
        if (storedPrayerStatus) {
          setPrayerStatus(storedPrayerStatus);
        }

        const storedEvents = await storageService.getEvents();
        if (storedEvents) {
          setEvents(storedEvents);
        }
      } catch (error) {
        console.error('Error loading additional data:', error);
      }
    };

    loadAdditionalData();
  }, []);

  // Add refreshPrayerStatus method
  const refreshPrayerStatus = async (): Promise<void> => {
    if (!isAuthenticated) return;

    // Implement throttling
    const now = Date.now();
    const lastPrayerStatusRefresh = lastRefreshTime;
    if (now - lastPrayerStatusRefresh < MIN_REFRESH_INTERVAL) {
      logger.debug("ContentContext: Throttling prayer status refresh - too frequent calls");
      return;
    }

    try {
      logger.info("ContentContext: Refreshing prayer status");
      
      // Trigger prayer status sync with force refresh
      await dataSyncService.syncPrayerStatus(true);
      
      // Get updated prayer status from storage
      const updatedPrayerStatus = await storageService.getPrayerStatus();
      if (updatedPrayerStatus) {
        setPrayerStatus(updatedPrayerStatus);
        logger.info("ContentContext: Prayer status refreshed successfully");
      } else {
        logger.warn("ContentContext: No updated prayer status found in storage after sync");
      }
    } catch (error) {
      console.error('Error refreshing prayer status:', error);
      logger.error("ContentContext: Error refreshing prayer status", { error });
    }
  };

  // Add refreshPrayerTimes method
  const refreshPrayerTimes = async (): Promise<void> => {
    if (!isAuthenticated) return;

    // Implement throttling
    const now = Date.now();
    const lastPrayerTimesRefresh = lastRefreshTime;
    if (now - lastPrayerTimesRefresh < MIN_REFRESH_INTERVAL) {
      logger.debug("ContentContext: Throttling prayer times refresh - too frequent calls");
      return;
    }

    try {
      logger.info("ContentContext: Refreshing prayer times");
      
      // Trigger prayer times sync with force refresh
      await dataSyncService.syncPrayerTimes(true);
      
      // Get updated prayer times from storage
      const updatedContent = await storageService.getScreenContent();
      if (updatedContent && updatedContent.prayerTimes) {
        setPrayerTimes(updatedContent.prayerTimes);
        logger.info("ContentContext: Prayer times refreshed successfully");
      } else {
        logger.warn("ContentContext: No updated prayer times found in storage after sync");
      }
    } catch (error) {
      console.error('Error refreshing prayer times:', error);
      logger.error("ContentContext: Error refreshing prayer times", { error });
    }
  };

  return (
    <ContentContext.Provider
      value={{
        isLoading,
        screenContent,
        prayerTimes,
        prayerStatus,
        schedule,
        events,
        masjidName,
        masjidTimezone,
        refreshContent,
        refreshPrayerStatus,
        refreshPrayerTimes,
        lastUpdated,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
};

export const useContent = (): ContentContextType => {
  const context = useContext(ContentContext);
  if (context === undefined) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
}; 