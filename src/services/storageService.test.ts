/**
 * Storage service tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import storageService from './storageService';

const mockStore = new Map<string, unknown>();
const mockGetItem = vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null));
const mockSetItem = vi.fn((key: string, value: unknown) => {
  mockStore.set(key, value);
  return Promise.resolve();
});
const mockRemoveItem = vi.fn((key: string) => {
  mockStore.delete(key);
  return Promise.resolve();
});
const mockClear = vi.fn(() => {
  mockStore.clear();
  return Promise.resolve();
});
const mockKeys = vi.fn(() => Promise.resolve([...mockStore.keys()]));

vi.mock('localforage', () => ({
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
    clear: (...args: unknown[]) => mockClear(...args),
    keys: (...args: unknown[]) => mockKeys(...args),
    config: vi.fn(),
  },
  INDEXEDDB: 'asyncStorage',
  LOCALSTORAGE: 'localStorageWrapper',
}));

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('storageService', () => {
  beforeEach(() => {
    mockStore.clear();
    vi.clearAllMocks();
  });

  it('get returns null for missing key', async () => {
    const result = await storageService.get('missing');
    expect(result).toBeNull();
  });

  it('get returns defaultValue for missing key when provided', async () => {
    const result = await storageService.get('missing', 'default');
    expect(result).toBe('default');
  });

  it('set and get round-trip', async () => {
    await storageService.set('key1', { foo: 'bar' });
    const result = await storageService.get<{ foo: string }>('key1');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('remove deletes key', async () => {
    await storageService.set('key1', 'value');
    await storageService.remove('key1');
    const result = await storageService.get('key1');
    expect(result).toBeNull();
  });

  it('has returns true when key exists', async () => {
    await storageService.set('key1', 1);
    expect(await storageService.has('key1')).toBe(true);
  });

  it('has returns false when key missing', async () => {
    expect(await storageService.has('missing')).toBe(false);
  });

  it('clear removes all keys', async () => {
    await storageService.set('a', 1);
    await storageService.set('b', 2);
    await storageService.clear();
    expect(await storageService.get('a')).toBeNull();
    expect(await storageService.get('b')).toBeNull();
  });

  it('keys returns array of keys', async () => {
    await storageService.set('k1', 1);
    await storageService.set('k2', 2);
    const keys = await storageService.keys();
    expect(keys).toContain('k1');
    expect(keys).toContain('k2');
    expect(keys.length).toBe(2);
  });

  it('get returns defaultValue on getItem error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('storage error'));
    const result = await storageService.get('key', 'fallback');
    expect(result).toBe('fallback');
  });
});
