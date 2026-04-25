/**
 * ContentCarousel
 *
 * Cycles through schedule items (announcements, hadith, events, etc.)
 * with a GPU-friendly crossfade transition.
 *
 * Content is sized using adaptive typography: a content-density classifier
 * picks initial font sizes, then a binary-search fit loop adjusts a
 * multiplier so text fills the available area without overflow. Short
 * content (a single Asma al-Husna name, a brief announcement) gets large
 * display-size fonts; long content (Ayatul Kursi, lengthy hadith) gets
 * compact fonts. If content still overflows at the minimum readable size,
 * a slow vertical auto-scroll kicks in as a last resort.
 *
 * Font sizes are applied via CSS custom properties (--carousel-title-size,
 * --carousel-body-size, --carousel-arabic-size) so each text element sizes
 * independently — unlike the old transform:scale() which scaled
 * spacing and line-height uniformly.
 *
 * The carousel interval is configurable via props (from screen config).
 * Falls back to 30s if not specified.
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import logger from '@/utils/logger';
import { sanitizeHtml } from '@/utils/sanitizeHtml';
import {
  getScalingForItem,
  getScalingForEvent,
  computeFontSizes,
  AUTO_SCROLL_SPEED,
  AUTO_SCROLL_PAUSE_TOP,
  AUTO_SCROLL_PAUSE_BOTTOM,
} from './contentScaling';
import type { FontSizeConfig } from './contentScaling';

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
  /** When true, body contains HTML — render with sanitised innerHTML */
  bodyIsHTML?: boolean;
  /** Per-item font size override: multiplies base body size */
  bodyFontSize?: 'small' | 'medium' | 'large';
  /** Text alignment for title and body (default: left) */
  textAlign?: 'left' | 'center' | 'right';
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

/** Maximum binary-search iterations to prevent infinite loops */
const MAX_FIT_ITERATIONS = 8;

/**
 * Ratio of container used for fitting — leaves a small margin so content
 * doesn't press against the edges.
 */
const FIT_RATIO = 0.92;

/**
 * If content height is below this fraction of container height after
 * applying the tier's base multiplier, the fit loop will try to scale up.
 */
const HEADROOM_THRESHOLD = 0.75;

/**
 * Portrait orientation gives the carousel a smaller content box (the
 * prayer panel sits above it instead of beside it). Without a floor,
 * the fit loop would happily shrink the same content far below its
 * landscape sizing — which is exactly the drift admins were working
 * around by duplicating playlists.
 *
 * In compact (portrait) mode, treat 85% of the tier's base multiplier
 * as the lowest "readable" size before falling through to the existing
 * safety-scale / auto-scroll fallbacks. The fit loop can still scale
 * up freely; the floor only applies to fit-down.
 */
const COMPACT_READABLE_FLOOR_RATIO = 0.85;

/**
 * Apply font sizes as CSS custom properties on a DOM element.
 * The carousel typography classes (.text-carousel-title etc.) read these.
 */
function applyFontSizeProps(el: HTMLElement, sizes: FontSizeConfig): void {
  el.style.setProperty('--carousel-title-size', `${sizes.titleSize}rem`);
  el.style.setProperty('--carousel-body-size', `${sizes.bodySize}rem`);
  el.style.setProperty('--carousel-arabic-size', `${sizes.arabicSize}rem`);
}

