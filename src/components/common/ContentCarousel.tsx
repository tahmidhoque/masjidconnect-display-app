import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { Box, Typography, Fade, CircularProgress, Paper } from "@mui/material";
import { Image as ImageIcon } from "@mui/icons-material";
import { useAppSelector, selectCarouselData } from "../../store/hooks";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import IslamicPatternBackground from "./IslamicPatternBackground";
import { NoMobilePhoneIcon, PrayerRowsIcon } from "../../assets/svgComponent";
import logger from "../../utils/logger";
import localforage from "localforage";
import ModernContentCard from "./ModernContentCard";
import { Event, Schedule } from "../../api/models";
import storageService from "../../services/storageService";
import { isLowPowerDevice, throttle } from "../../utils/performanceUtils";

// Define content types enum to match API
type ContentItemType =
  | "VERSE_HADITH"
  | "ANNOUNCEMENT"
  | "EVENT"
  | "CUSTOM"
  | "ASMA_AL_HUSNA";

// Additional types for internal handling
type ExtendedContentItemType = ContentItemType | "HADITH";

interface ContentItem {
  id: string;
  title: string;
  content: any;
  type: ContentItemType;
  duration: number;
  reference?: string;
}

interface ContentCarouselProps {
  variant?: "portrait" | "landscape";
}

// Helper function to format newlines in text
const formatTextWithNewlines = (text: string) => {
  if (!text) return "";
  return text.split("\n").map((line, index) => (
    <React.Fragment key={index}>
      {line}
      {index < text.split("\n").length - 1 && <br />}
    </React.Fragment>
  ));
};

// Optimized component to memoize text formatting
const MemoizedFormattedText = memo(({ text }: { text: string }) => (
  <>{formatTextWithNewlines(text)}</>
));

// Use direct color values for content types
const contentTypeConfig: Record<
  ExtendedContentItemType,
  {
    title: string;
    titleColor: string;
    textColor: string;
    colorType?: "primary" | "secondary" | "info";
    isUrgent?: boolean;
  }
> = {
  VERSE_HADITH: {
    title: "Verse from the Quran",
    titleColor: "#2A9D8F",
    textColor: "#FFFFFF",
    colorType: "secondary",
  },
  HADITH: {
    title: "Hadith of the Day",
    titleColor: "#2A9D8F",
    textColor: "#FFFFFF",
    colorType: "secondary",
  },
  ANNOUNCEMENT: {
    title: "Announcement",
    titleColor: "#3B82F6",
    textColor: "#FFFFFF",
    colorType: "info",
  },
  EVENT: {
    title: "Upcoming Event",
    titleColor: "#8B5CF6",
    textColor: "#FFFFFF",
    colorType: "primary",
  },
  ASMA_AL_HUSNA: {
    title: "Names of Allah",
    titleColor: "#F59E0B",
    textColor: "#FFFFFF",
    colorType: "secondary",
  },
  CUSTOM: {
    title: "Information",
    titleColor: "#0A2647",
    textColor: "#FFFFFF",
    colorType: "primary",
  },
};

// Helper function to get content type config safely
const getContentTypeConfig = (
  type: string | undefined,
): (typeof contentTypeConfig)[ExtendedContentItemType] => {
  if (!type || !(type in contentTypeConfig)) {
    return contentTypeConfig["CUSTOM"];
  }
  return contentTypeConfig[type as ExtendedContentItemType];
};

// Map schedule item to component props
interface ScheduleItem {
  id: string;
  order: number;
  contentItem: ContentItem;
}

// Define prayer announcement UI options
interface AnnouncementConfig {
  prayerName: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  variant: "jamaat" | "adhan";
}

/**
 * ContentCarousel component
 *
 * Displays content items in a carousel/slideshow format.
 * Automatically rotates through items based on their specified duration.
 * Also displays prayer announcements when prayer times are reached.
 */
