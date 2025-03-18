import React, { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Fade } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';

interface ContentItem {
  id: string;
  title: string;
  content: string | any;
  duration: number;
  type: string;
}

interface ScheduleItem {
  id: string;
  contentItem: ContentItem;
}

interface ContentCarouselProps {
  overrideContent?: React.ReactNode;
  isOverrideActive?: boolean;
}

/**
 * ContentCarousel component
 * 
 * Displays scheduled content in a carousel with automatic transitions
 * based on the duration set for each content item.
 */
const ContentCarousel: React.FC<ContentCarouselProps> = ({ 
  overrideContent,
  isOverrideActive = false
}) => {
  const { schedule } = useContent();
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [fadeIn, setFadeIn] = useState<boolean>(true);
  const [items, setItems] = useState<ScheduleItem[]>([]);

  // Set up items from schedule
  useEffect(() => {
    if (schedule && schedule.items && schedule.items.length > 0) {
      setItems(schedule.items);
    }
  }, [schedule]);

  // Function to go to next slide with fade animation
  const goToNextSlide = useCallback(() => {
    if (items.length <= 1) return;
    
    // Start fade out animation
    setFadeIn(false);
    
    // After fade out, change the content and fade in
    setTimeout(() => {
      setCurrentItemIndex((prevIndex) => (prevIndex + 1) % items.length);
      setFadeIn(true);
    }, 500); // Half a second for fade out
  }, [items.length]);

  // Set up automatic rotation based on content duration
  useEffect(() => {
    if (isOverrideActive || items.length === 0) return;
    
    const currentItem = items[currentItemIndex];
    const duration = currentItem?.contentItem?.duration || 10; // Default 10 seconds
    
    console.log(`Setting up content rotation: ${currentItem?.contentItem?.title} for ${duration} seconds`);
    
    // Set timer for auto-rotation
    const timer = setTimeout(() => {
      goToNextSlide();
    }, duration * 1000);
    
    // Clear timer on cleanup
    return () => clearTimeout(timer);
  }, [currentItemIndex, items, goToNextSlide, isOverrideActive]);

  // Render placeholder if no content
  if (!items.length) {
    return (
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}
      >
        <Typography variant="h5" align="center">
          No content scheduled
        </Typography>
        <Typography variant="body1" align="center" sx={{ mt: 2 }}>
          Add content through the MasjidConnect management portal
        </Typography>
      </Paper>
    );
  }

  // If override is active, show override content
  if (isOverrideActive && overrideContent) {
    return (
      <Box sx={{ height: '100%', width: '100%' }}>
        {overrideContent}
      </Box>
    );
  }

  // Get current content
  const currentItem = items[currentItemIndex]?.contentItem;

  // Determine content to render based on content type
  const renderContent = () => {
    if (!currentItem) return null;

    switch (currentItem.type) {
      case 'ANNOUNCEMENT':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom color="primary.main">
              {currentItem.title}
            </Typography>
            <Typography variant="body1">
              {typeof currentItem.content === 'string' 
                ? currentItem.content 
                : JSON.stringify(currentItem.content)}
            </Typography>
          </Box>
        );
      case 'HADITH':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom color="primary.main">
              Hadith of the Day
            </Typography>
            <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 2 }}>
              {typeof currentItem.content === 'string' 
                ? currentItem.content 
                : currentItem.content?.text || ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {currentItem.content?.source || currentItem.title}
            </Typography>
          </Box>
        );
      case 'QURAN_VERSE':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom color="primary.main">
              Verse of the Day
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                fontWeight: 500, 
                mb: 2,
                direction: 'rtl', 
                textAlign: 'right',
                fontSize: '1.5rem',
                fontFamily: '"Amiri", "Scheherazade New", serif',
                lineHeight: 1.8
              }}
            >
              {currentItem.content?.arabic || ''}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {currentItem.content?.translation || ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {currentItem.content?.reference || currentItem.title}
            </Typography>
          </Box>
        );
      case 'IMAGE':
        return (
          <Box sx={{ 
            p: 2, 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {currentItem.title && (
              <Typography variant="h5" gutterBottom>
                {currentItem.title}
              </Typography>
            )}
            <Box 
              component="img" 
              src={typeof currentItem.content === 'string' ? currentItem.content : currentItem.content?.url} 
              alt={currentItem.title || 'Image content'}
              sx={{ 
                maxWidth: '100%', 
                maxHeight: 'calc(100% - 60px)',
                objectFit: 'contain'
              }}
            />
          </Box>
        );
      default:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5">
              {currentItem.title}
            </Typography>
            <Typography variant="body1">
              {typeof currentItem.content === 'string' 
                ? currentItem.content 
                : JSON.stringify(currentItem.content)}
            </Typography>
          </Box>
        );
    }
  };

  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%', 
      overflow: 'hidden',
      position: 'relative'
    }}>
      <Fade in={fadeIn} timeout={500}>
        <Paper
          elevation={2}
          sx={{ 
            height: '100%', 
            width: '100%', 
            overflow: 'auto',
            borderRadius: 2,
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '0.4em',
            },
            '&::-webkit-scrollbar-track': {
              boxShadow: 'inset 0 0 6px rgba(0,0,0,0.1)',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            },
          }}
        >
          {renderContent()}
        </Paper>
      </Fade>
      
      {/* Pagination indicators */}
      {items.length > 1 && (
        <Box 
          sx={{ 
            position: 'absolute', 
            bottom: 8, 
            left: 0, 
            right: 0, 
            display: 'flex', 
            justifyContent: 'center',
            gap: 1,
            zIndex: 10
          }}
        >
          {items.map((_, index) => (
            <Box 
              key={index}
              sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                bgcolor: index === currentItemIndex ? 'primary.main' : 'rgba(0,0,0,0.2)',
                transition: 'background-color 0.3s ease'
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ContentCarousel; 