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

  it('uses settle window for layout and playlist-related invalidations', () => {
    expect(getInvalidationTrailingMs('display_layout')).toBe(400);
    expect(getInvalidationTrailingMs('content_item')).toBe(400);
    expect(getInvalidationTrailingMs('prayer_times')).toBe(600);
  });

  it('treats layout and playlist saves as trailing-only (no immediate refetch)', () => {
    expect(usesTrailingOnlyInvalidation('display_layout')).toBe(true);
    expect(usesTrailingOnlyInvalidation('content_item')).toBe(true);
    expect(usesTrailingOnlyInvalidation('prayer_times')).toBe(false);
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

  it('defers content_item refetch until after settle delay', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'content_item', run);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(getInvalidationTrailingMs('content_item'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('resets trailing timer when burst content_item invalidations arrive', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'content_item', run);
    vi.advanceTimersByTime(200);
    scheduleInvalidationRefetch(map, 'content_item', run);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(getInvalidationTrailingMs('content_item'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs the leading-edge refetch immediately for prayer_times', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'prayer_times', run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('schedules a single trailing refetch for burst prayer_times invalidations', () => {
    const map = new Map<string, InvalidationCoalesceState>();
    const run = vi.fn();

    scheduleInvalidationRefetch(map, 'prayer_times', run);
    expect(run).toHaveBeenCalledTimes(1);

    scheduleInvalidationRefetch(map, 'prayer_times', run);
    expect(run).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(getInvalidationTrailingMs('prayer_times'));
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
