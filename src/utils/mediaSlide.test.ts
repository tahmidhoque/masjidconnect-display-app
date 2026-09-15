/**
 * Tests for MEDIA_SLIDE fit helpers — Smart Size stays in-zone; Cover is fullscreen.
 */

import { describe, it, expect } from 'vitest';
import {
  isViewportFullscreenFit,
  resolveMediaFit,
} from './mediaSlide';

describe('resolveMediaFit', () => {
  it('prefers an explicit mediaFit value', () => {
    expect(resolveMediaFit({ mediaFit: 'smart', fullscreen: true })).toBe('smart');
    expect(resolveMediaFit({ mediaFit: 'cover' })).toBe('cover');
    expect(resolveMediaFit({ mediaFit: 'contain' })).toBe('contain');
  });

  it('maps legacy fullscreen true to cover and false to contain', () => {
    expect(resolveMediaFit({ fullscreen: true })).toBe('cover');
    expect(resolveMediaFit({ fullscreen: false })).toBe('contain');
    expect(resolveMediaFit({})).toBe('contain');
  });
});

describe('isViewportFullscreenFit', () => {
  it('is true only for Cover — Smart Size and Contain stay in the content zone', () => {
    expect(isViewportFullscreenFit('cover')).toBe(true);
    expect(isViewportFullscreenFit('smart')).toBe(false);
    expect(isViewportFullscreenFit('contain')).toBe(false);
  });
});
