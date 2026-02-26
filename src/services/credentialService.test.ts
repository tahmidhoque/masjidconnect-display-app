/**
 * Credential service tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('credentialService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('getCredentials returns null when no credentials in storage', async () => {
    const credentialService = (await import('./credentialService')).default;
    const creds = credentialService.getCredentials();
    expect(creds).toBeNull();
  });

  it('hasCredentials returns false when no credentials', async () => {
    const credentialService = (await import('./credentialService')).default;
    expect(credentialService.hasCredentials()).toBe(false);
  });

  it('saveCredentials and getCredentials round-trip', async () => {
    const credentialService = (await import('./credentialService')).default;
    credentialService.saveCredentials({
      apiKey: 'key123',
      screenId: 'screen456',
      masjidId: 'masjid789',
    });
    const creds = credentialService.getCredentials();
    expect(creds).toEqual({
      apiKey: 'key123',
      screenId: 'screen456',
      masjidId: 'masjid789',
    });
    expect(credentialService.hasCredentials()).toBe(true);
  });

  it('getMasjidId returns masjidId when set', async () => {
    const credentialService = (await import('./credentialService')).default;
    credentialService.saveCredentials({
      apiKey: 'k',
      screenId: 's',
      masjidId: 'm1',
    });
    expect(credentialService.getMasjidId()).toBe('m1');
  });

  it('clearCredentials clears primary storage keys and cache', async () => {
    const credentialService = (await import('./credentialService')).default;
    credentialService.saveCredentials({ apiKey: 'k', screenId: 's' });
    credentialService.clearCredentials();
    expect(localStorage.getItem('masjid_api_key')).toBeNull();
    expect(localStorage.getItem('masjid_screen_id')).toBeNull();
    expect(credentialService.hasCredentials()).toBe(false);
  });

  it('initialise can be called multiple times', async () => {
    const credentialService = (await import('./credentialService')).default;
    credentialService.initialise();
    credentialService.initialise();
    expect(credentialService.hasCredentials()).toBe(false);
  });

  it('saveCredentials throws when apiKey or screenId missing', async () => {
    const credentialService = (await import('./credentialService')).default;
    expect(() =>
      credentialService.saveCredentials({ apiKey: '', screenId: 's' }),
    ).toThrow('Invalid credentials');
    expect(() =>
      credentialService.saveCredentials({ apiKey: 'k', screenId: '' }),
    ).toThrow('Invalid credentials');
  });

  it('getCredentials returns from legacy apiKey/screenId keys', async () => {
    localStorage.setItem('apiKey', 'legacy-key');
    localStorage.setItem('screenId', 'legacy-screen');
    const credentialService = (await import('./credentialService')).default;
    const creds = credentialService.getCredentials();
    expect(creds).toEqual({
      apiKey: 'legacy-key',
      screenId: 'legacy-screen',
      masjidId: undefined,
    });
  });
});
