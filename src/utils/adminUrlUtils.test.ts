/**
 * Unit tests for adminUrlUtils.
 */

import { describe, it, expect } from 'vitest';
import { getApiBaseUrl, getAdminBaseUrl, getPairingUrl } from './adminUrlUtils';

describe('getApiBaseUrl', () => {
  it('returns a string URL', () => {
    const url = getApiBaseUrl();
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^https?:\/\//);
  });
});

describe('getAdminBaseUrl', () => {
  it('returns a string URL', () => {
    const url = getAdminBaseUrl();
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^https?:\/\//);
  });
});

describe('getPairingUrl', () => {
  it('returns URL ending with /pair/{code}', () => {
    expect(getPairingUrl('ABC123')).toContain('/pair/ABC123');
    expect(getPairingUrl('XYZ')).toMatch(/\/pair\/XYZ$/);
  });

  it('includes the pairing code in the path', () => {
    const url = getPairingUrl('CODE99');
    expect(url).toContain('CODE99');
    expect(url).toContain('/pair/');
  });
});
