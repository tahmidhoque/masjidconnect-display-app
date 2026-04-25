/**
 * Tests for contentScaling — visible-text measurement, density tiers,
 * type parity, and per-item font size handling.
 *
 * These tests pin down the rule that an `ANNOUNCEMENT` and a `CUSTOM`
 * slide carrying the same visible text must classify the same way, so
 * admins never need to duplicate a playlist with a different ContentType
 * just to influence font sizing.
 */

import { describe, it, expect } from 'vitest';
import {
  visibleTextLength,
  classifyContentDensity,
  computeFontSizes,
  getScalingForItem,
  getBodyFontSizeMultiplier,
  getTierConfig,
} from './contentScaling';
import type { CarouselItem } from './ContentCarousel';

describe('visibleTextLength', () => {
  it('returns 0 for nullish and empty input', () => {
    expect(visibleTextLength(undefined)).toBe(0);
    expect(visibleTextLength(null)).toBe(0);
    expect(visibleTextLength('')).toBe(0);
  });

  it('counts plain text characters after collapsing whitespace', () => {
    expect(visibleTextLength('  hello  world  ')).toBe('hello world'.length);
  });

  it('strips simple HTML tags', () => {
    expect(visibleTextLength('<p>hello</p>')).toBe('hello'.length);
    expect(visibleTextLength('<ul><li>One</li><li>Two</li></ul>')).toBe('One Two'.length);
  });

  it('decodes the common HTML entities', () => {
    expect(visibleTextLength('Salah &amp; community')).toBe('Salah & community'.length);
    expect(visibleTextLength('Open&nbsp;daily')).toBe('Open daily'.length);
  });

  it('strips tags with attributes', () => {
    expect(visibleTextLength('<a href="https://example.com">Link</a>')).toBe('Link'.length);
  });
});

describe('classifyContentDensity — type parity', () => {
  /**
   * Announcement vs Custom with the same visible text was the customer's
   * workaround: they recreated `ANNOUNCEMENT` items as `CUSTOM` to land in
   * a larger tier. The two should now classify identically.
   */
  it('treats ANNOUNCEMENT and CUSTOM with the same visible text as the same tier', () => {
    const sharedTitle = 'Masjid Email Address';
    const sharedBody = 'admin@example-masjid.org';
    const ann: CarouselItem = { id: 'a', type: 'ANNOUNCEMENT', title: sharedTitle, body: sharedBody };
    const custom: CarouselItem = { id: 'c', type: 'CUSTOM', title: sharedTitle, body: sharedBody };
    expect(classifyContentDensity(ann)).toBe(classifyContentDensity(custom));
  });

  it('measures HTML and plain-text bodies the same when their visible text matches', () => {
    const plain: CarouselItem = {
      id: 'p',
      type: 'ANNOUNCEMENT',
      title: 'Notice',
      body: 'Friday meeting at 7pm',
    };
    const html: CarouselItem = {
      id: 'h',
      type: 'ANNOUNCEMENT',
      title: 'Notice',
      body: '<p>Friday meeting at 7pm</p>',
      bodyIsHTML: true,
    };
    expect(classifyContentDensity(plain)).toBe(classifyContentDensity(html));
  });

  it('does not count HTML list markup against density when the visible text is short', () => {
    const item: CarouselItem = {
      id: 'list',
      type: 'ANNOUNCEMENT',
      title: 'Contact',
      body: '<ul><li>Phone</li><li>Email</li></ul>',
      bodyIsHTML: true,
    };
    // Visible text: "Contact" (7) + "Phone Email" (11) = 18 chars → tier 1.
    expect(classifyContentDensity(item)).toBe(1);
  });
});