const ContentCarousel: React.FC<ContentCarouselProps> = ({ variant }) => {
  // Use optimized selector to reduce re-renders
  const {
    schedule,
    events,
    masjidName,
    isLoading: isContentLoading,
    carouselTime,
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
    orientation,
  } = useAppSelector(selectCarouselData);

  // Debug log to see what we're receiving from Redux
  useEffect(() => {
    logger.info("[ContentCarousel] Redux state updated", {
      hasSchedule: !!schedule,
      scheduleId: schedule?.id,
      scheduleItemsCount: schedule?.items?.length,
      eventsCount: events?.length,
      isLoading: isContentLoading,
    });
  }, [schedule, events, isContentLoading]);

  // For now, create a simple refreshSchedule function that logs (to be implemented with Redux actions later)
  const refreshSchedule = useCallback((forceRefresh: boolean) => {
    console.log("refreshSchedule called with forceRefresh:", forceRefresh);
    return Promise.resolve();
  }, []);

  const { fontSizes, screenSize } = useResponsiveFontSize();

  // Local state for content management
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showContent, setShowContent] = useState(true);
  const [contentItems, setContentItems] = useState<Array<any>>([]);
  const [isChangingItem, setIsChangingItem] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [currentItemDisplayTime, setCurrentItemDisplayTime] = useState(30000); // Default 30 seconds
  const [contentLoading, setContentLoading] = useState(true);
  const [hasCheckedLocalStorage, setHasCheckedLocalStorage] = useState(false);

  // Use refs to manage state without unnecessary rerenders
  const contentItemsRef = useRef<Array<any>>([]);
  const hasRefreshedRef = useRef(false);
  const isComponentMountedRef = useRef(true);
  const hasUserInteracted = useRef(false);
  const lastInteractionTime = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnnouncementState = useRef<boolean>(false);
  const lastOrientationRef = useRef<string>(orientation);

  // Refs to prevent unnecessary re-processing
  const lastProcessedSchedule = useRef<Schedule | null>(null);
  const lastProcessedEvents = useRef<Event[] | null>(null);

  // Constants
  const defaultDuration = 30; // Default duration in seconds
  const userInteractionTimeout = 60000; // 1 minute before resuming auto-rotation after user interaction
  const FADE_TRANSITION_DURATION = 500; // Duration for fade transitions

  // Auto-scroll constants
  const READING_SPEED_CHARS_PER_SECOND = 3.5; // ~200 words/minute = ~3.5 chars/second
  const MIN_DISPLAY_TIME_MS = 5000; // Minimum 5 seconds per item
  const SCROLL_PAUSE_AT_BOTTOM_MS = 2000; // Pause 2 seconds at bottom before next item
  const SCROLL_SPEED_PX_PER_SECOND = 50; // Smooth scroll speed

  // Preload next content item to avoid flashing
  const [nextItemIndex, setNextItemIndex] = useState<number | null>(null);

  // Image loading states
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [imageError, setImageError] = useState<{ [key: string]: boolean }>({});

  // Auto-scroll refs and state
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollableContentRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const [needsAutoScroll, setNeedsAutoScroll] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollStartTimeRef = useRef<number>(0);
  const scrollStartPositionRef = useRef<number>(0);
  const scrollEndPositionRef = useRef<number>(0);
  const scrollDurationRef = useRef<number>(0);
  const totalDisplayTimeRef = useRef<number>(0);
  const scrollPhaseRef = useRef<"down" | "up" | "complete">("down");

  // Detect content overflow and calculate scroll timing
  const detectOverflowAndCalculateTiming = useCallback(() => {
    if (!scrollableContentRef.current || !contentContainerRef.current) {
      setNeedsAutoScroll(false);
      return { needsScroll: false, scrollDuration: 0, totalDisplayTime: 0 };
    }

    const container = contentContainerRef.current;
    const content = scrollableContentRef.current;

    // Get actual scrollable dimensions
    const containerHeight = container.clientHeight;
    const contentHeight = content.scrollHeight;
    const scrollDistance = Math.max(0, contentHeight - containerHeight);

    // Check if content overflows
    const needsScroll = scrollDistance > 10; // 10px threshold for overflow

    if (!needsScroll) {
      setNeedsAutoScroll(false);
      return { needsScroll: false, scrollDuration: 0, totalDisplayTime: 0 };
    }

    // Calculate scroll duration based on content length and reading speed
    const contentText = content.textContent || "";
    const charCount = contentText.length;

    // Base reading time: characters / reading speed
    const readingTimeMs = (charCount / READING_SPEED_CHARS_PER_SECOND) * 1000;

    // Scroll animation time: distance / scroll speed (for one direction)
    const scrollAnimationTimeMs =
      (scrollDistance / SCROLL_SPEED_PX_PER_SECOND) * 1000;

    // Scroll duration is the animation time for one direction
    const scrollDuration = Math.max(1000, scrollAnimationTimeMs); // Minimum 1 second scroll

    // Total time needed: initial pause + scroll down + pause at bottom + scroll up
    const initialPauseMs = 1000; // 1 second pause at top
    const totalTimeNeeded =
      initialPauseMs +
      scrollDuration +
      SCROLL_PAUSE_AT_BOTTOM_MS +
      scrollDuration;

    // Ensure minimum display time
    const totalDisplayTime = Math.max(MIN_DISPLAY_TIME_MS, totalTimeNeeded);

    setNeedsAutoScroll(true);
    scrollStartPositionRef.current = 0;
    scrollEndPositionRef.current = scrollDistance;
    scrollDurationRef.current = scrollDuration;
    totalDisplayTimeRef.current = totalDisplayTime;

    logger.debug("ContentCarousel: Overflow detected", {
      containerHeight,
      contentHeight,
      scrollDistance,
      charCount,
      readingTimeMs,
      scrollAnimationTimeMs,
      totalDisplayTime,
      scrollDuration,
    });

    return { needsScroll, scrollDuration, totalDisplayTime };
  }, []);

  // Smooth auto-scroll animation using requestAnimationFrame
  // Scrolls down to bottom, then back up to top
  const performAutoScroll = useCallback(() => {
    if (!scrollableContentRef.current || !needsAutoScroll) {
      setIsScrolling(false);
      scrollPhaseRef.current = "complete";
      return;
    }

    const scrollDown = () => {
      if (!scrollableContentRef.current) {
        setIsScrolling(false);
        scrollPhaseRef.current = "complete";
        return;
      }

      const startTime = Date.now();
      const startPosition = scrollableContentRef.current.scrollTop;
      // Ensure we scroll to the actual maximum scroll position
      const maxScroll =
        scrollableContentRef.current.scrollHeight -
        scrollableContentRef.current.clientHeight;
      const endPosition = Math.max(scrollEndPositionRef.current, maxScroll);
      const duration = scrollDurationRef.current;

      setIsScrolling(true);
      scrollPhaseRef.current = "down";

      const animateDown = () => {
        if (!scrollableContentRef.current) {
          setIsScrolling(false);
          scrollPhaseRef.current = "complete";
          return;
        }

        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in-out easing function for smooth scrolling
        const easeInOut =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentPosition =
          startPosition + (endPosition - startPosition) * easeInOut;
        scrollableContentRef.current.scrollTop = currentPosition;

        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(animateDown);
        } else {
          // Reached bottom, pause then scroll back up
          setTimeout(() => {
            scrollUp();
          }, SCROLL_PAUSE_AT_BOTTOM_MS);
        }
      };

      scrollAnimationRef.current = requestAnimationFrame(animateDown);
    };

    const scrollUp = () => {
      if (!scrollableContentRef.current) {
        setIsScrolling(false);
        scrollPhaseRef.current = "complete";
        return;
      }

      const startTime = Date.now();
      const startPosition = scrollableContentRef.current.scrollTop;
      const endPosition = 0;
      const duration = scrollDurationRef.current;

      scrollPhaseRef.current = "up";

      const animateUp = () => {
        if (!scrollableContentRef.current) {
          setIsScrolling(false);
          scrollPhaseRef.current = "complete";
          return;
        }

        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in-out easing function for smooth scrolling
        const easeInOut =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentPosition =
          startPosition + (endPosition - startPosition) * easeInOut;
        scrollableContentRef.current.scrollTop = currentPosition;

        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(animateUp);
        } else {
          // Reached top, scrolling complete
          setIsScrolling(false);
          scrollPhaseRef.current = "complete";
          scrollAnimationRef.current = null;
        }
      };

      scrollAnimationRef.current = requestAnimationFrame(animateUp);
    };

    // Start scrolling down
    scrollDown();
  }, [needsAutoScroll]);

  // Stop auto-scroll animation
  const stopAutoScroll = useCallback(() => {
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    setIsScrolling(false);
  }, []);

  // Reset scroll position when content changes
  const resetScrollPosition = useCallback(() => {
    if (scrollableContentRef.current) {
      scrollableContentRef.current.scrollTop = 0;
    }
    stopAutoScroll();
    setNeedsAutoScroll(false);
    setIsScrolling(false);
    scrollDurationRef.current = 0;
    totalDisplayTimeRef.current = 0;
    scrollPhaseRef.current = "down";
  }, [stopAutoScroll]);

  // Log when content context changes
  useEffect(() => {
    logger.debug("ContentCarousel: Content context data updated", {
      hasSchedule: !!schedule,
      scheduleItemsCount: schedule?.items?.length || 0,
      scheduleId: schedule?.id || "unknown",
      scheduleName: schedule?.name || "unknown",
      eventsCount: events?.length || 0,
      masjidName: masjidName || "unknown",
    });

    setHasCheckedLocalStorage(true);
  }, [schedule, events, masjidName]);

  // Process the schedule and events into content items - optimized to prevent unnecessary processing
  useEffect(() => {
    if (!isComponentMountedRef.current) return;

    // Skip processing if data hasn't changed
    if (
      lastProcessedSchedule.current === schedule &&
      lastProcessedEvents.current === events
    ) {
      return;
    }

    lastProcessedSchedule.current = schedule;
    lastProcessedEvents.current = events;

    let processedItems: any[] = [];

    // Process schedule items if available
    if (schedule?.items && schedule.items.length > 0) {
      logger.debug("ContentCarousel: Processing schedule items", {
        count: schedule.items.length,
      });

      // Map schedule items to content items
      // Handle both formats: wrapped (contentItem) and flattened (direct properties)
      const scheduleItems = schedule.items
        .map((item: any, index: number) => {
          // Handle Events V2 from schedule items (with event property)
          if (item.eventId && item.event) {
            const event = item.event;
            logger.debug(
              `ContentCarousel: Processing event from schedule item`,
              {
                eventId: event.id,
                title: event.title,
              },
            );

            return {
              id: item.id || `schedule-event-${index}`,
              order: item.order || index,
              contentItem: {
                id: event.id || `event-${index}`,
                title: event.title || "Event",
                content: event.content || {
                  description: event.description || null,
                  shortDescription: event.shortDescription || null,
                  startAt: event.startAt || event.content?.startAt || null,
                  endAt: event.endAt || event.content?.endAt || null,
                  venue: event.venue || event.content?.venue || null,
                  location: event.venue || event.content?.location || null,
                  bannerUrl:
                    event.displayThumbnail ||
                    event.bannerImageUrl ||
                    event.content?.bannerUrl ||
                    event.content?.imageUrl ||
                    null,
                  imageUrl:
                    event.displayThumbnail ||
                    event.bannerImageUrl ||
                    event.content?.imageUrl ||
                    event.content?.bannerUrl ||
                    null,
                },
                type: "EVENT",
                duration: event.displayDuration || event.duration || 20,
              },
              startDate: event.startAt || event.content?.startAt || null,
              endDate: event.endAt || event.content?.endAt || null,
              location:
                event.venue ||
                event.content?.venue ||
                event.content?.location ||
                null,
            };
          }

          // Handle flattened format (items with direct properties like id, title, type, content, duration)
          // This format is used by /api/screens/content/route.ts
          if (item.type && (item.title || item.content)) {
            logger.debug(
              `ContentCarousel: Processing flattened schedule item`,
              {
                id: item.id,
                type: item.type,
                title: item.title,
              },
            );

            // Handle events in flattened format
            if (item.type === "EVENT") {
              const eventContent = item.content || {};
              return {
                id: item.id || `schedule-event-${index}`,
                order: item.order !== undefined ? item.order : index,
                contentItem: {
                  id: item.id || `event-${index}`,
                  title: item.title || "Event",
                  content: eventContent,
                  type: "EVENT",
                  duration:
                    typeof item.duration === "number" ? item.duration : 20,
                },
                startDate:
                  eventContent.startAt || eventContent.startDate || null,
                endDate: eventContent.endAt || eventContent.endDate || null,
                location: eventContent.venue || eventContent.location || null,
              };
            }

            // Handle other content types in flattened format
            return {
              id: item.id || `schedule-item-${index}`,
              order: item.order !== undefined ? item.order : index,
              contentItem: {
                id: item.id || `content-${index}`,
                title: item.title || "No Title",
                content: item.content || "No Content",
                type: item.type || "CUSTOM",
                duration:
                  typeof item.duration === "number" ? item.duration : 30,
              },
            };
          }

          // Handle wrapped format (items with contentItem property)
          if (item.contentItem) {
            const contentItem = item.contentItem;

            return {
              id: item.id || `schedule-item-${index}`,
              order: item.order !== undefined ? item.order : index,
              contentItem: {
                id: contentItem.id || `content-${index}`,
                title: contentItem.title || "No Title",
                content: contentItem.content || "No Content",
                type: contentItem.type || "CUSTOM",
                duration:
                  typeof contentItem.duration === "number"
                    ? contentItem.duration
                    : 30,
              },
            };
          }

          // Log items that don't match any expected format
          logger.debug(
            `ContentCarousel: Item ${index} doesn't match expected formats`,
            {
              item,
              hasType: !!item.type,
              hasTitle: !!item.title,
              hasContentItem: !!item.contentItem,
              hasEvent: !!item.event,
              hasEventId: !!item.eventId,
            },
          );
          return null;
        })
        .filter(Boolean);

      if (scheduleItems.length > 0) {
        processedItems = [...scheduleItems];
        logger.debug("ContentCarousel: Added schedule items", {
          count: scheduleItems.length,
        });
      }
    } else {
      logger.debug("ContentCarousel: No schedule items available");
    }

    // Add event items if available
    if (events && events.length > 0) {
      const eventItems = events.map((event, index) => {
        return {
          id: event.id || `event-${index}`,
          order: 999, // Place events after scheduled content
          contentItem: {
            id: event.id || `event-content-${index}`,
            title: event.title || "Event",
            content:
              typeof event.description === "string"
                ? event.description
                : "No description available",
            type: "EVENT",
            duration: 20,
          },
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
        };
      });

      processedItems = [...processedItems, ...eventItems];
      logger.debug("ContentCarousel: Added event items", {
        count: eventItems.length,
      });
    }

    // Sort items by order
    processedItems.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Update content items if they've changed
    if (
      processedItems.length > 0 &&
      JSON.stringify(processedItems) !== JSON.stringify(contentItemsRef.current)
    ) {
      logger.debug("ContentCarousel: Updating content items", {
        count: processedItems.length,
      });
      contentItemsRef.current = processedItems;
      setContentItems(processedItems);
      setCurrentItemIndex(0);
      setContentLoading(false);
    } else if (processedItems.length === 0 && contentItems.length === 0) {
      // Still set loading to false if there are no items to show
      setContentLoading(false);
    }
  }, [schedule, events]);

  // Initial content refresh
  useEffect(() => {
    if (!hasRefreshedRef.current) {
      logger.info("ContentCarousel: Initial schedule refresh");
      hasRefreshedRef.current = true;
      refreshSchedule(true).catch((error) => {
        logger.error("Failed to refresh schedule:", error);
      });
    }

    return () => {
      isComponentMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      stopAutoScroll();
    };
  }, [refreshSchedule, stopAutoScroll]);

  // Handle auto-rotation
  useEffect(() => {
    // Skip if loading or no items
    if (contentLoading || contentItems.length === 0) {
      return;
    }

    // Skip rotation during prayer announcements
    if (showPrayerAnnouncement) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Set up the timer for auto-rotation
    if (autoRotate && !hasUserInteracted.current) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Get the display time for the current item
      const currentItem = contentItems[currentItemIndex];
      const displayTimeSeconds =
        currentItem?.contentItem?.duration || defaultDuration;

      let displayTimeMs = displayTimeSeconds * 1000;

      // If auto-scroll might be needed, wait a bit for overflow detection to complete
      // This ensures we have the correct timing before setting the rotation timer
      const setupRotationTimer = () => {
        // Re-check if auto-scroll is needed now that detection might have completed
        if (needsAutoScroll && totalDisplayTimeRef.current > 0) {
          // Use the stored total display time (includes scroll down + pause + scroll up)
          displayTimeMs = Math.max(displayTimeMs, totalDisplayTimeRef.current);
        }

        setCurrentItemDisplayTime(displayTimeMs);

        // Start a timer to change to the next item
        timerRef.current = setTimeout(() => {
          // Only proceed if we have more than one item
          if (contentItems.length <= 1) return;

          // Preload next item for smoother transition
          const nextIdx = (currentItemIndex + 1) % contentItems.length;
          setNextItemIndex(nextIdx);

          // Signal we're changing items (causes a fade out)
          setIsChangingItem(true);

          // Short timeout to allow fade out to complete
          setTimeout(() => {
            // Change to the next item
            setCurrentItemIndex(nextIdx);
            setNextItemIndex(null);

            // Short timeout before fading back in with the new item
            setTimeout(() => {
              setIsChangingItem(false);
            }, 50); // Very short delay to ensure DOM update
          }, FADE_TRANSITION_DURATION - 50); // Slightly less than full transition time
        }, displayTimeMs);
      };

      // If we might need auto-scroll, wait a bit for overflow detection
      let checkTimeout: NodeJS.Timeout | null = null;
      if (scrollDurationRef.current === 0) {
        // Wait for overflow detection to complete (up to 300ms)
        checkTimeout = setTimeout(() => {
          setupRotationTimer();
        }, 300);
      } else {
        // Timing already calculated, proceed immediately
        setupRotationTimer();
      }

      // Cleanup function
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        if (checkTimeout) {
          clearTimeout(checkTimeout);
        }
        stopAutoScroll();
      };
    }

    // Cleanup function for when auto-rotate is false
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      stopAutoScroll();
    };
  }, [
    currentItemIndex,
    contentItems,
    autoRotate,
    contentLoading,
    showPrayerAnnouncement,
    defaultDuration,
    needsAutoScroll,
    stopAutoScroll,
  ]);

  // Reset scroll position and detect overflow when content changes
  useEffect(() => {
    if (contentLoading || contentItems.length === 0) return;

    // Reset scroll position when item changes
    resetScrollPosition();

    // Wait for DOM to update, then detect overflow
    const timeoutId = setTimeout(() => {
      detectOverflowAndCalculateTiming();
    }, 100); // Small delay to ensure DOM is updated

    return () => clearTimeout(timeoutId);
  }, [
    currentItemIndex,
    contentItems,
    contentLoading,
    resetScrollPosition,
    detectOverflowAndCalculateTiming,
  ]);

  // Handle window resize - recalculate overflow
  useEffect(() => {
    const handleResize = () => {
      if (contentLoading || contentItems.length === 0) return;

      // Stop current scroll if active
      stopAutoScroll();

      // Recalculate overflow after resize
      setTimeout(() => {
        detectOverflowAndCalculateTiming();
      }, 200);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [
    contentLoading,
    contentItems,
    stopAutoScroll,
    detectOverflowAndCalculateTiming,
  ]);

  // Start auto-scroll when overflow is detected
  useEffect(() => {
    if (!needsAutoScroll || isScrolling || isChangingItem) return;

    // Ensure timing is calculated before starting scroll
    if (scrollDurationRef.current === 0) {
      // Timing not ready yet, wait a bit
      const timeoutId = setTimeout(() => {
        if (scrollDurationRef.current > 0) {
          performAutoScroll();
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }

    // Small delay before starting scroll to allow reading at top
    const startDelay = 1000; // 1 second pause at top
    const timeoutId = setTimeout(() => {
      performAutoScroll();
    }, startDelay);

    return () => clearTimeout(timeoutId);
  }, [needsAutoScroll, isScrolling, isChangingItem, performAutoScroll]);

  // Reset display time when content changes
  useEffect(() => {
    if (!contentItems[currentItemIndex]) return;

    // Skip updating display time during prayer announcements
    if (showPrayerAnnouncement) return;

    try {
      const item = contentItems[currentItemIndex].contentItem;
      if (item) {
        // Get duration from the content item or use default
        const newDuration = item.duration || defaultDuration;
        // Convert to milliseconds
        setCurrentItemDisplayTime(newDuration * 1000);
      }
    } catch (error) {
      console.error("Error setting display time:", error);
      setCurrentItemDisplayTime(defaultDuration * 1000);
    }
  }, [currentItemIndex, contentItems, defaultDuration, showPrayerAnnouncement]);

  // Function to scale font size based on viewport
  const getScaledFontSize = (baseSize: string) => {
    return baseSize;
  };

  // Get dynamic font size based on content length
  const getDynamicFontSize = (text: string, type: string) => {
    if (!text) return getScaledFontSize(fontSizes.h4);

    const textLength = text.length;
    const lineCount = text.split("\n").length;

    // Adjust font size for Names of Allah
    if (type === "ASMA_AL_HUSNA") {
      if (textLength > 200) {
        return getScaledFontSize(fontSizes.h5);
      } else if (textLength > 100) {
        return getScaledFontSize(fontSizes.h4);
      } else {
        return getScaledFontSize(fontSizes.h3);
      }
    }

    // Adjust for Quranic verses (usually longer)
    if (type === "VERSE_HADITH") {
      if (textLength > 500 || lineCount > 8) {
        return getScaledFontSize(fontSizes.body1);
      } else if (textLength > 300 || lineCount > 5) {
        return getScaledFontSize(fontSizes.h6);
      } else if (textLength > 150 || lineCount > 3) {
        return getScaledFontSize(fontSizes.h5);
      } else {
        return getScaledFontSize(fontSizes.h4);
      }
    }

    // For regular text - make more responsive to larger content
    if (textLength > 500 || lineCount > 6) {
      return getScaledFontSize(fontSizes.h6);
    } else if (textLength > 350 || lineCount > 4) {
      return getScaledFontSize(fontSizes.h5);
    } else if (textLength > 200 || lineCount > 2) {
      return getScaledFontSize(fontSizes.h4);
    } else if (textLength > 100) {
      return getScaledFontSize(fontSizes.h3);
    } else {
      // For shorter content, use larger fonts
      return getScaledFontSize(fontSizes.h2);
    }
  };

  // Use memo for contentItems to prevent unnecessary re-renders
  const processedContentItems = useMemo(() => {
    return contentItems;
  }, [contentItems]);

  // Throttle carousel transitions on low-power devices
  const throttledItemChange = useMemo(() => {
    const changeDelay = isLowPowerDevice() ? 1000 : 500;
    return throttle((nextIndex: number) => {
      setCurrentItemIndex(nextIndex);
    }, changeDelay);
  }, []);

  // Memoize content type config lookup
  const getCurrentTypeConfig = useCallback((type: string | undefined) => {
    return getContentTypeConfig(type);
  }, []);

  // Simplify animation styles for better performance on low-power devices
  const cardAnimationStyles = useMemo(() => {
    const duration = isLowPowerDevice() ? "150ms" : "300ms";
    return {
      transform: showContent ? "translateY(0)" : "translateY(5px)",
      opacity: showContent ? 1 : 0,
      transition: `transform ${duration} ease, opacity ${duration} ease`,
    };
  }, [showContent]);

  // Helper function to extract image URL from content
  const getImageUrl = useCallback((content: any): string | null => {
    if (!content) return null;

    // Check if content is an object with image properties
    if (typeof content === "object") {
      return (
        content.imageUrl ||
        content.bannerUrl ||
        content.image ||
        content.bannerImageUrl ||
        content.displayThumbnail ||
        null
      );
    }

    return null;
  }, []);

  // Helper function to check if content has an image
  const hasImage = useCallback(
    (content: any): boolean => {
      return !!getImageUrl(content);
    },
    [getImageUrl],
  );

  // Render image content
  const renderImageContent = useCallback(
    (imageUrl: string, title: string, itemId: string) => {
      const isLoading = imageLoading[itemId] !== false;
      const hasError = imageError[itemId] === true;

      return (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {isLoading && !hasError && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0, 0, 0, 0.3)",
              }}
            >
              <CircularProgress size={48} />
            </Box>
          )}

          {hasError ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                p: 3,
              }}
            >
              <ImageIcon
                sx={{ fontSize: 64, color: "rgba(255,255,255,0.5)" }}
              />
              <Typography
                sx={{
                  fontSize: fontSizes.h5,
                  color: "rgba(255,255,255,0.7)",
                  textAlign: "center",
                }}
              >
                Image failed to load
              </Typography>
            </Box>
          ) : (
            <Box
              component="img"
              src={imageUrl}
              alt={title}
              onLoad={() => {
                setImageLoading((prev) => ({ ...prev, [itemId]: false }));
                setImageError((prev) => ({ ...prev, [itemId]: false }));
              }}
              onError={() => {
                setImageLoading((prev) => ({ ...prev, [itemId]: false }));
                setImageError((prev) => ({ ...prev, [itemId]: true }));
              }}
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: 1,
                opacity: isLoading ? 0 : 1,
                transition: "opacity 0.3s ease-in-out",
              }}
            />
          )}
        </Box>
      );
    },
    [imageLoading, imageError, fontSizes],
  );

  // Render formatted content with proper Arabic and English styling
  const renderFormattedContent = useCallback(
    (content: string, fontSize: string) => {
      // Check if content has Arabic characters (basic detection)
      const hasArabic = /[\u0600-\u06FF]/.test(content);

      // Split content by double newlines to separate sections
      const sections = content.split("\n\n");

      return (
        <Box sx={{ width: "100%", textAlign: "center" }}>
          {sections.map((section, index) => {
            const trimmedSection = section.trim();
            if (!trimmedSection) return null;

            // Detect if this section is Arabic
            const isArabicSection = /[\u0600-\u06FF]/.test(trimmedSection);

            return (
              <Typography
                key={index}
                sx={{
                  fontSize: isArabicSection
                    ? `${parseFloat(fontSize) * 1.1}rem`
                    : fontSize,
                  color: "rgba(255,255,255,0.9)",
                  fontFamily: isArabicSection
                    ? "'Amiri', 'Traditional Arabic', 'Arial Unicode MS', sans-serif"
                    : "'Poppins', sans-serif",
                  lineHeight: isArabicSection ? 2.2 : 1.7,
                  direction: isArabicSection ? "rtl" : "ltr",
                  textAlign: "center",
                  mb: index < sections.length - 1 ? 2 : 0,
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  // Better text rendering
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
                  letterSpacing: isArabicSection ? "1px" : "0.3px",
                  fontWeight: isArabicSection ? 500 : 400,
                  // Special styling for references (sections starting with —)
                  ...(trimmedSection.startsWith("—") && {
                    fontStyle: "italic",
                    opacity: 0.85,
                    fontSize: `${parseFloat(fontSize) * 0.9}rem`,
                    mt: 1,
                  }),
                }}
              >
                {trimmedSection}
              </Typography>
            );
          })}
        </Box>
      );
    },
    [],
  );

  // Process and format verse/hadith content correctly
  const formatVerseHadithContent = useCallback((content: any): string => {
    const formatStructuredContent = (data: any): string => {
      const arabic = data.arabicText || data.arabic || "";
      const translation = data.translation || data.english || data.text || "";
      const reference = data.reference || data.source || data.citation || "";

      let formatted = "";

      if (arabic) {
        formatted += arabic;
      }

      if (translation) {
        if (formatted) formatted += "\n\n";
        formatted += translation;
      }

      if (reference) {
        formatted += `\n\n— ${reference}`;
      }

      return formatted || "No content available";
    };

    if (typeof content === "string") {
      // Try to parse JSON if it looks like structured content
      if (content.startsWith("{") && content.includes('"')) {
        try {
          const parsed = JSON.parse(content);
          return formatStructuredContent(parsed);
        } catch (e) {
          // If parsing fails, return the original string
          return content;
        }
      }
      return content;
    }

    // If it's already an object
    if (content && typeof content === "object") {
      return formatStructuredContent(content);
    }

    // Fallback
    return typeof content === "string" ? content : "No content available";
  }, []);

  // Content rendering with performance optimization
  const renderContent = useCallback(() => {
    if (contentLoading) {
      return (
        <ModernContentCard variant={variant || "landscape"}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              width: "100%",
            }}
          >
            <CircularProgress />
          </Box>
        </ModernContentCard>
      );
    }

    if (!contentItems.length) {
      return (
        <ModernContentCard variant={variant || "landscape"}>
          {/* Static Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <Typography
              sx={{
                fontSize: fontSizes.h3,
                fontWeight: 600,
                color: "rgba(255, 193, 7, 1)",
                fontFamily: "'Poppins', sans-serif",
                width: "100%",
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
            >
              Welcome to {masjidName || "your masjid"}
            </Typography>
          </Box>

          {/* Animated Content */}
          <Fade in={!isChangingItem} timeout={{ enter: 800, exit: 400 }}>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
                textAlign: "center",
              }}
            >
              <Typography
                sx={{
                  fontSize: fontSizes.h4,
                  color: "rgba(255,255,255,0.9)",
                  fontFamily: "'Poppins', sans-serif",
                  lineHeight: 1.6,
                }}
              >
                Please log in to the admin portal to add announcements or
                events.
              </Typography>
            </Box>
          </Fade>
        </ModernContentCard>
      );
    }

    // Get current content item
    const currentItem = contentItems[currentItemIndex];
    if (!currentItem || !currentItem.contentItem) {
      return (
        <ModernContentCard variant={variant || "landscape"}>
          {/* Static Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <Typography
              sx={{
                fontSize: fontSizes.h3,
                fontWeight: 600,
                color: "rgba(255, 193, 7, 1)",
                fontFamily: "'Poppins', sans-serif",
                width: "100%",
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
            >
              Error
            </Typography>
          </Box>

          {/* Animated Content */}
          <Fade in={!isChangingItem} timeout={{ enter: 800, exit: 400 }}>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                p: 3,
              }}
            >
              <Typography variant="h6">Invalid content item</Typography>
            </Box>
          </Fade>
        </ModernContentCard>
      );
    }

    const contentType = currentItem.contentItem.type || "CUSTOM";
    const typeConfig = getCurrentTypeConfig(contentType);

    // Define which title to show
    let titleToShow = currentItem.contentItem.title || typeConfig.title;
    let titleGradient = typeConfig.titleColor;

    // Check if content has an image (for ANNOUNCEMENT, CUSTOM, or EVENT types)
    const contentData = currentItem.contentItem.content;
    const imageUrl = getImageUrl(contentData);
    const hasImageContent =
      !!imageUrl &&
      (contentType === "ANNOUNCEMENT" ||
        contentType === "CUSTOM" ||
        contentType === "EVENT");

    // Get content
    let contentToShow: string;

    // Format content based on type
    switch (contentType) {
      case "VERSE_HADITH":
        contentToShow = formatVerseHadithContent(
          currentItem.contentItem.content,
        );
        break;

      case "ANNOUNCEMENT":
        if (
          typeof currentItem.contentItem.content === "object" &&
          currentItem.contentItem.content.text
        ) {
          contentToShow = currentItem.contentItem.content.text;
        } else {
          contentToShow =
            typeof currentItem.contentItem.content === "string"
              ? currentItem.contentItem.content
              : "No announcement text";
        }
        // If there's an image, we'll render it instead of text
        break;

      case "EVENT":
        // Format event content with date/time - handle Events V2 structure
        const eventContent = currentItem.contentItem.content;
        let description = "";

        if (typeof eventContent === "string") {
          description = eventContent;
        } else if (eventContent && typeof eventContent === "object") {
          description =
            eventContent.description ||
            eventContent.shortDescription ||
            "No event description";
        } else {
          description = "No event description";
        }

        let eventDetails = "";
        const startDateStr =
          currentItem.startDate ||
          eventContent?.startAt ||
          eventContent?.startDate;
        const location =
          currentItem.location || eventContent?.venue || eventContent?.location;

        if (startDateStr) {
          try {
            const startDate = new Date(startDateStr);
            const formattedDate = startDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            const formattedTime = startDate.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            });
            eventDetails = `${formattedDate} at ${formattedTime}`;

            if (location) {
              eventDetails += `\nLocation: ${location}`;
            }
          } catch (e) {
            logger.error("Error formatting event date:", {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        contentToShow = eventDetails
          ? `${description}\n\n${eventDetails}`
          : description;
        break;

      case "ASMA_AL_HUSNA":
        // Format Names of Allah content
        const content = currentItem.contentItem.content;
        const name = content.name || content.arabic || "";
        const transliteration = content.transliteration || "";
        const meaning = content.meaning || "";

        // Add better spacing and formatting for Names of Allah
        const formattedName = name ? `${name}` : "";
        const formattedTransliteration = transliteration
          ? `${transliteration}`
          : "";
        const formattedMeaning = meaning ? `"${meaning}"` : "";

        // Filter out empty parts and join with newlines
        contentToShow = [
          formattedName,
          formattedTransliteration,
          formattedMeaning,
        ]
          .filter((part) => part)
          .join("\n\n");
        break;

      default:
        // Default handling for other content types (including CUSTOM)
        if (typeof currentItem.contentItem.content === "string") {
          contentToShow = currentItem.contentItem.content;
        } else if (
          currentItem.contentItem.content &&
          typeof currentItem.contentItem.content === "object"
        ) {
          try {
            if (currentItem.contentItem.content.text) {
              contentToShow = currentItem.contentItem.content.text;
            } else {
              const contentParts = [];
              if (currentItem.contentItem.content.title)
                contentParts.push(currentItem.contentItem.content.title);
              if (currentItem.contentItem.content.description)
                contentParts.push(currentItem.contentItem.content.description);
              if (currentItem.contentItem.content.details)
                contentParts.push(currentItem.contentItem.content.details);

              contentToShow =
                contentParts.length > 0
                  ? contentParts.join("\n\n")
                  : JSON.stringify(currentItem.contentItem.content, null, 2);
            }
          } catch (e) {
            contentToShow = "Error displaying content";
            logger.error("Error formatting content object:", {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else {
          contentToShow = "No content available";
        }
    }

    const fontSize = getDynamicFontSize(String(contentToShow), contentType);
    const itemId = currentItem.contentItem.id;

    // Initialize image loading state for this item if not already set
    if (hasImageContent && imageLoading[itemId] === undefined) {
      // Set initial loading state synchronously
      setImageLoading((prev) => ({ ...prev, [itemId]: true }));
    }

    // Render image content if available
    if (hasImageContent && imageUrl) {
      return (
        <ModernContentCard variant={variant || "landscape"}>
          {/* Static Header - Always Visible */}
          <Box
            sx={{
              p: 2,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              textAlign: "center",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <Typography
              sx={{
                fontSize: fontSizes.h3,
                fontWeight: 600,
                color: "rgba(255, 193, 7, 1)",
                fontFamily: "'Poppins', sans-serif",
                width: "100%",
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {titleToShow}
            </Typography>
          </Box>

          {/* Image Content Area */}
          <Fade in={!isChangingItem} timeout={{ enter: 800, exit: 400 }}>
            <Box
              ref={contentContainerRef}
              sx={{
                flex: 1,
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                p: 2,
              }}
            >
              {renderImageContent(imageUrl, titleToShow, itemId)}
            </Box>
          </Fade>
        </ModernContentCard>
      );
    }

    // Render text content (existing logic)
    return (
      <ModernContentCard variant={variant || "landscape"}>
        {/* Static Header - Always Visible */}
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            textAlign: "center",
            width: "100%",
            overflow: "hidden",
          }}
        >
          <Typography
            sx={{
              fontSize: fontSizes.h3,
              fontWeight: 600,
              color: "rgba(255, 193, 7, 1)",
              fontFamily: "'Poppins', sans-serif",
              width: "100%",
              wordWrap: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {titleToShow}
          </Typography>
        </Box>

        {/* Scrollable Content Area */}
        <Fade in={!isChangingItem} timeout={{ enter: 800, exit: 400 }}>
          <Box
            ref={contentContainerRef}
            sx={{
              flex: 1,
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              ref={scrollableContentRef}
              sx={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                p: 3,
                textAlign: "center",
                display: "flex",
                alignItems: needsAutoScroll ? "flex-start" : "center",
                justifyContent: "center",
                // Hide scrollbars
                scrollbarWidth: "none", // Firefox
                msOverflowStyle: "none", // IE and Edge
                "&::-webkit-scrollbar": {
                  display: "none", // Chrome, Safari, Opera
                },
                // Smooth scrolling
                scrollBehavior: "auto", // We handle smooth scrolling manually
              }}
            >
              {renderFormattedContent(String(contentToShow), fontSize)}
            </Box>
          </Box>
        </Fade>
      </ModernContentCard>
    );
  }, [
    contentLoading,
    contentItems,
    currentItemIndex,
    masjidName,
    variant,
    fontSizes,
    formatVerseHadithContent,
    getCurrentTypeConfig,
    getDynamicFontSize,
    renderFormattedContent,
    isChangingItem,
    needsAutoScroll,
    getImageUrl,
    imageLoading,
    imageError,
    renderImageContent,
  ]);

  // Render prayer announcement
  const renderPrayerAnnouncement = useCallback(() => {
    if (!showPrayerAnnouncement) return null;

    // Set up announcement configuration based on prayer and whether it's time for jamaat
    const config: AnnouncementConfig = {
      prayerName: prayerAnnouncementName,
      title: isPrayerJamaat ? "Prayer Time" : "Prayer Time",
      subtitle: isPrayerJamaat
        ? "Jamaat is starting now"
        : "Adhan is being called",
      description: isPrayerJamaat
        ? "Please proceed to prayer area"
        : "Please prepare for prayer",
      color: isPrayerJamaat ? "#4caf50" : "#2196f3",
      variant: isPrayerJamaat ? "jamaat" : "adhan",
    };

    return (
      <Fade in={showPrayerAnnouncement} timeout={{ enter: 500, exit: 300 }}>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            zIndex: 20,
            p: 3,
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              maxWidth: "80%",
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: fontSizes.h1,
                fontWeight: "bold",
                mb: 2,
                color: "white",
                textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
              }}
            >
              {config.prayerName} {config.title}
            </Typography>

            <Typography
              variant="h5"
              sx={{
                fontSize: fontSizes.h3,
                mb: 3,
                color: config.color,
                textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
              }}
            >
              {config.subtitle}
            </Typography>

            <Box
              sx={{
                mb: 4,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
              }}
            >
              <PrayerRowsIcon
                style={{
                  width: variant === "portrait" ? "180px" : "250px",
                  height: "auto",
                  fill: config.color,
                  filter: "drop-shadow(0 0 10px rgba(0, 0, 0, 0.3))",
                }}
              />
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontSize: fontSizes.h4,
                color: "white",
                opacity: 0.9,
                maxWidth: "600px",
                textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
              }}
            >
              {config.description}
            </Typography>
          </Box>
        </Box>
      </Fade>
    );
  }, [
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
    fontSizes,
    variant,
  ]);

  // Handle orientation change
  useEffect(() => {
    if (orientation !== lastOrientationRef.current) {
      // Reset timer when orientation changes
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Reset scroll position and recalculate overflow
      resetScrollPosition();

      // Recalculate overflow after orientation change
      setTimeout(() => {
        detectOverflowAndCalculateTiming();
      }, 200);

      lastOrientationRef.current = orientation;
      logger.debug(
        "ContentCarousel: Orientation changed, resetting timer and scroll",
      );
    }
  }, [orientation, resetScrollPosition, detectOverflowAndCalculateTiming]);

  // Main content display
  const contentDisplay = useMemo(() => {
    // Skip rendering entirely if we have a prayer announcement
    if (showPrayerAnnouncement) {
      return renderPrayerAnnouncement();
    }

    // Otherwise show normal content
    return (
      <Box
        sx={{
          height: "100%",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          padding: 0, // Remove padding to maintain original dimensions
        }}
      >
        {renderContent()}
      </Box>
    );
  }, [renderContent, renderPrayerAnnouncement, showPrayerAnnouncement]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%", // Maintain original height
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 0, // Remove padding to maintain original dimensions
      }}
    >
      {contentDisplay}
    </Box>
  );
};

// Export as memoized component to prevent unnecessary re-renders
// Export as memoized component to prevent unnecessary re-renders
export default memo(ContentCarousel);
