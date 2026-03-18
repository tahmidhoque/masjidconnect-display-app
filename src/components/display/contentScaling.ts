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
 * Count the total visible characters across all text fields of a
 * carousel item. Fields that are absent or empty contribute 0.
 */
function countChars(item: CarouselItem): number {
  let total = 0;
  if (item.title) total += item.title.length;
  if (item.body) total += item.body.length;
  if (item.arabicBody) total += item.arabicBody.length;
  if (item.transliteration) total += item.transliteration.length;
  if (item.source) total += item.source.length;

  // Asma al-Husna: only the single selected name is shown, not the full list
  if (item.names && item.names.length > 0) {
    const sample = item.names[0];
    total += (sample.arabic?.length ?? 0)
           + (sample.transliteration?.length ?? 0)
           + (sample.meaning?.length ?? 0);
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
 * Classify a carousel item into one of four density tiers based on its
 * text content length, type, and number of distinct text blocks.
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

  // Dua: bump one tier larger (tier 4→3, 3→2, 2→1) — minimum was too small;
  // overflow uses auto-scroll instead of scaling down further.
  if (type === 'dua') {
    const blockPenalty = Math.max(0, blocks - 2) * 40;
    const effectiveChars = chars + blockPenalty;
    let naturalTier: DensityTier = 4;
    if (effectiveChars < TIER_THRESHOLDS.MINIMAL) naturalTier = 1;
    else if (effectiveChars < TIER_THRESHOLDS.SHORT) naturalTier = 2;
    else if (effectiveChars < TIER_THRESHOLDS.MEDIUM) naturalTier = 3;
    return Math.max(1, naturalTier - 1) as DensityTier;
  }

  // Announcements: never use tier 1 or 2 — display-size fonts look out of place;
  // tier 3 (standard sizing) is the floor so they match the rest of the app.
  if (type === 'announcement') {
    const blockPenalty = Math.max(0, blocks - 2) * 40;
    const effectiveChars = chars + blockPenalty;
    if (effectiveChars < TIER_THRESHOLDS.MINIMAL) return 3;
    if (effectiveChars < TIER_THRESHOLDS.SHORT) return 3;
    if (effectiveChars < TIER_THRESHOLDS.MEDIUM) return 3;
    return 4;
  }

  // Adjust effective char count: more text blocks = denser visual layout
  // Each extra block beyond 2 adds a penalty equivalent to ~40 chars
  const blockPenalty = Math.max(0, blocks - 2) * 40;
  const effectiveChars = chars + blockPenalty;

  if (effectiveChars < TIER_THRESHOLDS.MINIMAL) return 1;
  if (effectiveChars < TIER_THRESHOLDS.SHORT) return 2;
  if (effectiveChars < TIER_THRESHOLDS.MEDIUM) return 3;
  return 4;
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
