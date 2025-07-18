import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { ScreenContent, PrayerTimes, Event, Schedule } from '../api/models';
import masjidDisplayClient from '../api/masjidDisplayClient';
import { useAuth } from './AuthContext';
import dataSyncService from '../services/dataSyncService';
import storageService from '../services/storageService';
import logger from '../utils/logger';

// Constants
const MIN_REFRESH_INTERVAL = 10 * 1000; // 10 seconds
const SKIP_PRAYERS = ['Sunrise']; // Prayers to skip in announcements
const DEFAULT_MASJID_NAME = 'Masjid Connect'; // Default masjid name if none is found

// Define the ContentContext type
export interface ContentContextType {
  isLoading: boolean;
  screenContent: ScreenContent | null;
  prayerTimes: PrayerTimes | null;
  schedule: Schedule | null;
  events: Event[] | null;
  masjidName: string | null;
  masjidTimezone: string | null;
  refreshContent: (forceRefresh?: boolean) => Promise<void>;
  refreshPrayerTimes: () => Promise<void>;
  refreshSchedule: (forceRefresh?: boolean) => Promise<void>;
  lastUpdated: Date | null;
  carouselTime: number;
  setCarouselTime: (time: number) => void;
  showPrayerAnnouncement: boolean;
  prayerAnnouncementName: string;
  isPrayerJamaat: boolean;
  setPrayerAnnouncement: (show: boolean, prayerName?: string, isJamaat?: boolean) => void;
  setShowPrayerAnnouncement: (show: boolean) => void;
  setPrayerAnnouncementName: (name: string) => void;
  setIsPrayerJamaat: (isJamaat: boolean) => void;
}

interface ContentProviderProps {
  children: ReactNode;
}

// Create the Content Context
const ContentContext = createContext<ContentContextType | undefined>(undefined);

// Create a hook to use the Content Context
export const useContent = (): ContentContextType => {
  const context = useContext(ContentContext);
  if (context === undefined) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};

// Helper function to create a fallback schedule
const createFallbackSchedule = (): Schedule => {
  return {
    id: 'fallback-schedule',
    name: 'Default Schedule',
    items: []
  };
};

// Helper function to create fallback prayer times
const createFallbackPrayerTimes = (): PrayerTimes => {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    fajr: '05:00',
    sunrise: '06:30',
    zuhr: '12:00',
    asr: '15:30',
    maghrib: '18:00',
    isha: '19:30',
    fajrJamaat: '05:30',
    zuhrJamaat: '12:30',
    asrJamaat: '16:00',
    maghribJamaat: '18:10',
    ishaJamaat: '20:00'
  };
};

// Helper function to extract masjid name from various API response formats
const extractMasjidName = (content: ScreenContent): string | null => {
  // Try to find masjid name in all possible locations
  if (content?.masjid?.name) {
    return content.masjid.name;
  }
  
  if (content?.data?.masjid?.name) {
    return content.data.masjid.name;
  }
  
  if (content?.screen?.masjid?.name) {
    return content.screen.masjid.name;
  }
  
  if (content?.data?.screen?.masjid?.name) {
    return content.data.screen.masjid.name;
  }
  
  // Look in screen properties
  if (content?.screen?.name) {
    return content.screen.name;
  }
  
  // If nothing found, return default
  return DEFAULT_MASJID_NAME;
};

