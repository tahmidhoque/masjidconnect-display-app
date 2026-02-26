/**
 * Network status service tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import networkStatusService from './networkStatusService';

vi.mock('@/config/environment', () => ({
  apiUrl: 'https://api.test',
}));
vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('networkStatusService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribe calls callback immediately with current status', () => {
    const cb = vi.fn();
    const unsub = networkStatusService.subscribe(cb);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        isOnline: expect.any(Boolean),
        isApiReachable: expect.any(Boolean),
      }),
    );
    unsub();
  });

  it('getStatus returns current status object', () => {
    const status = networkStatusService.getStatus();
    expect(status).toHaveProperty('isOnline');
    expect(status).toHaveProperty('isApiReachable');
    expect(status).toHaveProperty('lastChecked');
  });

  it('start adds listeners and stop removes them', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    networkStatusService.start();
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    networkStatusService.stop();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
