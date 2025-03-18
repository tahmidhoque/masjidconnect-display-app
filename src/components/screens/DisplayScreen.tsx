import React, { useEffect, useState, useRef } from 'react';
import { Box, Fade } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { useOrientation } from '../../contexts/OrientationContext';
import useRotationHandling from '../../hooks/useRotationHandling';
import LandscapeLayout from '../layouts/LandscapeLayout';
import PortraitLayout from '../layouts/PortraitLayout';
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
    screenContent
  } = useContent();
  
  const { orientation, setAdminOrientation, isOrientationMatching } = useOrientation();
  
  // Update orientation from screen content when it changes
  useEffect(() => {
    if (screenContent?.screen?.orientation) {
      // Always set orientation directly when first loaded 
      setAdminOrientation(screenContent.screen.orientation);
      console.log("DisplayScreen: Setting orientation from screenContent:", screenContent.screen.orientation);
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
  
  // Calculate viewport dimensions for portrait mode
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  return (
    <Fade in={showContent} timeout={800}>
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        {currentOrientation === 'LANDSCAPE' || !shouldRotate ? (
          // Landscape layout or no rotation needed - normal display
          <Box 
            sx={{ 
              width: '100%', 
              height: '100%', 
              overflow: 'auto',
            }}
          >
            {currentOrientation === 'LANDSCAPE' ? (
              <LandscapeLayout />
            ) : (
              <PortraitLayout />
            )}
          </Box>
        ) : (
          // Portrait layout with rotation transform
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: windowHeight,
              height: windowWidth,
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <PortraitLayout />
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default DisplayScreen; 