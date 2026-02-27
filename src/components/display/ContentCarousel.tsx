/**
 * ContentCarousel
 *
 * Cycles through schedule items (announcements, hadith, events, etc.)
 * with a GPU-friendly crossfade transition.
 *
 * Content is automatically scaled (via CSS transform) to fit the available area:
 * long content is scaled down so it all fits; short content may be scaled up within a cap.
 * No width is applied to the inner content div so every slide occupies the same layout
 * slot and stays in the same position regardless of content amount. No scrolling — display-only.
 *
 * The carousel interval is configurable via props (from screen config).
 * Falls back to 30s if not specified.
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';

const EventSlide = lazy(() => import('./EventSlide'));

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
  /** Transliteration / Latin script (e.g. for Dua); rendered LTR between Arabic and body */
  transliteration?: string;
  source?: string;
  imageUrl?: string;
  /** Display duration in seconds for this slide (overrides default interval when set) */
  duration?: number;
  /**
   * For ASMA_AL_HUSNA items: the full list of divine names from the API.
   * The carousel picks one at random each time this slide becomes active.
   */
  names?: AsmaName[];
  /**
   * Full Events V2 object. When present, the carousel renders an EventSlide
   * instead of the generic text layout.
   */
  event?: import('../../api/models').EventV2;
}

interface ContentCarouselProps {
  items: CarouselItem[];
  /** Cycle interval in seconds (default 30) */
  interval?: number;
  /** True when rendered inside a portrait layout — forwarded to EventSlide */
  compact?: boolean;
}

/**
 * Minimum scale factor when scaling down (content overflows).
 * Maximum scale factor when scaling up — kept conservative to avoid overflow.
 */
const MIN_SCALE = 0.45;
const MAX_SCALE_UP = 1.35;

/** Use most of the width (97%) so we don't waste space on the left; scale height more conservatively (84%) so nothing clips. */
const FIT_WIDTH_RATIO = 0.97;
const FIT_HEIGHT_RATIO = 0.84;

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
    dua: 'Dua',
  };
  return labels[type.toLowerCase()] ?? type;
}

const ContentCarousel: React.FC<ContentCarouselProps> = ({ items, interval = 30, compact = false }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [contentScale, setContentScale] = useState(1);
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
   * Scale content to fit the container. Long content is scaled down so it all fits.
   * No width is set on the content div so every slide uses the same layout slot and
   * stays in the same position regardless of content amount.
   */
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      setContentScale(1);
      return;
    }

    let cancelled = false;

    const recalc = () => {
      if (!containerRef.current || !contentRef.current || cancelled) return;
      const container = containerRef.current;
      const content = contentRef.current;

      const availableW = container.clientWidth;
      const availableH = container.clientHeight;
      if (availableW <= 0 || availableH <= 0) return;

      const fitW = availableW * FIT_WIDTH_RATIO;
      const fitH = availableH * FIT_HEIGHT_RATIO;

      const naturalW = content.scrollWidth;
      const naturalH = content.scrollHeight;

      if (naturalH <= 0 || naturalW <= 0) {
        requestAnimationFrame(recalc);
        return;
      }

      const scaleH = fitH / naturalH;
      const scaleW = fitW / naturalW;
      let scaleToFit = Math.min(scaleH, scaleW);

      if (scaleToFit < 1) {
        scaleToFit = Math.max(scaleToFit, MIN_SCALE);
        setContentScale(scaleToFit);
      } else {
        const scale = Math.min(Math.min(scaleToFit, MAX_SCALE_UP) * FIT_HEIGHT_RATIO, 1);
        setContentScale(scale);
      }
    };

    const raf = requestAnimationFrame(recalc);
    const containerObserver = new ResizeObserver(() => requestAnimationFrame(recalc));
    containerObserver.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      containerObserver.disconnect();
    };
  }, [activeIdx, items]);

  if (safeItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted text-body">No content to display</p>
      </div>
    );
  }

  const item = safeItems[activeIdx] ?? safeItems[0];
  const isEventSlide = !!item.event;

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
    <div className="flex flex-col h-full overflow-hidden relative w-full">
      {/* Measurement container — always clip; content is scaled to fit */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full overflow-hidden"
      >
        {/* Animated crossfade wrapper — centred so content has even space from all edges */}
        <div
          key={item.id}
          className={`
            w-full h-full gpu-accelerated flex flex-col justify-center items-stretch
            ${phase === 'in' ? 'animate-fade-in' : 'animate-fade-out'}
          `}
        >
          {/* Scaled content wrapper — applies to all slide types including EventSlide */}
          <div
            ref={isEventSlide ? undefined : contentRef}
            className="flex flex-col gap-4 min-w-0 flex-shrink-0 w-full max-w-full"
            style={isEventSlide ? undefined : {
              transform: `scale(${contentScale})`,
              transformOrigin: 'center center',
            }}
          >
            {isEventSlide && item.event ? (
              /* Events V2 — rich slide; inherits carousel's transparent background */
              <Suspense fallback={null}>
                <EventSlide event={item.event} compact={compact} />
              </Suspense>
            ) : (
              <>
                {/* Type badge — Dua uses distinct blue badge */}
                <span
                  className={`badge self-start ${item.type?.toLowerCase() === 'dua' ? 'badge-dua' : 'badge-emerald'}`}
                >
                  {getContentTypeLabel(item.type)}
                </span>

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

                {/* Title — scaled to match display readability */}
                {displayTitle && (
                  <h2 className="text-carousel-title text-text-primary">{displayTitle}</h2>
                )}

                {/* Arabic text — larger for prominence (verse/hadith, Dua, Asma al Husna) */}
                {displayArabic && (
                  <p className="arabic-text text-carousel-arabic text-gold leading-relaxed">{displayArabic}</p>
                )}

                {/* Transliteration — LTR (Dua and any type with transliteration) */}
                {item.transliteration && (
                  <p className="text-carousel-body text-text-secondary leading-relaxed" dir="ltr">
                    {item.transliteration}
                  </p>
                )}

                {/* English body / translation — larger for readability from a distance */}
                {displayBody && (
                  <p className="text-carousel-body text-text-secondary leading-relaxed">{displayBody}</p>
                )}

                {/* Source — slightly smaller than body but still legible */}
                {displaySource && (
                  <p className="text-carousel-body text-text-muted text-[0.9em] italic">— {displaySource}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pagination dots */}
      {safeItems.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 pt-1.5">
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
