import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Box, Typography, Fade, CircularProgress, Paper } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import IslamicPatternBackground from './IslamicPatternBackground';
import { NoMobilePhoneIcon, PrayerRowsIcon } from '../../assets/svgComponent';
import logger from '../../utils/logger';
import { useOrientation } from '../../contexts/OrientationContext';
import localforage from 'localforage';
import GlassmorphicContentCard from './GlassmorphicContentCard';
import GlassmorphicCard from './GlassmorphicCard';
import { Event, Schedule } from '../../api/models';
import storageService from '../../services/storageService';
import GlassmorphicContentCardWrapper from './GlassmorphicContentCardWrapper';

// Define content types enum to match API
type ContentItemType = 'VERSE_HADITH' | 'ANNOUNCEMENT' | 'EVENT' | 'CUSTOM' | 'ASMA_AL_HUSNA';

// Additional types for internal handling
type ExtendedContentItemType = ContentItemType | 'HADITH';

interface ContentItem {
  id: string;
  title: string;
  content: any;
  type: ContentItemType; 
  duration: number;
  reference?: string;
}

interface ContentCarouselProps {
  variant?: 'portrait' | 'landscape';
}

// Helper function to format newlines in text
const formatTextWithNewlines = (text: string) => {
  if (!text) return '';
  return text.split('\n').map((line, index) => (
    <React.Fragment key={index}>
      {line}
      {index < text.split('\n').length - 1 && <br />}
    </React.Fragment>
  ));
};

// Simplified component to memoize text formatting
const MemoizedFormattedText = memo(({ text }: { text: string }) => (
  <>{formatTextWithNewlines(text)}</>
));

// Use direct color values for content types
const contentTypeConfig: Record<ExtendedContentItemType, {
  title: string;
  titleColor: string;
  textColor: string;
  colorType?: 'primary' | 'secondary' | 'info';
  isUrgent?: boolean;
}> = {
  'VERSE_HADITH': {
    title: 'Verse from the Quran',
    titleColor: '#2A9D8F',
    textColor: '#FFFFFF',
    colorType: 'secondary'
  },
  'HADITH': {
    title: 'Hadith of the Day',
    titleColor: '#2A9D8F',
    textColor: '#FFFFFF',
    colorType: 'secondary'
  },
  'ANNOUNCEMENT': {
    title: 'Announcement',
    titleColor: '#3B82F6',
    textColor: '#FFFFFF',
    colorType: 'info'
  },
  'EVENT': {
    title: 'Upcoming Event',
    titleColor: '#8B5CF6',
    textColor: '#FFFFFF',
    colorType: 'primary'
  },
  'ASMA_AL_HUSNA': {
    title: 'Names of Allah',
    titleColor: '#F59E0B',
    textColor: '#FFFFFF',
    colorType: 'secondary'
  },
  'CUSTOM': {
    title: 'Information',
    titleColor: '#0A2647',
    textColor: '#FFFFFF',
    colorType: 'primary'
  }
};

