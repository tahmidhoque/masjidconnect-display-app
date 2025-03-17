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
  refreshContent: () => Promise<void>;
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

  useEffect(() => {
    if (isAuthenticated) {
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
      // First try to load from storage
      const storedContent = await storageService.getScreenContent();
      if (storedContent) {
        processScreenContent(storedContent);
      }

      // Then try to fetch fresh data
      if (navigator.onLine) {
        await refreshContent();
      }
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshContent = async (): Promise<void> => {
    if (!isAuthenticated) return;

    try {
      logger.info("ContentContext: Starting content refresh");
      
      // Ensure we're syncing all data from the server
      await dataSyncService.syncAllData();
      
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