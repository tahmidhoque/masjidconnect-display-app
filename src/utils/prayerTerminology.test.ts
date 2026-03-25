/**
 * Unit tests for prayerTerminology helpers.
 */

import { describe, it, expect } from 'vitest';
import { resolveTerminology, prayerRowNameToTerminologyKey } from './prayerTerminology';
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

