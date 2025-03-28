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

export const ContentProvider: React.FC<ContentProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [screenContent, setScreenContent] = useState<ScreenContent | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [masjidName, setMasjidName] = useState<string | null>(null);
  const [masjidTimezone, setMasjidTimezone] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [carouselTime, setCarouselTime] = useState<number>(0);
  
  // Prayer announcement states
  const [showPrayerAnnouncement, setShowPrayerAnnouncement] = useState<boolean>(false);
  const [prayerAnnouncementName, setPrayerAnnouncementName] = useState<string>('');
  const [isPrayerJamaat, setIsPrayerJamaat] = useState<boolean>(false);
  
  // Use refs to track initialization and prevent unnecessary renders
  const initializedRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  const isUpdatingRef = useRef(false);

  // Helper function to normalize schedule data from API to app expected format
  const normalizeScheduleData = useCallback((schedule: any): Schedule => {
    if (!schedule) return createFallbackSchedule();
    
    try {
      // Check if the schedule already has the expected format
      if (schedule.items && schedule.items.length > 0 && 
          schedule.items[0].contentItem && 
          typeof schedule.items[0].contentItem === 'object') {
        return schedule as Schedule;
      }
      
      // Create a new schedule object with the expected format
      const normalizedSchedule: Schedule = {
        id: schedule.id || 'normalized-schedule',
        name: schedule.name || 'Schedule',
        items: []
      };
      
      // Convert items from API format to app format
      if (schedule.items && Array.isArray(schedule.items)) {
        normalizedSchedule.items = schedule.items.map((item: any, index: number) => {
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
    if (!content) return;
    
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
    
    // Handle masjid info from the content response
    if (content.masjid) {
      setMasjidName(content.masjid.name);
      setMasjidTimezone(content.masjid.timezone || null);
    }
    
    // Additional handling for direct masjid data format from API
    if (content.data && content.data.masjid) {
      setMasjidName(content.data.masjid.name || masjidName);
      setMasjidTimezone(content.data.masjid.timezone || masjidTimezone);
    }
    
    // Process schedule data if available
    if (content.schedule) {
      // Create a normalized version that works with our app
      let normalizedSchedule: any;
      
      // Check for new API format with nested data
      if ('data' in content.schedule && Array.isArray(content.schedule.data)) {
        // Extract items into a normalized format for the app
        normalizedSchedule = normalizeScheduleData(content.schedule);
      } else if (Array.isArray(content.schedule)) {
        // Handle legacy format
        normalizedSchedule = {
          id: 'normalized-schedule',
          name: 'Schedule',
          items: content.schedule
        };
      } else {
        // Just use the schedule as is
        normalizedSchedule = content.schedule;
      }
      
      setSchedule(normalizedSchedule);
    }
    
    // Process events if available
    if (content.events) {
      // Handle the new API format where events might be inside a data property
      const eventsData = ('data' in content.events && Array.isArray(content.events.data)) 
        ? content.events.data
        : content.events;
        
      // Ensure we're only setting an array of events
      setEvents(Array.isArray(eventsData) ? eventsData : null);
    }
  }, [masjidName, masjidTimezone, normalizeScheduleData]);

  // Use memoized processPrayerTimes to avoid dependency cycles
  const processPrayerTimes = useCallback((prayerTimesData: PrayerTimes | PrayerTimes[] | null) => {
    if (!prayerTimesData) return;
    
    try {
      // Handle both array and single object formats
      if (Array.isArray(prayerTimesData)) {
        // If it's an array, use the first item
        if (prayerTimesData.length > 0) {
          setPrayerTimes(prayerTimesData[0]);
        }
      } else {
        // If it's a single object, use it directly
        setPrayerTimes(prayerTimesData);
      }
    } catch (error) {
      logger.error("ContentContext: Error processing prayer times data", { error });
    }
  }, []);

  // Simplified refreshPrayerTimes to prevent rerender loops
  const refreshPrayerTimes = useCallback(async (): Promise<void> => {
    if (isUpdatingRef.current) {
      logger.debug("ContentContext: Skipping prayer times refresh - already updating");
      return;
    }
    
    const now = Date.now();
    // Reduce the throttle time to ensure we don't miss updates 
    // but still prevent hammering the API
    if (now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
      logger.debug("ContentContext: Throttling prayer times refresh");
      return;
    }
    
    logger.info("ContentContext: Refreshing prayer times");
    isUpdatingRef.current = true;
    lastRefreshTimeRef.current = now;

    try {
      // First, check localStorage for existing prayer times
      const storedPrayerTimes = await storageService.getPrayerTimes();
      
      // Use data sync service to sync prayer times with force refresh
      logger.info("ContentContext: Fetching fresh prayer times from API");
      await dataSyncService.syncPrayerTimes(true);
      
      // Get updated prayer times from storage after sync
      const updatedPrayerTimes = await storageService.getPrayerTimes();
      if (updatedPrayerTimes) {
        logger.info("ContentContext: Successfully retrieved updated prayer times");
        processPrayerTimes(updatedPrayerTimes);
        setLastUpdated(new Date());
      } else if (storedPrayerTimes) {
        logger.warn("ContentContext: API prayer times fetch failed, using stored data");
        processPrayerTimes(storedPrayerTimes);
      } else {
        logger.error("ContentContext: No prayer times available, using fallback");
        processPrayerTimes(createFallbackPrayerTimes());
      }
    } catch (error) {
      logger.error("ContentContext: Error refreshing prayer times", { error });
      
      try {
        // Fall back to stored data if API fails
        const storedPrayerTimes = await storageService.getPrayerTimes();
        if (storedPrayerTimes) {
          processPrayerTimes(storedPrayerTimes);
          logger.info("ContentContext: Using stored prayer times as fallback");
        } else {
          processPrayerTimes(createFallbackPrayerTimes());
          logger.info("ContentContext: Using generated fallback prayer times");
        }
      } catch (fallbackError) {
        logger.error("ContentContext: Failed to load fallback prayer times", { error: fallbackError });
      }
    } finally {
      isUpdatingRef.current = false;
    }
  }, [processPrayerTimes]);

  // Refresh content with improved cache handling
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

  // Helper function to fetch schedule directly from the API
  const fetchScheduleFromAPI = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    try {
      logger.info('ContentContext: Fetching schedule from API');
      console.log('🔍 FETCHING SCHEDULE FROM API');
      
      // Use data sync service to sync schedule
      await dataSyncService.syncSchedule(forceRefresh);
      
      // Get updated schedule from storage
      const updatedSchedule = await storageService.getSchedule();
      if (updatedSchedule) {
        console.log('🔍 SCHEDULE FETCHED FROM API:', updatedSchedule);
        const normalizedSchedule = normalizeScheduleData(updatedSchedule as any);
        setSchedule(normalizedSchedule);
        
        // Update last updated time
        setLastUpdated(new Date());
      } else {
        console.log('🔍 NO SCHEDULE RETURNED FROM API');
      }
    } catch (error) {
      logger.error('ContentContext: Error fetching schedule from API', { error });
      console.error('🔍 ERROR FETCHING SCHEDULE FROM API:', error);
    }
  }, [normalizeScheduleData]);

  // Refresh schedule content
  const refreshSchedule = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    if (isUpdatingRef.current) {
      logger.info('ContentContext: Already refreshing schedule, skipping request');
      return;
    }
    
    const now = Date.now();
    if (!forceRefresh && now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
      logger.info('ContentContext: Refresh throttled, skipping request');
      return;
    }
    
    logger.info('ContentContext: Refreshing schedule', { forceRefresh });
    console.log('🔍 REFRESHING SCHEDULE, forceRefresh:', forceRefresh);
    
    isUpdatingRef.current = true;
    
    try {
      // First try loading from local storage
      let scheduleData = await storageService.getSchedule();
      console.log('🔍 SCHEDULE FROM STORAGE:', scheduleData);
      
      if (scheduleData) {
        logger.info('ContentContext: Schedule loaded from storage');
        
        // Log the shape of the data to help debug
        console.log('🔍 SCHEDULE DATA TYPE:', typeof scheduleData);
        console.log('🔍 SCHEDULE IS ARRAY:', Array.isArray(scheduleData));
        console.log('🔍 SCHEDULE HAS ITEMS:', !!(scheduleData as any).items);
        
        if (Array.isArray(scheduleData)) {
          // If it's an array, create a schedule object
          console.log('🔍 CONVERTING ARRAY TO SCHEDULE OBJECT');
          scheduleData = {
            id: 'local-schedule',
            name: 'Schedule',
            items: scheduleData as any // Cast to any to avoid type errors
          };
        } else if (typeof scheduleData === 'object' && scheduleData !== null) {
          // If it's an object but doesn't have an items property, it might be in a nested format
          if (!(scheduleData as any).items && (scheduleData as any).data) {
            console.log('🔍 SCHEDULE HAS NESTED DATA:', !!(scheduleData as any).data);
            
            if (Array.isArray((scheduleData as any).data)) {
              console.log('🔍 NESTED DATA IS ARRAY WITH LENGTH:', (scheduleData as any).data.length);
              // Use the data array as items
              scheduleData = {
                id: (scheduleData as any).id || 'local-schedule',
                name: (scheduleData as any).name || 'Schedule',
                items: (scheduleData as any).data
              };
            }
          }
        }
        
        // If we have a valid schedule object with items, process it
        if (typeof scheduleData === 'object' && scheduleData !== null && (scheduleData as any).items) {
          console.log('🔍 NORMALIZED SCHEDULE HAS ITEMS:', (scheduleData as any).items.length);
          setSchedule(normalizeScheduleData(scheduleData as Schedule));
        } else {
          console.log('🔍 INVALID SCHEDULE STRUCTURE, FETCHING FROM API');
          // If local storage doesn't have a valid format, try the API
          await fetchScheduleFromAPI(forceRefresh);
        }
      } else {
        logger.info('ContentContext: No schedule in storage, fetching from API');
        console.log('🔍 NO SCHEDULE IN STORAGE, FETCHING FROM API');
        await fetchScheduleFromAPI(forceRefresh);
      }
    } catch (error) {
      logger.error('ContentContext: Error refreshing schedule', { error });
      console.error('🔍 ERROR REFRESHING SCHEDULE:', error);
    } finally {
      isUpdatingRef.current = false;
      lastRefreshTimeRef.current = Date.now();
    }
  }, [fetchScheduleFromAPI, normalizeScheduleData]);

  // Create fallback prayer times data to use when no data is available
  const createFallbackPrayerTimes = (): PrayerTimes => {
    // Generate fallback data based on UTC times
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    
    return {
      date,
      fajr: '05:30',
      sunrise: '06:45',
      zuhr: '12:30',
      asr: '15:45',
      maghrib: '18:30',
      isha: '20:00',
      fajrJamaat: '06:00',
      zuhrJamaat: '13:00',
      asrJamaat: '16:15',
      maghribJamaat: '18:35',
      ishaJamaat: '20:30',
      data: [{
        date,
        fajr: '05:30',
        sunrise: '06:45',
        zuhr: '12:30',
        asr: '15:45',
        maghrib: '18:30',
        isha: '20:00',
        fajrJamaat: '06:00',
        zuhrJamaat: '13:00',
        asrJamaat: '16:15',
        maghribJamaat: '18:35',
        ishaJamaat: '20:30',
      }]
    };
  };

  // Create fallback schedule to use when no data is available
  const createFallbackSchedule = (): Schedule => {
    return {
      id: 'fallback-schedule',
      name: 'Default Schedule',
      items: [
        {
          id: 'fallback-item-1',
          order: 1,
          contentItem: {
            id: 'fallback-content-1',
            type: 'CUSTOM',
            title: 'Prayer Times',
            content: {},
            duration: 30
          }
        }
      ]
    };
  };

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
      logger.info("ContentContext: App became visible, refreshing data");
      refreshContent(true); // Force refresh when coming back to focus
      refreshPrayerTimes();
    }
  }, [refreshContent, refreshPrayerTimes]);

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
    isPrayerJamaat
  ]);

  return (
    <ContentContext.Provider
      value={contextValue}
    >
      {children}
    </ContentContext.Provider>
  );
}; 