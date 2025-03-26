import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Box, Typography, Fade, CircularProgress } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import IslamicPatternBackground from './IslamicPatternBackground';
import { NoMobilePhoneIcon, PrayerRowsIcon } from '../../assets/svgComponent';
import logger from '../../utils/logger';
import { useOrientation } from '../../contexts/OrientationContext';
import localforage from 'localforage';

// Define content types enum to match API
type ContentItemType = 'VERSE_HADITH' | 'ANNOUNCEMENT' | 'EVENT' | 'CUSTOM' | 'ASMA_AL_HUSNA';

interface ContentItem {
  id: string;
  title: string;
  content: any;
  type: ContentItemType; 
  duration: number;
  reference?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ScheduleItem {
  id: string;
  contentItem: ContentItem;
  order: number;
}

/**
 * ContentCarousel component
 * 
 * Displays content items in a carousel/slideshow format.
 * Automatically rotates through items based on their specified duration.
 * Also displays prayer announcements when prayer times are reached.
 */
const ContentCarousel: React.FC = () => {
  const { 
    schedule, 
    events, 
    refreshContent, 
    refreshSchedule,
    isLoading,
    // Prayer announcement states
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
    setPrayerAnnouncement,
    setPrayerAnnouncementName,
    setIsPrayerJamaat,
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
  
  // Debug state
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
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
  
  // Log when prayer announcement state changes
  useEffect(() => {
    // Only log significant changes to reduce noise
    if (showPrayerAnnouncement) {
      logger.info(`[ContentCarousel] Prayer announcement activated`, {
        prayerName: prayerAnnouncementName,
        isJamaat: isPrayerJamaat
      });
    } else if (!showPrayerAnnouncement && lastAnnouncementState.current) {
      logger.info(`[ContentCarousel] Prayer announcement deactivated`);
    }
    
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
  
  // Refresh content when mounted and when orientation changes
  useEffect(() => {
    // Initial content load
    if (!hasRefreshedRef.current) {
      logger.info('ContentCarousel: Initial schedule refresh');
      hasRefreshedRef.current = true;
      refreshSchedule().catch((error) => {
        logger.error('Failed to refresh schedule:', error);
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
        logger.error('Failed to refresh schedule after orientation change:', error);
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
  
  // Debug schedule changes
  useEffect(() => {
    logger.info('ContentCarousel: Schedule changed', { 
      hasSchedule: !!schedule,
      itemCount: schedule?.items?.length || 0,
      firstItem: schedule?.items?.[0] ? {
        hasContentItem: !!schedule.items[0].contentItem,
        type: schedule.items[0].contentItem?.type || 'unknown'
      } : 'no items',
      rawSchedule: JSON.stringify(schedule).substring(0, 200) + '...'
    });
    
    // Detailed console.log for immediate debugging visibility
    console.log('🔍 SCHEDULE CHANGED:', {
      hasItems: !!(schedule?.items && schedule.items.length > 0),
      itemCount: schedule?.items?.length || 0,
      firstItemSample: schedule?.items?.[0] ? JSON.stringify(schedule.items[0]).substring(0, 150) : 'no items'
    });
  }, [schedule]);
  
  // Add direct debug of raw data in IndexedDB
  useEffect(() => {
    // One-time check of IndexedDB data
    const checkIndexedDB = async () => {
      try {
        // This uses the browser's built-in IndexedDB API
        const dbRequest = indexedDB.open('MasjidConnect', 1);
        
        dbRequest.onsuccess = (event) => {
          // @ts-ignore
          const db = event.target.result;
          
          if (db.objectStoreNames.contains('display_storage')) {
            const transaction = db.transaction('display_storage', 'readonly');
            const store = transaction.objectStore('display_storage');
            
            const scheduleRequest = store.get('schedule');
            
            scheduleRequest.onsuccess = () => {
              const data = scheduleRequest.result;
              console.log('🔍 DIRECT INDEXEDDB CHECK - SCHEDULE:', data);
              logger.info('ContentCarousel: Direct IndexedDB check - schedule data', {
                hasData: !!data,
                type: typeof data,
                isArray: Array.isArray(data),
                hasItems: !!(data?.items && data.items.length > 0),
                itemCount: data?.items?.length || 0
              });
            };
            
            scheduleRequest.onerror = (error: Event) => {
              console.error('Error reading schedule from IndexedDB:', error);
            };
          } else {
            console.log('display_storage object store not found');
          }
        };
        
        dbRequest.onerror = (error) => {
          console.error('Error opening IndexedDB:', error);
        };
      } catch (error) {
        console.error('Error checking IndexedDB:', error);
      }
    };
    
    checkIndexedDB();
  }, []);
  
  // Prepare content items for carousel
  useEffect(() => {
    if (!isComponentMountedRef.current) return;
    
    logger.info('ContentCarousel: Processing content items', {
      hasSchedule: !!schedule,
      hasScheduleItems: !!(schedule?.items && schedule.items.length > 0),
      hasEvents: !!(events && events.length > 0),
      contentItemsCount: contentItemsRef.current.length
    });
    
    // More detailed console log for immediate visibility
    console.log('🔍 PROCESSING CONTENT ITEMS:', {
      hasSchedule: !!schedule,
      scheduleType: schedule ? typeof schedule : 'null',
      hasItems: !!(schedule?.items && schedule.items.length > 0),
      itemsCount: schedule?.items?.length || 0,
      contentItemsRefCount: contentItemsRef.current.length
    });
    
    let items = [];
    
    // Add schedule items if available
    if (schedule?.items && schedule.items.length > 0) {
      console.log('🔍 MAPPING SCHEDULE ITEMS, count:', schedule.items.length);
      
      // Map schedule items to the expected format
      const mappedItems = schedule.items.map((item, index) => {
        // If item doesn't have contentItem property, create it from the item's properties
        if (!item.contentItem) {
          console.log(`🔍 Item ${index} missing contentItem, transforming:`, item);
          
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
        console.log(`🔍 Item ${index} has contentItem, type:`, contentItem.type || 'unknown');
        
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
        console.log(`🔍 Mapped ${mappedItems.length} items from schedule`);
        items.push(...mappedItems);
      } else {
        console.log('🔍 No valid items after mapping schedule items');
      }
    }
    
    // Add upcoming events if available
    if (events && events.length > 0) {
      items.push(...events.map(event => ({
        id: event.id,
        order: 999, // Place events after scheduled content
        contentItem: {
          id: event.id,
          title: event.title || 'Event',
          content: event.description || 'No description available',
          type: 'EVENT',
          duration: 20
        },
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location
      })));
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
    // Clear any existing timer to prevent memory leaks
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Skip rotation if prayer announcement is active
    if (showPrayerAnnouncement) {
      logger.info(`Rotation paused - Prayer announcement active - ${prayerAnnouncementName}`);
      return;
    }
    
    if (!autoRotate || contentItems.length <= 1 || hasUserInteracted.current) {
      return;
    }

    // Use timer for rotation
    timerRef.current = setTimeout(() => {
      logger.debug(`Rotating to next item, current index: ${currentItemIndex}, next: ${(currentItemIndex + 1) % contentItems.length}`);
      
      // Start transition
      setIsChangingItem(true);
      setShowContent(false);
      
      // After fade-out, change to next item
      setTimeout(() => {
        const nextIndex = (currentItemIndex + 1) % contentItems.length;
        setCurrentItemIndex(nextIndex);
        
        // Reset timer for the next item based on its duration
        if (contentItems[nextIndex] && contentItems[nextIndex].contentItem) {
          const nextDuration = contentItems[nextIndex].contentItem.duration || defaultDuration;
          setCurrentItemDisplayTime(nextDuration * 1000);
        }
        
        // Show new content
        setShowContent(true);
        setIsChangingItem(false);
      }, FADE_TRANSITION_DURATION);
      
      // Reset user interaction flag after rotation has occurred
      if (Date.now() - lastInteractionTime.current > userInteractionTimeout) {
        hasUserInteracted.current = false;
      }
    }, currentItemDisplayTime);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [autoRotate, currentItemIndex, contentItems.length, currentItemDisplayTime, showPrayerAnnouncement, prayerAnnouncementName]);

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

  // Render content based on its type
  const renderContent = () => {
    // Show loading indicator while content is being loaded for the first time
    if (contentLoading && isLoading) {
      return (
        <Box sx={{ 
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          p: screenSize.is720p ? 1 : 2
        }}>
          <CircularProgress color="primary" />
          <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h5), textAlign: 'center' }}>
            Loading content...
          </Typography>
        </Box>
      );
    }
    
    // Guard clauses for empty state
    if (!contentItems || contentItems.length === 0 || currentItemIndex >= contentItems.length) {
      return (
        <Box sx={{ 
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: screenSize.is720p ? 1 : 2
        }}>
          <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h4), mb: 1, fontWeight: 'bold' }}>
            No Content Available
          </Typography>
          <Typography sx={{ fontSize: getScaledFontSize(fontSizes.body1) }}>
            Content will appear here once it's configured.
          </Typography>
        </Box>
      );
    }

    const currentItem = contentItems[currentItemIndex];
    if (!currentItem || !currentItem.contentItem) {
      console.error('Invalid content item:', currentItem);
      return (
        <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h4), textAlign: 'center' }}>
          Content unavailable
        </Typography>
      );
    }
    
    const content = currentItem.contentItem;
    const contentType = content.type;
    
    try {
      // For EVENT type
      if (contentType === 'EVENT') {
        let eventText = '';
        
        // Parse content based on its format
        if (typeof content.content === 'string') {
          eventText = content.content;
        } else if (content.content?.text) {
          eventText = content.content.text;
        } else if (typeof content.content === 'object') {
          eventText = JSON.stringify(content.content);
        }
        
        // Calculate font size based on content length to prevent overflow
        const textLength = eventText.length;
        const dynamicFontSize = textLength > 200 ? 
          getScaledFontSize(fontSizes.h5) : (textLength > 100 ? getScaledFontSize(fontSizes.h4) : getScaledFontSize(fontSizes.h3));
        
        return (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: screenSize.is720p ? 0.5 : 1, 
            textAlign: 'center',
            width: '100%',
            p: screenSize.is720p ? 0.5 : 1,
            overflow: 'auto'
          }}>
            <Typography 
              sx={{ 
                fontSize: dynamicFontSize,
                mb: 1,
                textAlign: 'center',
                fontWeight: 'medium'
              }}
            >
              {eventText}
            </Typography>
            
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-around', 
                flexWrap: 'wrap',
                gap: 1,
                mt: 1,
                bgcolor: 'background.paper',
                p: 1,
                borderRadius: 2,
                width: '100%'
              }}
            >
              {currentItem.startDate && (
                <Box>
                  <Typography 
                    sx={{ 
                      fontSize: getScaledFontSize(fontSizes.h6),
                      fontWeight: 'bold',
                      color: 'text.secondary',
                      textAlign: 'center'
                    }}
                  >
                    Date
                  </Typography>
                  <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h5), textAlign: 'center' }}>
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
                <Box>
                  <Typography 
                    sx={{ 
                      fontSize: getScaledFontSize(fontSizes.h6),
                      fontWeight: 'bold',
                      color: 'text.secondary',
                      textAlign: 'center'
                    }}
                  >
                    {currentItem.location ? 'Location' : 'Time'}
                  </Typography>
                  <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h5), textAlign: 'center' }}>
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
          </Box>
        );
      }
      
      // For ASMA_AL_HUSNA type
      if (contentType === 'ASMA_AL_HUSNA') {
        let displayContent = content.content;
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
            p: screenSize.is720p ? 0.5 : 1
          }}>
            {arabicText && (
              <Typography 
                sx={{ 
                  fontSize: getScaledFontSize(fontSizes.h1),
                  mb: 1,
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontFamily: 'Scheherazade New, Arial'
                }}
              >
                {arabicText}
              </Typography>
            )}
            
            {transliteration && (
              <Typography 
                sx={{ 
                  fontSize: getScaledFontSize(fontSizes.h3),
                  mb: 1,
                  textAlign: 'center',
                  fontWeight: 'medium'
                }}
              >
                {transliteration}
              </Typography>
            )}
            
            {meaning && (
              <Typography 
                sx={{ 
                  fontSize: getScaledFontSize(fontSizes.h4),
                  textAlign: 'center'
                }}
              >
                {meaning}
              </Typography>
            )}
          </Box>
        );
      }
      
      // For VERSE_HADITH type
      if (contentType === 'VERSE_HADITH') {
        let textContent;
        let arabicText = '';
        let englishText = '';
        let reference = content.content?.reference || content.reference || '';
        let grade = content.content?.grade || '';
        
        // Parse content based on its format
        if (typeof content.content === 'string') {
          englishText = content.content;
        } else if (content.content?.text) {
          englishText = content.content.text;
        } else if (content.content?.arabic && content.content?.translation) {
          arabicText = content.content.arabic;
          englishText = content.content.translation;
        } else if (typeof content.content === 'object') {
          // Handle JSON format
          try {
            const contentObj = content.content;
            arabicText = contentObj.arabicText || contentObj.arabic || '';
            englishText = contentObj.translation || contentObj.text || JSON.stringify(contentObj);
            grade = contentObj.grade || grade;
            reference = contentObj.reference || reference;
          } catch (e) {
            console.error('Error parsing VERSE_HADITH content:', e);
            englishText = JSON.stringify(content.content);
          }
        }
        
        // Calculate font size based on content length to prevent overflow
        const arabicFontSize = arabicText.length > 150 ? 
          getScaledFontSize(fontSizes.h4) : (arabicText.length > 80 ? getScaledFontSize(fontSizes.h3) : getScaledFontSize(fontSizes.h2));
        
        const englishFontSize = englishText.length > 300 ? 
          getScaledFontSize(fontSizes.h5) : (englishText.length > 150 ? getScaledFontSize(fontSizes.h4) : getScaledFontSize(fontSizes.h3));
        
        return (
          <Box sx={{ 
            textAlign: 'center', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: screenSize.is720p ? 0.5 : 1,
            overflow: 'auto'
          }}>
            {arabicText && (
              <Typography 
                sx={{ 
                  fontSize: arabicFontSize,
                  mb: 2,
                  textAlign: 'center',
                  fontFamily: 'Scheherazade New, Arial',
                  direction: 'rtl',
                  lineHeight: 1.7
                }}
              >
                {arabicText}
              </Typography>
            )}
            
            <Typography 
              sx={{ 
                fontSize: englishFontSize,
                lineHeight: 1.4,
                mb: 2,
                textAlign: 'center'
              }}
            >
              {englishText}
            </Typography>
            
            <Typography 
              sx={{ 
                fontSize: getScaledFontSize(fontSizes.h6),
                color: 'text.secondary',
                mt: 1,
                fontStyle: 'italic',
                textAlign: 'center'
              }}
            >
              {reference}{grade ? ` - ${grade}` : ''}
            </Typography>
          </Box>
        );
      }
      
      // For ANNOUNCEMENT type
      if (contentType === 'ANNOUNCEMENT') {
        let announcementText = '';
        
        // Parse content based on its format
        if (typeof content.content === 'string') {
          announcementText = content.content;
        } else if (content.content?.text) {
          announcementText = content.content.text;
        } else if (typeof content.content === 'object') {
          announcementText = JSON.stringify(content.content);
        }
        
        // Calculate font size based on content length to prevent overflow
        const textLength = announcementText.length;
        const dynamicFontSize = textLength > 300 ? 
          getScaledFontSize(fontSizes.h5) : (textLength > 150 ? getScaledFontSize(fontSizes.h4) : getScaledFontSize(fontSizes.h3));
        
        return (
          <Box sx={{ 
            textAlign: 'center', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: screenSize.is720p ? 0.5 : 1
          }}>
            <Typography 
              sx={{ 
                fontSize: dynamicFontSize,
                lineHeight: 1.5,
                textAlign: 'center',
                fontWeight: textLength > 150 ? 'normal' : 'bold'
              }}
            >
              {announcementText}
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
          p: screenSize.is720p ? 0.5 : 1
        }}>
          <Typography 
            sx={{ 
              fontSize: getScaledFontSize(fontSizes.h4),
              lineHeight: 1.5,
              textAlign: 'center'
            }}
          >
            {typeof content.content === 'string' 
              ? content.content 
              : content.content?.text || JSON.stringify(content.content)}
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
  };
  
  // Render prayer announcement content
  const renderPrayerAnnouncement = () => {
    if (!showPrayerAnnouncement) return null;
    
    // Always log when we're attempting to render an announcement
    logger.info('[ContentCarousel] Rendering prayer announcement', {
      name: prayerAnnouncementName,
      isJamaat: isPrayerJamaat,
      timestamp: new Date().toISOString()
    });
    
    // Use different styling for adhaan vs jamaat
    const bgColor = isPrayerJamaat 
      ? 'linear-gradient(135deg, #F1C40F 0%, #DAA520 100%)' 
      : 'linear-gradient(135deg, #2A9D8F 0%, #205E56 100%)';
    
    const textColor = isPrayerJamaat ? '#0A2647' : '#FFFFFF';
    const iconColor = isPrayerJamaat ? '#0A2647' : '#FFFFFF';
    
    return (
      <Box
        onClick={() => {
          console.log("Prayer announcement clicked");
        }}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '600px',
          background: bgColor,
          color: textColor,
          borderRadius: '16px',
          p: screenSize.is720p ? 3 : 5,
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          border: '3px solid',
          borderColor: isPrayerJamaat ? 'rgba(244, 208, 63, 0.9)' : 'rgba(42, 157, 143, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          animation: 'pulse 2s infinite ease-in-out',
          '@keyframes pulse': {
            '0%': { boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)' },
            '50%': { boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' },
            '100%': { boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)' },
          },
        }}
      >
        <Typography
          sx={{
            fontSize: getScaledFontSize(fontSizes.h2),
            fontWeight: 'bold',
            mb: 2,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            letterSpacing: '0.5px',
          }}
        >
          {isPrayerJamaat ? `${prayerAnnouncementName} Jamaa't Time` : `${prayerAnnouncementName} Time`}
        </Typography>
        
        <Typography
          sx={{
            fontSize: getScaledFontSize(fontSizes.h3),
            mb: 3,
            letterSpacing: '0.5px',
          }}
        >
          {isPrayerJamaat 
            ? 'Please straighten your rows for prayer' 
            : 'Please silence your mobile devices'}
        </Typography>
        
        <Box sx={{ mb: 2, mt: 2 }}>
          {isPrayerJamaat ? (
            <PrayerRowsIcon width="120px" height="120px" fill={iconColor} />
          ) : (
            <NoMobilePhoneIcon width="120px" height="120px" fill={iconColor} />
          )}
        </Box>
        
        <Typography
          sx={{
            fontSize: getScaledFontSize(fontSizes.h4),
            mt: 2,
            opacity: 0.9,
            letterSpacing: '0.5px',
          }}
        >
          {isPrayerJamaat 
            ? 'Jamaa\'t is about to begin' 
            : 'Adhaan is about to begin'}
        </Typography>
      </Box>
    );
  };
  
  // Toggle debug info display
  const toggleDebugInfo = useCallback(() => {
    setShowDebugInfo(prev => !prev);
  }, []);
  
  // Add event listener for debug key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Debug info toggle with 'I' key
      if (e.key === 'i' || e.key === 'I') {
        toggleDebugInfo();
      }
      
      // Manual prayer announcement override with 'D' key
      if (e.key === 'd' || e.key === 'D') {
        console.log('[DEBUG] D key pressed - forcing prayer announcement');
        const currentTimestamp = new Date().toLocaleTimeString();
        
        // Force the prayer announcement directly
        if (!showPrayerAnnouncement) {
          const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
          const randomPrayer = prayerNames[Math.floor(Math.random() * prayerNames.length)];
          const isJamaat = Math.random() > 0.5;
          
          console.log(`[DEBUG] Forcing prayer announcement: ${randomPrayer}, Jamaat: ${isJamaat}`);
          
          // Try two different methods to ensure it works
          // Method 1: Using ContentContext function
          setPrayerAnnouncement(true, randomPrayer, isJamaat);
          
          // Method 2: Direct state update as backup - removed as we now have proper types
        } else {
          // Hide the announcement if it's already showing
          console.log('[DEBUG] Hiding prayer announcement');
          setPrayerAnnouncement(false);
        }
      }
      
      // Emergency override with Shift+A
      if (e.key.toLowerCase() === 'a' && e.shiftKey) {
        logger.info("Emergency override: Forcing prayer announcement display");
        setAutoRotate(false);
        // Clear any existing rotation timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDebugInfo, setPrayerAnnouncement, showPrayerAnnouncement, prayerAnnouncementName, isPrayerJamaat, setPrayerAnnouncementName, setIsPrayerJamaat, autoRotate, setAutoRotate]);
  
  // Function to directly toggle announcement state (for debugging)
  const emergencyToggleAnnouncement = useCallback(() => {
    logger.info(`Emergency toggle: Setting showPrayerAnnouncement to ${!showPrayerAnnouncement}`);
    
    if (!showPrayerAnnouncement) {
      // Force render immediately
      console.log('Emergency override: Forcing prayer announcement to show');
      
      // Render the announcement content directly
      const box = document.createElement('div');
      box.style.position = 'fixed';
      box.style.top = '0';
      box.style.left = '0';
      box.style.width = '100%';
      box.style.height = '100%';
      box.style.display = 'flex';
      box.style.justifyContent = 'center';
      box.style.alignItems = 'center';
      box.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      box.style.zIndex = '999999999';
      
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="background: linear-gradient(135deg, #F1C40F 0%, #DAA520 100%); color: #0A2647; padding: 2rem; border-radius: 16px; text-align: center; width: 80%; max-width: 600px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);">
          <h2 style="font-size: 2rem; margin-bottom: 1rem;">EMERGENCY DEBUG</h2>
          <h3 style="font-size: 1.5rem; margin-bottom: 1rem;">Prayer Announcement</h3>
          <p style="font-size: 1.2rem;">This is a forced prayer announcement for debugging purposes.</p>
          <p style="margin-top: 2rem; font-size: 1rem;">Click anywhere to dismiss</p>
        </div>
      `;
      
      box.appendChild(content);
      document.body.appendChild(box);
      
      // Remove on click
      box.addEventListener('click', () => {
        document.body.removeChild(box);
      });
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (document.body.contains(box)) {
          document.body.removeChild(box);
        }
      }, 10000);
    }
  }, [showPrayerAnnouncement]);
  
  // Add event listener for custom prayer announcement event as emergency fallback
  useEffect(() => {
    const handleCustomPrayerAnnouncement = (event: Event) => {
      // Type assertion for CustomEvent
      const customEvent = event as CustomEvent<{show: boolean, prayerName: string, isJamaat: boolean}>;
      
      if (customEvent.detail) {
        const { show, prayerName, isJamaat } = customEvent.detail;
        
        logger.info(`[ContentCarousel] Received emergency prayer announcement event`, {
          show,
          prayerName,
          isJamaat
        });
        
        // Create a direct emergency overlay if state-based approach failed
        if (show && !showPrayerAnnouncement) {
          emergencyToggleAnnouncement();
        }
      }
    };
    
    document.addEventListener('prayer-announcement', handleCustomPrayerAnnouncement);
    return () => document.removeEventListener('prayer-announcement', handleCustomPrayerAnnouncement);
  }, [showPrayerAnnouncement, emergencyToggleAnnouncement]);
  
  // Update loading state based on content and isLoading
  useEffect(() => {
    // If we have content items, we're no longer loading
    if (contentItems.length > 0) {
      setContentLoading(false);
    } else if (!isLoading && contentLoading) {
      // If API loading is done but we still don't have content, stop showing the loading indicator
      setContentLoading(false);
    }
  }, [contentItems.length, isLoading, contentLoading]);
  
  // Force a reload if content is empty after initial load
  useEffect(() => {
    // Wait until loading is complete and check if we actually have content
    if (!isLoading && !contentItems.length && hasRefreshedRef.current) {
      console.log('🔍 NO CONTENT ITEMS AFTER LOADING, will force reload in 1 second');
      
      // Set a short timeout to prevent immediate reloading
      const timeoutId = setTimeout(() => {
        logger.info('ContentCarousel: No content items after loading, forcing reload');
        
        // Try direct fetch from localStorage/IndexedDB as a diagnostic step
        try {
          const checkStorage = async () => {
            // Try to open IndexedDB
            const dbRequest = indexedDB.open('MasjidConnect', 1);
            
            dbRequest.onsuccess = (event) => {
              // @ts-ignore
              const db = event.target.result;
              
              if (db.objectStoreNames.contains('display_storage')) {
                const transaction = db.transaction('display_storage', 'readonly');
                const store = transaction.objectStore('display_storage');
                
                const scheduleRequest = store.get('schedule');
                
                scheduleRequest.onsuccess = () => {
                  const data = scheduleRequest.result;
                  console.log('🆘 EMERGENCY STORAGE CHECK - SCHEDULE:', data);
                  
                  if (data && (data.items?.length > 0 || (Array.isArray(data) && data.length > 0))) {
                    console.log('🔍 FOUND VALID SCHEDULE DATA IN INDEXEDDB, FORCING REFRESH');
                    refreshSchedule().catch((error: unknown) => {
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      logger.error('Failed to reload schedule:', { errorMessage });
                    });
                  } else {
                    console.log('🔍 NO VALID SCHEDULE DATA IN INDEXEDDB');
                    refreshContent(true).then(() => {
                      refreshSchedule();
                    }).catch(error => {
                      logger.error('Failed to refresh content and schedule:', error);
                    });
                  }
                };
              }
            };
          };
          
          checkStorage();
        } catch (error: unknown) {
          console.error('Error during emergency storage check:', error);
          // Fall back to normal refresh
          refreshSchedule().catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to reload schedule:', { errorMessage });
          });
        }
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, contentItems.length, refreshSchedule, refreshContent]);
  
  // Force refresh content
  const forceRefreshContent = useCallback(() => {
    console.log('🔥 FORCE REFRESHING CONTENT AND SCHEDULE');
    logger.info('ContentCarousel: Force refreshing content and schedule');
    
    // Set loading state
    setContentLoading(true);
    
    // First refresh all content
    refreshContent(true).then(() => {
      // Then refresh schedule specifically
      return refreshSchedule();
    }).catch((error: unknown) => {
      logger.error('Error during force refresh:', { error });
      console.error('🔥 ERROR DURING FORCE REFRESH:', error);
    }).finally(() => {
      console.log('🔥 FORCE REFRESH COMPLETED');
    });
  }, [refreshContent, refreshSchedule]);
  
  // Reset all storage (dangerous, but useful for fixing corrupted data)
  const resetAllStorage = useCallback(() => {
    // This uses the browser's built-in IndexedDB API directly
    console.log('🧨 ATTEMPTING TO RESET ALL STORAGE');
    logger.info('ContentCarousel: Resetting all storage');
    
    try {
      // First try using localforage's clear method
      try {
        localforage.clear().then(() => {
          console.log('🧨 LOCALFORAGE STORAGE CLEARED');
          
          // After clearing, force a refresh
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }).catch((err: unknown) => {
          console.error('Error clearing localforage:', err);
        });
      } catch (error) {
        console.error('Error with localforage clear:', error);
        
        // Fallback: Try to delete the database directly
        try {
          const deleteRequest = indexedDB.deleteDatabase('MasjidConnect');
          
          deleteRequest.onsuccess = () => {
            console.log('🧨 DATABASE DELETED SUCCESSFULLY');
            
            // After deleting, force a refresh
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          };
          
          deleteRequest.onerror = () => {
            console.error('Error deleting database');
          };
        } catch (dbError) {
          console.error('Error deleting database:', dbError);
        }
      }
    } catch (error) {
      console.error('Error in resetAllStorage:', error);
    }
  }, []);
  
  // Main render
  return (
    <>
      {/* Main content */}
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Background pattern for both views */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <IslamicPatternBackground variant="embossed" />
        </Box>
        
        {/* Regular content */}
        <Fade 
          in={!showPrayerAnnouncement && showContent} 
          timeout={FADE_TRANSITION_DURATION}
          unmountOnExit
        >
          <Box 
            sx={{ 
              height: '100%', 
              width: '100%', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              zIndex: 1
            }}
          >
            {renderContent()}
          </Box>
        </Fade>
        
        {/* Prayer announcement with hard-coded high z-index */}
        <Box 
          onClick={() => console.log('Prayer announcement box clicked')}
          sx={{ 
            position: 'fixed', // Use fixed positioning to break out of any stacking contexts
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isPrayerJamaat 
              ? 'rgba(241, 196, 15, 0.2)' 
              : 'rgba(42, 157, 143, 0.2)',
            opacity: showPrayerAnnouncement ? 1 : 0,
            visibility: showPrayerAnnouncement ? 'visible' : 'hidden',
            transition: 'opacity 500ms ease-in-out, visibility 500ms ease-in-out',
            zIndex: 100000 // Extremely high z-index
          }}
        >
          {renderPrayerAnnouncement()}
        </Box>
        
        {/* Hidden refresh button - only visible when content fails to load */}
        {(!contentItems || contentItems.length === 0) && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              zIndex: 1000,
            }}
          >
            <Box
              onClick={forceRefreshContent}
              sx={{
                backgroundColor: 'rgba(25, 118, 210, 0.8)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 1)'
                }
              }}
            >
              <span>{contentLoading ? 'Loading...' : 'Refresh Content'}</span>
              {contentLoading && <CircularProgress size={16} sx={{ color: 'white' }} />}
            </Box>
            
            <Box
              onClick={resetAllStorage}
              sx={{
                backgroundColor: 'rgba(211, 47, 47, 0.8)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                '&:hover': {
                  backgroundColor: 'rgba(211, 47, 47, 1)'
                }
              }}
            >
              <span>Reset Storage</span>
            </Box>
          </Box>
        )}
      </Box>
      
      {/* Debug Info Overlay */}
      {showDebugInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          background: 'rgba(0,0,0,0.8)',
          color: 'lime',
          padding: '10px',
          zIndex: 10000,
          fontFamily: 'monospace',
          fontSize: '12px',
          width: '400px',
          maxHeight: '100vh',
          overflowY: 'auto'
        }}>
          <h3>Debug Info</h3>
          <p><strong>KEY CONTROLS:</strong></p>
          <p>- Press 'I' to toggle this debug panel</p>
          <p>- Press 'D' to force toggle prayer announcement state</p>
          <p>- Press 'Shift+A' for emergency announcement override</p>
          <hr/>
          <p><strong>Prayer Announcement:</strong> {showPrayerAnnouncement ? 'VISIBLE ✅' : 'HIDDEN ❌'}</p>
          <p><strong>Prayer Name:</strong> {prayerAnnouncementName || 'None'}</p>
          <p><strong>Is Jamaat:</strong> {isPrayerJamaat ? 'Yes' : 'No'}</p>
          <hr/>
          <p><strong>Auto Rotate:</strong> {autoRotate ? 'ON' : 'OFF'}</p>
          <p><strong>Current Index:</strong> {currentItemIndex}</p>
          <p><strong>Total Items:</strong> {contentItems?.length || 0}</p>
          <p><strong>Last Rotation:</strong> {new Date().toLocaleTimeString()}</p>
          
          <button 
            onClick={emergencyToggleAnnouncement}
            style={{
              marginTop: '10px',
              padding: '8px',
              backgroundColor: showPrayerAnnouncement ? '#f44336' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            {showPrayerAnnouncement ? 'HIDE ANNOUNCEMENT' : 'FORCE ANNOUNCEMENT NOW'}
          </button>
        </div>
      )}
    </>
  );
};

export default ContentCarousel; 