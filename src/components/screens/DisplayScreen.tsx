import React, { useEffect, useState, useRef } from 'react';
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
  
  // Update orientation from screen content when it changes
  useEffect(() => {
    // Check for orientation in both the new data structure and legacy location
    if (screenContent?.data && 'screen' in screenContent.data && 
        screenContent.data.screen && 'orientation' in screenContent.data.screen) {
      // Use orientation from the new data structure
      setAdminOrientation(screenContent.data.screen.orientation);
      console.log("DisplayScreen: Setting orientation from screenContent data:", screenContent.data.screen.orientation);
    } else if (screenContent?.screen?.orientation) {
      // Fallback to legacy location
      setAdminOrientation(screenContent.screen.orientation);
      console.log("DisplayScreen: Setting orientation from legacy screenContent:", screenContent.screen.orientation);
    }
  }, [screenContent, setAdminOrientation]);
  
  const [showContent, setShowContent] = useState(true);
  const [currentOrientation, setCurrentOrientation] = useState(orientation);
  const prevOrientationRef = useRef(orientation);

  // Use our rotation handling hook to determine if we need to rotate
  const { shouldRotate, physicalOrientation } = useRotationHandling(currentOrientation);

  // Handle orientation changes with animation
  useEffect(() => {
    console.log("DisplayScreen: Orientation context changed to:", orientation);
    
    // If orientation has changed
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

  // If content is still loading, show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  console.log("DisplayScreen: Rendering with orientation:", currentOrientation, "shouldRotate:", shouldRotate);

  return (
    <Box 
      sx={{ 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: 'background.default',
      }}
    >
      <Fade in={showContent} timeout={800}>
        {currentOrientation === 'LANDSCAPE' || !shouldRotate ? (
          // Landscape orientation or no rotation needed
          <Box sx={{ width: '100%', height: '100%' }}>
            {currentOrientation === 'LANDSCAPE' ? <LandscapeDisplay /> : <PortraitDisplay />}
          </Box>
        ) : (
          // Portrait orientation with rotation transform
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: window.innerHeight,
              height: window.innerWidth,
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center',
            }}
          >
            <PortraitDisplay />
          </Box>
        )}
      </Fade>
    </Box>
  );
};

export default DisplayScreen; 