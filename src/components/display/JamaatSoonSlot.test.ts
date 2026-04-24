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
  // TomorrowsJamaatsMap entries are now structured ({ jamaat, isJumuah?, alternateJamaat? }).
  const map = {
    Fajr: { jamaat: '05:00' },
    Zuhr: { jamaat: '13:35' },
    Asr: { jamaat: '16:45' },
    Maghrib: { jamaat: '18:30' },
    Isha: { jamaat: '21:30' },
  };

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
    expect(
      resolveTomorrowChange('Zuhr', '13:30', { Asr: { jamaat: '16:45' } }),
    ).toBeNull();
    expect(resolveTomorrowChange(null, '13:30', map)).toBeNull();
  });

  it('returns null when either value cannot be parsed', () => {
    expect(resolveTomorrowChange('Zuhr', 'noon', map)).toBeNull();
    expect(
      resolveTomorrowChange('Zuhr', '13:30', { Zuhr: { jamaat: 'later' } }),
    ).toBeNull();
  });

  it("relabels prayerName as 'Jumuah' when tomorrow's Zuhr entry is Jumuah", () => {
    // Today is Thursday during Zuhr jamaat-soon; tomorrow's Zuhr slot is
    // actually Jumuah. The slide must say "Jumuah" rather than "Zuhr" so
    // attendees aren't misled.
    const fridayMap = {
      Zuhr: { jamaat: '13:15', isJumuah: true, alternateJamaat: '12:35' },
      Asr: { jamaat: '16:45' },
      Isha: { jamaat: '21:30' },
    };
    expect(resolveTomorrowChange('Zuhr', '12:30', fridayMap)).toEqual({
      prayerName: 'Jumuah',
      tomorrow: '13:15',
    });
  });

  it("returns null when today's Zuhr matches tomorrow's Jumuah", () => {
    // Edge case: regular Zuhr today happens to align with Jumuah time
    // tomorrow. No change to announce.
    const fridayMap = {
      Zuhr: { jamaat: '13:15', isJumuah: true, alternateJamaat: '12:35' },
    };
    expect(resolveTomorrowChange('Zuhr', '13:15', fridayMap)).toBeNull();
  });

  describe('Friday → Saturday (today is Jumuah-substituted)', () => {
    // When today is Friday the Zuhr row is rewritten with the Jumuah
    // congregational time; the underlying weekday Zuhr lives on
    // `alternateJamaat`. Tomorrow (Saturday) is a plain Zuhr row. Comparing
    // the displayed Jumuah time against tomorrow's Zuhr would always differ
    // and fire the slide during the silence-your-phones window even when
    // the regular Zuhr jamaat hasn't actually changed.
    const saturdayMap = {
      Zuhr: { jamaat: '14:00' },
      Asr: { jamaat: '16:45' },
      Isha: { jamaat: '21:30' },
    };

    it('returns null when the underlying weekday Zuhr is unchanged', () => {
      // Today: Jumuah 13:30, regular Zuhr would have been 14:00.
      // Tomorrow: regular Zuhr 14:00 (same). No real change → no slide.
      expect(
        resolveTomorrowChange('Zuhr', '13:30', saturdayMap, true, '14:00'),
      ).toBeNull();
    });

    it("returns the Zuhr change when tomorrow's regular Zuhr actually differs", () => {
      // Today: Jumuah 13:30, regular Zuhr 14:00.
      // Tomorrow: regular Zuhr 14:15 (genuinely different schedule).
      const changedMap = { ...saturdayMap, Zuhr: { jamaat: '14:15' } };
      expect(
        resolveTomorrowChange('Zuhr', '13:30', changedMap, true, '14:00'),
      ).toEqual({ prayerName: 'Zuhr', tomorrow: '14:15' });
    });

    it('falls back to today.jamaat when alternateJamaat is missing', () => {
      // Defensive: if upstream ever drops alternateJamaat we should still
      // return null rather than crash, and we shouldn't silently announce a
      // bogus change.
      expect(
        resolveTomorrowChange('Zuhr', '13:30', saturdayMap, true, undefined),
      ).toBeNull();
      expect(
        resolveTomorrowChange('Zuhr', '13:30', saturdayMap, true, null),
      ).toBeNull();
    });

    it('does not affect Asr/Isha rows on Friday', () => {
      // Only the Zuhr slot gets the Jumuah substitution; the isJumuah flag
      // on nextPrayer travels with it, so an Asr/Isha next-prayer is never
      // flagged. The standard diff still applies.
      expect(
        resolveTomorrowChange('Asr', '16:30', saturdayMap, false, undefined),
      ).toEqual({ prayerName: 'Asr', tomorrow: '16:45' });
    });
  });
});
