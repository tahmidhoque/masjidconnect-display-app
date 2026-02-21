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

/** Custom event fired by the dev keyboard shortcut (Ctrl+Shift+N) to skip to the next slide instantly. */
export const CAROUSEL_ADVANCE_EVENT = 'carousel-advance';

/** A single divine name entry used by ASMA_AL_HUSNA slides. */
export interface AsmaName {
  arabic?: string;
  transliteration?: string;
  meaning?: string;
  number?: number;
}

export interface CarouselItem {
  id: string;
  type: string;
  title?: string;
  body?: string;
  /** Arabic body text (rendered with arabic-text class) */
  arabicBody?: string;
  source?: string;
  imageUrl?: string;
  /** Display duration in seconds for this slide (overrides default interval when set) */
  duration?: number;
  /**
   * For ASMA_AL_HUSNA items: the full list of divine names from the API.
   * The carousel picks one at random each time this slide becomes active.
   */
  names?: AsmaName[];
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

/** Map API content types to user-friendly labels for the carousel badge */
function getContentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    verse_hadith: 'Verse & Hadith',
    announcement: 'Announcement',
    prayer_times: 'Prayer Times',
    event: 'Event',
    content: 'Content',
    custom: 'Content',
    asma_al_husna: 'Names of Allah',
  };
  return labels[type.toLowerCase()] ?? type;
}

const ContentCarousel: React.FC<ContentCarouselProps> = ({ items, interval = 30 }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [contentScale, setContentScale] = useState(1);
  /** Index into the current item's `names` array; re-randomised whenever the active slide changes. */
  const [selectedNameIdx, setSelectedNameIdx] = useState(0);
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

  /** Per-item auto-advance: use current slide's duration (from API) or default interval */
  useEffect(() => {
    if (safeItems.length <= 1) return;

    const item = safeItems[activeIdx];
    const seconds = item?.duration != null && item.duration > 0
      ? Math.max(5, Math.min(300, Number(item.duration)))
      : interval;
    const ms = seconds * 1000;

    const id = setTimeout(advance, ms);
    return () => {
      clearTimeout(id);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIdx, advance, interval, safeItems, safeItems.length]);

  /** Reset index if items change */
  useEffect(() => {
    setActiveIdx(0);
    setPhase('in');
  }, [items]);

  /**
   * When the active slide changes, pick a new random name if the slide is an
   * ASMA_AL_HUSNA item with a `names` array. This ensures a different name is
   * shown each time the carousel cycles back to that slot.
   */
  useEffect(() => {
    const activeItem = safeItems[activeIdx];
    if (activeItem?.names && activeItem.names.length > 0) {
      setSelectedNameIdx(Math.floor(Math.random() * activeItem.names.length));
    }
  }, [activeIdx, safeItems]);

  /** Dev-only: listen for the carousel-advance event to skip slides instantly. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = () => advance();
    window.addEventListener(CAROUSEL_ADVANCE_EVENT, handler);
    return () => window.removeEventListener(CAROUSEL_ADVANCE_EVENT, handler);
  }, [advance]);

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

  // When the item carries a `names` array (ASMA_AL_HUSNA), resolve the fields
  // from the randomly selected entry rather than from the item-level fields.
  const selectedName = item.names?.[selectedNameIdx];
  const displayTitle    = selectedName?.transliteration ?? item.title;
  const displayArabic   = selectedName?.arabic           ?? item.arabicBody;
  const displayBody     = selectedName?.meaning          ?? item.body;
  const displaySource   = selectedName
    ? (typeof selectedName.number === 'number' ? `Name ${selectedName.number} of 99` : undefined)
    : item.source;

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
            <span className="badge badge-emerald self-start">{getContentTypeLabel(item.type)}</span>

            {/* Image — constrained so it doesn't overflow; rem-based to match 720p scaling */}
            {item.imageUrl && (
              <div className="flex justify-center min-h-0 max-h-[18rem] w-full">
                <img
                  src={item.imageUrl}
                  alt=""
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            )}

            {/* Title */}
            {displayTitle && (
              <h2 className="text-heading text-text-primary">{displayTitle}</h2>
            )}

            {/* Arabic text */}
            {displayArabic && (
              <p className="arabic-text text-2xl text-gold leading-relaxed">{displayArabic}</p>
            )}

            {/* English body */}
            {displayBody && (
              <p className="text-body text-text-secondary leading-relaxed">{displayBody}</p>
            )}

            {/* Source */}
            {displaySource && (
              <p className="text-caption text-text-muted italic">— {displaySource}</p>
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
