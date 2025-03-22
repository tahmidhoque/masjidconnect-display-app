import { useEffect, useState } from 'react';

/**
 * Interface for screen size properties
 */
interface ScreenSize {
  width: number;
  height: number;
  isLargeScreen: boolean;
  is720p?: boolean;
}

/**
 * useResponsiveFontSize
 * 
 * A custom hook that returns responsive font size multipliers based on screen resolution.
 * This helps scale typography appropriately for different screen sizes and resolutions.
 * Optimized for readability from a distance, especially on 1080p displays.
 */
const useResponsiveFontSize = () => {
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1.2);
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: window.innerWidth,
    height: window.innerHeight,
    isLargeScreen: window.innerWidth >= 1920 || window.innerHeight >= 1080
  });

  useEffect(() => {
    const calculateFontSizeMultiplier = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLargeScreen = width >= 1920 || height >= 1080;
      
      // Base size for 1080p (1920x1080) - already optimized for readability 
      let multiplier = 1.2; // Increased from 1.0 to improve readability
      
      // For 4K screens (3840x2160) and above
      if (width >= 3840 || height >= 2160) {
        multiplier = 2.0;
      }
      // For 2K screens (2560x1440)
      else if (width >= 2560 || height >= 1440) {
        multiplier = 1.6;
      }
      // For very large 1080p screens (e.g., 50+ inch TVs)
      else if (isLargeScreen && (width >= 2400 || height >= 1300)) {
        multiplier = 1.4;
      }
      // For 720p screens (1280x720)
      else if (width <= 1280 || height <= 720) {
        multiplier = 0.9;
      }
      
      setFontSizeMultiplier(multiplier);
      setScreenSize({ 
        width, 
        height, 
        isLargeScreen,
        is720p: width <= 1280 || height <= 720 
      });
    };

    // Calculate initially
    calculateFontSizeMultiplier();

    // Recalculate on resize
    const handleResize = () => {
      calculateFontSizeMultiplier();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate specific font sizes to use throughout the app
  // Optimized for better readability on large displays viewed from a distance
  const fontSizes = {
    huge: `${3.2 * fontSizeMultiplier}rem`,    // For major headings, readable from 5+ meters
    h1: `${2.6 * fontSizeMultiplier}rem`,      // Main headings
    h2: `${2.2 * fontSizeMultiplier}rem`,      // Section headings
    h3: `${1.8 * fontSizeMultiplier}rem`,      // Sub-section headings
    h4: `${1.6 * fontSizeMultiplier}rem`,      // Minor headings
    h5: `${1.4 * fontSizeMultiplier}rem`,      // Small headings
    h6: `${1.2 * fontSizeMultiplier}rem`,      // Tiny headings
    body1: `${1.1 * fontSizeMultiplier}rem`,   // Regular text, enlarged for readability
    body2: `${1.0 * fontSizeMultiplier}rem`,   // Secondary text
    caption: `${0.9 * fontSizeMultiplier}rem`  // Small text, still readable from distance
  };

  return { fontSizes, fontSizeMultiplier, screenSize };
};

export default useResponsiveFontSize; 