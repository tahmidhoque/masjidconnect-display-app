/**
 * Tests for useRotationHandling hook.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRotationHandling } from './useRotationHandling';

describe('useRotationHandling', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    });
  });

  it('returns shouldRotate and physicalOrientation', () => {
    const { result } = renderHook(() => useRotationHandling('LANDSCAPE'));
    expect(result.current).toHaveProperty('shouldRotate');
    expect(result.current).toHaveProperty('physicalOrientation');
    expect(['LANDSCAPE', 'PORTRAIT']).toContain(result.current.physicalOrientation);
  });

  it('shouldRotate is true when physical is PORTRAIT and desired is LANDSCAPE', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const { result } = renderHook(() => useRotationHandling('LANDSCAPE'));
    expect(result.current.physicalOrientation).toBe('PORTRAIT');
    expect(result.current.shouldRotate).toBe(true);
  });

  it('shouldRotate is false when physical matches desired', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
    const { result } = renderHook(() => useRotationHandling('LANDSCAPE'));
    expect(result.current.physicalOrientation).toBe('LANDSCAPE');
    expect(result.current.shouldRotate).toBe(false);
  });
});
