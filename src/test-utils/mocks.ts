/**
 * Shared mock data and helpers for tests.
 */

import type { EmergencyAlert } from '@/api/models';

// ---------------------------------------------------------------------------
// API / Auth mocks
// ---------------------------------------------------------------------------

export const mockApiCredentials = {
  apiKey: 'test-api-key',
  screenId: 'test-screen-id',
};

export const mockPairingCodeResponse = {
  pairingCode: 'ABC123',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
};

export const mockPairingStatusResponse = {
  paired: true,
  apiKey: 'test-api-key',
  screenId: 'test-screen-id',
  masjidId: 'test-masjid-id',
};

export const mockPrayerTimesArray = [
  {
    date: new Date().toISOString().slice(0, 10),
    fajr: '05:30',
    sunrise: '06:45',
    dhuhr: '12:15',
    asr: '15:30',
    maghrib: '18:20',
    isha: '19:45',
  },
];

export const mockScreenContent = {
  masjidName: 'Test Masjid',
  timezone: 'Europe/London',
  screen: { orientation: 'LANDSCAPE' as const },
  announcements: [],
  events: [],
};

export const mockHeartbeatResponse = { success: true };

export const mockEventsResponse = { events: [], count: 0 };

export const mockEmergencyAlert: EmergencyAlert = {
  id: 'test-alert-1',
  title: 'Test Emergency',
  message: 'This is a test emergency alert.',
  category: 'safety',
  urgency: 'high',
  color: null,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  createdAt: new Date().toISOString(),
  masjidId: 'test-masjid',
};

// ---------------------------------------------------------------------------
// Axios-style helpers
// ---------------------------------------------------------------------------

export function mockAxiosResponse<T>(data: T, status = 200) {
  return {
    data: { success: true, data },
    status,
    statusText: 'OK',
    headers: {},
    config: {} as unknown,
  };
}

export function mockAxiosError(message: string, status?: number) {
  const err = new Error(message) as Error & { response?: { status: number } };
  if (status != null) err.response = { status };
  return err;
}

// ---------------------------------------------------------------------------
// Environment / DOM helpers
// ---------------------------------------------------------------------------

export function setOnline(online: boolean): void {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: online,
    writable: true,
    configurable: true,
  });
}

export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// LocalForage mock factory (for API client tests)
// ---------------------------------------------------------------------------

export function createLocalForageMock() {
  const store = new Map<string, unknown>();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: unknown) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    clear: async () => store.clear(),
    store,
  };
}
