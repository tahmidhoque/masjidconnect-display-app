import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Box, Fade } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { useOrientation } from '../../contexts/OrientationContext';
import useRotationHandling from '../../hooks/useRotationHandling';
import LandscapeDisplay from '../layouts/LandscapeDisplay';
import PortraitDisplay from '../layouts/PortraitDisplay';
import LoadingScreen from './LoadingScreen';

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
  
  // Update orientation from screen content when it changes - optimized to reduce unnecessary updates
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
      setAdminOrientation(newOrientation);
    }
  }, [screenContent, setAdminOrientation, orientation]);
  
  const [showContent, setShowContent] = useState(true);
  const [currentOrientation, setCurrentOrientation] = useState(orientation);
  const prevOrientationRef = useRef(orientation);

  // Use our rotation handling hook to determine if we need to rotate
  const rotationInfo = useRotationHandling(currentOrientation);
  const shouldRotate = rotationInfo.shouldRotate;

  // Handle orientation changes with animation - optimized with improved timing
  useEffect(() => {
    // Only update if orientation has changed to prevent unnecessary renders
    if (prevOrientationRef.current !== orientation) {
      // Fade out
      setShowContent(false);
      
      // Wait for fade out to complete, then update orientation and fade in
      const timer = setTimeout(() => {
        setCurrentOrientation(orientation);
        prevOrientationRef.current = orientation;
        
        // Small delay before fading back in
        setTimeout(() => {
          setShowContent(true);
        }, 300);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [orientation]);

  // Memoize the display component based on orientation to prevent unnecessary re-renders
  // Important: This must be called unconditionally before any early returns
  const DisplayComponent = useMemo(() => {
    return currentOrientation === 'LANDSCAPE' ? 
      <LandscapeDisplay /> : 
      <PortraitDisplay />;
  }, [currentOrientation]);

  // If content is still loading, show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Fade in={showContent} timeout={800}>
      <Box 
        sx={{ 
          width: '100vw', 
          height: '100vh',
          overflow: 'hidden'
        }}
      >
        {shouldRotate ? (
          // Apply rotation transform for mismatched orientation
          <Box
            sx={{
              width: window.innerHeight,
              height: window.innerWidth,
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center',
            }}
          >
            {DisplayComponent}
          </Box>
        ) : (
          // No rotation needed
          DisplayComponent
        )}
      </Box>
    </Fade>
  );
};

export default React.memo(DisplayScreen); 