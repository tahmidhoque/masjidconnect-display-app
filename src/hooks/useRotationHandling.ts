import { useState, useEffect, useMemo } from 'react';
// Define Orientation type locally instead of importing from context
type Orientation = 'LANDSCAPE' | 'PORTRAIT';

/**
 * Custom hook for determining if rotation should be applied
 * Compares physical device orientation with desired orientation to avoid unnecessary rotation
 * 
 * @param desiredOrientation - The orientation we want to display (from admin dashboard)
 * @returns Object with shouldRotate flag and current physical device orientation
 */
export function useRotationHandling(desiredOrientation: Orientation) {
  // Track the physical device orientation
  const [physicalOrientation, setPhysicalOrientation] = useState<Orientation>(
    window.innerHeight > window.innerWidth ? 'PORTRAIT' : 'LANDSCAPE'
  );
  
  // Determine if we need to apply rotation - memoize to prevent recalculation
  const shouldRotate = useMemo(() => 
    physicalOrientation !== desiredOrientation,
  [physicalOrientation, desiredOrientation]);
  
  // Update physical orientation on window resize with simple debounce
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleResize = () => {
      // Cancel previous timer
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      
      // Set new timer with simple debounce
      resizeTimer = setTimeout(() => {
        const isPortrait = window.innerHeight > window.innerWidth;
        const newOrientation: Orientation = isPortrait ? 'PORTRAIT' : 'LANDSCAPE';
        
        if (newOrientation !== physicalOrientation) {
          setPhysicalOrientation(newOrientation);
        }
      }, 150); // 150ms debounce
    };
    
    // Initial check
    handleResize();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
  }, [physicalOrientation]);
  
  return {
    shouldRotate,
    physicalOrientation
  };
}

export default useRotationHandling; 