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
  refreshSchedule: () => Promise<void>;
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
  const MIN_REFRESH_INTERVAL = 30000; // 30 seconds

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
      } else {
        logger.warn("ContentContext: No stored content found");
      }
      
      // Load prayer times directly even if they weren't in screen content
      const storedPrayerTimes = await storageService.getPrayerTimes();
      if (storedPrayerTimes && !prayerTimes) {
        // Remove debug logging for performance
        logger.debug("Loading prayer times from storage");
        
        // Create a normalized version that works with our app
        let normalizedPrayerTimes: any;
        
        if (Array.isArray(storedPrayerTimes)) {
          // If it's an array, create an object with data property
          normalizedPrayerTimes = { 
            data: storedPrayerTimes,
            // Extract properties from first item for backwards compatibility
            ...(storedPrayerTimes[0] || {})
          };
        } else if ('data' in storedPrayerTimes && Array.isArray(storedPrayerTimes.data)) {
          // If it's already the right format, use it
          normalizedPrayerTimes = storedPrayerTimes;
        } else {
          // Just use as is
          normalizedPrayerTimes = storedPrayerTimes;
        }
        
        // Remove debug logging for performance
        setPrayerTimes(normalizedPrayerTimes);
      }
      
      // Load schedule directly even if it wasn't in screen content
      const storedSchedule = await storageService.getSchedule();
      if (storedSchedule && !schedule) {
        console.log("DEBUG ContentContext: Loading schedule directly from storage:", storedSchedule);
        
        // Create a normalized version that works with our app
        let normalizedSchedule: any;
        
        if (Array.isArray(storedSchedule)) {
          // If it's an array, create an object with data property
          normalizedSchedule = { 
            data: storedSchedule,
            // Extract properties from first item for backwards compatibility
            ...(storedSchedule[0] || {})
          };
        } else if ('data' in storedSchedule && Array.isArray((storedSchedule as any).data)) {
          // If it's already the right format, use it
          normalizedSchedule = storedSchedule;
        } else {
          // Just use as is
          normalizedSchedule = storedSchedule;
        }
        
        console.log("DEBUG ContentContext: Using normalized schedule:", normalizedSchedule);
        setSchedule(normalizedSchedule);
      }
      
      // Load prayer status directly
      const storedPrayerStatus = await storageService.getPrayerStatus();
      if (storedPrayerStatus && !prayerStatus) {
        console.log("DEBUG ContentContext: Loading prayer status directly from storage:", storedPrayerStatus);
        
        // Check if we have the new API format with data nested
        if (storedPrayerStatus.data && typeof storedPrayerStatus.data === 'object') {
          // Extract the data object and create a complete PrayerStatus
          const normalizedStatus = {
            ...storedPrayerStatus,
            ...storedPrayerStatus.data,
          };
          setPrayerStatus(normalizedStatus);
        } else {
          // Just use the existing format
          setPrayerStatus(storedPrayerStatus);
        }
      }

      // Always try to fetch fresh data when app loads
      if (navigator.onLine) {
        logger.info("ContentContext: Fetching fresh data on startup");
        // Force fetch to skip cache
        await refreshContent(true);
      } else {
        logger.warn("ContentContext: Offline, using cached data only");
      }
    } catch (error) {
      console.error('Error loading content:', error);
      logger.error("ContentContext: Error loading initial content", { error });
      
      // Create fallback data if we couldn't load anything
      if (!prayerTimes) {
        console.log("DEBUG ContentContext: Using fallback prayer times data");
        setPrayerTimes(createFallbackPrayerTimes());
      }
      
      // Create fallback schedule if we couldn't load anything
      if (!schedule) {
        console.log("DEBUG ContentContext: Using fallback schedule data");
        setSchedule(createFallbackSchedule());
      }
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
    
    // Handle prayer times, which might be in the new format with a data array
    if (content.prayerTimes) {
      console.log("DEBUG ContentContext: Processing prayer times from API:", content.prayerTimes);
      
      // Check if we have the new nested data structure
      if ('data' in content.prayerTimes && Array.isArray(content.prayerTimes.data)) {
        console.log("DEBUG ContentContext: Found nested data array in prayer times, length:", content.prayerTimes.data.length);
        
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
        
        console.log("DEBUG ContentContext: Setting normalized prayer times:", normalizedPrayerTimes);
        setPrayerTimes(normalizedPrayerTimes);
      } else {
        console.log("DEBUG ContentContext: Using original prayer times format");
        setPrayerTimes(content.prayerTimes);
      }
    }
    
    // Properly handle masjid info from the content response
    if (content.masjid) {
      console.log("DEBUG ContentContext: Processing masjid info from content:", content.masjid);
      setMasjidName(content.masjid.name);
      setMasjidTimezone(content.masjid.timezone || null);
    } else {
      console.warn("DEBUG ContentContext: No masjid info in content response");
    }
    
    // Additional handling for direct masjid data format from API
    if (content.data && content.data.masjid) {
      console.log("DEBUG ContentContext: Found masjid info in content.data:", content.data.masjid);
      setMasjidName(content.data.masjid.name || masjidName);
      setMasjidTimezone(content.data.masjid.timezone || masjidTimezone);
    }
    
    // Process schedule data if available
    if (content.schedule) {
      console.log("DEBUG ContentContext: Processing schedule from API", content.schedule);
      
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
      
      console.log("DEBUG ContentContext: Setting normalized schedule:", normalizedSchedule);
      setSchedule(normalizedSchedule);
    }
    
    // Process events if available
    if (content.events) {
      console.log("DEBUG ContentContext: Setting events from content:", content.events);
      
      // Handle the new API format where events might be inside a data property
      const eventsData = ('data' in content.events && Array.isArray(content.events.data)) 
        ? content.events.data
        : content.events;
        
      // Ensure we're only setting an array of events
      setEvents(Array.isArray(eventsData) ? eventsData : null);
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

  // Update refreshPrayerStatus method to handle the new nested data structure
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
        // Check if we have the new API format with data nested
        if (updatedPrayerStatus.data && typeof updatedPrayerStatus.data === 'object') {
          // Extract the data object and create a complete PrayerStatus
          const normalizedStatus = {
            ...updatedPrayerStatus,
            ...updatedPrayerStatus.data,
          };
          setPrayerStatus(normalizedStatus);
          logger.info("ContentContext: Prayer status (new format) refreshed successfully");
        } else {
          // Just use the existing format
          setPrayerStatus(updatedPrayerStatus);
          logger.info("ContentContext: Prayer status (legacy format) refreshed successfully");
        }
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
    if (!isAuthenticated) {
      logger.warn("ContentContext: Not authenticated, skipping prayer times refresh");
      return;
    }

    // Implement throttling to prevent infinite loops
    const now = Date.now();
    if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
      logger.debug("ContentContext: Throttling prayer times refresh - too frequent calls");
      return;
    }
    
    setLastRefreshTime(now);

    try {
      logger.debug("ContentContext: Starting prayer times refresh");
      
      // Use data sync service to sync prayer times
      await dataSyncService.syncPrayerTimes(true);
      
      // Get updated prayer times from storage
      const updatedPrayerTimes = await storageService.getPrayerTimes();
      if (updatedPrayerTimes) {
        logger.debug("ContentContext: Retrieved updated prayer times");
        
        // Create a normalized version that works with our app
        let normalizedPrayerTimes: any;
        
        if (Array.isArray(updatedPrayerTimes)) {
          // If it's an array, create an object with data property
          normalizedPrayerTimes = {
            data: updatedPrayerTimes,
            // Extract properties from first item for backwards compatibility
            ...(updatedPrayerTimes[0] || {})
          };
        } else if ('data' in updatedPrayerTimes && Array.isArray(updatedPrayerTimes.data)) {
          // If it's already the right format, use it
          normalizedPrayerTimes = updatedPrayerTimes;
        } else {
          // Just use as is
          normalizedPrayerTimes = updatedPrayerTimes;
        }
        
        // Update state with normalized data
        setPrayerTimes(normalizedPrayerTimes);
        
        // Update last updated time
        setLastUpdated(new Date());
        
        logger.debug("ContentContext: Prayer times updated successfully");
      } else {
        // Create fallback data if all else fails
        logger.warn("ContentContext: No prayer times available, using fallback data");
        setPrayerTimes(createFallbackPrayerTimes());
      }
    } catch (error) {
      logger.error("ContentContext: Error refreshing prayer times", { error });
    }
  };

  // Create fallback prayer times data to use when no data is available
  const createFallbackPrayerTimes = (): PrayerTimes => {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      fajr: '04:30',
      sunrise: '06:00',
      zuhr: '12:30',
      asr: '15:45',
      maghrib: '19:15',
      isha: '20:45',
      fajrJamaat: '05:00',
      zuhrJamaat: '13:00',
      asrJamaat: '16:15',
      maghribJamaat: '19:25',
      ishaJamaat: '21:15',
      data: [{
        date: today,
        fajr: '04:30',
        sunrise: '06:00',
        zuhr: '12:30',
        asr: '15:45',
        maghrib: '19:15',
        isha: '20:45',
        fajrJamaat: '05:00',
        zuhrJamaat: '13:00',
        asrJamaat: '16:15',
        maghribJamaat: '19:25',
        ishaJamaat: '21:15',
      }]
    };
  };

  // Create fallback schedule data to use when no data is available
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
            type: 'ANNOUNCEMENT',
            title: 'Welcome',
            content: 'Welcome to our masjid. Please check back for updates.',
            duration: 20
          }
        },
        {
          id: 'fallback-item-2',
          order: 2,
          contentItem: {
            id: 'fallback-content-2',
            type: 'VERSE_HADITH',
            title: 'Verse of the Day',
            content: 'Indeed, Allah is with the patient.',
            duration: 20
          }
        }
      ],
      data: [
        {
          id: 'fallback-schedule',
          name: 'Default Schedule',
          items: [
            {
              id: 'fallback-item-1',
              order: 1,
              contentItem: {
                id: 'fallback-content-1',
                type: 'ANNOUNCEMENT',
                title: 'Welcome',
                content: 'Welcome to our masjid. Please check back for updates.',
                duration: 20
              }
            },
            {
              id: 'fallback-item-2',
              order: 2,
              contentItem: {
                id: 'fallback-content-2',
                type: 'VERSE_HADITH',
                title: 'Verse of the Day',
                content: 'Indeed, Allah is with the patient.',
                duration: 20
              }
            }
          ]
        }
      ]
    };
  };

  // Add refreshSchedule method
  const refreshSchedule = async (): Promise<void> => {
    console.log("DEBUG ContentContext: refreshSchedule called");
    if (!isAuthenticated) {
      console.log("DEBUG ContentContext: Not authenticated, skipping refresh");
      return;
    }

    // Implement throttling
    const now = Date.now();
    const lastScheduleRefresh = lastRefreshTime;
    if (now - lastScheduleRefresh < MIN_REFRESH_INTERVAL) {
      console.log("DEBUG ContentContext: Throttling schedule refresh - too frequent calls", {
        timeSinceLastRefresh: now - lastScheduleRefresh,
        minInterval: MIN_REFRESH_INTERVAL
      });
      logger.debug("ContentContext: Throttling schedule refresh - too frequent calls");
      return;
    }

    try {
      console.log("DEBUG ContentContext: Starting schedule refresh");
      logger.info("ContentContext: Refreshing schedule");
      
      // Try to directly get content from the API client first as a diagnostic measure
      console.log("DEBUG ContentContext: Direct API call to getScreenContent");
      const apiResponse = await masjidDisplayClient.getScreenContent(true);
      console.log("DEBUG ContentContext: Direct API response success:", apiResponse.success);
      
      if (apiResponse.success && apiResponse.data) {
        console.log("DEBUG ContentContext: API returned success. Data properties:", Object.keys(apiResponse.data));
        
        // Check for nested schedule data structure
        // The API response may have schedule at the top level or nested inside a data property
        const nestedSchedule = (apiResponse.data as any).data?.schedule || apiResponse.data.schedule;
        console.log("DEBUG ContentContext: Schedule in response:", nestedSchedule ? "YES" : "NO");
        
        // Check if we have schedule data in the response (checking both possible locations)
        if (nestedSchedule) {
          console.log("DEBUG ContentContext: Raw schedule from API:", nestedSchedule);
          
          // Normalize the schedule to ensure it has the expected format with contentItem properties
          const normalizedSchedule = normalizeScheduleData(nestedSchedule);
          console.log("DEBUG ContentContext: Normalized schedule:", normalizedSchedule);
          
          // Save it to storage and update state
          await storageService.saveSchedule(normalizedSchedule);
          setSchedule(normalizedSchedule);
          
          logger.info("ContentContext: Schedule refreshed and saved successfully");
          return; // Exit early if we successfully got and processed the schedule
        } else {
          console.log("DEBUG ContentContext: API response successful but no schedule found in response or nested data");
        }
      } else {
        console.log("DEBUG ContentContext: API call failed or returned no data", 
          apiResponse.success ? "Success but no data" : "Failed with error: " + apiResponse.error);
      }
      
      // If we get here, either the API call failed or there was no schedule in the response
      // Try getting from storage as a fallback
      const updatedSchedule = await storageService.getSchedule();
      if (updatedSchedule) {
        console.log("DEBUG ContentContext: Got schedule from storage:", updatedSchedule);
        
        // Normalize the schedule if needed
        const normalizedSchedule = normalizeScheduleData(updatedSchedule);
        console.log("DEBUG ContentContext: Normalized schedule from storage:", normalizedSchedule);
        
        // Update state with the schedule
        setSchedule(normalizedSchedule);
        logger.info("ContentContext: Schedule refreshed from storage successfully");
      } else {
        console.log("DEBUG ContentContext: No schedule found in storage, using fallback");
        
        // Use fallback schedule if nothing else is available
        const fallbackSchedule = createFallbackSchedule();
        setSchedule(fallbackSchedule);
        logger.warn("ContentContext: Using fallback schedule due to no data available");
      }
    } catch (error) {
      console.error('Error refreshing schedule:', error);
      logger.error("ContentContext: Error refreshing schedule", { error });
      
      // Use fallback schedule in case of error
      setSchedule(createFallbackSchedule());
    }
  };

  // Helper function to normalize schedule data from API to app expected format
  const normalizeScheduleData = (schedule: any): Schedule => {
    console.log("DEBUG ContentContext: Normalizing schedule data", schedule);
    
    if (!schedule) return createFallbackSchedule();
    
    try {
      // Check if the schedule already has the expected format
      if (schedule.items && schedule.items.length > 0 && 
          schedule.items[0].contentItem && 
          typeof schedule.items[0].contentItem === 'object') {
        console.log("DEBUG ContentContext: Schedule already in expected format with contentItem objects");
        return schedule as Schedule;
      }
      
      // Create a new schedule object with the expected format
      const normalizedSchedule: Schedule = {
        id: schedule.id || 'normalized-schedule',
        name: schedule.name || 'Schedule',
        items: []
      };
      
      console.log("DEBUG ContentContext: API schedule structure:", {
        hasItems: !!schedule.items,
        itemsIsArray: Array.isArray(schedule.items),
        itemsLength: schedule.items?.length,
        firstItemProperties: schedule.items && schedule.items.length > 0 ? Object.keys(schedule.items[0]) : []
      });
      
      // Convert items from API format to app format
      if (schedule.items && Array.isArray(schedule.items)) {
        normalizedSchedule.items = schedule.items.map((item: any, index: number) => {
          console.log(`DEBUG ContentContext: Processing item ${index}:`, {
            hasContentItem: 'contentItem' in item,
            hasId: 'id' in item,
            hasType: 'type' in item,
            hasTitle: 'title' in item,
            allProperties: Object.keys(item)
          });
          
          // Check if this item has a contentItem
          if (item.contentItem && typeof item.contentItem === 'object') {
            // Already has contentItem, use as is but ensure it has all required fields
            console.log(`DEBUG ContentContext: Item ${index} already has contentItem`);
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
            console.log(`DEBUG ContentContext: Creating contentItem from top-level properties for item ${index}`);
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
        
        console.log("DEBUG ContentContext: Normalized items count:", normalizedSchedule.items.length);
        
        if (normalizedSchedule.items.length > 0) {
          console.log("DEBUG ContentContext: First normalized item:", {
            id: normalizedSchedule.items[0].id,
            order: normalizedSchedule.items[0].order,
            contentItem: {
              id: normalizedSchedule.items[0].contentItem.id,
              type: normalizedSchedule.items[0].contentItem.type,
              hasContent: !!normalizedSchedule.items[0].contentItem.content
            }
          });
        }
      } else {
        console.log("DEBUG ContentContext: No items found in schedule or not an array");
      }
      
      console.log("DEBUG ContentContext: Final normalized schedule:", {
        id: normalizedSchedule.id,
        name: normalizedSchedule.name,
        itemsCount: normalizedSchedule.items.length
      });
      return normalizedSchedule;
    } catch (error) {
      console.error("Error normalizing schedule data:", error);
      logger.error("ContentContext: Error normalizing schedule data", { error });
      return createFallbackSchedule();
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
        refreshSchedule,
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