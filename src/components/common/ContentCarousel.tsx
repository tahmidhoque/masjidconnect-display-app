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

// Mock data for testing
const mockData = [
  {
    id: 'mock-1',
    contentItem: {
      id: 'mock-item-1',
      title: 'Upcoming Event: Community Iftar',
      content: 'Join us for our community iftar this Saturday after Maghrib prayer.',
      type: 'EVENT' as ContentItemType,
      duration: 15
    },
    order: 1,
    startDate: new Date().toISOString(),
    location: 'Main Hall'
  },
  {
    id: 'mock-2',
    contentItem: {
      id: 'mock-item-2',
      title: 'Verse of the Day',
      content: 'Indeed, Allah is with the patient.',
      type: 'VERSE_HADITH' as ContentItemType,
      duration: 15,
      reference: 'Quran 2:153'
    },
    order: 2
  },
  {
    id: 'mock-3',
    contentItem: {
      id: 'mock-item-3',
      title: 'Announcement',
      content: 'The masjid will be open for Tahajjud prayers every Friday night starting at 3:00 AM.',
      type: 'ANNOUNCEMENT' as ContentItemType,
      duration: 15
    },
    order: 3
  }
];

/**
 * ContentCarousel component
 * 
 * Displays content items in a carousel/slideshow format.
 * Automatically rotates through items based on their specified duration.
 */
