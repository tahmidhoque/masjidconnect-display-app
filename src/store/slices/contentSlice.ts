import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { ScreenContent, PrayerTimes, Event, Schedule } from "../../api/models";
import apiClient from "../../api/apiClient";
import syncService from "../../services/syncService";
import storageService from "../../services/storageService";
import logger from "../../utils/logger";

// Constants
const MIN_REFRESH_INTERVAL = 30 * 1000; // Increased from 10 to 30 seconds to prevent rapid firing
const SKIP_PRAYERS = ["Sunrise"]; // Prayers to skip in announcements
const DEFAULT_MASJID_NAME = "Masjid Connect"; // Default masjid name if none is found

// Debounce map to prevent rapid successive calls
const debounceMap = new Map<string, number>();

// State interface
export interface ContentState {
  // Content data
  screenContent: ScreenContent | null;
  prayerTimes: PrayerTimes | null;
  schedule: Schedule | null;
  events: Event[] | null;

  // Masjid information
  masjidName: string | null;
  masjidTimezone: string | null;

  // UI settings
  carouselTime: number;

  // Prayer announcements
  showPrayerAnnouncement: boolean;
  prayerAnnouncementName: string;
  isPrayerJamaat: boolean;

  // Loading states
  isLoading: boolean;
  isLoadingContent: boolean;
  isLoadingPrayerTimes: boolean;
  isLoadingSchedule: boolean;
  isLoadingEvents: boolean;

  // Error states
  contentError: string | null;
  prayerTimesError: string | null;
  scheduleError: string | null;
  eventsError: string | null;

  // Timestamps
  lastUpdated: string | null;
  lastContentUpdate: string | null;
  lastPrayerTimesUpdate: string | null;
  lastScheduleUpdate: string | null;
  lastEventsUpdate: string | null;
}

// Initial state
const initialState: ContentState = {
  screenContent: null,
  prayerTimes: null,
  schedule: null,
  events: null,
  masjidName: DEFAULT_MASJID_NAME,
  masjidTimezone: null,
  carouselTime: 30,
  showPrayerAnnouncement: false,
  prayerAnnouncementName: "",
  isPrayerJamaat: false,
  isLoading: true,
  isLoadingContent: false,
  isLoadingPrayerTimes: false,
  isLoadingSchedule: false,
  isLoadingEvents: false,
  contentError: null,
  prayerTimesError: null,
  scheduleError: null,
  eventsError: null,
  lastUpdated: null,
  lastContentUpdate: null,
  lastPrayerTimesUpdate: null,
  lastScheduleUpdate: null,
  lastEventsUpdate: null,
};

// Helper function to create fallback schedule
const createFallbackSchedule = (): Schedule => ({
  id: "fallback-schedule",
  name: "Default Schedule",
  items: [],
});

