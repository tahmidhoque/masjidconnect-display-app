/**
 * ReferenceViewport
 *
 * Renders children in a fixed 720p "stage" (1280×720 landscape or 720×1280 portrait)
 * and scales the stage to fit the viewport. This keeps container sizing and proportions
 * identical at every resolution: the layout is always 720p, only the scale changes.
 *
 * Uses ResizeObserver to measure the container and compute scale = min(w/refW, h/refH).
 * Inner stage has fontSize: 16px so 1rem is fixed and layout is purely 720p.
 *
 * IMPORTANT: Uses CSS `zoom` rather than `transform: scale()` for scaling.
 * `transform: scale()` rasterises the content at 720p layout pixels then GPU-upscales
 * the bitmap — producing blurry text and graphics on high-res displays. `zoom` causes
 * the browser to re-lay out and re-rasterise at the final zoomed pixel density, so
 * content is always rendered at native screen resolution and remains crisp.
 */

import React, { useState, useEffect, useRef } from 'react';

const REF_LANDSCAPE = { width: 1280, height: 720 };
const REF_PORTRAIT = { width: 720, height: 1280 };

type Orientation = 'LANDSCAPE' | 'PORTRAIT';

interface ReferenceViewportProps {
  orientation: Orientation;
  children: React.ReactNode;
}

const ReferenceViewport: React.FC<ReferenceViewportProps> = ({
  orientation,
  children,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const refSize =
    orientation === 'PORTRAIT' ? REF_PORTRAIT : REF_LANDSCAPE;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateScale = (): void => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / refSize.width, h / refSize.height);
      setScale(s);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [orientation, refSize.width, refSize.height]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div
        className="shrink-0"
        style={{
          width: refSize.width,
          height: refSize.height,
          zoom: scale,
          fontSize: '16px',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ReferenceViewport;
