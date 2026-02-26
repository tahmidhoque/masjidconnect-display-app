/**
 * Unit tests for metricsCollector.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectMetrics } from './metricsCollector';

describe('collectMetrics', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (typeof window !== 'undefined' && 'companionService' in window) {
      delete (window as { companionService?: unknown }).companionService;
    }
  });

  it('returns status ONLINE', async () => {
    const result = await collectMetrics();
    expect(result.status).toBe('ONLINE');
  });

  it('includes resolution from screen when available', async () => {
    Object.defineProperty(globalThis, 'screen', {
      value: { width: 1920, height: 1080 },
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.resolution).toBe('1920x1080');
  });

  it('includes currentContentId when passed', async () => {
    const result = await collectMetrics('slide-123');
    expect(result.currentContent).toBe('slide-123');
  });

  it('includes memoryUsage from performance.memory when available (Chrome)', async () => {
    const perf = {
      memory: {
        usedJSHeapSize: 50_000_000,
        jsHeapSizeLimit: 100_000_000,
        totalJSHeapSize: 80_000_000,
      },
    };
    Object.defineProperty(globalThis, 'performance', {
      value: { ...globalThis.performance, ...perf },
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.memoryUsage).toBe(50);
  });

  it('skips memory when jsHeapSizeLimit is 0', async () => {
    const perf = {
      memory: {
        usedJSHeapSize: 50,
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
      },
    };
    Object.defineProperty(globalThis, 'performance', {
      value: { ...globalThis.performance, ...perf },
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.memoryUsage).toBeUndefined();
  });

  it('includes connectionType from navigator.connection when available', async () => {
    const nav = {
      ...globalThis.navigator,
      connection: { type: 'wifi', effectiveType: '4g', rtt: 50, downlink: 10 },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: nav,
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.connectionType).toBe('WIFI');
    expect(result.networkLatency).toBe(50);
    expect(result.bandwidthUsage).toBe(10);
  });

  it('uses effectiveType when type is missing', async () => {
    const nav = {
      ...globalThis.navigator,
      connection: { effectiveType: '3g' },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: nav,
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.connectionType).toBe('3G');
  });

  it('fetches companion metrics when window.companionService is set', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          cpuUsage: 25,
          temperature: 45,
          storageUsed: 2.5,
          memoryUsage: 60,
        }),
    });
    globalThis.fetch = mockFetch;
    Object.defineProperty(window, 'companionService', {
      value: { baseUrl: 'http://localhost:9999' },
      configurable: true,
      writable: true,
    });

    const result = await collectMetrics();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9999/system-info',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.cpuUsage).toBe(25);
    expect(result.temperature).toBe(45);
    expect(result.storageUsed).toBe(2.5);
    expect(result.memoryUsage).toBe(60);
  });

  it('returns empty companion metrics when baseUrl is missing', async () => {
    Object.defineProperty(window, 'companionService', {
      value: {},
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.cpuUsage).toBeUndefined();
  });

  it('handles companion fetch failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    Object.defineProperty(window, 'companionService', {
      value: { baseUrl: 'http://localhost:9999' },
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.status).toBe('ONLINE');
    expect(result.cpuUsage).toBeUndefined();
  });

  it('handles companion non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    Object.defineProperty(window, 'companionService', {
      value: { baseUrl: 'http://localhost:9999' },
      configurable: true,
      writable: true,
    });
    const result = await collectMetrics();
    expect(result.cpuUsage).toBeUndefined();
  });
});
