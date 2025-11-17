import { useState, useEffect, useMemo } from "react";
// Define Orientation type locally instead of importing from context
type Orientation = "LANDSCAPE" | "PORTRAIT";

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
    window.innerHeight > window.innerWidth ? "PORTRAIT" : "LANDSCAPE",
  );

  // Determine if we need to apply rotation - memoize to prevent recalculation
  const shouldRotate = useMemo(
    () => physicalOrientation !== desiredOrientation,
    [physicalOrientation, desiredOrientation],
  );

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
        const newOrientation: Orientation = isPortrait
          ? "PORTRAIT"
          : "LANDSCAPE";

        // Use functional update to avoid dependency on physicalOrientation
        setPhysicalOrientation((current) => {
          if (newOrientation !== current) {
            return newOrientation;
          }
          return current;
        });
      }, 150); // 150ms debounce
    };

    // Initial check - only set if different to avoid initial re-render
    const initialIsPortrait = window.innerHeight > window.innerWidth;
    const initialOrientation: Orientation = initialIsPortrait
      ? "PORTRAIT"
      : "LANDSCAPE";
    if (initialOrientation !== physicalOrientation) {
      setPhysicalOrientation(initialOrientation);
    }

    // Listen for resize events
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
    // Remove physicalOrientation from dependencies to prevent re-attaching listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    shouldRotate,
    physicalOrientation,
  };
}

export default useRotationHandling;