const ContentCarousel: React.FC<ContentCarouselProps> = ({ items, interval = 30, compact = false }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [selectedNameIdx, setSelectedNameIdx] = useState(0);
  const [needsScroll, setNeedsScroll] = useState(false);
  /**
   * Safety scale applied as a last resort when content still overflows the
   * container at the tier's minimum font size. Preserves the original
   * "nothing is ever clipped" guarantee from the transform:scale() approach.
   * Value is 1 for the vast majority of content; only drops below 1 for
   * extremely long items that hit the bottom of the fit loop.
   */
  const [safetyScale, setSafetyScale] = useState(1);
  /**
   * True once the binary-search fit loop has settled on a final font-size
   * for the current slide. The slide is held at opacity 0 until this flips
   * true, then the fade-in animation runs — so the user never sees the text
   * grow visibly while the fit loop is still searching upwards.
   */
  const [isFitted, setIsFitted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number>(0);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitLoopRafRef = useRef<number>(0);

  const safeItems = useMemo(() => (items.length > 0 ? items : []), [items]);

  /** Advance to the next slide with a crossfade */
  const advance = useCallback(() => {
    if (safeItems.length <= 1) return;

    setPhase('out');
    timerRef.current = setTimeout(() => {
      setActiveIdx((prev) => (prev + 1) % safeItems.length);
      setPhase('in');
    }, 700);
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

  /** Pick a random Asma al-Husna name when slide becomes active */
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

  const currentItem = safeItems[activeIdx] ?? safeItems[0];
  const isEventSlide = !!currentItem?.event;

  /** Compute the scaling result for the current item (memoised). Event slides use getScalingForEvent. */
  const scalingResult = useMemo(() => {
    if (!currentItem) return null;
    if (isEventSlide && currentItem.event) return getScalingForEvent(currentItem.event);
    return getScalingForItem(currentItem);
  }, [currentItem, isEventSlide]);

  /**
   * Apply the tier's initial font sizes synchronously before the browser paints.
   * This means the very first visible frame of a new slide already uses the
   * content-aware sizes rather than the CSS clamp fallbacks, eliminating the
   * "jump from small to large" flash.
   */
  useLayoutEffect(() => {
    const content = contentRef.current;
    // Reset safety scale synchronously so the new slide never briefly shows
    // the previous slide's transform before the fit loop runs.
    setSafetyScale(1);
    // Hide the new slide until the fit loop has settled — prevents the
    // "text grows in" flash that was visible while the binary search ran.
    setIsFitted(false);
    if (!content || !scalingResult) return;
    applyFontSizeProps(content, scalingResult.initialSizes);
  }, [activeIdx, scalingResult]);

  /**
   * Adaptive typography fit loop.
   *
   * After the DOM renders with the tier's initial font sizes, this effect
   * measures whether content fits the container. It runs a binary search
   * on the font-size multiplier (between the tier's min and max) to find
   * the largest sizes that fit without overflow.
   *
   * If content still overflows at the minimum multiplier, `needsScroll`
   * is set to true to trigger the auto-scroll fallback.
   */
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content || !scalingResult) {
      setNeedsScroll(false);
      // Nothing to fit — reveal so the slide is never stuck invisible.
      setIsFitted(true);
      return;
    }

    let cancelled = false;

    const runFitLoop = () => {
      if (cancelled || !containerRef.current || !contentRef.current) return;

      const ctr = containerRef.current;
      const cnt = contentRef.current;

      // Only constrain height — text elements are w-full, so scrollWidth always
      // equals clientWidth regardless of font size. Checking width would always
      // report "overflow" and force sizes down to tier minimum.
      const availH = ctr.clientHeight * FIT_RATIO;
      if (availH <= 0) {
        // Container hasn't been laid out yet (e.g. JSDOM, or pre-paint).
        // Reveal the slide at base sizes — ResizeObserver will re-run the
        // fit loop once the container actually has a size.
        setIsFitted(true);
        return;
      }

      const { config, tier, bodyFontSizeMultiplier } = scalingResult;
      // Generic text slides honour the compact (portrait) floor; event
      // slides handle compact mode themselves via the `compact` prop.
      const effectiveMin = compact && !isEventSlide
        ? Math.max(
            config.minMultiplier,
            Math.min(config.baseMultiplier, config.baseMultiplier * COMPACT_READABLE_FLOOR_RATIO),
          )
        : config.minMultiplier;
      let lo = effectiveMin;
      let hi = config.maxMultiplier;
      let bestMultiplier = config.baseMultiplier;
      let overflowsAtMin = false;

      // Apply the initial (base) sizes so we can measure
      const baseSizes = computeFontSizes(tier, config.baseMultiplier, bodyFontSizeMultiplier);
      applyFontSizeProps(cnt, baseSizes);

      // Wait a frame for the browser to reflow with new font sizes
      fitLoopRafRef.current = requestAnimationFrame(() => {
        if (cancelled) return;

        const naturalH = cnt.scrollHeight;

        if (naturalH <= 0) {
          setIsFitted(true);
          return;
        }

        const fitsH = naturalH <= availH;

        if (fitsH) {
          // Content fits — check if there's headroom to scale up
          const fillRatio = naturalH / availH;
          if (fillRatio < HEADROOM_THRESHOLD && config.baseMultiplier < config.maxMultiplier) {
            // Binary search upwards
            lo = config.baseMultiplier;
            hi = config.maxMultiplier;
          } else {
            // Good fit already — keep base sizes
            setSafetyScale(1);
            setNeedsScroll(false);
            setIsFitted(true);
            logger.debug('[Carousel] Fit OK at base multiplier', { tier, multiplier: config.baseMultiplier });
            return;
          }
        } else {
          // Content overflows — binary search downwards, but never below
          // the effective floor (raised in compact mode so portrait
          // doesn't render the same content far smaller than landscape).
          lo = effectiveMin;
          hi = config.baseMultiplier;
        }

        // Binary search for the best multiplier
        let iterations = 0;
        const search = () => {
          if (cancelled || iterations >= MAX_FIT_ITERATIONS) {
            // Apply the best multiplier found during the search
            const finalSizes = computeFontSizes(tier, bestMultiplier, bodyFontSizeMultiplier);
            applyFontSizeProps(cnt, finalSizes);

            // Final measurement — one extra RAF so the browser reflows at finalSizes
            fitLoopRafRef.current = requestAnimationFrame(() => {
              if (cancelled) return;
              const finalH = cnt.scrollHeight;
              const isDua = currentItem?.type?.toLowerCase() === 'dua';
              if (finalH > availH) {
                // Content still overflows even at minimum font sizes.
                // Dua: use auto-scroll so text stays readable at larger size.
                // Other types: fall back to transform: scale() so nothing is clipped.
                if (isDua) {
                  setSafetyScale(1);
                  setNeedsScroll(true);
                  logger.debug('[Carousel] Dua auto-scroll enabled', { tier, multiplier: bestMultiplier });
                } else {
                  const neededScale = Math.max(availH / finalH, 0.4);
                  setSafetyScale(neededScale);
                  setNeedsScroll(false);
                  logger.debug('[Carousel] Safety scale applied', { tier, scale: neededScale });
                }
              } else {
                setSafetyScale(1);
                setNeedsScroll(false);
                logger.debug('[Carousel] Fit found', { tier, multiplier: bestMultiplier });
              }
              setIsFitted(true);
            });
            return;
          }

          const mid = (lo + hi) / 2;
          const testSizes = computeFontSizes(tier, mid, bodyFontSizeMultiplier);
          applyFontSizeProps(cnt, testSizes);

          fitLoopRafRef.current = requestAnimationFrame(() => {
            if (cancelled) return;

            const h = cnt.scrollHeight;
            const fits = h <= availH;

            if (fits) {
              bestMultiplier = mid;
              lo = mid;
            } else {
              hi = mid;
              if (mid <= effectiveMin + 0.01) {
                overflowsAtMin = true;
              }
            }

            iterations++;
            search();
          });
        };

        search();
      });
    };

    // Initial run after a frame (content needs to be in the DOM first)
    fitLoopRafRef.current = requestAnimationFrame(runFitLoop);

    // Re-run when container resizes
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(fitLoopRafRef.current);
      fitLoopRafRef.current = requestAnimationFrame(runFitLoop);
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(fitLoopRafRef.current);
      observer.disconnect();
    };
  }, [activeIdx, scalingResult, compact, isEventSlide]);

  /**
   * Auto-scroll effect for content that overflows at minimum font sizes.
   *
   * Pauses at the top, scrolls down slowly, pauses at the bottom, then
   * scrolls back up to the top (no abrupt jump). Scroll speed and pause
   * durations are constants from contentScaling.ts. Only the scroll
   * wrapper scrolls.
   */
  useEffect(() => {
    if (!needsScroll) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    let cancelled = false;
    let lastTimestamp = 0;
    let scrollDirection: 'down' | 'up' | 'paused-top' | 'paused-bottom' = 'paused-top';

    // Reset scroll position
    scrollEl.scrollTop = 0;

    const tick = (timestamp: number) => {
      if (cancelled) return;

      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
        scrollRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = (timestamp - lastTimestamp) / 1000; // seconds
      lastTimestamp = timestamp;

      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;

      if (scrollDirection === 'down') {
        scrollEl.scrollTop += AUTO_SCROLL_SPEED * delta;

        if (scrollEl.scrollTop >= maxScroll - 1) {
          scrollEl.scrollTop = maxScroll;
          scrollDirection = 'paused-bottom';

          scrollTimerRef.current = setTimeout(() => {
            if (cancelled) return;
            scrollDirection = 'up';
            lastTimestamp = 0;
            scrollRafRef.current = requestAnimationFrame(tick);
          }, AUTO_SCROLL_PAUSE_BOTTOM);
          return;
        }
      } else if (scrollDirection === 'up') {
        scrollEl.scrollTop -= AUTO_SCROLL_SPEED * delta;

        if (scrollEl.scrollTop <= 1) {
          scrollEl.scrollTop = 0;
          scrollDirection = 'paused-top';

          scrollTimerRef.current = setTimeout(() => {
            if (cancelled) return;
            scrollDirection = 'down';
            lastTimestamp = 0;
            scrollRafRef.current = requestAnimationFrame(tick);
          }, AUTO_SCROLL_PAUSE_TOP);
          return;
        }
      }

      scrollRafRef.current = requestAnimationFrame(tick);
    };

    // Start with a pause at the top, then begin scrolling down
    scrollTimerRef.current = setTimeout(() => {
      if (cancelled) return;
      scrollDirection = 'down';
      lastTimestamp = 0;
      scrollRafRef.current = requestAnimationFrame(tick);
    }, AUTO_SCROLL_PAUSE_TOP);

    return () => {
      cancelled = true;
      cancelAnimationFrame(scrollRafRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [needsScroll, activeIdx]);

  if (safeItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted text-body">No content to display</p>
      </div>
    );
  }

  const item = currentItem;

  // When the item carries a `names` array (ASMA_AL_HUSNA), resolve the fields
  // from the randomly selected entry rather than from the item-level fields.
  const typeLower = item?.type?.toLowerCase() ?? '';
  const effectiveTextAlign: 'left' | 'center' | 'right' =
    ['verse_hadith', 'asma_al_husna'].includes(typeLower) ? 'center' : (item?.textAlign ?? 'left');
  const selectedName = item.names?.[selectedNameIdx];
  const displayTitle    = selectedName?.transliteration ?? item.title;
  const displayArabic   = selectedName?.arabic           ?? item.arabicBody;
  const displayBody     = selectedName?.meaning          ?? item.body;
  const displaySource   = selectedName
    ? (typeof selectedName.number === 'number' ? `Name ${selectedName.number} of 99` : undefined)
    : item.source;

  return (
    <div className="flex flex-col h-full overflow-hidden relative w-full">
      {/* Measurement container — always clip; content adapts via font sizes */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full overflow-hidden"
      >
        {/* Animated crossfade wrapper.
            While the new slide is being measured by the fit loop we hold
            it at opacity 0; once `isFitted` flips true we play the
            standard fade-in. This prevents the visible "text grows in"
            flash that happens when the binary search scales the multiplier
            up over several frames. */}
        <div
          key={item.id}
          className={`
            w-full h-full gpu-accelerated flex flex-col items-stretch
            ${needsScroll ? 'justify-start' : 'justify-center'}
            ${phase === 'in' ? (isFitted ? 'animate-fade-in' : 'opacity-0') : 'animate-fade-out'}
          `}
        >
          {/* Content wrapper — when needsScroll, fills container so scroll region has constrained height. */}
          <div
            ref={contentRef}
            className={`flex flex-col gap-4 min-w-0 w-full max-w-full ${needsScroll ? 'flex-1 min-h-0' : 'flex-shrink-0'}`}
            style={safetyScale < 1 ? {
              transform: `scale(${safetyScale})`,
              transformOrigin: 'top center',
            } : undefined}
          >
            {isEventSlide && item.event ? (
              <Suspense fallback={null}>
                <EventSlide event={item.event} compact={compact} />
              </Suspense>
            ) : (
              <div style={{ textAlign: effectiveTextAlign }} className="flex flex-col min-w-0 w-full">
                {/* Scrollable text region — when needsScroll, flex-1 min-h-0 constrains height for scroll. */}
                <div
                  ref={scrollRef}
                  className={`flex flex-col gap-4 min-w-0 ${needsScroll ? 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar' : ''}`}
                >
                  {item.imageUrl && (
                    <div className="flex justify-center min-h-0 max-h-[18rem] w-full">
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    </div>
                  )}

                  {displayTitle && (
                    <h2 className="text-carousel-title text-text-primary">{displayTitle}</h2>
                  )}

                  {displayArabic && (
                    <p
                      className="arabic-text text-carousel-arabic text-gold leading-relaxed"
                      // `.arabic-text` forces `text-align: right` for readability; override for centered verse/names.
                      style={{ textAlign: effectiveTextAlign }}
                    >
                      {displayArabic}
                    </p>
                  )}

                  {item.transliteration && (
                    <p className="text-carousel-body text-text-secondary leading-relaxed" dir="ltr">
                      {item.transliteration}
                    </p>
                  )}

                  {displayBody && (item.bodyIsHTML ? (
                    <div
                      className="text-carousel-body text-text-secondary leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayBody) }}
                      dir="auto"
                    />
                  ) : (
                    <p
                      className="text-carousel-body text-text-secondary leading-relaxed"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {displayBody}
                    </p>
                  ))}

                  {displaySource && (
                    <p className="text-carousel-body text-text-muted text-[0.9em] italic">— {displaySource}</p>
                  )}
                </div>
              </div>
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
