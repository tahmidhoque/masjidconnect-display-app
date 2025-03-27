import React, { useState, useEffect, useCallback, useRef } from 'react';
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
      return;
    }
    
    if (!autoRotate || contentItems.length <= 1 || hasUserInteracted.current) {
      return;
    }

    // Use timer for rotation
    timerRef.current = setTimeout(() => {
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
      // Set a short timeout to prevent immediate reloading
      const timeoutId = setTimeout(() => {
        // Try to refresh the schedule
        refreshSchedule().catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to reload schedule:', { errorMessage });
        });
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, contentItems.length, refreshSchedule]);
  
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
        <Fade
          in={showPrayerAnnouncement}
          timeout={FADE_TRANSITION_DURATION}
          unmountOnExit
        >
          <Box 
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
              zIndex: 100000, // Extremely high z-index
              background: isPrayerJamaat 
                ? 'linear-gradient(135deg, rgba(241, 196, 15, 0.95), rgba(218, 165, 32, 0.85))'
                : 'linear-gradient(135deg, rgba(42, 157, 143, 0.95), rgba(26, 95, 87, 0.85))',
              overflow: 'hidden'
            }}
          >
            {/* Islamic pattern background for prayer announcement */}
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              zIndex: 0
            }}>
              <IslamicPatternBackground 
                variant="embossed" 
                embossStrength="medium" 
                patternColor={"#0A2647"}
                backgroundColor={ '#0A2647'}
                opacity={0.3}
              />
            </Box>
            
            {/* Prayer announcement card */}
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                width: '90%',
                maxWidth: '600px',
                background: isPrayerJamaat 
                  ? 'linear-gradient(135deg, #F1C40F 0%, #DAA520 100%)' 
                  : 'linear-gradient(135deg, #2A9D8F 0%, #205E56 100%)',
                color: isPrayerJamaat ? '#0A2647' : '#FFFFFF',
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
                  <PrayerRowsIcon width="120px" height="120px" fill="#0A2647" />
                ) : (
                  <NoMobilePhoneIcon width="120px" height="120px" fill="#FFFFFF" />
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
          </Box>
        </Fade>
      </Box>
    </>
  );
};

export default ContentCarousel; 