export const ContentProvider: React.FC<ContentProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [screenContent, setScreenContent] = useState<ScreenContent | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [masjidName, setMasjidName] = useState<string | null>(DEFAULT_MASJID_NAME);
  const [masjidTimezone, setMasjidTimezone] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [carouselTime, setCarouselTime] = useState<number>(30); // Default 30 seconds
  
  // Prayer announcement states
  const [showPrayerAnnouncement, setShowPrayerAnnouncement] = useState<boolean>(false);
  const [prayerAnnouncementName, setPrayerAnnouncementName] = useState<string>('');
  const [isPrayerJamaat, setIsPrayerJamaat] = useState<boolean>(false);
  
  // Use refs to track initialization and prevent unnecessary renders
  const initializedRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  const isUpdatingRef = useRef(false);

  // Normalize schedule data function - outside dependency cycle
  const normalizeScheduleData = useCallback((schedule: any): Schedule => {
    if (!schedule) return createFallbackSchedule();
    
    try {
      // Create a normalized structure
      const normalizedSchedule: Schedule = {
        id: schedule.id || 'normalized-schedule',
        name: schedule.name || 'Schedule',
        items: []
      };
      
      // Handle different schedule data formats
      if (Array.isArray(schedule)) {
        // Direct array of items
        normalizedSchedule.items = schedule;
      } else if ('data' in schedule && Array.isArray(schedule.data)) {
        // New API format with data array
        normalizedSchedule.items = schedule.data;
      } else if ('items' in schedule && Array.isArray(schedule.items)) {
        // Format with items property
        normalizedSchedule.items = schedule.items;
      } else {
        logger.error("ContentContext: Invalid schedule format", { schedule });
        return createFallbackSchedule();
      }
      
      // Normalize each item to ensure it has the required structure
      if (normalizedSchedule.items.length > 0) {
        normalizedSchedule.items = normalizedSchedule.items.map((item: any, index: number) => {
          // Check if this item has a contentItem
          if (item.contentItem && typeof item.contentItem === 'object') {
            // Already has contentItem, use as is but ensure it has all required fields
            return {
              id: item.id || `item-${index}`,
              order: typeof item.order === 'number' ? item.order : index,
              contentItem: {
                id: item.contentItem.id || `${item.id}-content`,
                type: item.contentItem.type || 'CUSTOM',
                title: item.contentItem.title || 'No Title',
                content: item.contentItem.content || {},
                duration: typeof item.contentItem.duration === 'number' ? item.contentItem.duration : 30
              }
            };
          } else {
            // API format has properties at top level, not under contentItem
            return {
              id: item.id || `item-${index}`,
              order: typeof item.order === 'number' ? item.order : index,
              contentItem: {
                id: `${item.id || index}-content`,
                type: item.type || 'CUSTOM',
                title: item.title || 'No Title',
                content: item.content || {},
                duration: typeof item.duration === 'number' ? item.duration : 30
              }
            };
          }
        });
      }
      
      return normalizedSchedule;
    } catch (error) {
      logger.error("ContentContext: Error normalizing schedule data", { error });
      return createFallbackSchedule();
    }
  }, []);

  // Memoize processScreenContent to avoid dependency issues
  const processScreenContent = useCallback((content: ScreenContent): void => {
    if (!content) {
      logger.error("ContentContext: processScreenContent called with null content");
      return;
    }
    
    logger.debug("ContentContext: Processing screen content", { 
      hasScreen: !!content.screen,
      hasMasjid: !!content.masjid,
      hasDataMasjid: !!(content.data && content.data.masjid),
      hasPrayerTimes: !!content.prayerTimes,
      hasSchedule: !!content.schedule,
      hasEvents: !!content.events
    });
    
    // Update screen content state
    setScreenContent(content);
    
    // Handle prayer times, which might be in the new format with a data array
    if (content.prayerTimes) {
      // Check if we have the new nested data structure
      if ('data' in content.prayerTimes && Array.isArray(content.prayerTimes.data)) {
        // Create a normalized version that has both the array and the first day's data at top level
        const normalizedPrayerTimes: any = { ...content.prayerTimes };
        
        // If there's data in the array, extract the first day to the top level properties
        if (content.prayerTimes.data.length > 0) {
          const firstDay = content.prayerTimes.data[0];
          // Copy all properties from the first day to the top level
          Object.keys(firstDay).forEach(key => {
            normalizedPrayerTimes[key] = (firstDay as any)[key];
          });
        }
        
        setPrayerTimes(normalizedPrayerTimes);
      } else {
        setPrayerTimes(content.prayerTimes);
      }
    }
    
    // Extract and update masjid name using helper function
    const extractedMasjidName = extractMasjidName(content);
    if (extractedMasjidName) {
      logger.debug("ContentContext: Using masjid name", { name: extractedMasjidName });
      setMasjidName(extractedMasjidName);
    }
    
    // Extract and update masjid timezone
    let foundTimezone = null;
    
    // Check all possible locations for timezone
    if (content.masjid?.timezone) {
      foundTimezone = content.masjid.timezone;
    } else if (content.data?.masjid?.timezone) {
      foundTimezone = content.data.masjid.timezone;
    } else if (content.screen?.masjid?.timezone) {
      foundTimezone = content.screen.masjid.timezone;
    }
    
    if (foundTimezone) {
      setMasjidTimezone(foundTimezone);
    }
    
    // Process schedule data if available
    if (content.schedule) {
      // Create a normalized version that works with our app
      let normalizedSchedule: any;
      
      // Check for new API format with nested data
      if ('data' in content.schedule && Array.isArray(content.schedule.data)) {
        // Extract items into a normalized format for the app
        normalizedSchedule = normalizeScheduleData(content.schedule);
        logger.debug("ContentContext: Normalized schedule from data array", { 
          itemCount: normalizedSchedule.items.length 
        });
      } else if (Array.isArray(content.schedule)) {
        // Handle legacy format
        normalizedSchedule = normalizeScheduleData(content.schedule);
        logger.debug("ContentContext: Normalized schedule from array", { 
          itemCount: normalizedSchedule.items.length 
        });
      } else {
        // Just use the schedule as is
        normalizedSchedule = content.schedule;
        logger.debug("ContentContext: Using schedule as is", { 
          hasItems: Array.isArray(normalizedSchedule.items),
          itemCount: Array.isArray(normalizedSchedule.items) ? normalizedSchedule.items.length : 'unknown' 
        });
      }
      
      setSchedule(normalizedSchedule);
    } else {
      logger.warn("ContentContext: No schedule found in content");
    }
    
    // Process events if available
    if (content.events) {
      // Handle the new API format where events might be inside a data property
      const eventsData = ('data' in content.events && Array.isArray(content.events.data)) 
        ? content.events.data
        : content.events;
        
      // Ensure we're only setting an array of events
      if (Array.isArray(eventsData)) {
        setEvents(eventsData);
        logger.debug("ContentContext: Processed events", { count: eventsData.length });
      } else {
        logger.warn("ContentContext: Events data is not an array", { 
          eventsType: typeof content.events 
        });
        setEvents(null);
      }
    } else {
      logger.debug("ContentContext: No events found in content");
    }
  }, [normalizeScheduleData]);

  // Use memoized processPrayerTimes to avoid dependency cycles
  const processPrayerTimes = useCallback((prayerTimesData: PrayerTimes | PrayerTimes[] | null) => {
    if (!prayerTimesData) return;
    
    try {
      // Handle both array and single object formats
      if (Array.isArray(prayerTimesData)) {
        // If it's an array, use the first item
        if (prayerTimesData.length > 0) {
          setPrayerTimes(prayerTimesData[0]);
          logger.debug("ContentContext: Processed prayer times from array", { 
            date: prayerTimesData[0].date 
          });
        }
      } else {
        // If it's a single object, use it directly
        setPrayerTimes(prayerTimesData);
        logger.debug("ContentContext: Processed prayer times from object", { 
          date: prayerTimesData.date 
        });
      }
    } catch (error) {
      logger.error("ContentContext: Error processing prayer times data", { error });
    }
  }, []);

  // Memoize refreshPrayerTimes to prevent dependency cycles
  const refreshPrayerTimes = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) {
      logger.debug("ContentContext: Cannot refresh prayer times - not authenticated");
      return;
    }
    
    if (isUpdatingRef.current) {
      logger.debug("ContentContext: Already updating, skipping prayer times refresh");
      return;
    }
    
    try {
      const now = Date.now();
      if (now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
        logger.debug("ContentContext: Throttling prayer times refresh");
        return;
      }
      
      logger.info("ContentContext: Refreshing prayer times");
      isUpdatingRef.current = true;
      
      // Set a timeout to use fallback times if API request takes too long
      const fallbackTimer = setTimeout(() => {
        if (isUpdatingRef.current && !prayerTimes) {
          logger.warn("ContentContext: Prayer times refresh timeout, using fallback");
          const fallbackTimes = createFallbackPrayerTimes();
          processPrayerTimes(fallbackTimes);
          isUpdatingRef.current = false;
        }
      }, 10000); // 10 second timeout
      
      // Use the data sync service to refresh prayer times
      await dataSyncService.syncPrayerTimes(true);
      
      // Get the updated prayer times from storage
      const storedPrayerTimes = await storageService.getPrayerTimes();
      
      // Clear the fallback timer since we got a response
      clearTimeout(fallbackTimer);
      
      if (storedPrayerTimes) {
        processPrayerTimes(storedPrayerTimes);
        logger.info("ContentContext: Successfully refreshed prayer times");
      } else {
        logger.error("ContentContext: No prayer times available after refresh");
        // Use fallback times if no data is available
        const fallbackTimes = createFallbackPrayerTimes();
        processPrayerTimes(fallbackTimes);
        // Store the fallback for future use
        await storageService.savePrayerTimes(fallbackTimes);
      }
    } catch (error) {
      logger.error("ContentContext: Error refreshing prayer times", { error });
      // Use fallback times on error
      const fallbackTimes = createFallbackPrayerTimes();
      processPrayerTimes(fallbackTimes);
      // Store the fallback for future use
      await storageService.savePrayerTimes(fallbackTimes);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [isAuthenticated, processPrayerTimes]);

  // Memoize refreshSchedule to prevent dependency cycles
  const refreshSchedule = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!isAuthenticated) {
      logger.debug("ContentContext: Cannot refresh schedule - not authenticated");
      return;
    }
    
    if (isUpdatingRef.current && !forceRefresh) {
      logger.debug("ContentContext: Already updating, skipping schedule refresh");
      return;
    }
    
    try {
      const now = Date.now();
      if (!forceRefresh && now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
        logger.debug("ContentContext: Throttling schedule refresh");
        return;
      }
      
      logger.info("ContentContext: Refreshing schedule", { forceRefresh });
      isUpdatingRef.current = true;
      
      // If forcing a refresh, invalidate caches
      if (forceRefresh) {
        masjidDisplayClient.invalidateCache('/api/screens/content');
      }
      
      // Use the data sync service to refresh the schedule
      await dataSyncService.syncSchedule(forceRefresh);
      
      // Get the updated schedule from storage
      const storedSchedule = await storageService.getSchedule();
      
      if (storedSchedule) {
        const normalizedSchedule = normalizeScheduleData(storedSchedule);
        setSchedule(normalizedSchedule);
        logger.info("ContentContext: Successfully refreshed schedule", {
          itemCount: normalizedSchedule.items.length
        });
      } else {
        logger.error("ContentContext: No schedule available after refresh");
      }
    } catch (error) {
      logger.error("ContentContext: Error refreshing schedule", { error });
    } finally {
      isUpdatingRef.current = false;
    }
  }, [isAuthenticated, normalizeScheduleData]);

  // Memoize refreshContent to prevent dependency cycles
  const refreshContent = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!isAuthenticated) {
      logger.debug("ContentContext: Not refreshing content - not authenticated");
      return;
    }
    
    if (isUpdatingRef.current && !forceRefresh) {
      logger.debug("ContentContext: Already updating content and force refresh not requested");
      return;
    }
    
    const now = Date.now();
    if (!forceRefresh && now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
      logger.debug("ContentContext: Throttling content refresh");
      return;
    }
    
    logger.info(`ContentContext: Refreshing content (forceRefresh: ${forceRefresh})`);
    setIsLoading(true);
    isUpdatingRef.current = true;
    lastRefreshTimeRef.current = now;
    
    try {
      // If forcing a refresh, invalidate caches
      if (forceRefresh) {
        masjidDisplayClient.invalidateAllCaches();
      }
      
      // Use data sync service to sync all data
      await dataSyncService.syncAllData(forceRefresh);
      
      // Get the updated content from storage
      const storedContent = await storageService.getScreenContent();
      
      if (storedContent) {
        logger.info("ContentContext: Successfully fetched screen content");
        processScreenContent(storedContent);
        setLastUpdated(new Date());
      } else {
        logger.error("ContentContext: No content available after sync");
      }
    } catch (error) {
      logger.error("ContentContext: Error refreshing content", { error });
      
      try {
        // Fall back to stored content if API fails
        const storedContent = await storageService.getScreenContent();
        if (storedContent) {
          processScreenContent(storedContent);
          logger.info("ContentContext: Using stored content as fallback");
        }
      } catch (fallbackError) {
        logger.error("ContentContext: Failed to load fallback content", { error: fallbackError });
      }
    } finally {
      setIsLoading(false);
      isUpdatingRef.current = false;
    }
  }, [isAuthenticated, processScreenContent]);

  // Memoize loadContent to prevent rerenders
  const loadContent = useCallback(async (): Promise<void> => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    
    try {
      setIsLoading(true);
      logger.info("ContentContext: Loading initial content");
      
      // First try to load from storage
      const storedContent = await storageService.getScreenContent();
      const storedPrayerTimes = await storageService.getPrayerTimes();
      
      let hasData = false;
      
      // Process stored prayer times first to ensure they're available
      if (storedPrayerTimes) {
        logger.info("ContentContext: Loaded prayer times from storage");
        processPrayerTimes(storedPrayerTimes);
        hasData = true;
      } else {
        logger.warn("ContentContext: No prayer times found in storage");
        
        // Use fallback times if nothing is found
        logger.info("ContentContext: Using fallback prayer times");
        const fallbackTimes = createFallbackPrayerTimes();
        processPrayerTimes(fallbackTimes);
        
        // Store the fallback in storage for next time
        try {
          await storageService.savePrayerTimes(fallbackTimes);
          hasData = true;
        } catch (e) {
          logger.error("ContentContext: Error storing fallback prayer times", { error: e });
        }
      }
      
      // Process stored content after prayer times
      if (storedContent) {
        processScreenContent(storedContent);
        logger.info("ContentContext: Loaded content from storage");
        hasData = true;
      } else {
        logger.warn("ContentContext: No content found in storage");
      }
      
      // Switch loading state off once we have at least prayer times
      if (hasData) {
        setIsLoading(false);
      }
      
      // Always try to fetch fresh data when app loads
      if (navigator.onLine) {
        logger.info("ContentContext: Fetching fresh data on startup");
        // Force fetch to skip cache but don't cause a refresh loop
        setTimeout(() => {
          if (!initializedRef.current) {
            initializedRef.current = true;
            refreshContent(true).then(() => {
              // After content is refreshed, explicitly refresh prayer times
              refreshPrayerTimes();
              // Ensure loading state is off
              setIsLoading(false);
            });
          }
        }, 100);
      } else {
        // Ensure loading state is off even if offline
        setIsLoading(false);
      }
    } catch (error) {
      logger.error("ContentContext: Error loading initial content", { error });
      setIsLoading(false);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [processScreenContent, processPrayerTimes, refreshContent, refreshPrayerTimes]);

  // Prayer announcement management function
  const setPrayerAnnouncement = useCallback((
    show: boolean,
    prayerName?: string,
    isJamaat?: boolean
  ) => {
    // Skip update if nothing is changing
    if (show === showPrayerAnnouncement && 
        (!prayerName || prayerName === prayerAnnouncementName) &&
        (isJamaat === undefined || isJamaat === isPrayerJamaat)) {
      return;
    }

    // Only log meaningful state changes
    logger.info('[ContentContext] Setting prayer announcement', {
      show,
      prayerName: prayerName || (show ? prayerAnnouncementName : ''),
      isJamaat: typeof isJamaat !== 'undefined' ? isJamaat : isPrayerJamaat,
      timestamp: new Date().toISOString()
    });

    // CRITICAL FIX: Ensure synchronous updates to avoid race conditions
    // Use the React 18 automatic batching behavior and synchronous setter
    // First, update the flag that controls visibility
    setShowPrayerAnnouncement(show);

    // Then update the name if provided
    if (prayerName) {
      setPrayerAnnouncementName(prayerName);
    }
      
    // Finally update the jamaat flag if provided
    if (typeof isJamaat !== 'undefined') {
      setIsPrayerJamaat(isJamaat);
    }

    // For monitoring purposes, log to console directly
    console.log(`[CRITICAL] Prayer announcement state set to: ${show ? 'SHOWING' : 'HIDDEN'}, Prayer: ${prayerName || prayerAnnouncementName}, Jamaat: ${isJamaat !== undefined ? isJamaat : isPrayerJamaat}`);
    
    // Always dispatch a DOM event as a failsafe mechanism for critical UI updates
    try {
      document.dispatchEvent(new CustomEvent('prayer-announcement', { 
        detail: { 
          show, 
          prayerName: prayerName || prayerAnnouncementName, 
          isJamaat: typeof isJamaat !== 'undefined' ? isJamaat : isPrayerJamaat 
        } 
      }));
    } catch (err) {
      console.error("Failed to dispatch prayer announcement event:", err);
    }
      
    // If we're showing an announcement, set a failsafe timer to ensure it gets hidden
    if (show) {
      // Add a check after a short delay to verify the state was properly updated
      setTimeout(() => {
        if (show && !showPrayerAnnouncement) {
          logger.warn('[ContentContext] State update failed! Retrying setPrayerAnnouncement with forced approach');
          
          // Force state update directly with DOM API as a last resort
          try {
            // Try again directly with React state
            setShowPrayerAnnouncement(true);
            if (prayerName) setPrayerAnnouncementName(prayerName);
            if (typeof isJamaat !== 'undefined') setIsPrayerJamaat(isJamaat);
            
            // Use CSS variables as another fallback mechanism
            document.documentElement.style.setProperty('--prayer-announcement-visible', 'true');
            document.documentElement.style.setProperty('--prayer-name', prayerName || prayerAnnouncementName);
            document.documentElement.style.setProperty('--is-jamaat', isJamaat ? 'true' : 'false');
          } catch (e) {
            logger.error('[ContentContext] Critical error in emergency prayer announcement fallback', { error: e });
          }
        }
      }, 250);
      
      // Auto-hide after 3 minutes just in case it gets stuck
      const timeout = setTimeout(() => {
        logger.info('[ContentContext] Failsafe: Auto-hiding prayer announcement after timeout');
        setShowPrayerAnnouncement(false);
        // Also reset CSS variables
        document.documentElement.style.setProperty('--prayer-announcement-visible', 'false');
      }, 180000); // 3 minutes
      
      // Return cleanup function to prevent memory leaks
      return () => clearTimeout(timeout);
    } else {
      // Reset CSS variables when hiding
      document.documentElement.style.setProperty('--prayer-announcement-visible', 'false');
    }
  }, [showPrayerAnnouncement, prayerAnnouncementName, isPrayerJamaat]);

  // Add visibility change handler
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      logger.info("ContentContext: App became visible, checking data freshness");
      // Instead of force refreshing, check how long it's been since last update
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;
      
      if (now - lastRefreshTimeRef.current > fiveMinutesMs) {
        // Only do a gentle refresh if it's been more than 5 minutes
        logger.info("ContentContext: Data older than 5 minutes, refreshing gently");
        // Use false to avoid force refresh that causes flashing
        refreshContent(false);
      } else {
        logger.info("ContentContext: Data is fresh enough, skipping refresh");
      }
    }
  }, [refreshContent]);

  // Run once on mount to set up visibility change listener
  useEffect(() => {
    logger.info("ContentContext: Setting up visibility change listener");
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);
  
  // Set up initial data loading
  useEffect(() => {
    // Use refs to ensure this only runs once
    if (isAuthenticated && !initializedRef.current) {
      // Initialize data sync service
      dataSyncService.initialize();
      
      // Load content with a small delay to prevent immediate rerender
      setTimeout(() => {
        loadContent();
      }, 10);
    }
    
    // Cleanup on unmount
    return () => {
      dataSyncService.cleanup();
    };
  }, [isAuthenticated, loadContent]);

  // Add debug logging for masjid name changes
  useEffect(() => {
    logger.debug("ContentContext: masjidName updated", { masjidName });
  }, [masjidName]);

  // Exposed context value
  const contextValue = useMemo(() => ({
    isLoading,
    screenContent,
    prayerTimes,
    schedule,
    events,
    masjidName,
    masjidTimezone,
    refreshContent,
    refreshPrayerTimes,
    refreshSchedule,
    lastUpdated,
    carouselTime,
    setCarouselTime,
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
    setPrayerAnnouncement,
    setShowPrayerAnnouncement,
    setPrayerAnnouncementName,
    setIsPrayerJamaat
  }), [
    isLoading,
    screenContent,
    prayerTimes,
    schedule,
    events,
    masjidName,
    masjidTimezone,
    refreshContent,
    refreshPrayerTimes,
    refreshSchedule,
    lastUpdated,
    carouselTime,
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
    setPrayerAnnouncement,
    setShowPrayerAnnouncement,
    setPrayerAnnouncementName,
    setIsPrayerJamaat
  ]);

  return (
    <ContentContext.Provider
      value={contextValue}
    >
      {children}
    </ContentContext.Provider>
  );
}; 