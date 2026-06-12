import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purgeApiServiceWorkerCaches } from './purgeApiServiceWorkerCaches';

describe('purgeApiServiceWorkerCaches', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the Workbox api-cache when caches API is available', async () => {
    const deleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { delete: deleteMock });

    await purgeApiServiceWorkerCaches();

    expect(deleteMock).toHaveBeenCalledWith('api-cache');
  });

  it('no-ops when caches API is unavailable', async () => {
    vi.stubGlobal('caches', undefined);

    await expect(purgeApiServiceWorkerCaches()).resolves.toBeUndefined();
  });
});
