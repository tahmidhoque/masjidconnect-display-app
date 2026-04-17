/**
 * Tests for JamaatSoonSlot helpers — pure logic only (eligibility + diff).
 * Component cycling is exercised manually via the dev keyboard shortcut
 * (Ctrl+Shift+M) and the existing jamaat-soon phase override (Ctrl+Shift+J).
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseHHmm,
  resolveTomorrowChange,
  TOMORROW_CHANGE_ELIGIBLE_PRAYERS,
} from './JamaatSoonSlot';

describe('normaliseHHmm', () => {
  it('returns padded HH:mm for valid times', () => {
    expect(normaliseHHmm('13:30')).toBe('13:30');
    expect(normaliseHHmm('9:05')).toBe('09:05');
    expect(normaliseHHmm('00:00')).toBe('00:00');
    expect(normaliseHHmm('23:59')).toBe('23:59');
  });

  it('strips a seconds suffix', () => {
    expect(normaliseHHmm('13:30:00')).toBe('13:30');
    expect(normaliseHHmm('07:15:42')).toBe('07:15');
  });

  it('trims whitespace', () => {
    expect(normaliseHHmm('  13:30  ')).toBe('13:30');
  });

  it('returns null for invalid input', () => {
    expect(normaliseHHmm('')).toBeNull();
    expect(normaliseHHmm(undefined)).toBeNull();
    expect(normaliseHHmm(null)).toBeNull();
    expect(normaliseHHmm('not a time')).toBeNull();
    expect(normaliseHHmm('25:00')).toBeNull();
    expect(normaliseHHmm('12:60')).toBeNull();
  });
});

describe('TOMORROW_CHANGE_ELIGIBLE_PRAYERS', () => {
  it('contains exactly Zuhr, Asr, Isha', () => {
    expect(TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has('Zuhr')).toBe(true);
    expect(TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has('Asr')).toBe(true);
    expect(TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has('Isha')).toBe(true);
    expect(TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has('Fajr')).toBe(false);
    expect(TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has('Maghrib')).toBe(false);
    expect(TOMORROW_CHANGE_ELIGIBLE_PRAYERS.has('Sunrise')).toBe(false);
    expect(TOMORROW_CHANGE_ELIGIBLE_PRAYERS.size).toBe(3);
  });
});

describe('resolveTomorrowChange', () => {
  const map = { Fajr: '05:00', Zuhr: '13:35', Asr: '16:45', Maghrib: '18:30', Isha: '21:30' };

  it('returns the change when Zuhr/Asr/Isha differ', () => {
    expect(resolveTomorrowChange('Zuhr', '13:30', map)).toEqual({
      prayerName: 'Zuhr',
      tomorrow: '13:35',
    });
    expect(resolveTomorrowChange('Asr', '16:30', map)).toEqual({
      prayerName: 'Asr',
      tomorrow: '16:45',
    });
    expect(resolveTomorrowChange('Isha', '21:15', map)).toEqual({
      prayerName: 'Isha',
      tomorrow: '21:30',
    });
  });

  it('returns null when today and tomorrow match (after normalisation)', () => {
    expect(
      resolveTomorrowChange('Zuhr', '13:35', map),
    ).toBeNull();
    expect(
      resolveTomorrowChange('Zuhr', '13:35:00', map),
    ).toBeNull();
  });

  it('returns null for ineligible prayers', () => {
    expect(resolveTomorrowChange('Fajr', '04:30', map)).toBeNull();
    expect(resolveTomorrowChange('Maghrib', '18:00', map)).toBeNull();
    expect(resolveTomorrowChange('Sunrise', '06:30', map)).toBeNull();
  });

  it('returns null when today or tomorrow is missing', () => {
    expect(resolveTomorrowChange('Zuhr', undefined, map)).toBeNull();
    expect(resolveTomorrowChange('Zuhr', '13:30', null)).toBeNull();
    expect(resolveTomorrowChange('Zuhr', '13:30', { Asr: '16:45' })).toBeNull();
    expect(resolveTomorrowChange(null, '13:30', map)).toBeNull();
  });

  it('returns null when either value cannot be parsed', () => {
    expect(resolveTomorrowChange('Zuhr', 'noon', map)).toBeNull();
    expect(resolveTomorrowChange('Zuhr', '13:30', { Zuhr: 'later' })).toBeNull();
  });
});
