import { useState, useEffect, useMemo, useCallback } from 'react';
import { Orientation } from '../contexts/OrientationContext';

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
  
  // Optimize the orientation update with debounce
  const updatePhysicalOrientation = useCallback(() => {
    const isPortrait = window.innerHeight > window.innerWidth;
    const newOrientation: Orientation = isPortrait ? 'PORTRAIT' : 'LANDSCAPE';
    
    if (newOrientation !== physicalOrientation) {
      // Remove console log to reduce spam
      setPhysicalOrientation(newOrientation);
    }
  }, [physicalOrientation]);
  
  // Update physical orientation on window resize with debounce
  useEffect(() => {
    // Debounce resize events to avoid frequent updates
    let resizeTimer: NodeJS.Timeout | null = null;
    
    const handleResize = () => {
      // Cancel previous timer
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      
      // Set new timer
      resizeTimer = setTimeout(() => {
        updatePhysicalOrientation();
      }, 100); // 100ms debounce
    };
    
    // Initial check
    updatePhysicalOrientation();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
  }, [updatePhysicalOrientation]);
  
  return {
    shouldRotate,
    physicalOrientation
  };
}

export default useRotationHandling; 