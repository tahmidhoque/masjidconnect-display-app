/**
 * contentScaling.ts
 *
 * Content-aware adaptive typography system for the ContentCarousel.
 *
 * Instead of applying a uniform CSS `transform: scale()` to all content,
 * this module classifies content by density (character count, type, number
 * of text blocks) and returns per-element font-size multipliers that are
 * applied via CSS custom properties. Short content gets display-size fonts;
 * long content gets compact fonts with an optional auto-scroll fallback.
 *
 * The binary-search fit loop lives in the carousel component itself (it
 * needs DOM measurements); this module provides the initial tier and the
 * bounds for that search.
 */

import { getEventDescription } from '@/utils/eventUtils';
import type { CarouselItem } from './ContentCarousel';
import type { EventV2 } from '@/api/models';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Character-count thresholds that separate density tiers. */
const TIER_THRESHOLDS = {
  MINIMAL: 50,
  SHORT: 200,
  MEDIUM: 500,
} as const;

/**
 * Base rem sizes that the CSS carousel classes use (the middle clamp value).
 * These are the "1×" reference — multipliers are applied on top of these.
 */
const BASE_SIZES = {
  title: 1.5,
  body: 1.05,
  arabic: 1.6,
} as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DensityTier = 1 | 2 | 3 | 4;

export interface TierConfig {
  /** Human-readable label for debugging / logging */
  label: string;
  /** Starting multiplier for the binary-search fit loop */
  baseMultiplier: number;
  /** Lowest the fit loop is allowed to go before triggering auto-scroll */
  minMultiplier: number;
  /** Highest the fit loop is allowed to go */
  maxMultiplier: number;
  /** Per-element multiplier overrides (relative to baseMultiplier) */
  elementWeights: {
    title: number;
    body: number;
    arabic: number;
  };
}

export interface FontSizeConfig {
  titleSize: number;
  bodySize: number;
  arabicSize: number;
}

export interface ScalingResult {
  tier: DensityTier;
  config: TierConfig;
  /** Initial font sizes (rem) before the fit loop adjusts them */
  initialSizes: FontSizeConfig;
  /** Per-item body font size multiplier (small: 0.85, medium: 1, large: 1.2) */
  bodyFontSizeMultiplier: number;
}

/* ------------------------------------------------------------------ */
/*  Tier definitions                                                   */
/* ------------------------------------------------------------------ */

const TIER_CONFIGS: Record<DensityTier, TierConfig> = {
  1: {
    label: 'minimal',
    baseMultiplier: 2.2,
    minMultiplier: 1.2,
    maxMultiplier: 3.0,
    elementWeights: { title: 1.0, body: 1.0, arabic: 1.15 },
  },
  2: {
    label: 'short',
    baseMultiplier: 1.6,
    minMultiplier: 1.0,
    maxMultiplier: 2.4,
    elementWeights: { title: 1.0, body: 1.0, arabic: 1.1 },
  },
  3: {
    label: 'medium',
    baseMultiplier: 1.0,
    minMultiplier: 0.75,
    maxMultiplier: 1.5,
    elementWeights: { title: 1.0, body: 1.0, arabic: 1.0 },
  },
  4: {
    label: 'long',
    baseMultiplier: 0.85,
    minMultiplier: 0.6,
    maxMultiplier: 1.1,
    elementWeights: { title: 0.9, body: 1.0, arabic: 0.95 },
  },
};

/* ------------------------------------------------------------------ */
/*  Density classification                                             */
/* ------------------------------------------------------------------ */

/**
 * Strip HTML tags and decode the most common entities so density
 * classification counts visible characters only. Without this, a body
 * like `<ul><li>Item</li></ul>` is measured as ~25 chars rather than 4
 * and gets pushed into a smaller density tier than it deserves.
 *
 * This is a deliberately small, pure utility — the carousel still uses
 * `sanitizeHtml` (DOMPurify) when rendering. Measurement does not need
 * the security guarantees of a full parser.
 */
export function visibleTextLength(value: string | undefined | null): number {
  if (!value) return 0;
  // 1. Remove tags. 2. Collapse common whitespace. 3. Decode the handful
  //    of entities that show up in announcement/event text.
  const stripped = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length;
}

/**
 * Count the total visible characters across all text fields of a
 * carousel item. HTML tags do not count — only the rendered text does,
 * so equivalent items sent as plain `CUSTOM` text or as HTML
 * `ANNOUNCEMENT` text classify into the same density tier.
 */
function countChars(item: CarouselItem): number {
  let total = 0;
  total += visibleTextLength(item.title);
  total += visibleTextLength(item.body);
  total += visibleTextLength(item.arabicBody);
  total += visibleTextLength(item.transliteration);
  total += visibleTextLength(item.source);

  // Asma al-Husna: only the single selected name is shown, not the full list
  if (item.names && item.names.length > 0) {
    const sample = item.names[0];
    total += visibleTextLength(sample.arabic)
           + visibleTextLength(sample.transliteration)
           + visibleTextLength(sample.meaning);
  }

  return total;
}

/**
 * Count distinct rendered text blocks. More blocks = less vertical space
 * per block, so the tier may need to be pushed towards compact sizing.
 */
function countTextBlocks(item: CarouselItem): number {
  let blocks = 0;
  if (item.title || item.names) blocks++;
  if (item.arabicBody || item.names) blocks++;
  if (item.transliteration) blocks++;
  if (item.body || item.names) blocks++;
  if (item.source) blocks++;
  return blocks;
}