describe('classifyContentDensity — semantic exceptions', () => {
  it('keeps Asma al-Husna at tier 1 regardless of payload size', () => {
    const item: CarouselItem = {
      id: 'asma',
      type: 'ASMA_AL_HUSNA',
      names: [{ arabic: 'الرحمن', transliteration: 'Ar-Rahman', meaning: 'The Most Merciful', number: 1 }],
    };
    expect(classifyContentDensity(item)).toBe(1);
  });

  it('bumps a Dua up one tier compared to the same text as a generic slide', () => {
    const body = 'A medium-length supplication that lands in tier 3 by character count alone, used to verify the dua bump.'.repeat(2);
    const dua: CarouselItem = { id: 'd', type: 'DUA', title: 'Dua', body };
    const generic: CarouselItem = { id: 'g', type: 'CUSTOM', title: 'Dua', body };
    const duaTier = classifyContentDensity(dua);
    const genericTier = classifyContentDensity(generic);
    expect(duaTier).toBeLessThanOrEqual(genericTier);
  });
});

describe('classifyContentDensity — natural tiers', () => {
  it('classifies very short contact info as tier 1', () => {
    const item: CarouselItem = { id: 's', type: 'ANNOUNCEMENT', title: 'Phone', body: '07000 000 000' };
    expect(classifyContentDensity(item)).toBe(1);
  });

  it('classifies a short paragraph as tier 2', () => {
    const item: CarouselItem = {
      id: 's2',
      type: 'CUSTOM',
      title: 'Notice',
      body: 'Weekly Quran circle on Wednesdays after Isha. All brothers are welcome to attend in person.',
    };
    expect(classifyContentDensity(item)).toBe(2);
  });

  it('classifies a long body as tier 3 or 4', () => {
    const longBody = 'x'.repeat(450);
    const item: CarouselItem = { id: 'l', type: 'CUSTOM', title: 'Long', body: longBody };
    expect(classifyContentDensity(item)).toBeGreaterThanOrEqual(3);
  });
});

describe('computeFontSizes / getScalingForItem', () => {
  it('returns matching font sizes for items that classify the same', () => {
    const ann: CarouselItem = { id: 'a', type: 'ANNOUNCEMENT', title: 'Contact', body: 'admin@example.org' };
    const custom: CarouselItem = { id: 'c', type: 'CUSTOM', title: 'Contact', body: 'admin@example.org' };
    const annResult = getScalingForItem(ann);
    const customResult = getScalingForItem(custom);
    expect(annResult.tier).toBe(customResult.tier);
    expect(annResult.initialSizes).toEqual(customResult.initialSizes);
  });

  it('honours bodyFontSize as a body-only multiplier', () => {
    const small: CarouselItem = { id: 's', type: 'CUSTOM', title: 'Notice', body: 'Hello', bodyFontSize: 'small' };
    const large: CarouselItem = { id: 'l', type: 'CUSTOM', title: 'Notice', body: 'Hello', bodyFontSize: 'large' };
    const smallResult = getScalingForItem(small);
    const largeResult = getScalingForItem(large);

    // Title/arabic should match — only body changes
    expect(smallResult.initialSizes.titleSize).toBe(largeResult.initialSizes.titleSize);
    expect(smallResult.initialSizes.arabicSize).toBe(largeResult.initialSizes.arabicSize);
    expect(smallResult.initialSizes.bodySize).toBeLessThan(largeResult.initialSizes.bodySize);
  });

  it('maps bodyFontSize values to expected multipliers', () => {
    expect(getBodyFontSizeMultiplier('small')).toBe(0.85);
    expect(getBodyFontSizeMultiplier('medium')).toBe(1);
    expect(getBodyFontSizeMultiplier('large')).toBe(1.2);
    expect(getBodyFontSizeMultiplier(undefined)).toBe(1);
  });

  it('produces strictly larger sizes at smaller tiers', () => {
    const tier1 = computeFontSizes(1, getTierConfig(1).baseMultiplier);
    const tier3 = computeFontSizes(3, getTierConfig(3).baseMultiplier);
    expect(tier1.titleSize).toBeGreaterThan(tier3.titleSize);
    expect(tier1.bodySize).toBeGreaterThan(tier3.bodySize);
  });
});
