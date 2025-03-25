import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Box } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { useOrientation } from '../../contexts/OrientationContext';
import useRotationHandling from '../../hooks/useRotationHandling';
import LandscapeDisplay from '../layouts/LandscapeDisplay';
import PortraitDisplay from '../layouts/PortraitDisplay';
import LoadingScreen from './LoadingScreen';
import logger from '../../utils/logger';

// CSS classes for orientation transitions
const TRANSITION_STYLES = {
  container: {
    width: '100vw', 
    height: '100vh',
    overflow: 'hidden',
    transition: 'opacity 0.5s ease-in-out, transform 0.8s ease-in-out',
    position: 'relative'
  },
  content: {
    width: '100%',
    height: '100%',
    transition: 'opacity 0.5s ease-in-out, transform 0.8s ease-in-out',
  },
  rotated: {
    width: '100vh',
    height: '100vw',
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transformOrigin: 'center',
    transition: 'transform 0.8s ease-in-out, opacity 0.5s ease-in-out'
  }
};

/**
 * DisplayScreen component
 * 
 * The main display screen shown after successful authentication.
 * Shows prayer times, current content, and other information.
 * Adapts to the screen orientation (portrait/landscape) based on admin settings.
 */
const DisplayScreen: React.FC = () => {
  const { 
    isLoading, 
    masjidName,
    screenContent
  } = useContent();
  
  const { orientation, setAdminOrientation } = useOrientation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousOrientationRef = useRef(orientation);
  
  // Add effect to track orientation changes
  useEffect(() => {
    // Only trigger animation if orientation actually changed
    if (previousOrientationRef.current !== orientation) {
      console.log(`🔄 DisplayScreen: Orientation changed from ${previousOrientationRef.current} to ${orientation}`);
      
      // Start transition
      setIsTransitioning(true);
      
      // After transition completes, clear the transitioning flag
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        previousOrientationRef.current = orientation;
        
        // Force redraw to ensure layout is correct
        window.dispatchEvent(new Event('resize'));
      }, 800); // Match the transition duration
      
      return () => clearTimeout(timer);
    }
  }, [orientation]);
  
  // Update orientation from screen content when it changes
  useEffect(() => {
    if (!screenContent) return;
    
    // Check for orientation in both the new data structure and legacy location
    let newOrientation;
    
    if (screenContent?.data?.screen?.orientation) {
      newOrientation = screenContent.data.screen.orientation;
    } else if (screenContent?.screen?.orientation) {
      newOrientation = screenContent.screen.orientation;
    }
    
    // Only update if we found a valid orientation and it's different from current
    if (newOrientation && newOrientation !== orientation) {
      // Check if this update is from initial load vs SSE event
      const lastSseEvent = localStorage.getItem('last_orientation_sse_event');
      if (lastSseEvent) {
        const lastEventTime = parseInt(lastSseEvent, 10);
        const now = Date.now();
        
        // If we've received an SSE event in the last 10 seconds, don't override it with content data
        if (now - lastEventTime < 10000) {
          console.log(`⚠️ DisplayScreen: Skipping content orientation update (${newOrientation}) because recent SSE event occurred ${(now - lastEventTime)/1000}s ago`);
          return;
        }
      }
      
      console.log(`📄 DisplayScreen: Updating orientation from content API: ${newOrientation}`);
      setAdminOrientation(newOrientation);
    }
  }, [screenContent, setAdminOrientation, orientation]);
  
  // Use rotation handling hook to determine if we need to rotate
  const rotationInfo = useRotationHandling(orientation);
  const shouldRotate = rotationInfo.shouldRotate;

  // Memoize the display component based on orientation
  const DisplayComponent = useMemo(() => {
    logger.info(`DisplayScreen: Rendering ${orientation} layout`);
    return orientation === 'LANDSCAPE' ? 
      <LandscapeDisplay /> : 
      <PortraitDisplay />;
  }, [orientation]);

  // If content is still loading, show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Box 
      sx={{ 
        ...TRANSITION_STYLES.container,
        opacity: isTransitioning ? 0.6 : 1,
        transform: isTransitioning ? 'scale(0.98)' : 'scale(1)',
      }}
    >
      {shouldRotate ? (
        // Apply rotation transform for mismatched orientation
        <Box
          sx={{
            ...TRANSITION_STYLES.rotated,
            transform: `translate(-50%, -50%) rotate(90deg) ${isTransitioning ? 'scale(0.95)' : 'scale(1)'}`,
            opacity: isTransitioning ? 0.6 : 1,
          }}
        >
          <Box sx={{
            ...TRANSITION_STYLES.content,
            opacity: isTransitioning ? 0.8 : 1,
            transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)',
          }}>
            {DisplayComponent}
          </Box>
        </Box>
      ) : (
        // No rotation needed
        <Box sx={{
          ...TRANSITION_STYLES.content,
          opacity: isTransitioning ? 0.8 : 1,
          transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)',
        }}>
          {DisplayComponent}
        </Box>
      )}
    </Box>
  );
};

export default React.memo(DisplayScreen); 