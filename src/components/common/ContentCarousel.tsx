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
import { Event } from '../../api/models';

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

// Update the content type config to use direct color values instead of gradients
const contentTypeConfig: Record<ExtendedContentItemType, {
  title: string;
  titleColor: string;
  textColor: string;
  colorType?: 'primary' | 'secondary' | 'info';
  isUrgent?: boolean;
}> = {
  'VERSE_HADITH': {
    title: 'Verse from the Quran',
    titleColor: 'rgba(42, 157, 143, 0.3)',
    textColor: '#FFFFFF',
    colorType: 'secondary'
  },
  'HADITH': {
    title: 'Hadith of the Day',
    titleColor: 'rgba(42, 157, 143, 0.3)',
    textColor: '#FFFFFF',
    colorType: 'secondary'
  },
  'ANNOUNCEMENT': {
    title: 'Announcement',
    titleColor: 'rgba(59, 130, 246, 0.3)',
    textColor: '#FFFFFF',
    colorType: 'info'
  },
  'EVENT': {
    title: 'Upcoming Event',
    titleColor: 'rgba(139, 92, 246, 0.3)',
    textColor: '#FFFFFF',
    colorType: 'primary'
  },
  'ASMA_AL_HUSNA': {
    title: 'Names of Allah',
    titleColor: 'rgba(245, 158, 11, 0.3)',
    textColor: '#FFFFFF',
    colorType: 'secondary'
  },
  'CUSTOM': {
    title: 'Information',
    titleColor: 'rgba(10, 38, 71, 0.3)',
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
  
  // Log when prayer announcement state changes
  useEffect(() => {
    // Track last state for comparison
    lastAnnouncementState.current = showPrayerAnnouncement;
    
    // When prayer announcement changes, handle content rotation
    if (showPrayerAnnouncement) {
      // If announcement is showing, pause rotation
      setAutoRotate(false);
      
      // Cancel any existing rotation timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // When announcement ends, resume rotation (unless user has interacted)
      if (!hasUserInteracted.current) {
        setAutoRotate(true);
      }
    }
  }, [showPrayerAnnouncement, prayerAnnouncementName, isPrayerJamaat]);
  
  // Check IndexedDB for content on initialization
  useEffect(() => {
    const checkLocalStorage = async () => {
      try {
        // Try to load content from IndexedDB
        const cachedSchedule = await localforage.getItem('schedule');
        const cachedEvents = await localforage.getItem('events');
        
        logger.debug('ContentCarousel: Checking cached content', { 
          hasCachedSchedule: !!cachedSchedule, 
          hasCachedEvents: !!cachedEvents 
        } as Record<string, any>);
        
        if (cachedSchedule || cachedEvents) {
          // Process cached content similar to how we process API content
          let items = [];
          
          // Add schedule items if available
          if (cachedSchedule && (cachedSchedule as any)?.items && (cachedSchedule as any).items.length > 0) {
            const scheduleItems = (cachedSchedule as any).items;
            // Map schedule items to the expected format
            const mappedItems = scheduleItems.map((item: any, index: number) => {
              if (!item.contentItem) {
                const apiItem = item as unknown as { 
                  id: string; 
                  type?: string; 
                  title?: string; 
                  content?: any; 
                  duration?: number; 
                  order?: number;
                };
                
                return {
                  id: apiItem.id || `item-${index}`,
                  order: typeof apiItem.order === 'number' ? apiItem.order : index,
                  contentItem: {
                    id: `${apiItem.id}-content`,
                    type: apiItem.type || 'CUSTOM',
                    title: apiItem.title || 'No Title',
                    content: apiItem.content || 'No Content',
                    duration: typeof apiItem.duration === 'number' ? apiItem.duration : 30
                  }
                };
              }
              
              const contentItem = item.contentItem;
              
              return {
                id: item.id,
                order: item.order || 999,
                contentItem: {
                  id: contentItem.id,
                  title: contentItem.title || 'No Title',
                  content: contentItem.content || 'No Content',
                  type: contentItem.type || 'CUSTOM',
                  duration: contentItem.duration || 30
                }
              };
            }).filter(Boolean);
            
            if (mappedItems.length > 0) {
              items.push(...mappedItems);
            }
          }
          
          // Add cached events if available
          if (cachedEvents && Array.isArray(cachedEvents) && (cachedEvents as any[]).length > 0) {
            items.push(...(cachedEvents as any[]).map((event: any) => {
              // Extract description properly based on various possible formats
              let description = '';
              
              if (typeof event.description === 'string') {
                description = event.description;
              } else if (typeof event.description === 'object' && event.description !== null) {
                const descObj = event.description as { 
                  text?: string; 
                  description?: string;
                  category?: string;
                  location?: string;
                };
                
                // Try to extract meaningful text from the description object
                if (descObj.text) {
                  description = descObj.text;
                } else if (descObj.description) {
                  description = descObj.description;
                } else {
                  // Try to extract meaningful text from the object
                  try {
                    // Extract only helpful fields for display
                    const extractedInfo = [];
                    
                    if (descObj.category) extractedInfo.push(descObj.category);
                    if (descObj.description) extractedInfo.push(descObj.description);
                    if (descObj.location && !event.location) extractedInfo.push(`Location: ${descObj.location}`);
                    
                    description = extractedInfo.length > 0 ? extractedInfo.join('\n\n') : 'See event details';
                  } catch (err) {
                    description = 'Event information unavailable';
                    console.error('Error parsing cached event description:', err);
                  }
                }
              }
              
              return {
                id: event.id,
                order: 999, // Place events after scheduled content
                contentItem: {
                  id: event.id,
                  title: event.title || 'Event',
                  content: description || 'No description available',
                  type: 'EVENT',
                  duration: 20
                },
                startDate: event.startDate,
                endDate: event.endDate,
                location: event.location
              };
            }));
          }
          
          // Sort and update content items
          if (items.length > 0) {
            items.sort((a, b) => ((a as any).order || 999) - ((b as any).order || 999));
            contentItemsRef.current = items;
            setContentItems(items);
            setContentLoading(false);
          }
        }
        
        setHasCheckedLocalStorage(true);
      } catch (error) {
        logger.error('ContentCarousel: Error checking IndexedDB for cached content', {
          error: error instanceof Error ? error.message : String(error)
        });
        setHasCheckedLocalStorage(true);
      }
    };
    
    checkLocalStorage();
  }, []);
  
  // Refresh content when mounted and when orientation changes
  useEffect(() => {
    // Initial content load
    if (!hasRefreshedRef.current) {
      logger.info('ContentCarousel: Initial schedule refresh');
      hasRefreshedRef.current = true;
      refreshSchedule().catch((error) => {
        logger.error('Failed to refresh schedule:', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }
    
    // Handle orientation changes - refresh content when orientation changes
    if (lastOrientationRef.current !== orientation) {
      logger.info('ContentCarousel: Orientation changed, refreshing schedule', {
        from: lastOrientationRef.current,
        to: orientation
      });
      
      // Force a new refresh of content when orientation changes
      refreshSchedule().catch((error) => {
        logger.error('Failed to refresh schedule after orientation change:', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
      
      lastOrientationRef.current = orientation;
    }
    
    return () => {
      isComponentMountedRef.current = false;
      // Clean up timer on unmount
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [refreshSchedule, orientation]);
  
  // Prepare content items for carousel
  useEffect(() => {
    if (!isComponentMountedRef.current) return;
    
    let items = [];
    
    // Add schedule items if available
    if (schedule?.items && schedule.items.length > 0) {
      // Map schedule items to the expected format
      const mappedItems = schedule.items.map((item, index) => {
        // If item doesn't have contentItem property, create it from the item's properties
        if (!item.contentItem) {
          // Use type assertion to handle API format with top-level properties
          const apiItem = item as unknown as { 
            id: string; 
            type?: string; 
            title?: string; 
            content?: any; 
            duration?: number; 
            order?: number;
          };
          
          return {
            id: apiItem.id || `item-${index}`,
            order: typeof apiItem.order === 'number' ? apiItem.order : index,
            contentItem: {
              id: `${apiItem.id}-content`,
              type: apiItem.type || 'CUSTOM',
              title: apiItem.title || 'No Title',
              content: apiItem.content || 'No Content',
              duration: typeof apiItem.duration === 'number' ? apiItem.duration : 30
            }
          };
        }
        
        const contentItem = item.contentItem;
        
        return {
          id: item.id,
          order: item.order || 999,
          contentItem: {
            id: contentItem.id,
            title: contentItem.title || 'No Title',
            content: contentItem.content || 'No Content',
            // Ensure type is set correctly (API might use different field names)
            type: contentItem.type || 'CUSTOM',
            // Ensure duration has a fallback value
            duration: contentItem.duration || 30
          }
        };
      }).filter(Boolean);
      
      if (mappedItems.length > 0) {
        items.push(...mappedItems);
      }
    }
    
    // Add upcoming events if available
    if (events && events.length > 0) {
      items.push(...events.map((event: Event | any) => {
        // Extract description properly based on various possible formats
        let description = '';
        
        if (typeof event.description === 'string') {
          description = event.description;
        } else if (typeof event.description === 'object' && event.description !== null) {
          const descObj = event.description as { 
            text?: string; 
            description?: string;
            category?: string;
            location?: string;
          };
          
          // Try to extract meaningful text from the description object
          if (descObj.text) {
            description = descObj.text;
          } else if (descObj.description) {
            description = descObj.description;
          } else {
            // Try to extract meaningful text from the object
            try {
              // Extract only helpful fields for display
              const extractedInfo = [];
              
              if (descObj.category) extractedInfo.push(descObj.category);
              if (descObj.description) extractedInfo.push(descObj.description);
              if (descObj.location && !event.location) extractedInfo.push(`Location: ${descObj.location}`);
              
              description = extractedInfo.length > 0 ? extractedInfo.join('\n\n') : 'See event details';
            } catch (err) {
              description = 'Event information unavailable';
              console.error('Error parsing event description:', err);
            }
          }
        }
        
        return {
          id: event.id,
          order: 999, // Place events after scheduled content
          contentItem: {
            id: event.id,
            title: event.title || 'Event',
            content: description || 'No description available',
            type: 'EVENT',
            duration: 20
          },
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location
        };
      }));
    }
    
    // Sort by order - handle null safety with non-null assertion
    items = items.filter(Boolean); // Remove any null/undefined items first
    items.sort((a, b) => {
      // At this point we know items are not null due to filter
      return ((a as any).order || 999) - ((b as any).order || 999);
    });
    
    // Only update if the items have actually changed
    if (JSON.stringify(items) !== JSON.stringify(contentItemsRef.current)) {
      contentItemsRef.current = items;
      setContentItems(items);
      // Reset to first item when content changes
      setCurrentItemIndex(0);
    }
  }, [schedule, events]);
  
  // Handle auto-rotation
  useEffect(() => {
    // Skip if loading or no items
    if (contentLoading || contentItems.length === 0) {
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
        currentItem?.displayTime || 
        currentItem?.contentItem?.displayTime || 
        defaultDuration;
      
      const displayTimeMs = displayTimeSeconds * 1000;
      setCurrentItemDisplayTime(displayTimeMs);
      
      // Start a timer to change to the next item
      timerRef.current = setTimeout(() => {
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
  }, [currentItemIndex, contentItems, autoRotate, contentLoading]);

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
  
  // Add a helper function to scale down font sizes
  const getScaledFontSize = (baseSize: string) => {
    // Extract the numeric value and unit from the font size
    const match = baseSize.match(/^([\d.]+)(.*)$/);
    if (!match) return baseSize;
    
    const [, value, unit] = match;
    // Scale down by 20% for 720p, 15% for larger screens
    const scaleFactor = screenSize.is720p ? 0.8 : 0.85;
    const scaledValue = parseFloat(value) * scaleFactor;
    return `${scaledValue}${unit}`;
  };

  // Get dynamic font size based on content length
  const getDynamicFontSize = (text: string, type: string) => {
    if (!text) return getScaledFontSize(fontSizes.h4);
    
    const textLength = text.length;
    const lineCount = (text.match(/\n/g) || []).length + 1;
    
    // Special handling for Eid prayers - use extremely large sizes regardless of content length
    if (type === 'eid-announcement') {
      if (lineCount <= 2) {
        return `${3.5}rem`; // Extremely large font for Eid announcements with few lines
      } else if (lineCount <= 4) {
        return `${2.8}rem`; // Very large font for Eid announcements with moderate lines
      } else {
        return `${2.2}rem`; // Large font for Eid announcements with many lines
      }
    }
    
    // For very short content, especially event announcements, use larger font sizes
    if (textLength < 50 && (type === 'event-title' || type === 'announcement-title')) {
      return getScaledFontSize(fontSizes.huge); // Very large for main titles with minimal text
    }
    
    if (textLength < 80 && type === 'event-content') {
      return getScaledFontSize(fontSizes.h1); // Larger size for short event content
    }
    
    // Adjust based on both text length and number of lines
    if (type === 'arabic') {
      if (textLength > 250 || lineCount > 4) {
        return getScaledFontSize(fontSizes.h4);
      } else if (textLength > 150 || lineCount > 2) {
        return getScaledFontSize(fontSizes.h3);
      } else {
        return getScaledFontSize(fontSizes.h2);
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
    if (!currentItem) return null;

    const typeConfig = getCurrentTypeConfig(currentItem.type);

    // Define which title to show
    let titleToShow = currentItem.contentItem?.title || typeConfig.title;
    let titleGradient = typeConfig.titleColor;
    let titleTextColor = typeConfig.textColor;
    
    try {
      // For EVENT type
      if (currentItem.type === 'EVENT') {
        let eventText = '';
        
        // Parse content based on its format
        if (typeof currentItem.content === 'string') {
          eventText = currentItem.content;
        } else if (currentItem.content?.text) {
          eventText = currentItem.content.text;
        } else if (currentItem.content?.description) {
          // Add handling for when description is directly in the content object
          eventText = currentItem.content.description;
        } else if (typeof currentItem.content === 'object' && currentItem.content !== null) {
          // Try to extract meaningful text from the object before falling back to stringify
          const contentObj = currentItem.content as {
            text?: string;
            description?: string;
            category?: string;
            location?: string;
            eventDate?: string;
            eventDescription?: string;
            isHighlighted?: boolean;
          };
          
          if (contentObj.eventDescription || contentObj.description) {
            eventText = contentObj.eventDescription || contentObj.description || '';
          } else {
            // Only stringify as a last resort, and try to make it readable
            try {
              // Extract only helpful fields for display rather than showing the full JSON
              const extractedInfo = [];
              
              if (contentObj.category) extractedInfo.push(contentObj.category);
              if (contentObj.description) extractedInfo.push(contentObj.description);
              if (contentObj.location) extractedInfo.push(`Location: ${contentObj.location}`);
              
              // If we have extracted info, use that instead of full JSON
              eventText = extractedInfo.length > 0 ? extractedInfo.join('\n\n') : 'Event information';
            } catch (err) {
              eventText = 'Event information unavailable';
              console.error('Error parsing event content:', err);
            }
          }
        }
        
        // Check if this is an Eid prayer or special announcement
        const isEidAnnouncement = 
          currentItem.title?.toLowerCase().includes('eid') || 
          eventText.toLowerCase().includes('eid prayer');
        
        const isPrayerAnnouncement = 
          currentItem.title?.toLowerCase().includes('prayer') ||
          eventText.toLowerCase().includes('prayer will be held');
        
        const isSpecialAnnouncement = isEidAnnouncement || isPrayerAnnouncement;
        
        // Calculate appropriate content type for sizing
        const fontSizeType = isEidAnnouncement ? 'eid-announcement' : 
                             (isSpecialAnnouncement ? 'event-content' : 'normal');
        
        // Special handling for Eid prayer - ensure it has translucent background
        if (isEidAnnouncement) {
          return (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center',
              alignItems: 'center',
              gap: 3,
              textAlign: 'center',
              width: '100%',
              height: '100%',
              p: 2,
              overflow: 'auto',
              // No background color here to maintain glassmorphic effect
            }}>
              <Typography 
                variant="h2"
                sx={{ 
                  fontSize: getDynamicFontSize(eventText, 'eid-announcement'),
                  textAlign: 'center',
                  fontWeight: 'bold',
                  whiteSpace: 'pre-line',
                  lineHeight: 2,
                  color: '#FFFFFF',
                  textShadow: '0 2px 5px rgba(0, 0, 0, 0.5)', // Stronger text shadow for better contrast
                  mb: 2
                }}
              >
                <MemoizedFormattedText text={eventText} />
              </Typography>
            </Box>
          );
        }
        
        // Return normal event rendering
        return (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            alignItems: 'center',
            gap: isSpecialAnnouncement ? 4 : (screenSize.is720p ? 0.5 : 1), 
            textAlign: 'center',
            width: '100%',
            height: '100%',
            p: isSpecialAnnouncement ? 4 : (screenSize.is720p ? 1 : 2),
            overflow: 'auto'
          }}>
            <Typography 
              sx={{ 
                fontSize: getDynamicFontSize(eventText, fontSizeType),
                mb: isSpecialAnnouncement ? 2 : 1,
                textAlign: 'center',
                fontWeight: isSpecialAnnouncement ? 'bold' : 'medium',
                whiteSpace: 'pre-line', // Preserve newlines
                lineHeight: isSpecialAnnouncement ? 2 : 1.5,
                color: '#FFFFFF',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)' // Add text shadow for better readability
              }}
            >
              <MemoizedFormattedText text={eventText} />
            </Typography>
            
            {/* Only show date/location box if not an Eid announcement, to maximize text space */}
            {(!isEidAnnouncement && (currentItem.startDate || currentItem.location)) && (
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-around', 
                  flexWrap: 'wrap',
                  gap: 1,
                  mt: 1,
                  backdropFilter: 'blur(10px)',
                  background: 'rgba(0, 0, 0, 0.15)', // More translucent
                  p: 1.5,
                  borderRadius: 2,
                  width: '100%',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                {currentItem.startDate && (
                  <Box
                    sx={{
                      backdropFilter: 'blur(5px)',
                      background: 'rgba(255, 255, 255, 0.05)', // More translucent
                      p: 1,
                      borderRadius: 1,
                      flex: 1,
                      minWidth: '120px'
                    }}
                  >
                    <Typography 
                      sx={{ 
                        fontSize: getScaledFontSize(fontSizes.h6),
                        fontWeight: 'bold',
                        color: 'rgba(255, 255, 255, 0.9)',
                        textAlign: 'center'
                      }}
                    >
                      Date
                    </Typography>
                    <Typography sx={{ 
                      fontSize: getScaledFontSize(fontSizes.h5), 
                      textAlign: 'center',
                      color: '#FFFFFF',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                    }}>
                      {new Date(currentItem.startDate).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Typography>
                  </Box>
                )}
                
                {(currentItem.location || currentItem.startDate) && (
                  <Box
                    sx={{
                      backdropFilter: 'blur(5px)',
                      background: 'rgba(255, 255, 255, 0.05)', // More translucent
                      p: 1,
                      borderRadius: 1,
                      flex: 1,
                      minWidth: '120px'
                    }}
                  >
                    <Typography 
                      sx={{ 
                        fontSize: getScaledFontSize(fontSizes.h6),
                        fontWeight: 'bold',
                        color: 'rgba(255, 255, 255, 0.9)',
                        textAlign: 'center'
                      }}
                    >
                      {currentItem.location ? 'Location' : 'Time'}
                    </Typography>
                    <Typography sx={{ 
                      fontSize: getScaledFontSize(fontSizes.h5), 
                      textAlign: 'center',
                      color: '#FFFFFF',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                    }}>
                      {currentItem.location || (
                        currentItem.startDate && new Date(currentItem.startDate).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        );
      }
      
      // For ASMA_AL_HUSNA type
      if (currentItem.type === 'ASMA_AL_HUSNA') {
        let displayContent = currentItem.content;
        let nameToDisplay = null;
        let arabicText = '';
        let transliteration = '';
        let meaning = '';
        
        // Enhanced structure handling for different API formats
        // Case 1: selectedNames array format (new format)
        if (displayContent?.selectedNames && Array.isArray(displayContent.selectedNames) && displayContent.selectedNames.length > 0) {
          const nameIndex = 0; // Default to first item
          nameToDisplay = displayContent.selectedNames[nameIndex];
          arabicText = nameToDisplay?.arabic || '';
          transliteration = nameToDisplay?.transliteration || '';
          meaning = nameToDisplay?.meaning || nameToDisplay?.translation || '';
        }
        // Case 2: nameDetails array format (old format) 
        else if (displayContent?.nameDetails && Array.isArray(displayContent.nameDetails) && displayContent.nameDetails.length > 0) {
          const nameIndex = 0; // Default to first item
          nameToDisplay = displayContent.nameDetails[nameIndex];
          arabicText = nameToDisplay?.arabic || '';
          transliteration = nameToDisplay?.transliteration || '';
          meaning = nameToDisplay?.meaning || nameToDisplay?.translation || '';
        } 
        // Case 3: Direct array format
        else if (Array.isArray(displayContent)) {
          const nameIndex = 0; // Use first item instead of random for consistency
          nameToDisplay = displayContent[nameIndex];
          arabicText = nameToDisplay?.arabic || '';
          transliteration = nameToDisplay?.transliteration || '';
          meaning = nameToDisplay?.meaning || nameToDisplay?.translation || '';
        }
        // Case 4: Direct object format
        else if (typeof displayContent === 'object' && displayContent !== null) {
          arabicText = displayContent.arabic || displayContent.arabicText || '';
          transliteration = displayContent.transliteration || '';
          meaning = displayContent.meaning || displayContent.translation || '';
        }
        
        return (
          <Box sx={{ 
            textAlign: 'center', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: screenSize.is720p ? 1 : 2,
            // No background color to maintain glassmorphic effect
          }}>
            {arabicText && (
              <Typography 
                sx={{ 
                  fontSize: getDynamicFontSize(arabicText, 'arabic'),
                  mb: 1,
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontFamily: 'Scheherazade New, Arial',
                  color: '#FFFFFF',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)' // Add text shadow for better readability
                }}
              >
                <MemoizedFormattedText text={arabicText} />
              </Typography>
            )}
            
            {transliteration && (
              <Typography 
                sx={{ 
                  fontSize: getDynamicFontSize(transliteration, 'normal'),
                  mb: 1,
                  textAlign: 'center',
                  fontWeight: 'medium',
                  color: '#FFFFFF',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' // Add text shadow for better readability
                }}
              >
                <MemoizedFormattedText text={transliteration} />
              </Typography>
            )}
            
            {meaning && (
              <Typography 
                sx={{ 
                  fontSize: getDynamicFontSize(meaning, 'normal'),
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                  color: '#FFFFFF', 
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' // Add text shadow for better readability
                }}
              >
                <MemoizedFormattedText text={meaning} />
              </Typography>
            )}
          </Box>
        );
      }
      
      // For VERSE_HADITH type
      if (currentItem.type === 'VERSE_HADITH') {
        let arabicText = '';
        let englishText = '';
        let reference = currentItem.content?.reference || currentItem.reference || '';
        let grade = currentItem.content?.grade || '';
        let isHadith = reference?.toLowerCase().includes('hadith') || grade || 
                      (currentItem.title && currentItem.title.toLowerCase().includes('hadith'));
        
        // Update the title based on hadith detection
        if (isHadith) {
          titleToShow = 'Hadith of the Day';
          titleGradient = contentTypeConfig['HADITH'].titleColor;
        }
        
        // Parse content based on its format
        if (typeof currentItem.content === 'string') {
          englishText = currentItem.content;
        } else if (currentItem.content?.text) {
          englishText = currentItem.content.text;
        } else if (currentItem.content?.arabic && currentItem.content?.translation) {
          arabicText = currentItem.content.arabic;
          englishText = currentItem.content.translation;
        } else if (typeof currentItem.content === 'object') {
          // Handle JSON format
          try {
            const contentObj = currentItem.content;
            arabicText = contentObj.arabicText || contentObj.arabic || '';
            englishText = contentObj.translation || contentObj.text || JSON.stringify(contentObj);
            grade = contentObj.grade || grade;
            reference = contentObj.reference || reference;
          } catch (e) {
            console.error('Error parsing VERSE_HADITH content:', e);
            englishText = JSON.stringify(currentItem.content);
          }
        }
        
        return (
          <Box sx={{ 
            textAlign: 'center', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: screenSize.is720p ? 1 : 2,
            overflow: 'auto',
            // No background color to maintain glassmorphic effect
          }}>
            {arabicText && (
              <Typography 
                sx={{ 
                  fontSize: getDynamicFontSize(arabicText, 'arabic'),
                  mb: 2,
                  textAlign: 'center',
                  fontFamily: 'Scheherazade New, Arial',
                  direction: 'rtl',
                  lineHeight: 1.7,
                  color: '#FFFFFF',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)' // Enhanced shadow for better readability
                }}
              >
                <MemoizedFormattedText text={arabicText} />
              </Typography>
            )}
            
            <Typography 
              sx={{ 
                fontSize: getDynamicFontSize(englishText, 'normal'),
                lineHeight: 1.4,
                mb: 2,
                textAlign: 'center',
                whiteSpace: 'pre-line',
                color: '#FFFFFF',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)' // Enhanced shadow for better readability
              }}
            >
              <MemoizedFormattedText text={englishText} />
            </Typography>
            
            <Typography 
              sx={{ 
                fontSize: getScaledFontSize(fontSizes.h6),
                color: 'rgba(255, 255, 255, 0.85)',
                mt: 1,
                fontStyle: 'italic',
                textAlign: 'center',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' // Add text shadow for better readability
              }}
            >
              {reference}{grade ? ` - ${grade}` : ''}
            </Typography>
          </Box>
        );
      }
      
      // For ANNOUNCEMENT type
      if (currentItem.type === 'ANNOUNCEMENT') {
        let announcementText = '';
        
        // Parse content based on its format
        if (typeof currentItem.content === 'string') {
          announcementText = currentItem.content;
        } else if (currentItem.content?.text) {
          announcementText = currentItem.content.text;
        } else if (typeof currentItem.content === 'object') {
          announcementText = JSON.stringify(currentItem.content);
        }
        
        const isUrgent = currentItem.urgent === true;
        
        // Get optimal font size based on text length
        const getOptimalFontSize = (text: string): string => {
          const length = text.length;
          const lines = text.split('\n').length;
          
          if (length < 50) return getScaledFontSize(fontSizes.h2);
          if (length < 100) return getScaledFontSize(fontSizes.h3);
          if (length < 200) return getScaledFontSize(fontSizes.h4);
          if (length < 400) return getScaledFontSize(fontSizes.h5);
          return getScaledFontSize(fontSizes.h6);
        };
        
        return (
          <Box sx={{ 
            textAlign: 'center', 
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: screenSize.is720p ? 2 : 3,
          }}>
            <Typography 
              sx={{ 
                fontSize: getOptimalFontSize(announcementText),
                lineHeight: 1.4,
                textAlign: 'center',
                fontWeight: announcementText.length > 150 ? 'normal' : 'bold',
                whiteSpace: 'pre-line',
                color: '#FFFFFF',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MemoizedFormattedText text={announcementText} />
            </Typography>
          </Box>
        );
      }
      
      // Default for any other content type
      return (
        <Box sx={{ 
          textAlign: 'center', 
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          p: screenSize.is720p ? 1 : 2,
          // No background color to maintain glassmorphic effect
        }}>
          <Typography 
            sx={{ 
              fontSize: getDynamicFontSize(
                typeof currentItem.content === 'string' 
                  ? currentItem.content 
                  : currentItem.content?.text || JSON.stringify(currentItem.content),
                'normal'
              ),
              lineHeight: 1.5,
              textAlign: 'center',
              whiteSpace: 'pre-line',
              color: '#FFFFFF',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' // Add text shadow for better readability
            }}
          >
            <MemoizedFormattedText text={
              typeof currentItem.content === 'string' 
                ? currentItem.content 
                : currentItem.content?.text || JSON.stringify(currentItem.content)
            } />
          </Typography>
        </Box>
      );
    } catch (error) {
      console.error('Error rendering content:', error);
      return (
        <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h4), textAlign: 'center', color: 'error.main' }}>
          Error displaying content
        </Typography>
      );
    }
  }, [contentLoading, currentItemIndex, getCurrentTypeConfig, variant, fontSizes, screenSize]);

  // Memoize the entire content display to reduce re-renders
  const contentDisplay = useMemo(() => {
    return renderContent();
  }, [renderContent]);
  
  // Update loading state based on content and isLoading
  useEffect(() => {
    // Keep showing loading until we've checked IndexedDB and have either loaded content or API loading is complete
    if (contentItems.length > 0) {
      // If we have content items, we're no longer loading
      setContentLoading(false);
    } else if (!isLoading && hasCheckedLocalStorage) {
      // Only stop loading if we've checked IndexedDB and API loading is complete
      setContentLoading(false);
    }
  }, [contentItems.length, isLoading, hasCheckedLocalStorage]);
  
  // Force a reload if content is empty after initial load
  useEffect(() => {
    // Wait until loading is complete and check if we actually have content
    if (!isLoading && !contentItems.length && hasRefreshedRef.current && hasCheckedLocalStorage) {
      // Set a short timeout to prevent immediate reloading
      const timeoutId = setTimeout(() => {
        // Try to refresh the schedule
        refreshSchedule().catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to reload schedule:', { 
            error: errorMessage 
          });
        });
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, contentItems.length, refreshSchedule, hasCheckedLocalStorage]);
  
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {contentDisplay}
    </Box>
  );
};

// Export as memoized component to prevent unnecessary re-renders
export default memo(ContentCarousel); 