// Helper function to normalize schedule data
const normalizeScheduleData = (schedule: any): Schedule => {
  if (!schedule) return createFallbackSchedule();

  try {
    const normalizedSchedule: Schedule = {
      id: schedule.id || "normalized-schedule",
      name: schedule.name || "Schedule",
      items: [],
    };

    // Handle different schedule data formats
    if (Array.isArray(schedule)) {
      normalizedSchedule.items = schedule;
    } else if ("data" in schedule && Array.isArray(schedule.data)) {
      normalizedSchedule.items = schedule.data;
    } else if ("items" in schedule && Array.isArray(schedule.items)) {
      normalizedSchedule.items = schedule.items;
    } else {
      logger.error("Invalid schedule format", { schedule });
      return createFallbackSchedule();
    }

    // Normalize each item
    if (normalizedSchedule.items.length > 0) {
      normalizedSchedule.items = normalizedSchedule.items.map(
        (item: any, index: number) => {
          // Handle Events V2 from schedule items (with eventId and event properties)
          if (item.eventId && item.event) {
            const event = item.event;
            return {
              id: item.id || `item-${index}`,
              order: typeof item.order === "number" ? item.order : index,
              eventId: item.eventId,
              event: event,
              // Also include flattened format for compatibility
              type: "EVENT",
              title: event.title || item.title || "Event",
              duration: event.displayDuration || item.duration || 20,
              content: {
                description: event.description || null,
                shortDescription: event.shortDescription || null,
                startAt:
                  event.startAt?.toISOString?.() || event.startAt || null,
                endAt: event.endAt?.toISOString?.() || event.endAt || null,
                venue: event.venue || null,
                location: event.venue || null,
                bannerUrl:
                  event.displayThumbnail ||
                  event.bannerImageUrl ||
                  event.thumbnailImageUrl ||
                  null,
                imageUrl:
                  event.displayThumbnail ||
                  event.bannerImageUrl ||
                  event.thumbnailImageUrl ||
                  null,
              },
              contentItem: {
                id: event.id || `${item.id}-event`,
                type: "EVENT",
                title: event.title || "Event",
                content: {
                  description: event.description || null,
                  shortDescription: event.shortDescription || null,
                  startAt:
                    event.startAt?.toISOString?.() || event.startAt || null,
                  endAt: event.endAt?.toISOString?.() || event.endAt || null,
                  venue: event.venue || null,
                  location: event.venue || null,
                  bannerUrl:
                    event.displayThumbnail ||
                    event.bannerImageUrl ||
                    event.thumbnailImageUrl ||
                    null,
                  imageUrl:
                    event.displayThumbnail ||
                    event.bannerImageUrl ||
                    event.thumbnailImageUrl ||
                    null,
                },
                duration: event.displayDuration || 20,
              },
            };
          }

          // Handle wrapped format (items with contentItem property)
          if (item.contentItem && typeof item.contentItem === "object") {
            return {
              id: item.id || `item-${index}`,
              order: typeof item.order === "number" ? item.order : index,
              contentItem: {
                id: item.contentItem.id || `${item.id}-content`,
                type: item.contentItem.type || "CUSTOM",
                title: item.contentItem.title || "No Title",
                content: item.contentItem.content || {},
                duration:
                  typeof item.contentItem.duration === "number"
                    ? item.contentItem.duration
                    : 30,
              },
              // Also include flattened format for compatibility
              type: item.contentItem.type || "CUSTOM",
              title: item.contentItem.title || "No Title",
              content: item.contentItem.content || {},
              duration:
                typeof item.contentItem.duration === "number"
                  ? item.contentItem.duration
                  : 30,
            };
          }

          // Handle flattened format (items with direct properties)
          return {
            id: item.id || `item-${index}`,
            order: typeof item.order === "number" ? item.order : index,
            type: item.type || "CUSTOM",
            title: item.title || "No Title",
            content: item.content || {},
            duration: typeof item.duration === "number" ? item.duration : 30,
            contentItem: {
              id: `${item.id || index}-content`,
              type: item.type || "CUSTOM",
              title: item.title || "No Title",
              content: item.content || {},
              duration: typeof item.duration === "number" ? item.duration : 30,
            },
          };
        },
      );
    }

    return normalizedSchedule;
  } catch (error) {
    logger.error("Error normalizing schedule data", { error });
    return createFallbackSchedule();
  }
};

// Helper function to extract masjid name
const extractMasjidName = (content: ScreenContent | null): string => {
  if (!content) return DEFAULT_MASJID_NAME;

  // Look in masjid data first
  if (content.masjid?.name) {
    return content.masjid.name;
  }

  // Look in data.masjid
  if (content.data?.masjid?.name) {
    return content.data.masjid.name;
  }

  // Prayer times don't contain masjid name

  // Look in screen properties
  if (content.screen?.name) {
    return content.screen.name;
  }

  return DEFAULT_MASJID_NAME;
};