const ContentCarousel: React.FC = () => {
  const { schedule, events, refreshContent } = useContent();
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
      console.log('ContentCarousel: Refreshing content...');
      refreshContent()
        .then(() => {
          console.log('ContentCarousel: Content refreshed successfully');
          hasRefreshedRef.current = true;
        })
        .catch(err => console.error('Error refreshing content:', err));
    }
  }, [refreshContent]);
  
  // Refresh content when component mounts
  useEffect(() => {
    refreshContentOnce();
  }, [refreshContentOnce]);
  
  // Debug output for schedule and events
  useEffect(() => {
    console.log('ContentCarousel: Current schedule:', schedule);
    console.log('ContentCarousel: Current events:', events);
  }, [schedule, events]);
  
  // Prepare content items for carousel
  useEffect(() => {
    let items = [];
    
    // Add schedule items if available
    if (schedule?.items && schedule.items.length > 0) {
      console.log('Schedule items found:', schedule.items);
      
      // Map schedule items to the expected format
      items.push(...schedule.items.map(item => {
        // Ensure content item has the required properties
        if (!item.contentItem) {
          console.error('Schedule item missing contentItem property:', item);
          return null;
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
      }).filter(Boolean)); // Filter out null items
    } else {
      console.warn('No schedule items found');
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
    
    // If no content from API, use mock data
    if (items.length === 0) {
      console.log('No content found from API, using mock data');
      items = [...mockData];
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
    
    let fadeOutTimer: number;
    let nextItemTimer: number;
    let fadeInTimer: number;
    
    // Set timeout for current content duration
    const timer = setTimeout(() => {
      // Fade out
      setShowContent(false);
      
      // After fade out, move to next item
      fadeOutTimer = window.setTimeout(() => {
        setCurrentItemIndex((prevIndex) => 
          prevIndex === contentItems.length - 1 ? 0 : prevIndex + 1
        );
        
        // Fade in new content
        nextItemTimer = window.setTimeout(() => {
          setShowContent(true);
          
          fadeInTimer = 0;
        }, 300);
        
        nextItemTimer = 0;
      }, 500);
      
      fadeOutTimer = 0;
    }, duration * 1000);
    
    // Cleanup all timers on unmount or when dependencies change
    return () => {
      clearTimeout(timer);
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      if (nextItemTimer) clearTimeout(nextItemTimer);
      if (fadeInTimer) clearTimeout(fadeInTimer);
    };
  }, [currentItemIndex, contentItems]);
  
  // Memoize the dot indicators - moved outside of the conditional return
  const renderDotIndicators = useCallback(() => {
    return contentItems.map((_, index) => (
      <Box
        key={index}
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: index === currentItemIndex ? 'primary.main' : 'grey.300'
        }}
      />
    ));
  }, [contentItems, currentItemIndex]);
  
  // Render different content based on content type
  const renderContent = () => {
    const currentItem = contentItems[currentItemIndex];
    if (!currentItem || !currentItem.contentItem) {
      console.error('Invalid content item:', currentItem);
      return (
        <Typography sx={{ fontSize: fontSizes.h4, textAlign: 'center' }}>
          Content unavailable
        </Typography>
      );
    }
    
    const content = currentItem.contentItem;
    const contentType = content.type;
    
    try {
      // For EVENT type
      if (contentType === 'EVENT') {
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography 
              sx={{ 
                fontSize: fontSizes.h4,
                mb: 1,
                textAlign: 'center',
                fontWeight: 'medium'
              }}
            >
              {typeof content.content === 'string' 
                ? content.content 
                : content.content?.text || JSON.stringify(content.content)}
            </Typography>
            
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                mt: 2,
                bgcolor: 'background.paper',
                p: 2,
                borderRadius: 2
              }}
            >
              <Box>
                <Typography 
                  sx={{ 
                    fontSize: fontSizes.h6,
                    fontWeight: 'bold',
                    color: 'text.secondary'
                  }}
                >
                  Date
                </Typography>
                <Typography sx={{ fontSize: fontSizes.h5 }}>
                  {currentItem.startDate && new Date(currentItem.startDate).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Typography>
              </Box>
              <Box>
                <Typography 
                  sx={{ 
                    fontSize: fontSizes.h6,
                    fontWeight: 'bold',
                    color: 'text.secondary'
                  }}
                >
                  {currentItem.location ? 'Location' : 'Time'}
                </Typography>
                <Typography sx={{ fontSize: fontSizes.h5 }}>
                  {currentItem.location || (
                    currentItem.startDate && new Date(currentItem.startDate).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  )}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      }
      
      // For ASMA_AL_HUSNA type
      if (contentType === 'ASMA_AL_HUSNA') {
        return (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography 
              sx={{ 
                fontSize: fontSizes.h2,
                mb: 2,
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            >
              {content.content?.arabic || ''}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: fontSizes.h3,
                mb: 3,
                textAlign: 'center',
                fontWeight: 'medium'
              }}
            >
              {content.content?.transliteration || ''}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: fontSizes.h4,
                textAlign: 'center'
              }}
            >
              {content.content?.meaning || ''}
            </Typography>
          </Box>
        );
      }
      
      // For VERSE_HADITH type
      if (contentType === 'VERSE_HADITH') {
        return (
          <Box sx={{ textAlign: 'center', mt: 3, mb: 3 }}>
            <Typography 
              sx={{ 
                fontSize: fontSizes.h3,
                fontStyle: 'italic',
                lineHeight: 1.5,
                mb: 4,
                py: 3,
                px: 5,
                borderLeft: '3px solid',
                borderRight: '3px solid',
                borderColor: 'primary.light',
                borderRadius: 1
              }}
            >
              {typeof content.content === 'string' 
                ? content.content 
                : content.content?.text || JSON.stringify(content.content)}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: fontSizes.h5,
                color: 'text.secondary',
                mt: 2
              }}
            >
              {content.content?.reference || content.reference || ''}
            </Typography>
          </Box>
        );
      }
      
      // For ANNOUNCEMENT type
      if (contentType === 'ANNOUNCEMENT') {
        return (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography 
              sx={{ 
                fontSize: fontSizes.h4,
                lineHeight: 1.6,
                textAlign: 'center'
              }}
            >
              {typeof content.content === 'string' 
                ? content.content 
                : content.content?.text || JSON.stringify(content.content)}
            </Typography>
          </Box>
        );
      }
      
      // Default for any other content type
      return (
        <Typography 
          sx={{ 
            fontSize: fontSizes.h4,
            lineHeight: 1.6,
            textAlign: 'center'
          }}
        >
          {typeof content.content === 'string' 
            ? content.content 
            : content.content?.text || JSON.stringify(content.content)}
        </Typography>
      );
    } catch (error) {
      console.error('Error rendering content:', error);
      return (
        <Typography sx={{ fontSize: fontSizes.h4, textAlign: 'center', color: 'error.main' }}>
          Error displaying content
        </Typography>
      );
    }
  };
  
  if (contentItems.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: fontSizes.h5 }}>Loading content...</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Background pattern */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <IslamicPatternBackground variant="subtle" opacity={0.15} />
      </Box>
      
      {/* Content Card */}
      <Fade in={showContent} timeout={800}>
        <Box
          sx={{ 
            width: '95%',
            maxWidth: screenSize.isLargeScreen ? '1100px' : '900px', 
            maxHeight: '80vh',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 4,
            p: screenSize.isLargeScreen ? 5 : 4,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(218, 165, 32, 0.2)',
            position: 'relative',
            zIndex: 1,
            mx: 'auto',
          }}
        >
          <Box 
            sx={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              width: '100%'
            }}
          >
            {/* Content Header */}
            <Box
              sx={{
                borderBottom: '3px solid',
                borderColor: 'primary.main',
                pb: 2,
                mb: 1
              }}
            >
              <Typography 
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: fontSizes.h2,
                  textAlign: 'center',
                  color: 'primary.main'
                }}
              >
                {contentItems[currentItemIndex]?.contentItem?.title || 'Content'}
              </Typography>
            </Box>
            
            {/* Content based on type */}
            {renderContent()}
          </Box>
          
          {/* Progress indicator */}
          <Box 
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1,
              mt: 'auto',
              pt: 3
            }}
          >
            {renderDotIndicators()}
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};

// Wrap in React.memo to prevent unnecessary renders
export default React.memo(ContentCarousel); 