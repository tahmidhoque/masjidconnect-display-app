/**
 * Unit tests for prayerTerminology helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTerminology,
  prayerRowNameToTerminologyKey,
  resolvePrayerDisplayName,
  resolveAnnouncementPrayerName,
  resolveCountdownStartPhrase,
} from './prayerTerminology';
import type { TerminologyKey } from '@/api/models';

describe('resolveTerminology', () => {
  it('returns terminology value when present and non-empty', () => {
    const terminology = { jummah: '  Custom Jumuah  ' } as Partial<Record<TerminologyKey, string>>;
    expect(resolveTerminology(terminology, 'jummah', 'Jumuah')).toBe('Custom Jumuah');
  });

  it('falls back when terminology map is missing', () => {
    expect(resolveTerminology(undefined, 'jummah', 'Jumuah')).toBe('Jumuah');
    expect(resolveTerminology(null, 'jummah', 'Jumuah')).toBe('Jumuah');
  });

  it('falls back when key is missing', () => {
    const terminology = { zuhr: 'Custom Zuhr' } as Partial<Record<TerminologyKey, string>>;
    expect(resolveTerminology(terminology, 'jummah', 'Jumuah')).toBe('Jumuah');
  });
});

describe('prayerRowNameToTerminologyKey', () => {
  it('maps known prayer row names to stable keys', () => {
    expect(prayerRowNameToTerminologyKey('Fajr')).toBe('fajr');
    expect(prayerRowNameToTerminologyKey('Sunrise')).toBe('sunrise');
    expect(prayerRowNameToTerminologyKey('Zuhr')).toBe('zuhr');
    expect(prayerRowNameToTerminologyKey('Asr')).toBe('asr');
    expect(prayerRowNameToTerminologyKey('Maghrib')).toBe('maghrib');
    expect(prayerRowNameToTerminologyKey('Isha')).toBe('isha');
  });

  it('maps Jumuah / Jumu\'ah to jummah', () => {
    expect(prayerRowNameToTerminologyKey('Jumuah')).toBe('jummah');
    expect(prayerRowNameToTerminologyKey("Jumu'ah")).toBe('jummah');
  });

  it('returns null for unknown labels', () => {
    expect(prayerRowNameToTerminologyKey('SomethingElse')).toBeNull();
  });
});

describe('resolvePrayerDisplayName', () => {
  it('applies custom salah labels from displaySettings.terminology', () => {
    const terminology = { zuhr: 'Zhur', asr: 'Asar' } as Partial<Record<TerminologyKey, string>>;
    expect(resolvePrayerDisplayName('Zuhr', terminology)).toBe('Zhur');
    expect(resolvePrayerDisplayName('Asr', terminology)).toBe('Asar');
  });

  it('falls back to the row name when terminology is missing', () => {
    expect(resolvePrayerDisplayName('Zuhr', undefined)).toBe('Zuhr');
    expect(resolvePrayerDisplayName('Zuhr', null)).toBe('Zuhr');
  });

  it('uses the jummah key for Friday Zuhr so the overlay matches the panel', () => {
    const terminology = {
      zuhr: 'Dhuhr',
      jummah: 'Jumuah',
    } as Partial<Record<TerminologyKey, string>>;
    expect(resolvePrayerDisplayName('Zuhr', terminology, { isJumuahToday: true })).toBe('Jumuah');
    expect(resolvePrayerDisplayName('Zuhr', terminology, { isJumuahToday: false })).toBe('Dhuhr');
  });

  it('returns null when the phase has no prayer name', () => {
    expect(resolvePrayerDisplayName(null, undefined)).toBeNull();
    expect(resolvePrayerDisplayName(undefined, undefined)).toBeNull();
  });
});

describe('resolveAnnouncementPrayerName', () => {
  it('returns the row name when terminology is missing', () => {
    expect(resolveAnnouncementPrayerName('Maghrib', undefined)).toBe('Maghrib');
  });

  it('uses terminology for the matching prayer key', () => {
    const terminology = { maghrib: '  Maghrib Salah  ' } as Partial<Record<TerminologyKey, string>>;
    expect(resolveAnnouncementPrayerName('Maghrib', terminology)).toBe('Maghrib Salah');
  });

  it('uses jummah terminology when isJumuah is true', () => {
    const terminology = { jummah: 'Jumuʿah', zuhr: 'Dhuhr' } as Partial<Record<TerminologyKey, string>>;
    expect(resolveAnnouncementPrayerName('Zuhr', terminology, true)).toBe('Jumuʿah');
  });

  it('returns null when there is no prayer name', () => {
    expect(resolveAnnouncementPrayerName(null, undefined)).toBeNull();
    expect(resolveAnnouncementPrayerName('  ', undefined)).toBeNull();
  });
});

describe('resolveCountdownStartPhrase', () => {
  it('uses "starts in" for the default Start column label', () => {
    expect(resolveCountdownStartPhrase('Fajr', 'Start')).toBe('Fajr starts in');
    expect(resolveCountdownStartPhrase('Asr', 'start')).toBe('Asr starts in');
  });

  it('uses "{name} Adhan in" when the column is labelled Adhan', () => {
    expect(resolveCountdownStartPhrase('Fajr', 'Adhan')).toBe('Fajr Adhan in');
  });

  it('uses other custom labels as "{name} {label} in"', () => {
    expect(resolveCountdownStartPhrase('Zuhr', 'Iqamah')).toBe('Zuhr Iqamah in');
  });

  it('falls back without a prayer name', () => {
    expect(resolveCountdownStartPhrase('', 'Start')).toBe('Next prayer starts in');
    expect(resolveCountdownStartPhrase('', 'Adhan')).toBe('Adhan in');
  });
});