// Async thunks
export const refreshContent = createAsyncThunk(
  "content/refreshContent",
  async (
    { forceRefresh = false }: { forceRefresh?: boolean } = {},
    { rejectWithValue, getState },
  ) => {
    try {
      const debounceKey = "refreshContent";
      const now = Date.now();
      const lastCall = debounceMap.get(debounceKey) || 0;

      // Aggressive debouncing to prevent rapid firing (especially in Electron)
      if (!forceRefresh && now - lastCall < MIN_REFRESH_INTERVAL) {
        logger.debug("[Content] Debouncing refresh call - too recent", {
          lastCall: new Date(lastCall).toISOString(),
          timeSince: now - lastCall,
        });
        return { skipped: true, reason: "debounced" };
      }

      debounceMap.set(debounceKey, now);
      logger.debug("[Content] Refreshing content...", { forceRefresh });

      const state = getState() as { content: ContentState };
      const lastUpdate = state.content.lastContentUpdate
        ? new Date(state.content.lastContentUpdate).getTime()
        : 0;

      // Check if we should skip this refresh due to rate limiting
      if (!forceRefresh && now - lastUpdate < MIN_REFRESH_INTERVAL) {
        logger.debug("[Content] Skipping refresh due to rate limiting");
        return { skipped: true, reason: "rate_limited" };
      }

      // Use sync service for robust data fetching
      if (forceRefresh) {
        await syncService.forceRefresh();
      } else {
        await syncService.syncContent();
      }

      // Get the content from storage after sync
      const content = await storageService.getScreenContent();

      if (!content) {
        throw new Error("No content received from server");
      }

      // Extract masjid information
      const masjidName = extractMasjidName(content);
      const masjidTimezone =
        content.masjid?.timezone || content.data?.masjid?.timezone || null;

      // Extract and store masjidId if available (for WebSocket connection)
      // This handles cases where the backend includes masjidId in the content response
      const masjidId =
        content.masjid?.id || content.data?.masjid?.id || null;
      if (masjidId) {
        const existingMasjidId = localStorage.getItem("masjid_id");
        if (!existingMasjidId || existingMasjidId !== masjidId) {
          localStorage.setItem("masjid_id", masjidId);
          logger.info("[Content] Stored masjidId from content response", { masjidId });
        }
      }

      // Update carousel time if specified in content
      let carouselTime = 30; // default
      if (content.screen?.contentConfig?.carouselInterval) {
        carouselTime = Math.max(
          5,
          Math.min(300, content.screen.contentConfig.carouselInterval),
        ); // 5-300 seconds
      }

      return {
        content: content || null,
        masjidName: masjidName || null,
        masjidTimezone: masjidTimezone || null,
        carouselTime: carouselTime || 30,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("[Content] Error refreshing content", { error });
      return rejectWithValue(error.message || "Failed to refresh content");
    }
  },
);

export const refreshPrayerTimes = createAsyncThunk(
  "content/refreshPrayerTimes",
  async (options: { forceRefresh?: boolean } = {}, { rejectWithValue }) => {
    try {
      const { forceRefresh = false } = options;
      const debounceKey = "refreshPrayerTimes";
      const now = Date.now();
      const lastCall = debounceMap.get(debounceKey) || 0;

      // Allow force refresh to bypass debouncing
      if (!forceRefresh && now - lastCall < MIN_REFRESH_INTERVAL) {
        logger.debug("[Content] Debouncing prayer times refresh - too recent", {
          lastCall: new Date(lastCall).toISOString(),
          timeSince: now - lastCall,
        });
        return { skipped: true, reason: "debounced" };
      }

      debounceMap.set(debounceKey, now);
      logger.debug("[Content] Refreshing prayer times...");

      // First, try to sync prayer times separately (but don't fail if it doesn't work)
      try {
        await syncService.syncPrayerTimes();
        logger.debug("[Content] Prayer times sync completed successfully");
      } catch (syncError) {
        logger.warn(
          "[Content] Prayer times sync failed, falling back to cached data",
          { error: syncError },
        );
      }

      // Try to get prayer times from storage
      let prayerTimes = await storageService.getPrayerTimes();

      // If no prayer times found separately, try to extract from screen content
      if (!prayerTimes) {
        logger.info(
          "[Content] No separate prayer times found, extracting from screen content...",
        );
        const screenContent = await storageService.getScreenContent();

        if (screenContent) {
          // Try different possible locations for prayer times in screen content
          if (screenContent.prayerTimes) {
            prayerTimes = screenContent.prayerTimes;
            logger.info(
              "[Content] Extracted prayer times from screenContent.prayerTimes",
            );
          } else if ((screenContent as any).data?.prayerTimes) {
            prayerTimes = (screenContent as any).data.prayerTimes;
            logger.info(
              "[Content] Extracted prayer times from screenContent.data.prayerTimes",
            );
          }

          // If we found prayer times in screen content, save them separately for future use
          if (prayerTimes) {
            await storageService.savePrayerTimes(prayerTimes);
            logger.info(
              "[Content] Saved extracted prayer times separately for future use",
            );
          }
        }
      }

      if (!prayerTimes) {
        logger.warn(
          "[Content] No prayer times found in storage or screen content",
        );
        throw new Error("No prayer times found in storage or screen content");
      }

      logger.info("[Content] Successfully loaded prayer times", {
        hasData: !!prayerTimes,
        isArray: Array.isArray(prayerTimes),
        dataKeys:
          prayerTimes && typeof prayerTimes === "object"
            ? Object.keys(prayerTimes)
            : [],
      });

      return {
        prayerTimes,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("[Content] Error refreshing prayer times", { error });
      return rejectWithValue(error.message || "Failed to refresh prayer times");
    }
  },
);

export const refreshSchedule = createAsyncThunk(
  "content/refreshSchedule",
  async (
    { forceRefresh = false }: { forceRefresh?: boolean } = {},
    { rejectWithValue, getState },
  ) => {
    try {
      logger.debug("[Content] Refreshing schedule...", { forceRefresh });

      const state = getState() as { content: ContentState };
      const now = Date.now();
      const lastUpdate = state.content.lastScheduleUpdate
        ? new Date(state.content.lastScheduleUpdate).getTime()
        : 0;

      // Check if we should skip this refresh due to rate limiting
      if (!forceRefresh && now - lastUpdate < MIN_REFRESH_INTERVAL) {
        logger.debug(
          "[Content] Skipping schedule refresh due to rate limiting",
        );
        return { skipped: true };
      }

      // Schedule is synced as part of content sync
      await syncService.syncContent();

      // Get the schedule from storage after sync
      const scheduleData = await storageService.getSchedule();

      if (!scheduleData) {
        logger.warn("[Content] No schedule data received, using fallback", {});
        return {
          schedule: createFallbackSchedule(),
          timestamp: new Date().toISOString(),
        };
      }

      const normalizedSchedule = normalizeScheduleData(scheduleData);

      return {
        schedule: normalizedSchedule,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("[Content] Error refreshing schedule", { error });
      return rejectWithValue(error.message || "Failed to refresh schedule");
    }
  },
);

export const refreshEvents = createAsyncThunk(
  "content/refreshEvents",
  async (_, { rejectWithValue }) => {
    try {
      logger.debug("[Content] Refreshing events...");

      // Get existing events from storage for now
      const events = await storageService.getEvents();

      return {
        events: events || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("[Content] Error refreshing events", { error });
      return rejectWithValue(error.message || "Failed to refresh events");
    }
  },
);

export const refreshAllContent = createAsyncThunk(
  "content/refreshAllContent",
  async (
    { forceRefresh = false }: { forceRefresh?: boolean } = {},
    { dispatch },
  ) => {
    try {
      logger.debug("[Content] Refreshing all content...", { forceRefresh });

      // Refresh all content in parallel for better performance
      const results = await Promise.allSettled([
        dispatch(refreshContent({ forceRefresh })),
        dispatch(refreshPrayerTimes({ forceRefresh: true })),
        dispatch(refreshSchedule({ forceRefresh })),
        dispatch(refreshEvents()),
      ]);

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const names = ["content", "prayerTimes", "schedule", "events"];
          logger.warn(`[Content] Failed to refresh ${names[index]}`, {
            reason: result.reason,
          });
        }
      });

      return {
        timestamp: new Date().toISOString(),
        results: results.map((r) => r.status),
      };
    } catch (error: any) {
      logger.error("[Content] Error refreshing all content", { error });
      throw error;
    }
  },
);

// Slice
const contentSlice = createSlice({
  name: "content",
  initialState,
  reducers: {
    // Synchronous actions
    setCarouselTime: (state, action: PayloadAction<number>) => {
      state.carouselTime = Math.max(5, Math.min(300, action.payload)); // 5-300 seconds
    },

    setPrayerAnnouncement: (
      state,
      action: PayloadAction<{
        show: boolean;
        prayerName?: string;
        isJamaat?: boolean;
      }>,
    ) => {
      state.showPrayerAnnouncement = action.payload.show;
      if (action.payload.prayerName !== undefined) {
        state.prayerAnnouncementName = action.payload.prayerName;
      }
      if (action.payload.isJamaat !== undefined) {
        state.isPrayerJamaat = action.payload.isJamaat;
      }
    },

    setShowPrayerAnnouncement: (state, action: PayloadAction<boolean>) => {
      state.showPrayerAnnouncement = action.payload;
    },

    setPrayerAnnouncementName: (state, action: PayloadAction<string>) => {
      state.prayerAnnouncementName = action.payload;
    },

    setIsPrayerJamaat: (state, action: PayloadAction<boolean>) => {
      state.isPrayerJamaat = action.payload;
    },

    clearContentError: (state) => {
      state.contentError = null;
    },

    clearPrayerTimesError: (state) => {
      state.prayerTimesError = null;
    },

    clearScheduleError: (state) => {
      state.scheduleError = null;
    },

    clearEventsError: (state) => {
      state.eventsError = null;
    },

    clearAllErrors: (state) => {
      state.contentError = null;
      state.prayerTimesError = null;
      state.scheduleError = null;
      state.eventsError = null;
    },

    setLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    // Refresh content
    builder
      .addCase(refreshContent.pending, (state) => {
        state.isLoadingContent = true;
        state.contentError = null;
      })
      .addCase(refreshContent.fulfilled, (state, action) => {
        state.isLoadingContent = false;

        if (!action.payload.skipped) {
          state.screenContent = action.payload.content || null;
          state.masjidName = action.payload.masjidName || null;
          state.masjidTimezone = action.payload.masjidTimezone || null;
          state.carouselTime = action.payload.carouselTime || 30;
          state.lastContentUpdate = action.payload.timestamp || null;
          state.lastUpdated = action.payload.timestamp || null;
        }

        // Update general loading state - only stay loading if others are still loading
        const stillLoading =
          state.isLoadingPrayerTimes ||
          state.isLoadingSchedule ||
          state.isLoadingEvents;
        state.isLoading = stillLoading;

        if (!stillLoading) {
          logger.info(
            "[ContentSlice] Content refresh complete, all loading finished",
          );
        }
      })
      .addCase(refreshContent.rejected, (state, action) => {
        state.isLoadingContent = false;
        state.contentError = action.payload as string;
        state.isLoading =
          state.isLoadingPrayerTimes ||
          state.isLoadingSchedule ||
          state.isLoadingEvents;
      });

    // Refresh prayer times
    builder
      .addCase(refreshPrayerTimes.pending, (state) => {
        state.isLoadingPrayerTimes = true;
        state.prayerTimesError = null;
      })
      .addCase(refreshPrayerTimes.fulfilled, (state, action) => {
        state.isLoadingPrayerTimes = false;

        // Skip update if this was debounced
        if (!action.payload.skipped) {
          // Handle both single PrayerTimes object and array format
          const prayerTimes = action.payload.prayerTimes;
          if (Array.isArray(prayerTimes)) {
            // If it's an array, take the first element (today's prayer times)
            state.prayerTimes = prayerTimes[0] || null;
          } else {
            state.prayerTimes = prayerTimes || null;
          }
          state.lastPrayerTimesUpdate =
            action.payload.timestamp || new Date().toISOString();
          state.lastUpdated =
            action.payload.timestamp || new Date().toISOString();
        }

        // Update general loading state - only stay loading if others are still loading
        const stillLoading =
          state.isLoadingContent ||
          state.isLoadingSchedule ||
          state.isLoadingEvents;
        state.isLoading = stillLoading;

        if (!stillLoading) {
          logger.info(
            "[ContentSlice] Prayer times refresh complete, all loading finished",
          );
        }
      })
      .addCase(refreshPrayerTimes.rejected, (state, action) => {
        state.isLoadingPrayerTimes = false;
        state.prayerTimesError = action.payload as string;
        state.isLoading =
          state.isLoadingContent ||
          state.isLoadingSchedule ||
          state.isLoadingEvents;
      });

    // Refresh schedule
    builder
      .addCase(refreshSchedule.pending, (state) => {
        state.isLoadingSchedule = true;
        state.scheduleError = null;
      })
      .addCase(refreshSchedule.fulfilled, (state, action) => {
        state.isLoadingSchedule = false;

        if (!action.payload.skipped) {
          state.schedule = action.payload.schedule || null;
          state.lastScheduleUpdate = action.payload.timestamp || null;
          state.lastUpdated = action.payload.timestamp || null;
        }

        // Update general loading state
        state.isLoading =
          state.isLoadingContent ||
          state.isLoadingPrayerTimes ||
          state.isLoadingEvents;
      })
      .addCase(refreshSchedule.rejected, (state, action) => {
        state.isLoadingSchedule = false;
        state.scheduleError = action.payload as string;
        state.isLoading =
          state.isLoadingContent ||
          state.isLoadingPrayerTimes ||
          state.isLoadingEvents;
      });

    // Refresh events
    builder
      .addCase(refreshEvents.pending, (state) => {
        state.isLoadingEvents = true;
        state.eventsError = null;
      })
      .addCase(refreshEvents.fulfilled, (state, action) => {
        state.isLoadingEvents = false;
        state.events = action.payload.events;
        state.lastEventsUpdate = action.payload.timestamp;
        state.lastUpdated = action.payload.timestamp;

        // Update general loading state
        state.isLoading =
          state.isLoadingContent ||
          state.isLoadingPrayerTimes ||
          state.isLoadingSchedule;
      })
      .addCase(refreshEvents.rejected, (state, action) => {
        state.isLoadingEvents = false;
        state.eventsError = action.payload as string;
        state.isLoading =
          state.isLoadingContent ||
          state.isLoadingPrayerTimes ||
          state.isLoadingSchedule;
      });

    // Refresh all content
    builder
      .addCase(refreshAllContent.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshAllContent.fulfilled, (state, action) => {
        state.lastUpdated = action.payload.timestamp;
        // CRITICAL FIX: Explicitly set isLoading to false when all content refresh completes
        // This ensures the loading screen doesn't hang after pairing
        state.isLoading = false;
        logger.info(
          "[ContentSlice] All content refresh completed, setting isLoading=false",
        );
      })
      .addCase(refreshAllContent.rejected, (state, action) => {
        // Individual errors will be set by individual refresh actions
        state.isLoading = false;
        logger.warn(
          "[ContentSlice] All content refresh failed, setting isLoading=false",
        );
      });
  },
});

// Export actions
export const {
  setCarouselTime,
  setPrayerAnnouncement,
  setShowPrayerAnnouncement,
  setPrayerAnnouncementName,
  setIsPrayerJamaat,
  clearContentError,
  clearPrayerTimesError,
  clearScheduleError,
  clearEventsError,
  clearAllErrors,
  setLastUpdated,
} = contentSlice.actions;

// Selectors
export const selectIsLoading = (state: { content: ContentState }) =>
  state.content.isLoading;
export const selectScreenContent = (state: { content: ContentState }) =>
  state.content.screenContent;
export const selectPrayerTimes = (state: { content: ContentState }) =>
  state.content.prayerTimes;
export const selectSchedule = (state: { content: ContentState }) =>
  state.content.schedule;
export const selectEvents = (state: { content: ContentState }) =>
  state.content.events;
export const selectMasjidName = (state: { content: ContentState }) =>
  state.content.masjidName;
export const selectMasjidTimezone = (state: { content: ContentState }) =>
  state.content.masjidTimezone;
export const selectCarouselTime = (state: { content: ContentState }) =>
  state.content.carouselTime;
export const selectShowPrayerAnnouncement = (state: {
  content: ContentState;
}) => state.content.showPrayerAnnouncement;
export const selectPrayerAnnouncementName = (state: {
  content: ContentState;
}) => state.content.prayerAnnouncementName;
export const selectIsPrayerJamaat = (state: { content: ContentState }) =>
  state.content.isPrayerJamaat;
export const selectLastUpdated = (state: { content: ContentState }) =>
  state.content.lastUpdated;
export const selectContentError = (state: { content: ContentState }) =>
  state.content.contentError;
export const selectPrayerTimesError = (state: { content: ContentState }) =>
  state.content.prayerTimesError;
export const selectScheduleError = (state: { content: ContentState }) =>
  state.content.scheduleError;
export const selectEventsError = (state: { content: ContentState }) =>
  state.content.eventsError;

// Loading selectors
export const selectIsLoadingContent = (state: { content: ContentState }) =>
  state.content.isLoadingContent;
export const selectIsLoadingPrayerTimes = (state: { content: ContentState }) =>
  state.content.isLoadingPrayerTimes;
export const selectIsLoadingSchedule = (state: { content: ContentState }) =>
  state.content.isLoadingSchedule;
export const selectIsLoadingEvents = (state: { content: ContentState }) =>
  state.content.isLoadingEvents;

export default contentSlice.reducer;
