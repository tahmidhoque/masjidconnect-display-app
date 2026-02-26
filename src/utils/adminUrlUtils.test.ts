/**
 * Unit tests for adminUrlUtils.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { getApiBaseUrl, getAdminBaseUrl, getPairingUrl } from './adminUrlUtils';

const originalLocation = window.location;

function mockLocation(overrides: { hostname?: string; protocol?: string }) {
  const loc = {
    ...originalLocation,
    hostname: overrides.hostname ?? originalLocation.hostname,
    protocol: overrides.protocol ?? originalLocation.protocol,
  };
  Object.defineProperty(window, 'location', { value: loc, writable: true, configurable: true });
}

describe('getApiBaseUrl', () => {
  it('returns a string URL', () => {
    const url = getApiBaseUrl();
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^https?:\/\//);
  });

  it('returns URL with protocol and host', () => {
    const url = getApiBaseUrl();
    expect(url).toMatch(/^https?:\/\/[^/]+/);
  });
});

describe('getAdminBaseUrl', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('returns a string URL', () => {
    const url = getAdminBaseUrl();
    expect(typeof url).toBe('string');
    expect(url).toMatch(/^https?:\/\//);
  });

  it('returns URL with protocol when on localhost (uses API host from getApiBaseUrl)', () => {
    mockLocation({ hostname: 'localhost', protocol: 'http:' });
    const url = getAdminBaseUrl();
    expect(url).toMatch(/^https?:\/\//);
    expect(typeof url).toBe('string');
  });

  it('replaces "display" with "dashboard" in hostname when hostname includes display', () => {
    mockLocation({ hostname: 'display.masjidconnect.co.uk', protocol: 'https:' });
    const url = getAdminBaseUrl();
    expect(url).toBe('https://dashboard.masjidconnect.co.uk');
  });

  it('uses subdomain swap when hostname has multiple parts', () => {
    mockLocation({ hostname: 'app.example.com', protocol: 'https:' });
    const url = getAdminBaseUrl();
    expect(url).toBe('https://dashboard.example.com');
  });

  it('returns URL derived from API when hostname has no subdomain', () => {
    mockLocation({ hostname: 'example', protocol: 'http:' });
    const url = getAdminBaseUrl();
    expect(url).toBeDefined();
    expect(url).not.toContain('/api');
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

  it('builds URL from getAdminBaseUrl', () => {
    const base = getAdminBaseUrl();
    const url = getPairingUrl('TEST');
    expect(url).toBe(`${base}/pair/TEST`);
  });
});
