/**
 * OrientationWrapper
 *
 * Applies CSS rotation when the physical device orientation doesn't match
 * the desired orientation configured in the admin dashboard.
 *
 * Uses center-based rotation matching the original implementation:
 * - Centers the container at 50%, 50%
 * - Rotates 90deg from that center point
 * - Swaps width/height to match rotated dimensions
 *
 * IMPORTANT: Child layouts must use `w-full h-full` (percentage-based)
 * instead of `100vw/100vh` (viewport-based) so they correctly fill the
 * rotated container.
 */

import React from 'react';
import { useRotationHandling } from '../../hooks/useRotationHandling';

type Orientation = 'LANDSCAPE' | 'PORTRAIT';

interface OrientationWrapperProps {
  /** Desired orientation from the admin dashboard */
  orientation: Orientation;
  children: React.ReactNode;
}

const OrientationWrapper: React.FC<OrientationWrapperProps> = ({
  orientation,
  children,
}) => {
  const { shouldRotate } = useRotationHandling(orientation);

  if (!shouldRotate) {
    // Physical orientation matches desired — fill the viewport directly
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden">
        {children}
      </div>
    );
  }

  // Physical orientation doesn't match — apply 90° rotation.
  // The outer div owns the viewport, the inner div is rotated with swapped dimensions.
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      <div
        className="gpu-accelerated absolute"
        style={{
          top: '50%',
          left: '50%',
          width: '100vh',
          height: '100vw',
          transformOrigin: 'center center',
          transform: 'translate(-50%, -50%) rotate(90deg)',
          overflow: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default OrientationWrapper;
