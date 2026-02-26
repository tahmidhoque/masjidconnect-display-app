/**
 * Integration test: store state for startup → pairing → display.
 */

import { describe, it, expect } from 'vitest';
import { createTestStore } from '@/test-utils';
import {
  requestPairingCode,
  checkPairingStatus,
  initializeFromStorage,
} from '@/store/slices/authSlice';
import { refreshContent } from '@/store/slices/contentSlice';
import { mockPairingCodeResponse, mockPairingStatusResponse, mockScreenContent } from '@/test-utils/mocks';

describe('Startup to display flow (reducer state)', () => {
  it('moves from unauthenticated to pairing when pairing code requested', () => {
    const store = createTestStore();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().auth.isPairing).toBe(false);

    store.dispatch(
      requestPairingCode.fulfilled(
        {
          pairingCode: mockPairingCodeResponse.pairingCode,
          expiresAt: mockPairingCodeResponse.expiresAt,
          requestTime: Date.now(),
        },
        '',
        'LANDSCAPE',
      ),
    );
    expect(store.getState().auth.pairingCode).toBe(mockPairingCodeResponse.pairingCode);
    expect(store.getState().auth.isPairing).toBe(false);
  });

  it('moves to authenticated when checkPairingStatus returns paired', () => {
    const store = createTestStore();
    store.dispatch(
      checkPairingStatus.fulfilled(
        {
          isPaired: true,
          credentials: {
            screenId: mockPairingStatusResponse.screenId,
            apiKey: mockPairingStatusResponse.apiKey,
            masjidId: mockPairingStatusResponse.masjidId,
          },
          masjidName: 'Test Masjid',
          screenName: 'Screen 1',
          orientation: 'LANDSCAPE',
        },
        '',
        'ABC123',
      ),
    );
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.isPaired).toBe(true);
    expect(store.getState().auth.screenId).toBe(mockPairingStatusResponse.screenId);
  });

  it('has content after refreshContent fulfilled', () => {
    const store = createTestStore();
    store.dispatch(
      refreshContent.fulfilled(
        {
          content: mockScreenContent as never,
          masjidName: 'Test Masjid',
          masjidTimezone: 'Europe/London',
          carouselTime: 30,
          timeFormat: '12h',
          timestamp: new Date().toISOString(),
          schedule: undefined,
          events: undefined,
        },
        '',
        {},
      ),
    );
    expect(store.getState().content.screenContent).toBeTruthy();
    expect(store.getState().content.masjidName).toBe('Test Masjid');
  });
});
