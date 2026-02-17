/**
 * ContentCarousel
 *
 * Cycles through schedule items (announcements, hadith, events, etc.)
 * with a GPU-friendly crossfade transition.
 *
 * Content is automatically scaled down (via CSS transform) when it would
 * overflow the available container height. This ensures long Arabic text
 * or verbose announcements never clip, regardless of the carousel's size.
 *
 * The carousel interval is configurable via props (from screen config).
 * Falls back to 30s if not specified.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface CarouselItem {
  id: string;
  type: string;
  title?: string;
  body?: string;
  /** Arabic body text (rendered with arabic-text class) */
  arabicBody?: string;
  source?: string;
  imageUrl?: string;
}

interface ContentCarouselProps {
  items: CarouselItem[];
  /** Cycle interval in seconds (default 30) */
  interval?: number;
}

/**
 * Minimum scale factor to prevent text becoming unreadably small.
 * At 0.45 a heading at 3 rem becomes ~1.35 rem — still legible on a TV.
 */
const MIN_SCALE = 0.45;

const ContentCarousel: React.FC<ContentCarouselProps> = ({ items, interval = 30 }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [contentScale, setContentScale] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const safeItems = items.length > 0 ? items : [];

  /** Advance to the next slide with a crossfade */
  const advance = useCallback(() => {
    if (safeItems.length <= 1) return;

    setPhase('out');
    timerRef.current = setTimeout(() => {
      setActiveIdx((prev) => (prev + 1) % safeItems.length);
      setPhase('in');
    }, 700); // matches --duration-crossfade
  }, [safeItems.length]);

  /** Auto-advance timer */
  useEffect(() => {
    if (safeItems.length <= 1) return;

    const id = setInterval(advance, interval * 1000);
    return () => {
      clearInterval(id);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [advance, interval, safeItems.length]);

  /** Reset index if items change */
  useEffect(() => {
    setActiveIdx(0);
    setPhase('in');
  }, [items]);

  /**
   * Auto-scale: measure the content's natural height (scrollHeight is
   * unaffected by CSS transforms) against the container's available height.
   * If the content would overflow, apply a proportional scale-down.
   * A ResizeObserver recalculates on container resize (orientation change, etc.).
   */
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      setContentScale(1);
      return;
    }

    const recalc = () => {
      const availableH = container.clientHeight;
      const naturalH = content.scrollHeight;

      if (naturalH > availableH && naturalH > 0 && availableH > 0) {
        setContentScale(Math.max(availableH / naturalH, MIN_SCALE));
      } else {
        setContentScale(1);
      }
    };

    // Measure once layout has settled after the slide mount
    const raf = requestAnimationFrame(recalc);

    // Re-measure whenever the container is resized
    const observer = new ResizeObserver(() => requestAnimationFrame(recalc));
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [activeIdx, items]);

  if (safeItems.length === 0) {
    return (
      <div className="panel flex items-center justify-center h-full">
        <p className="text-text-muted text-body">No content to display</p>
      </div>
    );
  }

  const item = safeItems[activeIdx] ?? safeItems[0];
  const isScaled = contentScale < 1;

  return (
    <div className="panel flex flex-col h-full overflow-hidden relative">
      {/* Measurement container — defines the available height for content */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
        {/* Animated crossfade wrapper */}
        <div
          key={item.id}
          className={`
            h-full gpu-accelerated
            ${!isScaled ? 'flex flex-col justify-center' : ''}
            ${phase === 'in' ? 'animate-fade-in' : 'animate-fade-out'}
          `}
        >
          {/* Content wrapper — scales down when it would overflow */}
          <div
            ref={contentRef}
            className="flex flex-col gap-3"
            style={isScaled ? {
              transform: `scale(${contentScale})`,
              transformOrigin: 'top center',
            } : undefined}
          >
            {/* Type badge */}
            <span className="badge badge-emerald self-start">{item.type}</span>

            {/* Title */}
            {item.title && (
              <h2 className="text-heading text-text-primary">{item.title}</h2>
            )}

            {/* Arabic text */}
            {item.arabicBody && (
              <p className="arabic-text text-2xl text-gold leading-relaxed">{item.arabicBody}</p>
            )}

            {/* English body */}
            {item.body && (
              <p className="text-body text-text-secondary leading-relaxed">{item.body}</p>
            )}

            {/* Source */}
            {item.source && (
              <p className="text-caption text-text-muted italic">— {item.source}</p>
            )}
          </div>
        </div>
      </div>

      {/* Pagination dots — always visible */}
      {safeItems.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 pt-2">
          {safeItems.map((_, i) => (
            <span
              key={i}
              className={`
                w-1.5 h-1.5 rounded-full transition-all duration-normal
                ${i === activeIdx ? 'bg-emerald w-4' : 'bg-text-muted/30'}
              `}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(ContentCarousel);
