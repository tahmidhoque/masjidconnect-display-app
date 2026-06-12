/**
 * Unit tests for scheduled supplication timing helpers.
 */

import { describe, it, expect } from 'vitest';
import type { DisplaySettings } from '@/api/models';
import {
  isPostAdhanSupplicationActive,
  postAdhanSupplicationDelayMinutes,
  postJamaatSupplicationDurationMinutes,
} from './displaySettingsSupplications';

const baseSettings = (): DisplaySettings => ({
  ramadanMode: 'auto',
  isRamadanActive: false,
  timeFormat: '12h',
  showImsak: false,
  showTomorrowJamaat: false,
  imsakOffset: 10,
  hijriDateAdjustment: 0,
  minutesAfterJamaatUntilNextPrayer: 10,
  defaultJamaatInProgressMinutes: 10,
  minutesAfterJamaatUntilNextPrayerBySalah: {},
  postAdhanSupplication: {
    enabled: true,
    delayMinutes: 2,
    durationMinutes: 5,
  },
  postJamaatSupplication: {
    enabled: true,
    durationMinutes: 4,
  },
  jamaatInProgressMode: 'screen',
});

describe('postAdhanSupplication timing', () => {
  it('is active inside the configured window after adhan', () => {
    const s = baseSettings();
    expect(isPostAdhanSupplicationActive(s, 12 * 60 + 2, 12 * 60, 12 * 60 + 30, 5)).toBe(true);
  });

  it('is inactive before delay elapses', () => {
    const s = baseSettings();
    expect(isPostAdhanSupplicationActive(s, 12 * 60 + 1, 12 * 60, 12 * 60 + 30, 5)).toBe(false);
  });

  it('is inactive inside the silent-phones lead window', () => {
    const s = baseSettings();
    const jamaat = 12 * 60 + 30;
    expect(isPostAdhanSupplicationActive(s, jamaat - 4, 12 * 60, jamaat, 5)).toBe(false);
  });

  it('is inactive when disabled', () => {
    const s = { ...baseSettings(), postAdhanSupplication: { enabled: false, delayMinutes: 0, durationMinutes: 3 } };
    expect(isPostAdhanSupplicationActive(s, 12 * 60, 12 * 60, 12 * 60 + 30, 5)).toBe(false);
  });

  it('clamps delay and duration', () => {
    const s = {
      ...baseSettings(),
      postAdhanSupplication: { enabled: true, delayMinutes: 99, durationMinutes: 0 },
    };
    expect(postAdhanSupplicationDelayMinutes(s)).toBe(15);
    expect(postJamaatSupplicationDurationMinutes(s)).toBe(4);
  });
});