/**
 * Map an effective visible-character count to a density tier.
 * Shared between every content type so that two items with the same
 * visible text and block count classify the same way regardless of
 * whether they came in as `ANNOUNCEMENT`, `CUSTOM`, or another type.
 */
function tierForChars(effectiveChars: number): DensityTier {
  if (effectiveChars < TIER_THRESHOLDS.MINIMAL) return 1;
  if (effectiveChars < TIER_THRESHOLDS.SHORT) return 2;
  if (effectiveChars < TIER_THRESHOLDS.MEDIUM) return 3;
  return 4;
}

/**
 * Classify a carousel item into one of four density tiers based on its
 * text content length, type, and number of distinct text blocks.
 *
 * Sizing is driven by visible content, not content type. Type-specific
 * adjustments are only applied where the slide layout itself differs
 * (Asma al-Husna, Dua) — never to make `ANNOUNCEMENT` and `CUSTOM`
 * items with the same visible text render at radically different sizes.
 *
 * The tier drives the initial font-size multipliers and the min/max
 * bounds for the binary-search fit loop.
 */
export function classifyContentDensity(item: CarouselItem): DensityTier {
  const chars = countChars(item);
  const blocks = countTextBlocks(item);
  const type = item.type?.toLowerCase() ?? '';

  // Asma al-Husna is always minimal — single name display
  if (type === 'asma_al_husna') return 1;

  // More blocks = denser layout. Each block beyond 2 adds ~40 effective chars.
  const blockPenalty = Math.max(0, blocks - 2) * 40;
  const effectiveChars = chars + blockPenalty;
  const naturalTier = tierForChars(effectiveChars);

  // Dua: bump one tier larger (tier 4→3, 3→2, 2→1) — minimum was too small;
  // overflow uses auto-scroll instead of scaling down further.
  if (type === 'dua') {
    return Math.max(1, naturalTier - 1) as DensityTier;
  }

  return naturalTier;
}

/* ------------------------------------------------------------------ */
/*  Font size computation                                              */
/* ------------------------------------------------------------------ */

/**
 * Map per-item bodyFontSize to a numeric multiplier for body text only.
 */
export function getBodyFontSizeMultiplier(size?: 'small' | 'medium' | 'large'): number {
  switch (size) {
    case 'small': return 0.85;
    case 'large': return 1.2;
    default: return 1;
  }
}

/**
 * Compute initial font sizes (in rem) for a given multiplier and tier.
 * These are applied as CSS custom properties on the content wrapper.
 * The binary-search fit loop in the carousel will adjust the multiplier
 * up or down from here.
 * @param bodyFontSizeMultiplier - Optional multiplier for body size only (small: 0.85, large: 1.2)
 */
export function computeFontSizes(
  tier: DensityTier,
  multiplier: number,
  bodyFontSizeMultiplier: number = 1,
): FontSizeConfig {
  const config = TIER_CONFIGS[tier];
  const weights = config.elementWeights;

  return {
    titleSize:  Math.round((BASE_SIZES.title * multiplier * weights.title) * 100) / 100,
    bodySize:   Math.round((BASE_SIZES.body * multiplier * weights.body * bodyFontSizeMultiplier) * 100) / 100,
    arabicSize: Math.round((BASE_SIZES.arabic * multiplier * weights.arabic) * 100) / 100,
  };
}

/**
 * Main entry point: classify the item and return the tier config plus
 * initial font sizes. The carousel uses these as the starting point
 * for its binary-search fit loop.
 */
export function getScalingForItem(item: CarouselItem): ScalingResult {
  const tier = classifyContentDensity(item);
  const config = TIER_CONFIGS[tier];
  const bodyFontSizeMultiplier = getBodyFontSizeMultiplier(item.bodyFontSize);
  const initialSizes = computeFontSizes(tier, config.baseMultiplier, bodyFontSizeMultiplier);

  return { tier, config, initialSizes, bodyFontSizeMultiplier };
}

/**
 * Scaling for EventSlide — classifies by title + description length
 * so event slides participate in the fit loop and safety scale.
 */
export function getScalingForEvent(event: EventV2): ScalingResult {
  const desc = getEventDescription(event);
  const chars = (event.title?.length ?? 0) + (desc?.length ?? 0) + 80; // +80 for date, venue, capacity UI
  let tier: DensityTier = 4;
  if (chars < TIER_THRESHOLDS.MINIMAL) tier = 1;
  else if (chars < TIER_THRESHOLDS.SHORT) tier = 2;
  else if (chars < TIER_THRESHOLDS.MEDIUM) tier = 3;

  const config = TIER_CONFIGS[tier];
  const initialSizes = computeFontSizes(tier, config.baseMultiplier);
  return { tier, config, initialSizes, bodyFontSizeMultiplier: 1 };
}

/**
 * Returns the tier configuration (multiplier bounds, element weights)
 * for a given density tier.
 */
export function getTierConfig(tier: DensityTier): TierConfig {
  return TIER_CONFIGS[tier];
}

/* ------------------------------------------------------------------ */
/*  Auto-scroll constants (used by the carousel component)             */
/* ------------------------------------------------------------------ */

/** Pixels per second for the auto-scroll animation */
export const AUTO_SCROLL_SPEED = 30;

/** Pause duration (ms) at the top before scrolling begins */
export const AUTO_SCROLL_PAUSE_TOP = 3000;

/** Pause duration (ms) at the bottom before resetting to top */
export const AUTO_SCROLL_PAUSE_BOTTOM = 3000;
