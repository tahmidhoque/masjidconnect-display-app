/**
 * Tests for useAppLoader hook.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppLoader } from './useAppLoader';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { mockScreenContent, mockPrayerTimesArray } from '@/test-utils/mocks';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockGetCredentials = vi.fn();
vi.mock('@/services/credentialService', () => ({
  default: {
    getCredentials: () => mockGetCredentials(),
    hasCredentials: vi.fn(() => true),
    initialise: vi.fn(),
    debugLogState: vi.fn(),
  },
}));

vi.mock('@/api/apiClient', () => ({
  default: {
    requestPairingCode: vi.fn().mockResolvedValue({ success: true, data: { pairingCode: 'X', expiresAt: new Date().toISOString() } }),
    checkPairingStatus: vi.fn(),
    getPairedCredentials: vi.fn(),
  },
}));

describe('useAppLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCredentials.mockReturnValue(null);
  });

  it('returns expected shape with phase and tasks', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AllTheProviders, null, children);
    const { result } = renderHook(() => useAppLoader(), { wrapper });
    await waitFor(() => {
      expect(result.current).toHaveProperty('phase');
      expect(result.current).toHaveProperty('tasks');
      expect(result.current).toHaveProperty('overallProgress');
      expect(result.current).toHaveProperty('currentTask');
      expect(result.current).toHaveProperty('needsPairing');
      expect(result.current).toHaveProperty('hasPairingCode');
      expect(result.current).toHaveProperty('error');
      expect(['startup', 'pairing', 'loading', 'ready']).toContain(result.current.phase);
      expect(Array.isArray(result.current.tasks)).toBe(true);
    });
  });

  it('moves to loading when store has credentials and content', async () => {
    mockGetCredentials.mockReturnValue({ apiKey: 'k', screenId: 's', masjidId: 'm' });
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isPaired: true,
        screenId: 's',
        apiKey: 'k',
        masjidId: 'm',
      } as never,
      content: {
        screenContent: mockScreenContent as never,
        prayerTimes: mockPrayerTimesArray[0] as never,
        isLoading: false,
      } as never,
    });
    const preloaded = store.getState();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AllTheProviders, { preloadedState: preloaded }, children);
    const { result } = renderHook(() => useAppLoader(), { wrapper });
    await waitFor(
      () => {
        expect(['loading', 'ready']).toContain(result.current.phase);
      },
      { timeout: 3000 },
    );
  });
});