// Helper function to get content type config safely
const getContentTypeConfig = (type: string | undefined): typeof contentTypeConfig[ExtendedContentItemType] => {
  if (!type || !(type in contentTypeConfig)) {
    return contentTypeConfig['CUSTOM'];
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
  variant: 'jamaat' | 'adhan';
}

/**
 * ContentCarousel component
 * 
 * Displays content items in a carousel/slideshow format.
 * Automatically rotates through items based on their specified duration.
 * Also displays prayer announcements when prayer times are reached.
 */
const ContentCarousel: React.FC<ContentCarouselProps> = ({ variant }) => {
  const { 
    schedule, 
    events, 
    refreshSchedule,
    isLoading,
    // Masjid info
    masjidName,
    masjidTimezone,
    // Prayer announcement states
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
  } = useContent();
  
  const { orientation } = useOrientation();
  
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
  
  // Constants
  const defaultDuration = 30; // Default duration in seconds
  const userInteractionTimeout = 60000; // 1 minute before resuming auto-rotation after user interaction
  const FADE_TRANSITION_DURATION = 500; // Duration for fade transitions
  
  // Preload next content item to avoid flashing
  const [nextItemIndex, setNextItemIndex] = useState<number | null>(null);
  
  // Log when content context changes
  useEffect(() => {
    logger.debug('ContentCarousel: Content context data updated', {
      hasSchedule: !!schedule,
      scheduleItemsCount: schedule?.items?.length || 0,
      scheduleId: schedule?.id || 'unknown',
      scheduleName: schedule?.name || 'unknown',
      eventsCount: events?.length || 0,
      masjidName: masjidName || 'unknown'
    });
    
    setHasCheckedLocalStorage(true);
  }, [schedule, events, masjidName]);
  
  // Process the schedule and events into content items
  useEffect(() => {
    if (!isComponentMountedRef.current) return;
    
    let processedItems: any[] = [];
    
    // Process schedule items if available
    if (schedule?.items && schedule.items.length > 0) {
      logger.debug('ContentCarousel: Processing schedule items', { 
        count: schedule.items.length
      });
      
      // Map schedule items to content items
      const scheduleItems = schedule.items.map((item: any, index: number) => {
        if (!item.contentItem) {
          logger.debug(`ContentCarousel: Item ${index} missing contentItem property`, { item });
          return null;
        }
        
        const contentItem = item.contentItem;
        
        return {
          id: item.id || `schedule-item-${index}`,
          order: item.order || index,
          contentItem: {
            id: contentItem.id || `content-${index}`,
            title: contentItem.title || 'No Title',
            content: contentItem.content || 'No Content',
            type: contentItem.type || 'CUSTOM',
            duration: contentItem.duration || 30
          }
        };
      }).filter(Boolean);
      
      if (scheduleItems.length > 0) {
        processedItems = [...scheduleItems];
        logger.debug('ContentCarousel: Added schedule items', { count: scheduleItems.length });
      }
    } else {
      logger.debug('ContentCarousel: No schedule items available');
    }
    
    // Add event items if available
    if (events && events.length > 0) {
      const eventItems = events.map((event, index) => {
        return {
          id: event.id || `event-${index}`,
          order: 999, // Place events after scheduled content
          contentItem: {
            id: event.id || `event-content-${index}`,
            title: event.title || 'Event',
            content: typeof event.description === 'string' ? event.description : 'No description available',
            type: 'EVENT', 
            duration: 20
          },
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location
        };
      });
      
      processedItems = [...processedItems, ...eventItems];
      logger.debug('ContentCarousel: Added event items', { count: eventItems.length });
    }
    
    // Sort items by order
    processedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Update content items if they've changed
    if (processedItems.length > 0 && 
        JSON.stringify(processedItems) !== JSON.stringify(contentItemsRef.current)) {
      logger.debug('ContentCarousel: Updating content items', { count: processedItems.length });
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
      logger.info('ContentCarousel: Initial schedule refresh');
      hasRefreshedRef.current = true;
      refreshSchedule(true).catch(error => {
        logger.error('Failed to refresh schedule:', error);
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
        currentItem?.contentItem?.duration || 
        defaultDuration;
      
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
  }, [currentItemIndex, contentItems, autoRotate, contentLoading, showPrayerAnnouncement, defaultDuration]);

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
      console.error('Error setting display time:', error);
      setCurrentItemDisplayTime(defaultDuration * 1000);
    }
  }, [currentItemIndex, contentItems, defaultDuration, showPrayerAnnouncement]);

  // Function to scale font size based on viewport
  const getScaledFontSize = (baseSize: string) => {
    return baseSize;
  };
  
  // Get dynamic font size based on content length
  const getDynamicFontSize = (text: string, type: string) => {
    // Ensure text is always a string to prevent split() errors
    const safeText = typeof text === 'string' ? text : String(text || '');
    if (!safeText) return getScaledFontSize(fontSizes.h4);
    
    const textLength = safeText.length;
    const lineCount = safeText.split('\n').length;
    
    // Adjust font size for Names of Allah
    if (type === 'ASMA_AL_HUSNA') {
      if (textLength > 200) {
        return getScaledFontSize(fontSizes.h5);
      } else if (textLength > 100) {
        return getScaledFontSize(fontSizes.h4);
      } else {
        return getScaledFontSize(fontSizes.h3);
      }
    }
    
    // Adjust for Quranic verses (usually longer)
    if (type === 'VERSE_HADITH') {
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
  
  // Memoize content type config lookup
  const getCurrentTypeConfig = useCallback((type: string | undefined) => {
    return getContentTypeConfig(type);
  }, []);
  
  // Simplify animation styles for better performance
  const cardAnimationStyles = useMemo(() => ({
    transform: showContent ? 'translateY(0)' : 'translateY(5px)',
    opacity: showContent ? 1 : 0,
    transition: 'transform 300ms ease, opacity 300ms ease',
  }), [showContent]);
  
  // Process and format verse/hadith content correctly
  const formatVerseHadithContent = useCallback((content: any): string => {
    // Handle null/undefined content
    if (!content) {
      return 'No content available';
    }
    
    // Handle string content
    if (typeof content === 'string') {
      // If it's already a JSON string, return it as is
      if (content.startsWith('{') && content.includes('"type"')) {
        return content;
      }
      
      // Otherwise, it's a regular string
      return content;
    }
    
    // Handle object content
    if (typeof content === 'object' && content !== null) {
      try {
        // If it's an object with verse/hadith structure
        if (content.type === 'QURAN_VERSE' || 
            content.type === 'HADITH' || 
            content.arabicText || 
            content.translation) {
          // Return the whole object as a JSON string
          return JSON.stringify(content);
        }
        
        // Legacy format handling
        if (content.verse || content.text) {
          const verse = content.verse || content.text || '';
          const reference = content.reference || content.source || '';
          
          // Try to combine into a JSON format for better display
          if (content.arabicText) {
            return JSON.stringify({
              type: 'QURAN_VERSE',
              arabicText: content.arabicText,
              translation: verse,
              reference: reference
            });
          }
          
          return reference ? `${verse}\n\n${reference}` : verse;
        } else if (content.hadith) {
          const hadith = content.hadith || '';
          const source = content.source || content.reference || '';
          
          return source ? `${hadith}\n\n${source}` : hadith;
        } else if (content.description) {
          // Handle content with description property
          const description = content.description;
          const reference = content.reference || content.source || '';
          
          return reference ? `${description}\n\n${reference}` : description;
        } else if (content.content) {
          // Handle nested content property
          if (typeof content.content === 'string') {
            return content.content;
          } else if (typeof content.content === 'object') {
            return JSON.stringify(content.content);
          }
        } else {
          // Try to extract any meaningful text from the object
          const textParts = [];
          if (content.text) textParts.push(content.text);
          if (content.description) textParts.push(content.description);
          if (content.title) textParts.push(content.title);
          
          if (textParts.length > 0) {
            return textParts.join('\n\n');
          }
          
          // If we can't parse in a specific way, return the JSON
          return JSON.stringify(content);
        }
      } catch (e) {
        console.error('Error formatting verse/hadith content:', e);
        return 'Error displaying content';
      }
    }
    
    // Fallback
    return 'No content available';
  }, []);
  
  // Content rendering with performance optimization
  const renderContent = useCallback(() => {
    if (contentLoading) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%'
          }}
        >
          <CircularProgress />
        </Box>
      );
    }
    
    if (!contentItems.length) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%'
          }}
        >
          <Typography variant="h6">No content available</Typography>
        </Box>
      );
    }

    // Get current content item
    const currentItem = contentItems[currentItemIndex];
    if (!currentItem || !currentItem.contentItem) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%'
          }}
        >
          <Typography variant="h6">Invalid content item</Typography>
        </Box>
      );
    }

    const contentType = currentItem.contentItem.type || 'CUSTOM';
    const typeConfig = getCurrentTypeConfig(contentType);

    // Define which title to show
    let titleToShow = currentItem.contentItem.title || typeConfig.title;
    let titleGradient = typeConfig.titleColor;
    
    // Get content and ensure it's properly formatted as a string
    let contentToShow: string;
    
    // Format content based on type with proper error handling
    switch (contentType) {
      case 'VERSE_HADITH':
        // Use the specialized formatter for verse/hadith content
        contentToShow = formatVerseHadithContent(currentItem.contentItem.content);
        break;
        
      case 'ANNOUNCEMENT':
        // Handle announcement content with proper object/string handling
        if (typeof currentItem.contentItem.content === 'object') {
          if (currentItem.contentItem.content.text) {
            contentToShow = currentItem.contentItem.content.text;
          } else if (currentItem.contentItem.content.description) {
            contentToShow = currentItem.contentItem.content.description;
          } else if (currentItem.contentItem.content.content) {
            contentToShow = typeof currentItem.contentItem.content.content === 'string' 
              ? currentItem.contentItem.content.content
              : JSON.stringify(currentItem.contentItem.content.content);
          } else {
            contentToShow = 'No announcement text';
          }
        } else {
          contentToShow = typeof currentItem.contentItem.content === 'string' 
            ? currentItem.contentItem.content
            : 'No announcement text';
        }
        break;
        
      case 'EVENT':
        // Handle event content with proper structure handling
        let eventDescription = '';
        if (typeof currentItem.contentItem.content === 'string') {
          eventDescription = currentItem.contentItem.content;
        } else if (currentItem.contentItem.content && typeof currentItem.contentItem.content === 'object') {
          // Handle different event content structures
          if (currentItem.contentItem.content.description) {
            eventDescription = currentItem.contentItem.content.description;
          } else if (currentItem.contentItem.content.text) {
            eventDescription = currentItem.contentItem.content.text;
          } else if (currentItem.contentItem.content.content) {
            eventDescription = typeof currentItem.contentItem.content.content === 'string'
              ? currentItem.contentItem.content.content
              : 'No event description';
          } else {
            eventDescription = 'No event description';
          }
        } else {
          eventDescription = 'No event description';
        }
        
        // Add event details (date, time, location)
        let eventDetails = '';
        if (currentItem.startDate) {
          try {
            const startDate = new Date(currentItem.startDate);
            const formattedDate = startDate.toLocaleDateString(undefined, {
              weekday: 'long', 
              month: 'long', 
              day: 'numeric'
            });
            const formattedTime = startDate.toLocaleTimeString(undefined, {
              hour: 'numeric', 
              minute: '2-digit'
            });
            eventDetails = `${formattedDate} at ${formattedTime}`;
            
            if (currentItem.location) {
              eventDetails += `\nLocation: ${currentItem.location}`;
            }
          } catch (e) {
            console.error('Error formatting event date:', e);
          }
        }
        
        contentToShow = eventDetails ? `${eventDescription}\n\n${eventDetails}` : eventDescription;
        break;
        
      case 'ASMA_AL_HUSNA':
        // Handle Asma Al Husna content with proper object structure
        const asmaContent = currentItem.contentItem.content;
        if (typeof asmaContent === 'object' && asmaContent !== null) {
          const name = asmaContent.name || asmaContent.arabic || '';
          const transliteration = asmaContent.transliteration || '';
          const meaning = asmaContent.meaning || '';
          
          // Format with proper spacing
          const formattedName = name ? `${name}` : '';
          const formattedTransliteration = transliteration ? `${transliteration}` : '';
          const formattedMeaning = meaning ? `"${meaning}"` : '';
          
          // Filter out empty parts and join with newlines
          contentToShow = [formattedName, formattedTransliteration, formattedMeaning]
            .filter(part => part)
            .join('\n\n');
        } else {
          contentToShow = typeof asmaContent === 'string' ? asmaContent : 'No content available';
        }
        break;
        
      default:
        // Default handling for other content types with robust error handling
        if (typeof currentItem.contentItem.content === 'string') {
          contentToShow = currentItem.contentItem.content;
        } else if (currentItem.contentItem.content && typeof currentItem.contentItem.content === 'object') {
          try {
            // Try to extract meaningful content from object
            if (currentItem.contentItem.content.text) {
              contentToShow = currentItem.contentItem.content.text;
            } else if (currentItem.contentItem.content.description) {
              contentToShow = currentItem.contentItem.content.description;
            } else if (currentItem.contentItem.content.content) {
              contentToShow = typeof currentItem.contentItem.content.content === 'string'
                ? currentItem.contentItem.content.content
                : JSON.stringify(currentItem.contentItem.content.content);
            } else {
              // Try to combine available properties
              const contentParts = [];
              if (currentItem.contentItem.content.title) contentParts.push(currentItem.contentItem.content.title);
              if (currentItem.contentItem.content.description) contentParts.push(currentItem.contentItem.content.description);
              if (currentItem.contentItem.content.details) contentParts.push(currentItem.contentItem.content.details);
              
              contentToShow = contentParts.length > 0 
                ? contentParts.join('\n\n')
                : 'No content available';
            }
          } catch (e) {
            contentToShow = 'Error displaying content';
            console.error('Error formatting content object:', e);
          }
        } else {
          contentToShow = 'No content available';
        }
    }
    
    const fontSize = getDynamicFontSize(String(contentToShow), contentType);
    
    return (
      <GlassmorphicContentCardWrapper
        title={titleToShow}
        titleGradient={titleGradient}
        content={contentToShow}
        fontSize={fontSize}
        variant={variant || 'landscape'}
        itemType={contentType}
      />
    );
  }, [contentItems, currentItemIndex, contentLoading, getCurrentTypeConfig, getDynamicFontSize, variant, formatVerseHadithContent]);

  // Render prayer announcement
  const renderPrayerAnnouncement = useCallback(() => {
    if (!showPrayerAnnouncement) return null;
    
    // Set up announcement configuration based on prayer and whether it's time for jamaat
    const config: AnnouncementConfig = {
      prayerName: prayerAnnouncementName,
      title: isPrayerJamaat ? "Prayer Time" : "Prayer Time",
      subtitle: isPrayerJamaat ? "Jamaat is starting now" : "Adhan is being called",
      description: isPrayerJamaat 
        ? "Please proceed to prayer area" 
        : "Please prepare for prayer",
      color: isPrayerJamaat ? "#4caf50" : "#2196f3",
      variant: isPrayerJamaat ? "jamaat" : "adhan"
    };
    
    return (
      <Fade in={showPrayerAnnouncement} timeout={{ enter: 500, exit: 300 }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 20,
            p: 3,
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: '80%',
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontSize: fontSizes.h1,
                fontWeight: 'bold',
                mb: 2,
                color: 'white',
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
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
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {config.subtitle}
            </Typography>
            
            <Box 
              sx={{ 
                mb: 4,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <PrayerRowsIcon 
                style={{ 
                  width: variant === 'portrait' ? '180px' : '250px', 
                  height: 'auto',
                  fill: config.color,
                  filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.3))'
                }} 
              />
            </Box>
            
            <Typography
              variant="h6"
              sx={{
                fontSize: fontSizes.h4,
                color: 'white',
                opacity: 0.9,
                maxWidth: '600px',
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {config.description}
            </Typography>
          </Box>
        </Box>
      </Fade>
    );
  }, [showPrayerAnnouncement, prayerAnnouncementName, isPrayerJamaat, fontSizes, variant]);

  // Handle orientation change
  useEffect(() => {
    if (orientation !== lastOrientationRef.current) {
      // Reset timer when orientation changes
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      lastOrientationRef.current = orientation;
      logger.debug('ContentCarousel: Orientation changed, resetting timer');
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
            height: '100%',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            padding: 0 // Remove padding to maintain original dimensions
          }}
        >
          {renderContent()}
        </Box>
      </Fade>
    );
  }, [isChangingItem, renderContent, renderPrayerAnnouncement, showPrayerAnnouncement]);
  
  return (
    <Box 
      sx={{ 
        width: '100%',
        height: '100%', // Maintain original height
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0 // Remove padding to maintain original dimensions
      }}
    >
      {contentDisplay}
    </Box>
  );
};

// Export as memoized component to prevent unnecessary re-renders
export default ContentCarousel; 