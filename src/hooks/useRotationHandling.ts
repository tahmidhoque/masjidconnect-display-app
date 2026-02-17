import { useState, useEffect, useMemo } from "react";
// Define Orientation type locally instead of importing from context
type Orientation = "LANDSCAPE" | "PORTRAIT";

/**
 * Custom hook for determining if rotation should be applied.
 * Compares physical device orientation with desired orientation.
 *
 * CRITICAL FIX: Use a direct calculation instead of state to avoid timing issues
 * where the initial state might not match the actual window dimensions at render time.
 *
 * @param desiredOrientation - The orientation we want to display (from admin dashboard)
 * @returns Object with shouldRotate flag and current physical device orientation
 */
export function useRotationHandling(desiredOrientation: Orientation) {
  // Directly calculate physical orientation every render (cheap calculation)
  // This avoids timing issues with useState initial values
  const physicalOrientation: Orientation =
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
      ? 'PORTRAIT'
      : 'LANDSCAPE';

  // Determine if we need to apply rotation
  const shouldRotate = physicalOrientation !== desiredOrientation;


  // Force re-render on window resize to recalculate orientation
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);

      // Debounce resize events
      resizeTimer = setTimeout(() => {
        forceUpdate((n) => n + 1);
      }, 150);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  return {
    shouldRotate,
    physicalOrientation,
  };
}

export default useRotationHandling;
