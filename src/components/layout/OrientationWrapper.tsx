/**
 * OrientationWrapper
 *
 * Applies CSS rotation (0°, 90°, 180°, 270°) from the admin-configured screen orientation.
 * When rotationDegrees is 0, content fills the viewport directly; otherwise a centred
 * rotated inner div is used with width/height swapped for 90° and 270° (FR-4, FR-5).
 *
 * Child layouts must use `w-full h-full` (percentage-based) so they fill the rotated container.
 */

import React from 'react';
import type { RotationDegrees } from '@/types/realtime';

interface OrientationWrapperProps {
  /** Rotation in degrees (0, 90, 180, 270). Applied directly from WebSocket or derived from orientation. */
  rotationDegrees: RotationDegrees;
  children: React.ReactNode;
}

const OrientationWrapper: React.FC<OrientationWrapperProps> = ({
  rotationDegrees,
  children,
}) => {
  if (rotationDegrees === 0) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden">
        {children}
        {/*
         * Portal target for fullscreen media overlays. Sitting here (inside the
         * no-rotation branch), a `position: fixed` child portalled into this div
         * behaves like a normal `fixed inset-0` — covering the full physical viewport.
         */}
        <div id="orientation-portal-root" />
      </div>
    );
  }

  const swapDimensions = rotationDegrees === 90 || rotationDegrees === 270;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      <div
        className="gpu-accelerated absolute"
        style={{
          top: '50%',
          left: '50%',
          width: swapDimensions ? '100vh' : '100vw',
          height: swapDimensions ? '100vw' : '100vh',
          transformOrigin: 'center center',
          transform: `translate(-50%, -50%) rotate(${rotationDegrees}deg)`,
          overflow: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        {children}
        {/*
         * Portal target for fullscreen media overlays. Because this ancestor div
         * has a CSS `transform`, a `position: fixed` child portalled here is
         * contained by this transformed block (not the raw viewport). That means
         * `fixed inset-0` covers the full *logical* display area in the configured
         * orientation, rather than the physical screen rectangle.
         */}
        <div id="orientation-portal-root" />
      </div>
    </div>
  );
};

export default OrientationWrapper;
