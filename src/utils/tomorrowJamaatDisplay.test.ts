import { describe, expect, it } from 'vitest';
import type { DisplaySettings } from '@/api/models';
import {
  isPrayerJamaatPhaseComplete,
  isPrayerSlotComplete,
  resolvePrayerJamaatDisplay,
  resolvePrayerTimesDisplay,
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

describe('isPrayerSlotComplete', () => {
  it('rolls sunrise after the sunrise time has passed', () => {
    expect(isPrayerSlotComplete('Sunrise', '06:30', undefined, baseSettings, 6 * 60 + 31)).toBe(true);
  });

  it('does not roll sunrise before the sunrise time', () => {
    expect(isPrayerSlotComplete('Sunrise', '06:30', undefined, baseSettings, 6 * 60 + 15)).toBe(false);
  });

  it('still waits for the jamaat window on prayers with congregation', () => {
    expect(
      isPrayerSlotComplete('Zuhr', '13:00', '13:30', baseSettings, 13 * 60 + 35),
    ).toBe(false);
    expect(
      isPrayerSlotComplete('Zuhr', '13:00', '13:30', baseSettings, 13 * 60 + 51),
    ).toBe(true);
  });
});

describe('resolvePrayerTimesDisplay', () => {
  const tomorrows = {
    Zuhr: { jamaat: '13:35', start: '13:05' },
    Sunrise: { jamaat: '', start: '06:32' },
  };

  it('keeps today start and jamaat in column mode', () => {
    const result = resolvePrayerTimesDisplay({
      prayerName: 'Zuhr',
      todayStart: '13:00',
      todayJamaat: '13:30',
      tomorrowsJamaats: tomorrows,
      mode: 'column',
      displaySettings: baseSettings,
      nowMin: 14 * 60,
      jummahLabel: 'Jumuah',
      zuhrLabel: 'Zuhr',
    });
    expect(result?.startTime).toBe('13:00');
    expect(result?.jamaatTime).toBe('13:30');
    expect(result?.isRollForward).toBe(false);
  });

  it('swaps start and jamaat to tomorrow after the jamaat window', () => {
    const result = resolvePrayerTimesDisplay({
      prayerName: 'Zuhr',
      todayStart: '13:00',
      todayJamaat: '13:30',
      tomorrowsJamaats: tomorrows,
      mode: 'roll-forward',
      displaySettings: baseSettings,
      nowMin: 14 * 60,
      jummahLabel: 'Jumuah',
      zuhrLabel: 'Zuhr',
    });
    expect(result?.startTime).toBe('13:05');
    expect(result?.jamaatTime).toBe('13:35');
    expect(result?.isRollForward).toBe(true);
  });

  it('swaps sunrise to tomorrow after sunrise has passed', () => {
    const result = resolvePrayerTimesDisplay({
      prayerName: 'Sunrise',
      todayStart: '06:30',
      tomorrowsJamaats: tomorrows,
      mode: 'roll-forward',
      displaySettings: baseSettings,
      nowMin: 7 * 60,
      jummahLabel: 'Jumuah',
      zuhrLabel: 'Zuhr',
    });
    expect(result?.startTime).toBe('06:32');
    expect(result?.jamaatTime).toBeNull();
    expect(result?.isRollForward).toBe(true);
  });

  it('keeps today sunrise before sunrise time', () => {
    const result = resolvePrayerTimesDisplay({
      prayerName: 'Sunrise',
      todayStart: '06:30',
      tomorrowsJamaats: tomorrows,
      mode: 'roll-forward',
      displaySettings: baseSettings,
      nowMin: 6 * 60,
      jummahLabel: 'Jumuah',
      zuhrLabel: 'Zuhr',
    });
    expect(result?.startTime).toBe('06:30');
    expect(result?.isRollForward).toBe(false);
  });
});
