import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { Box, Typography, Fade, CircularProgress, Paper } from "@mui/material";
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
  type: string | undefined
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

  // Preload next content item to avoid flashing
  const [nextItemIndex, setNextItemIndex] = useState<number | null>(null);

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
      const scheduleItems = schedule.items
        .map((item: any, index: number) => {
          if (!item.contentItem) {
            logger.debug(
              `ContentCarousel: Item ${index} missing contentItem property`,
              { item }
            );
            return null;
          }

          const contentItem = item.contentItem;

          return {
            id: item.id || `schedule-item-${index}`,
            order: item.order || index,
            contentItem: {
              id: contentItem.id || `content-${index}`,
              title: contentItem.title || "No Title",
              content: contentItem.content || "No Content",
              type: contentItem.type || "CUSTOM",
              duration: contentItem.duration || 30,
            },
          };
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
    };
  }, [refreshSchedule]);

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

      const displayTimeMs = displayTimeSeconds * 1000;
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
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    currentItemIndex,
    contentItems,
    autoRotate,
    contentLoading,
    showPrayerAnnouncement,
    defaultDuration,
  ]);

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
    []
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
      );
    }

    if (!contentItems.length) {
      return (
        <ModernContentCard
          title={`Welcome to ${masjidName || "your masjid"}`}
          variant={variant || "landscape"}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
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
              Please log in to the admin portal to add announcements or events.
            </Typography>
          </Box>
        </ModernContentCard>
      );
    }

    // Get current content item
    const currentItem = contentItems[currentItemIndex];
    if (!currentItem || !currentItem.contentItem) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            width: "100%",
          }}
        >
          <Typography variant="h6">Invalid content item</Typography>
        </Box>
      );
    }

    const contentType = currentItem.contentItem.type || "CUSTOM";
    const typeConfig = getCurrentTypeConfig(contentType);

    // Define which title to show
    let titleToShow = currentItem.contentItem.title || typeConfig.title;
    let titleGradient = typeConfig.titleColor;

    // Get content
    let contentToShow: string;

    // Format content based on type
    switch (contentType) {
      case "VERSE_HADITH":
        contentToShow = formatVerseHadithContent(
          currentItem.contentItem.content
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
        break;

      case "EVENT":
        // Format event content with date/time
        const description =
          typeof currentItem.contentItem.content === "string"
            ? currentItem.contentItem.content
            : currentItem.contentItem.content?.description ||
              "No event description";

        let eventDetails = "";
        if (currentItem.startDate) {
          try {
            const startDate = new Date(currentItem.startDate);
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

            if (currentItem.location) {
              eventDetails += `\nLocation: ${currentItem.location}`;
            }
          } catch (e) {
            console.error("Error formatting event date:", e);
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
        // Default handling for other content types
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
            console.error("Error formatting content object:", e);
          }
        } else {
          contentToShow = "No content available";
        }
    }

    const fontSize = getDynamicFontSize(String(contentToShow), contentType);

    return (
      <ModernContentCard title={titleToShow} variant={variant || "landscape"}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            p: 3,
            textAlign: "center",
          }}
        >
          {renderFormattedContent(String(contentToShow), fontSize)}
        </Box>
      </ModernContentCard>
    );
  }, [
    contentItems,
    currentItemIndex,
    contentLoading,
    getCurrentTypeConfig,
    getDynamicFontSize,
    variant,
    formatVerseHadithContent,
    renderFormattedContent,
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

      lastOrientationRef.current = orientation;
      logger.debug("ContentCarousel: Orientation changed, resetting timer");
    }
  }, [orientation]);

  // Main content display
  const contentDisplay = useMemo(() => {
    // Skip rendering entirely if we have a prayer announcement
    if (showPrayerAnnouncement) {
      return renderPrayerAnnouncement();
    }

    // Otherwise show normal content
    return (
      <Fade in={!isChangingItem} timeout={{ enter: 800, exit: 400 }}>
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
      </Fade>
    );
  }, [
    isChangingItem,
    renderContent,
    renderPrayerAnnouncement,
    showPrayerAnnouncement,
  ]);

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
