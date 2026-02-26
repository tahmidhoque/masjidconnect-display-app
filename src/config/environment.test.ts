/**
 * Unit tests for environment config.
 */

import { describe, it, expect } from 'vitest';
import config, { DEFAULTS, apiUrl, realtimeUrl, isDevMode, isProduction } from './environment';

describe('environment', () => {
  it('exports default config with required shape', () => {
    expect(config).toMatchObject({
      apiUrl: expect.any(String),
      realtimeUrl: expect.any(String),
      isDevelopment: expect.any(Boolean),
      isProduction: expect.any(Boolean),
      heartbeatInterval: expect.any(Number),
      heartbeatFastInterval: expect.any(Number),
      contentSyncInterval: expect.any(Number),
      prayerTimesSyncInterval: expect.any(Number),
      eventsSyncInterval: expect.any(Number),
      prayerStatusInterval: expect.any(Number),
      maxRetries: expect.any(Number),
      initialRetryDelay: expect.any(Number),
      maxRetryDelay: expect.any(Number),
    });
  });

  it('exports named apiUrl and realtimeUrl', () => {
    expect(apiUrl).toBe(config.apiUrl);
    expect(realtimeUrl).toBe(config.realtimeUrl);
  });

  it('exports isDevMode and isProduction', () => {
    expect(isDevMode).toBe(config.isDevelopment);
    expect(isProduction).toBe(config.isProduction);
  });

  it('apiUrl and realtimeUrl have no trailing slashes', () => {
    expect(apiUrl).not.toMatch(/\/+$/);
    expect(realtimeUrl).not.toMatch(/\/+$/);
  });

  it('DEFAULTS contains production URLs', () => {
    expect(DEFAULTS.PRODUCTION_API_URL).toBe('https://portal.masjidconnect.co.uk');
    expect(DEFAULTS.PRODUCTION_REALTIME_URL).toBe('https://masjidconnect-realtime.fly.dev');
  });

  it('DEFAULTS contains sync intervals', () => {
    expect(DEFAULTS.HEARTBEAT_INTERVAL).toBe(30_000);
    expect(DEFAULTS.CONTENT_SYNC_INTERVAL).toBe(5 * 60_000);
    expect(DEFAULTS.PRAYER_TIMES_SYNC_INTERVAL).toBe(24 * 60 * 60_000);
  });
});
