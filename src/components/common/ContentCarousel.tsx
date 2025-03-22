import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Fade } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import IslamicPatternBackground from './IslamicPatternBackground';

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
 */
const ContentCarousel: React.FC = () => {
  const { schedule, events, refreshContent, refreshSchedule } = useContent();
  console.log('ContentCarousel: schedule', schedule);
  const { fontSizes, screenSize } = useResponsiveFontSize();
  
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showContent, setShowContent] = useState(true);
  const [contentItems, setContentItems] = useState<Array<any>>([]);
  
  // Use refs to prevent unnecessary re-renders
  const contentItemsRef = useRef<Array<any>>([]);
  const hasRefreshedRef = useRef(false);
  
  // Memoize refreshContent to prevent unnecessary re-renders
  const refreshContentOnce = useCallback(() => {
    if (!hasRefreshedRef.current) {
      console.log('ContentCarousel: Refreshing content and schedule...');
      // First try to refresh the schedule specifically
      refreshSchedule()
        .then(() => {
          console.log('ContentCarousel: Schedule refresh attempt completed');
          // Then do the general content refresh as a backup
          return refreshContent();
        })
        .then(() => {
          console.log('ContentCarousel: Content refreshed successfully');
          hasRefreshedRef.current = true;
        })
        .catch(err => console.error('Error refreshing content:', err));
    }
  }, [refreshContent, refreshSchedule]);
  
  // Refresh content when component mounts - with safeguard against infinite refreshes
  useEffect(() => {
    // Create stable function references to avoid dependency changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const doRefreshSchedule = refreshSchedule;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const doRefreshContent = refreshContent;

    // Only refresh if we haven't already refreshed (using the existing ref)
    if (!hasRefreshedRef.current) {
      console.log('ContentCarousel: First mount, refreshing content once...');
      
      // Do a single refresh of schedule and content
      doRefreshSchedule()
        .then(() => {
          console.log('ContentCarousel: Initial schedule refresh completed');
          return doRefreshContent(true);
        })
        .then(() => {
          console.log('ContentCarousel: Initial content refresh completed');
          hasRefreshedRef.current = true; // Mark as refreshed to prevent future refreshes
        })
        .catch(err => {
          console.error('Error during initial refresh:', err);
          // Still mark as refreshed to prevent infinite retry loops
          hasRefreshedRef.current = true;
        });
    } else {
      console.log('ContentCarousel: Skipping refresh as content was already refreshed');
    }
    
    // Cleanup function to help prevent memory leaks
    return () => {
      console.log('ContentCarousel: Component unmounting');
    };
  }, []); // Empty dependency array - run only on mount
  
  // Debug output for schedule and events
  useEffect(() => {
    console.log('ContentCarousel: Current schedule:', schedule);
    console.log('ContentCarousel: Current events:', events);
    
    // More detailed debugging of schedule structure
    if (schedule) {
      console.log('ContentCarousel: Schedule ID:', schedule.id);
      console.log('ContentCarousel: Schedule name:', schedule.name);
      console.log('ContentCarousel: Schedule items array exists:', !!schedule.items);
      console.log('ContentCarousel: Schedule items length:', schedule.items?.length || 0);
      
      // Check the first item if available
      if (schedule.items && schedule.items.length > 0) {
        console.log('ContentCarousel: First item:', schedule.items[0]);
        console.log('ContentCarousel: First item has contentItem:', !!schedule.items[0].contentItem);
      }
    }
    
    // Check if we're using fallback schedule
    if (schedule?.id === 'fallback-schedule') {
      console.log('WARNING: Using fallback schedule! API data retrieval may have failed.');
    } else if (schedule?.id === 'normalized-schedule') {
      console.log('INFO: Using normalized schedule from API data.');
    }
  }, [schedule, events]);
  
  // Prepare content items for carousel
  useEffect(() => {
    console.log('ContentCarousel: Beginning content preparation with schedule:', schedule);
    let items = [];
    
    // Add schedule items if available
    if (schedule?.items && schedule.items.length > 0) {
      console.log('ContentCarousel: Schedule items found:', schedule.items.length);
      console.log('ContentCarousel: First raw schedule item:', JSON.stringify(schedule.items[0], null, 2));
      
      // Map schedule items to the expected format
      const mappedItems = schedule.items.map((item, index) => {
        // Log item structure more extensively
        console.log(`ContentCarousel: Item ${index} structure:`, {
          id: item.id,
          hasContentItem: !!item.contentItem,
          topLevelProps: {
            hasType: 'type' in item,
            hasTitle: 'title' in item,
            hasContent: 'content' in item,
            hasDuration: 'duration' in item,
            hasOrder: 'order' in item
          },
          allKeys: Object.keys(item)
        });
        
        // If item doesn't have contentItem property, create it from the item's properties
        if (!item.contentItem) {
          console.log(`ContentCarousel: Item at index ${index} missing contentItem, creating from top-level properties:`, item);
          
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
        
        console.log(`ContentCarousel: Processing item ${index} with existing contentItem:`, {
          id: item.id,
          hasContentItem: true,
          contentItemType: item.contentItem.type
        });
        
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
      
      console.log('ContentCarousel: Mapped items count:', mappedItems.length);
      
      if (mappedItems.length > 0) {
        console.log('ContentCarousel: First mapped item:', JSON.stringify(mappedItems[0], null, 2));
        items.push(...mappedItems);
      } else {
        console.warn('ContentCarousel: No valid items found after mapping schedule items');
      }
    } else {
      console.warn('ContentCarousel: No schedule items found - schedule.items:', schedule?.items ? schedule.items.length : 'undefined');
    }
    
    // Add upcoming events if available
    if (events && events.length > 0) {
      console.log('Events found:', events);
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
    } else {
      console.warn('No events found');
    }
    
    // Sort by order - handle null safety with non-null assertion
    items = items.filter(Boolean); // Remove any null/undefined items first
    items.sort((a, b) => {
      // At this point we know items are not null due to filter
      return ((a as any).order || 999) - ((b as any).order || 999);
    });
    
    // Remove the mock data fallback
    if (items.length === 0) {
      console.log('No content found from API or storage');
    }
    
    console.log('Content items prepared:', items);
    
    // Update state and refs
    contentItemsRef.current = items;
    setContentItems(items);
    
    // Reset current index when content changes to prevent out-of-bounds
    if (currentItemIndex >= items.length) {
      setCurrentItemIndex(0);
    }
  }, [schedule, events, currentItemIndex]);
  
  // Rotate through content items
  useEffect(() => {
    if (contentItems.length === 0) return;
    
    const currentItem = contentItems[currentItemIndex];
    if (!currentItem?.contentItem) {
      console.error('Invalid current item:', currentItem);
      // Move to next item if current is invalid
      setCurrentItemIndex((prevIndex) => 
        prevIndex === contentItems.length - 1 ? 0 : prevIndex + 1
      );
      return;
    }
    
    const duration = currentItem?.contentItem?.duration || 30;
    
    console.log(`Displaying content: ${currentItem?.contentItem?.title} for ${duration} seconds`);
    
    // Initially show content
    setShowContent(true);
    
    // Set timeout for current content duration
    const timer = setTimeout(() => {
      // Fade out
      setShowContent(false);
      
      // After fade out, move to next item
      const fadeOutTimer = window.setTimeout(() => {
        setCurrentItemIndex((prevIndex) => 
          prevIndex === contentItems.length - 1 ? 0 : prevIndex + 1
        );
        
        // Fade in new content after a brief delay
        const fadeInTimer = window.setTimeout(() => {
          setShowContent(true);
        }, 100); // Very small delay to ensure state updates properly
        
        return () => clearTimeout(fadeInTimer);
      }, 400); // Slightly longer fade-out for smoother transitions
      
      return () => clearTimeout(fadeOutTimer);
    }, duration * 1000);
    
    // Cleanup timer on unmount or when dependencies change
    return () => clearTimeout(timer);
  }, [currentItemIndex, contentItems]);
  
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
  
  // Empty state display for ContentCarousel
  if (contentItems.length === 0) {
    return (
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.7)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(218, 165, 32, 0.2)',
          borderRadius: 4,
          p: screenSize.is720p ? 1 : 2,
          width: screenSize.is720p ? '97%' : '95%',
          height: screenSize.is720p ? '95%' : '90%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
        }}>
          <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h5), mb: 2 }}>No content available</Typography>
          
          {schedule?.id === 'fallback-schedule' && (
            <Typography sx={{ fontSize: getScaledFontSize(fontSizes.h6), color: 'warning.main', mb: 2 }}>
              Using default content. The API connection may be unavailable.
            </Typography>
          )}
          
          <Typography 
            sx={{ 
              fontSize: getScaledFontSize(fontSizes.body1), 
              mt: 2, 
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' }
            }}
            onClick={() => {
              console.log('Manual refresh requested by user');
              hasRefreshedRef.current = false; // Reset to allow refresh again
              refreshSchedule().then(() => refreshContent(true));
            }}
          >
            Click to refresh content
          </Typography>
        </Box>
      </Box>
    );
  }
  
  return (
    <Fade in={showContent} timeout={500}>
      <Box 
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.7)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(218, 165, 32, 0.2)',
          borderRadius: 4,
          p: screenSize.is720p ? 1 : 2,
          width: screenSize.is720p ? '97%' : '95%',
          height: screenSize.is720p ? '95%' : '90%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
        }}>
          <Box
            sx={{
              borderBottom: '3px solid',
              borderColor: 'primary.main',
              pb: screenSize.is720p ? 1 : 1.5,
              mb: screenSize.is720p ? 1 : 2,
              width: '100%',
              flex: '0 0 auto',
            }}
          >
            <Typography 
              sx={{ 
                fontWeight: 'bold',
                fontSize: getScaledFontSize(fontSizes.h2),
                textAlign: 'center',
                color: 'primary.main'
              }}
            >
              {contentItems[currentItemIndex]?.contentItem?.type === 'ASMA_AL_HUSNA' 
                ? 'Asma ul Husna' 
                : contentItems[currentItemIndex]?.contentItem?.title || 'Content'}
            </Typography>
          </Box>
          
          <Box sx={{ 
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto',
            width: '100%',
          }}>
            {renderContent()}
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default React.memo(ContentCarousel); 