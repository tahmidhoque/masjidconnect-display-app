/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cyclePrayerDisplayDevState,
  resolvePrayerDisplayDevOverride,
  toggleAdhanSupplicationDevForce,
  toggleJamaatBlackoutDevForce,
  clearPrayerDisplayDevOverrides,
} from './prayerDisplayDevOverride';

describe('prayerDisplayDevOverride', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true);
    clearPrayerDisplayDevOverrides();
  });

  afterEach(() => {
    clearPrayerDisplayDevOverrides();
    vi.unstubAllEnvs();
  });

  it('cycles from auto to jamaat-soon then post-adhan supplication', () => {
    expect(resolvePrayerDisplayDevOverride('Asr')).toBeNull();

    cyclePrayerDisplayDevState();
    expect(resolvePrayerDisplayDevOverride('Asr')).toMatchObject({
      phase: 'jamaat-soon',
    });

    cyclePrayerDisplayDevState();
    expect(resolvePrayerDisplayDevOverride('Asr')).toMatchObject({
      phase: 'countdown-jamaat',
      adhanSupplicationActive: true,
    });
  });

  it('toggleAdhanSupplicationDevForce shows post-adhan supplication', () => {
    toggleAdhanSupplicationDevForce();
    expect(resolvePrayerDisplayDevOverride('Maghrib')).toMatchObject({
      adhanSupplicationActive: true,
      phase: 'countdown-jamaat',
    });

    toggleAdhanSupplicationDevForce();
    expect(resolvePrayerDisplayDevOverride('Maghrib')).toBeNull();
  });

  it('toggleJamaatBlackoutDevForce pins in-prayer jamaat sub-phase', () => {
    toggleJamaatBlackoutDevForce();
    expect(resolvePrayerDisplayDevOverride('Isha')).toMatchObject({
      phase: 'in-prayer',
      inPrayerSubPhase: 'jamaat',
    });
    expect(window.__JAMAAT_BLACKOUT_FORCE).toBe(true);
  });
});
