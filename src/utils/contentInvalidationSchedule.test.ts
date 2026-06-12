import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clearInvalidationCoalesceMap,
  getInvalidationTrailingMs,
  invalidationCoalesceKey,
  scheduleInvalidationRefetch,
  usesTrailingOnlyInvalidation,
  type InvalidationCoalesceState,
} from './contentInvalidationSchedule';

describe('contentInvalidationSchedule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a longer settle window for display_layout than generic content', () => {
    expect(getInvalidationTrailingMs('display_layout')).toBe(400);
    expect(getInvalidationTrailingMs('content_item')).toBe(600);
  });

  it('treats display_layout as trailing-only (no immediate refetch)', () => {
    expect(usesTrailingOnlyInvalidation('display_layout')).toBe(true);
    expect(usesTrailingOnlyInvalidation('content_item')).toBe(false);
  });

  it('defers display_layout refetch until after settle delay', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'display_layout', run);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(getInvalidationTrailingMs('display_layout') - 1);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('resets trailing timer when burst display_layout invalidations arrive', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'display_layout', run);
    vi.advanceTimersByTime(200);
    scheduleInvalidationRefetch(map, 'display_layout', run);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(getInvalidationTrailingMs('display_layout'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs the leading-edge refetch immediately for content_item', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'content_item', run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('schedules a single trailing refetch for burst content invalidations', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'content_item', run);
    expect(run).toHaveBeenCalledTimes(1);

    scheduleInvalidationRefetch(map, 'content_item', run);
    expect(run).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(getInvalidationTrailingMs('content_item'));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('scopes coalesce keys by entityId when provided', () => {
    expect(invalidationCoalesceKey('display_layout', 'layout-1')).toBe(
      'display_layout:layout-1',
    );
    expect(invalidationCoalesceKey('display_layout')).toBe('display_layout');
  });

  it('clears all pending timers', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'display_layout', run);
    clearInvalidationCoalesceMap(map);

    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
  });
});
