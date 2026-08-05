/**
 * Tests for mediaCacheService — cache behaviour, retain safety, failure memoisation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mediaCacheService, { collectHttpUrls } from './mediaCacheService';

const STORAGE_A =
  'https://proj.supabase.co/storage/v1/object/public/display-carousel/a/poster.webp';
const STORAGE_B =
  'https://proj.supabase.co/storage/v1/object/public/display-carousel/b/clip.mp4';

function stubBlobUrl(value = 'blob:http://localhost/media-cache-test') {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => value),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

function stubFetchOk(body = 'fake-bytes') {
  const blob = new Blob([body], { type: 'image/webp' });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      clone() {
        return this;
      },
      blob: async () => blob,
    }),
  );
}

describe('collectHttpUrls', () => {
  it('collects nested http(s) strings', () => {
    const urls = collectHttpUrls({
      a: STORAGE_A,
      b: { c: 'https://cdn.example.com/y.mp4', d: 'not-a-url' },
      e: ['https://portal.masjidconnect.co.uk/z.png'],
    });
    expect(urls).toContain(STORAGE_A);
    expect(urls).toContain('https://cdn.example.com/y.mp4');
    expect(urls).toContain('https://portal.masjidconnect.co.uk/z.png');
    expect(urls).not.toContain('not-a-url');
  });

  it('ignores oversized strings', () => {
    const huge = `https://example.com/${'x'.repeat(3000)}`;
    expect(collectHttpUrls(huge)).toEqual([]);
  });
});

describe('mediaCacheService.isCacheable', () => {
  it('accepts Supabase Storage public object URLs', () => {
    expect(mediaCacheService.isCacheable(STORAGE_A)).toBe(true);
    expect(
      mediaCacheService.isCacheable(
        'https://abc.supabase.co/storage/v1/object/public/mosque-logos/logo.webp',
      ),
    ).toBe(true);
  });

  it('rejects non-storage and invalid URLs', () => {
    expect(mediaCacheService.isCacheable('https://cdn.example.com/a.jpg')).toBe(false);
    expect(mediaCacheService.isCacheable('/relative/path.jpg')).toBe(false);
    expect(mediaCacheService.isCacheable('not-a-url')).toBe(false);
    expect(
      mediaCacheService.isCacheable(
        'https://abc.supabase.co/storage/v1/object/sign/private/x?token=1',
      ),
    ).toBe(false);
  });
});

describe('mediaCacheService.getLocalUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    mediaCacheService.__resetForTests();
    vi.stubGlobal('caches', undefined);
    localStorage.clear();
  });

  afterEach(() => {
    mediaCacheService.__resetForTests();
    vi.unstubAllGlobals();
  });

  it('passes through non-cacheable URLs unchanged', async () => {
    const url = 'https://cdn.example.com/poster.jpg';
    await expect(mediaCacheService.getLocalUrl(url)).resolves.toBe(url);
  });

  it('returns a blob URL after a successful fetch when Cache API is missing', async () => {
    const blobUrl = 'blob:http://localhost/media-cache-test';
    stubBlobUrl(blobUrl);
    stubFetchOk();

    const local = await mediaCacheService.getLocalUrl(STORAGE_A);
    expect(local).toBe(blobUrl);
    expect(fetch).toHaveBeenCalledWith(STORAGE_A, {
      mode: 'cors',
      credentials: 'omit',
    });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
    const again = await mediaCacheService.getLocalUrl(STORAGE_A);
    expect(again).toBe(blobUrl);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('dedupes concurrent fetches for the same URL', async () => {
    stubBlobUrl('blob:http://localhost/concurrent');
    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => fetchPromise),
    );

    const p1 = mediaCacheService.getLocalUrl(STORAGE_A);
    const p2 = mediaCacheService.getLocalUrl(STORAGE_A);

    // Allow openCache() microtask to run so fetch is invoked once.
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const blob = new Blob(['x'], { type: 'image/webp' });
    resolveFetch({
      ok: true,
      status: 200,
      clone() {
        return this;
      },
      blob: async () => blob,
    });

    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe(b);
    expect(a).toBe('blob:http://localhost/concurrent');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('memoises failed fetches so remounts do not re-hit the network', async () => {
    stubBlobUrl();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        clone() {
          return this;
        },
        blob: async () => new Blob(),
      }),
    );

    const first = await mediaCacheService.getLocalUrl(STORAGE_A);
    expect(first).toBe(STORAGE_A);
    expect(fetch).toHaveBeenCalledTimes(1);

    (fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
    const second = await mediaCacheService.getLocalUrl(STORAGE_A);
    expect(second).toBe(STORAGE_A);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retries a previously failed URL after the cooldown expires', async () => {
    vi.useFakeTimers();
    stubBlobUrl('blob:http://localhost/recovered');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        clone() {
          return this;
        },
        blob: async () => new Blob(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        clone() {
          return this;
        },
        blob: async () => new Blob(['ok'], { type: 'image/webp' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await mediaCacheService.getLocalUrl(STORAGE_A);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1);
    const recovered = await mediaCacheService.getLocalUrl(STORAGE_A);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(recovered).toBe('blob:http://localhost/recovered');
  });
});

describe('mediaCacheService.prefetchAndRetain', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    mediaCacheService.__resetForTests();
    vi.stubGlobal('caches', undefined);
    localStorage.clear();
    stubBlobUrl('blob:http://localhost/prefetch');
    stubFetchOk();
  });

  afterEach(() => {
    mediaCacheService.__resetForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not wipe the cache when given an empty URL list', async () => {
    await mediaCacheService.getLocalUrl(STORAGE_A);
    expect(localStorage.getItem('masjidconnect-media-meta-v1')).toBeTruthy();

    await mediaCacheService.prefetchAndRetain([]);

    const metaRaw = localStorage.getItem('masjidconnect-media-meta-v1');
    expect(metaRaw).toBeTruthy();
    const meta = JSON.parse(metaRaw!) as { entries: Array<{ url: string }> };
    expect(meta.entries.some((e) => e.url === STORAGE_A)).toBe(true);
  });

  it('drops inactive URLs from meta and revokes their blobs after a grace period', async () => {
    vi.useFakeTimers();
    let n = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:http://localhost/${++n}`),
    });
    const revoke = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    stubFetchOk();

    await mediaCacheService.getLocalUrl(STORAGE_A);
    await mediaCacheService.getLocalUrl(STORAGE_B);
    await mediaCacheService.retain([STORAGE_A]);

    const meta = JSON.parse(localStorage.getItem('masjidconnect-media-meta-v1')!) as {
      entries: Array<{ url: string }>;
    };
    expect(meta.entries.map((e) => e.url)).toEqual([STORAGE_A]);
    expect(revoke).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(revoke).toHaveBeenCalled();
  });
});
