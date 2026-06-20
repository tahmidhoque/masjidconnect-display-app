import { describe, expect, it } from 'vitest';
import {
  formatUkPlateForDisplay,
  isValidUkPlate,
  normaliseUkPlateInput,
} from '@/utils/ukNumberPlate';

describe('ukNumberPlate', () => {
  it('normalises mixed input to uppercase alphanumeric', () => {
    expect(normaliseUkPlateInput('ab12-cde')).toBe('AB12CDE');
  });

  it('formats current-style plates with a central space', () => {
    expect(formatUkPlateForDisplay('AB12CDE')).toBe('AB12 CDE');
  });

  it('validates minimum plate length', () => {
    expect(isValidUkPlate('A')).toBe(false);
    expect(isValidUkPlate('AB')).toBe(true);
  });
});
