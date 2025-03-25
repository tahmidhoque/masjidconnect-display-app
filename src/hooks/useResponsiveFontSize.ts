import { useEffect, useState } from 'react';

/**
 * Interface for screen size properties
 */
interface ScreenSize {
  width: number;
  height: number;
  isLargeScreen: boolean;
  is720p: boolean;
  is1080p: boolean;
  isSmallerThan720p: boolean;
  aspectRatio: number;
  isLandscape: boolean;
}

/**
 * useResponsiveFontSize
 * 
 * A custom hook that provides responsive sizing based on screen dimensions.
 * Optimized for 16:9 displays with special handling for 720p screens.
 */
const useResponsiveFontSize = () => {
  // Reference design dimensions (based on 1280x720)
  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;
  
  // Calculate initial state for responsive values
  const getInitialState = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    const isLandscape = width > height;
    
    // Calculate scale based on width for consistent sizing
    const scale = width / BASE_WIDTH;
    
    return {
      viewportScale: Math.max(scale, 0.6), // Never scale below 60%
      screenSize: {
        width,
        height,
        isLargeScreen: width >= 1920 || height >= 1080,
        is720p: width <= 1280 || height <= 720,
        is1080p: (width > 1280 && width <= 1920) || (height > 720 && height <= 1080),
        isSmallerThan720p: width < 960 || height < 540,
        aspectRatio,
        isLandscape
      }
    };
  };
  
  const [viewportScale, setViewportScale] = useState(() => getInitialState().viewportScale);
  const [screenSize, setScreenSize] = useState<ScreenSize>(() => getInitialState().screenSize);

  // Update on window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = width / height;
      const isLandscape = width > height;
      
      // Calculate scale based on width for consistent sizing
      const scale = width / BASE_WIDTH;
      
      setViewportScale(Math.max(scale, 0.6)); // Never scale below 60%
      setScreenSize({
        width,
        height,
        isLargeScreen: width >= 1920 || height >= 1080,
        is720p: width <= 1280 || height <= 720,
        is1080p: (width > 1280 && width <= 1920) || (height > 720 && height <= 1080),
        isSmallerThan720p: width < 960 || height < 540,
        aspectRatio,
        isLandscape
      });
    };

    // Calculate initially
    handleResize();

    // Recalculate on resize
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper functions for responsive sizing
  const getSizeRem = (size: number) => `${size * viewportScale}rem`;
  const getSizePx = (size: number) => `${size * viewportScale}px`;
  const getSize = (size: number) => size * viewportScale;
  
  // Define consistent font and element sizes
  const fontSizes = {
    // Heading sizes
    huge: getSizeRem(3.0),
    h1: getSizeRem(2.4),
    h2: getSizeRem(2.0),
    h3: getSizeRem(1.7),
    h4: getSizeRem(1.5),
    h5: getSizeRem(1.3),
    h6: getSizeRem(1.1),
    
    // Body text sizes
    body1: getSizeRem(1.0),
    body2: getSizeRem(0.9),
    caption: getSizeRem(0.8),
    
    // Prayer times specific sizes
    prayerName: getSizeRem(1.0),
    prayerTime: getSizeRem(1.1),
    prayerJamaat: getSizeRem(1.0),
    
    // Countdown sizes - significantly reduced
    countdownDigit: getSizeRem(2.2),
    countdownLabel: getSizeRem(0.65),
    
    // UI elements and headers
    nextPrayerTitle: getSizeRem(1.2),
    headerText: getSizeRem(1.1),
  };
  
  // Layout measurements
  const layout = {
    prayerRowHeight: getSizePx(38),
    countdownHeight: getSizePx(90),
    prayerTimesPadding: getSizePx(12),
    standardGap: getSizePx(6),
    standardPadding: getSizePx(10),
    headerSpacing: getSizePx(8),
    sidebarWidth: '320px', // Fixed width for the sidebar
  };

  return { 
    fontSizes,
    layout,
    screenSize, 
    viewportScale,
    getSizeRem,
    getSizePx,
    getSize
  };
};

export default useResponsiveFontSize; 