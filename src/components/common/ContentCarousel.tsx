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
import { isLowPowerDevice, debounce } from '../../utils/performanceUtils';

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
 * Optimized for Raspberry Pi performance.
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
  const isLowPower = isLowPowerDevice();
  
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
  
  // Constants - adjusted for performance
  const defaultDuration = isLowPower ? 45 : 30; // Longer duration on low-power devices
  const userInteractionTimeout = isLowPower ? 90000 : 60000; // 1.5 minutes on low-power devices
  const FADE_TRANSITION_DURATION = isLowPower ? 200 : 500; // Faster transitions on low-power devices
  
  // Preload next content item to avoid flashing
  const [nextItemIndex, setNextItemIndex] = useState<number | null>(null);
  
  // Debounced refresh function for better performance
  const debouncedRefresh = useMemo(
    () => debounce(() => {
      if (isComponentMountedRef.current) {
        refreshSchedule(true);
      }
    }, 1000),
    [refreshSchedule]
  );
  
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
      
      // Filter out items without content
      const validItems = schedule.items.filter(item => 
        item.contentItem && 
        item.contentItem.title && 
        item.contentItem.content
      );
      
      if (validItems.length > 0) {
        processedItems = validItems.map(item => ({
          id: item.id,
          title: item.contentItem.title,
          content: item.contentItem.content,
          type: item.contentItem.type || 'CUSTOM',
          duration: item.contentItem.duration || defaultDuration,
          reference: item.contentItem.reference || '',
          order: item.order || 0
        }));
      }
    }
    
    // Add events if available
    if (events && events.length > 0) {
      logger.debug('ContentCarousel: Processing events', { count: events.length });
      
      const eventItems = events
        .filter(event => event.title && event.description)
        .map(event => ({
          id: `event-${event.id}`,
          title: event.title,
          content: { description: event.description },
          type: 'EVENT' as ContentItemType,
          duration: defaultDuration,
          reference: '',
          order: processedItems.length + 1
        }));
      
      processedItems = [...processedItems, ...eventItems];
    }
    
    // Sort by order if available
    processedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Update content items
    if (processedItems.length > 0) {
      setContentItems(processedItems);
      contentItemsRef.current = processedItems;
      setContentLoading(false);
      
      // Reset to first item if we have new content
      if (currentItemIndex >= processedItems.length) {
        setCurrentItemIndex(0);
      }
      
      logger.info('ContentCarousel: Content items processed', { 
        count: processedItems.length,
        types: processedItems.map(item => item.type)
      });
    } else {
      // Create fallback content
      const fallbackItems = [
        {
          id: 'fallback-1',
          title: 'Welcome to Masjid Connect',
          content: { description: 'Digital display system for mosques' },
          type: 'CUSTOM' as ContentItemType,
          duration: defaultDuration,
          reference: '',
          order: 0
        }
      ];
      
      setContentItems(fallbackItems);
      contentItemsRef.current = fallbackItems;
      setContentLoading(false);
      setCurrentItemIndex(0);
      
      logger.warn('ContentCarousel: No content available, using fallback');
    }
  }, [schedule, events, defaultDuration, currentItemIndex]);
  
  // Handle prayer announcements
  useEffect(() => {
    if (showPrayerAnnouncement !== lastAnnouncementState.current) {
      lastAnnouncementState.current = showPrayerAnnouncement;
      
      if (showPrayerAnnouncement) {
        logger.info('ContentCarousel: Prayer announcement started', {
          prayerName: prayerAnnouncementName,
          isJamaat: isPrayerJamaat
        });
        
        // Pause auto-rotation during prayer announcements
        setAutoRotate(false);
        
        // Clear any existing timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else {
        logger.info('ContentCarousel: Prayer announcement ended, resuming rotation');
        
        // Resume auto-rotation after prayer announcement
        setTimeout(() => {
          if (isComponentMountedRef.current) {
            setAutoRotate(true);
          }
        }, 2000);
      }
    }
  }, [showPrayerAnnouncement, prayerAnnouncementName, isPrayerJamaat]);
  
  // Auto-rotation logic with performance optimizations
  useEffect(() => {
    if (!autoRotate || contentItems.length === 0 || showPrayerAnnouncement) {
      return;
    }
    
    const currentItem = contentItems[currentItemIndex];
    const displayTime = currentItem ? (currentItem.duration * 1000) : (defaultDuration * 1000);
    
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Set new timer with performance considerations
    timerRef.current = setTimeout(() => {
      if (isComponentMountedRef.current && autoRotate && !showPrayerAnnouncement) {
        setIsChangingItem(true);
        
        // Use requestAnimationFrame for smoother transitions
        requestAnimationFrame(() => {
          const nextIndex = (currentItemIndex + 1) % contentItems.length;
          setCurrentItemIndex(nextIndex);
          setNextItemIndex(null);
          
          // Shorter transition delay for low-power devices
          setTimeout(() => {
            setIsChangingItem(false);
          }, FADE_TRANSITION_DURATION);
        });
      }
    }, displayTime);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentItemIndex, contentItems, autoRotate, showPrayerAnnouncement, defaultDuration, FADE_TRANSITION_DURATION]);
  
  // Handle orientation changes
  useEffect(() => {
    if (orientation !== lastOrientationRef.current) {
      lastOrientationRef.current = orientation;
      logger.info('ContentCarousel: Orientation changed, refreshing content');
      debouncedRefresh();
    }
  }, [orientation, debouncedRefresh]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  // Performance-optimized font size calculations
  const getScaledFontSize = useCallback((baseSize: string) => {
    if (isLowPower) {
      // Reduce font sizes on low-power devices
      const size = parseInt(baseSize);
      return `${Math.max(size * 0.8, 12)}px`;
    }
    return baseSize;
  }, [isLowPower]);
  
  const getDynamicFontSize = useCallback((text: string, type: string) => {
         if (!text) return getScaledFontSize(fontSizes.body1);
     
     const baseSize = type === 'title' ? fontSizes.h4 : fontSizes.body1;
    const textLength = text.length;
    
    if (isLowPower) {
      // Simplified font sizing for low-power devices
      if (textLength > 100) return getScaledFontSize('14px');
      if (textLength > 50) return getScaledFontSize('16px');
      return getScaledFontSize(baseSize);
    }
    
    // Original dynamic sizing for more powerful devices
    if (textLength > 200) return getScaledFontSize('12px');
    if (textLength > 100) return getScaledFontSize('14px');
    if (textLength > 50) return getScaledFontSize('16px');
    return getScaledFontSize(baseSize);
  }, [fontSizes, getScaledFontSize, isLowPower]);
  
  // Memoized current content item
  const currentItem = useMemo(() => {
    if (contentItems.length === 0) return null;
    return contentItems[currentItemIndex];
  }, [contentItems, currentItemIndex]);
  
  // Memoized prayer announcement config
  const announcementConfig = useMemo((): AnnouncementConfig | null => {
    if (!showPrayerAnnouncement || !prayerAnnouncementName) return null;
    
    const isJamaat = isPrayerJamaat;
    const prayerName = prayerAnnouncementName;
    
    return {
      prayerName,
      title: isJamaat ? `${prayerName} Jamaat` : `${prayerName} Adhan`,
      subtitle: isJamaat ? 'Jamaat Time' : 'Adhan Time',
      description: isJamaat 
        ? `It's time for ${prayerName} Jamaat. Please join the congregation.`
        : `The ${prayerName} Adhan has been called.`,
      color: isJamaat ? '#10B981' : '#F59E0B',
      variant: isJamaat ? 'jamaat' : 'adhan'
    };
  }, [showPrayerAnnouncement, prayerAnnouncementName, isPrayerJamaat]);
  
  // Loading state
  if (contentLoading || isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100%',
        width: '100%'
      }}>
        <CircularProgress size={isLowPower ? 40 : 60} />
      </Box>
    );
  }
  
  // No content state
  if (contentItems.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100%',
        width: '100%',
        textAlign: 'center',
        p: 2
      }}>
        <NoMobilePhoneIcon sx={{ fontSize: 60, mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          No Content Available
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Content will appear here when available
        </Typography>
      </Box>
    );
  }
  
  // Prayer announcement display
  if (announcementConfig) {
    return (
      <Box sx={{ 
        height: '100%', 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        p: 3,
        textAlign: 'center'
      }}>
        <Fade in={true} timeout={FADE_TRANSITION_DURATION}>
          <Paper
            elevation={isLowPower ? 2 : 8}
            sx={{
              p: 4,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${announcementConfig.color}22, ${announcementConfig.color}44)`,
              border: `2px solid ${announcementConfig.color}`,
              maxWidth: '90%',
              width: '100%'
            }}
          >
            <Typography 
              variant="h3" 
              sx={{ 
                color: announcementConfig.color,
                fontWeight: 'bold',
                mb: 2,
                fontSize: getScaledFontSize(fontSizes.h3)
              }}
            >
              {announcementConfig.title}
            </Typography>
            
            <Typography 
              variant="h5" 
              sx={{ 
                color: 'text.secondary',
                mb: 3,
                fontSize: getScaledFontSize(fontSizes.h5)
              }}
            >
              {announcementConfig.subtitle}
            </Typography>
            
            <Typography 
              variant="body1" 
              sx={{ 
                                 fontSize: getScaledFontSize(fontSizes.body1),
                lineHeight: 1.6
              }}
            >
              {announcementConfig.description}
            </Typography>
          </Paper>
        </Fade>
      </Box>
    );
  }
  
  // Regular content display
  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <Fade 
        in={!isChangingItem} 
        timeout={FADE_TRANSITION_DURATION}
        onExited={() => setIsChangingItem(false)}
      >
        <Box sx={{ height: '100%', width: '100%' }}>
          {currentItem && (
            <GlassmorphicContentCardWrapper>
              <Box sx={{ p: 3, height: '100%' }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    mb: 2,
                    fontWeight: 'bold',
                    fontSize: getDynamicFontSize(currentItem.title, 'title'),
                    color: getContentTypeConfig(currentItem.type).titleColor
                  }}
                >
                  {currentItem.title}
                </Typography>
                
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <MemoizedFormattedText text={currentItem.content.description || currentItem.content} />
                </Box>
                
                {currentItem.reference && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      mt: 2,
                      opacity: 0.7,
                      fontSize: getScaledFontSize('12px')
                    }}
                  >
                    Reference: {currentItem.reference}
                  </Typography>
                )}
              </Box>
            </GlassmorphicContentCardWrapper>
          )}
        </Box>
      </Fade>
    </Box>
  );
};

export default memo(ContentCarousel); 