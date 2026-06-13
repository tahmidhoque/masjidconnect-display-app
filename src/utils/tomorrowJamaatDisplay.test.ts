import { describe, expect, it } from 'vitest';
import type { DisplaySettings } from '@/api/models';
import {
  isPrayerJamaatPhaseComplete,
  resolvePrayerJamaatDisplay,
  resolveTomorrowJamaatMode,
} from './tomorrowJamaatDisplay';

const baseSettings: DisplaySettings = {
  ramadanMode: 'auto',
  isRamadanActive: false,
  timeFormat: '24h',
  showImsak: false,
  showTomorrowJamaat: false,
  tomorrowJamaatMode: 'off',
  imsakOffset: 10,
  hijriDateAdjustment: 0,
  minutesAfterJamaatUntilNextPrayer: 10,
  defaultJamaatInProgressMinutes: 10,
  minutesAfterJamaatUntilNextPrayerBySalah: {},
};

describe('resolveTomorrowJamaatMode', () => {
  it('maps legacy showTomorrowJamaat true to column', () => {
    expect(resolveTomorrowJamaatMode({ showTomorrowJamaat: true })).toBe('column');
  });

  it('prefers explicit tomorrowJamaatMode', () => {
    expect(
      resolveTomorrowJamaatMode({
        tomorrowJamaatMode: 'roll-forward',
        showTomorrowJamaat: true,
      }),
    ).toBe('roll-forward');
  });
});

describe('isPrayerJamaatPhaseComplete', () => {
  it('is false before jamaat window ends', () => {
    expect(
      isPrayerJamaatPhaseComplete('Zuhr', '13:30', baseSettings, 13 * 60 + 35),
    ).toBe(false);
  });

  it('is true after jamaat + default window (10+10 min)', () => {
    // 13:30 jamaat + 20 min window → complete after 13:50
    expect(
      isPrayerJamaatPhaseComplete('Zuhr', '13:30', baseSettings, 13 * 60 + 51),
    ).toBe(true);
  });
});

describe('resolvePrayerJamaatDisplay', () => {
  const tomorrows = {
    Zuhr: { jamaat: '13:35' },
  };

  it('keeps today jamaat in column mode', () => {
    const result = resolvePrayerJamaatDisplay({
      prayerName: 'Zuhr',
      todayJamaat: '13:30',
      tomorrowsJamaats: tomorrows,
      mode: 'column',
      displaySettings: baseSettings,
      nowMin: 14 * 60,
      jummahLabel: 'Jumuah',
      zuhrLabel: 'Zuhr',
    });
    expect(result?.jamaatTime).toBe('13:30');
    expect(result?.isRollForward).toBe(false);
  });

  it('swaps to tomorrow after phase completes in roll-forward mode', () => {
    const result = resolvePrayerJamaatDisplay({
      prayerName: 'Zuhr',
      todayJamaat: '13:30',
      tomorrowsJamaats: tomorrows,
      mode: 'roll-forward',
      displaySettings: baseSettings,
      nowMin: 14 * 60,
      jummahLabel: 'Jumuah',
      zuhrLabel: 'Zuhr',
    });
    expect(result?.jamaatTime).toBe('13:35');
    expect(result?.isRollForward).toBe(true);
  });

  it('keeps today jamaat before phase completes in roll-forward mode', () => {
    const result = resolvePrayerJamaatDisplay({
      prayerName: 'Zuhr',
      todayJamaat: '13:30',
      tomorrowsJamaats: tomorrows,
      mode: 'roll-forward',
      displaySettings: baseSettings,
      nowMin: 13 * 60 + 40,
      jummahLabel: 'Jumuah',
      zuhrLabel: 'Zuhr',
    });
    expect(result?.jamaatTime).toBe('13:30');
    expect(result?.isRollForward).toBe(false);
  });
});
