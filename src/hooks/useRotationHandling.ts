import { useState, useEffect } from 'react';
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
  
  // Determine if we need to apply rotation
  const shouldRotate = physicalOrientation !== desiredOrientation;
  
  // Update physical orientation on window resize
  useEffect(() => {
    const updatePhysicalOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const newOrientation: Orientation = isPortrait ? 'PORTRAIT' : 'LANDSCAPE';
      
      if (newOrientation !== physicalOrientation) {
        console.log('Physical device orientation changed:', newOrientation);
        setPhysicalOrientation(newOrientation);
      }
    };
    
    // Initial check
    updatePhysicalOrientation();
    
    // Listen for resize events
    window.addEventListener('resize', updatePhysicalOrientation);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', updatePhysicalOrientation);
    };
  }, [physicalOrientation]);
  
  return {
    shouldRotate,
    physicalOrientation
  };
}

export default useRotationHandling; 