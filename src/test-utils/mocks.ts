/**
 * Test Mocks and Utilities
 * Centralized mock data and factory functions for testing
 */

import {
  ApiCredentials,
  PrayerTimes,
  ScreenContent,
  HeartbeatResponse,
  EventsResponse,
  ApiResponse,
  RequestPairingCodeResponse,
  CheckPairingStatusResponse,
  EmergencyAlert,
  Schedule,
  ContentItem,
} from "../api/models";

// ============================================================================
// API Response Mocks
// ============================================================================

export const mockApiCredentials: ApiCredentials = {
  apiKey: "test-api-key-123",
  screenId: "test-screen-id-456",
};

export const mockPrayerTimes: PrayerTimes = {
  date: "2024-01-15",
  fajr: "05:30",
  sunrise: "07:00",
  zuhr: "12:30",
  asr: "15:00",
  maghrib: "17:30",
  isha: "19:00",
  fajrJamaat: "05:45",
  zuhrJamaat: "13:00",
  asrJamaat: "15:30",
  maghribJamaat: "17:35",
  ishaJamaat: "19:30",
  jummahKhutbah: "13:00",
  jummahJamaat: "13:30",
};

export const mockPrayerTimesArray: PrayerTimes[] = [
  mockPrayerTimes,
  {
    ...mockPrayerTimes,
    date: "2024-01-16",
  },
];

export const mockContentItem: ContentItem = {
  id: "content-1",
  type: "ANNOUNCEMENT",
  title: "Test Announcement",
  content: { text: "This is a test announcement" },
  duration: 5000,
};

export const mockSchedule: Schedule = {
  id: "schedule-1",
  name: "Default Schedule",
  items: [
    {
      id: "item-1",
      order: 1,
      contentItem: mockContentItem,
    },
  ],
};

export const mockScreenContent: ScreenContent = {
  screen: {
    id: "screen-1",
    name: "Main Display",
    orientation: "LANDSCAPE",
    contentConfig: {},
    masjid: {
      name: "Test Masjid",
      timezone: "America/New_York",
    },
  },
  masjid: {
    name: "Test Masjid",
    timezone: "America/New_York",
  },
  schedule: mockSchedule,
  prayerTimes: mockPrayerTimes,
  contentOverrides: [],
  lastUpdated: new Date().toISOString(),
};

export const mockHeartbeatResponse: HeartbeatResponse = {
  success: true,
};

export const mockEventsResponse: EventsResponse = {
  events: [
    {
      id: "event-1",
      title: "Community Iftar",
      description: "Join us for iftar",
      location: "Main Hall",
      startDate: "2024-03-15T18:00:00Z",
      endDate: "2024-03-15T20:00:00Z",
      category: "Community",
    },
  ],
};

export const mockPairingCodeResponse: RequestPairingCodeResponse = {
  pairingCode: "ABC123",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
};

export const mockPairingStatusResponse: CheckPairingStatusResponse = {
  isPaired: true,
  paired: true,
  screenId: "test-screen-id",
  apiKey: "test-api-key",
  masjidId: "test-masjid-id",
};

export const mockEmergencyAlert: EmergencyAlert = {
  id: "alert-1",
  title: "Emergency Alert",
  message: "This is a test emergency alert",
  color: "#f44336",
  expiresAt: new Date(Date.now() + 300000).toISOString(),
  createdAt: new Date().toISOString(),
  masjidId: "test-masjid-id",
};

// ============================================================================
// API Response Factories
// ============================================================================

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    data,
    success: true,
    cached: false,
  };
}

export function createErrorResponse<T>(error: string): ApiResponse<T> {
  return {
    data: null,
    success: false,
    error,
    cached: false,
  };
}

export function createCachedResponse<T>(data: T): ApiResponse<T> {
  return {
    data,
    success: true,
    cached: true,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Axios Mock Helpers
// ============================================================================

export const mockAxiosResponse = <T>(data: T, status = 200) => ({
  data,
  status,
  statusText: "OK",
  headers: {},
  config: {} as any,
});

export const mockAxiosError = (message: string, status?: number) => {
  const error: any = new Error(message);
  error.isAxiosError = true;
  if (status) {
    error.response = {
      status,
      data: { message },
      statusText: "Error",
      headers: {},
      config: {} as any,
    };
  }
  return error;
};

// ============================================================================
// LocalForage Mock
// ============================================================================

export const createLocalForageMock = () => {
  const storage = new Map<string, any>();

  return {
    getItem: jest.fn((key: string) =>
      Promise.resolve(storage.get(key) || null),
    ),
    setItem: jest.fn((key: string, value: any) => {
      storage.set(key, value);
      return Promise.resolve(value);
    }),
    removeItem: jest.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      storage.clear();
      return Promise.resolve();
    }),
    keys: jest.fn(() => Promise.resolve(Array.from(storage.keys()))),
    length: jest.fn(() => Promise.resolve(storage.size)),
  };
};

// ============================================================================
// Redux Store Mock
// ============================================================================

export const mockReduxState = {
  auth: {
    isAuthenticated: true,
    credentials: mockApiCredentials,
    isPairing: false,
    pairingCode: null,
    pairingError: null,
  },
  content: {
    screenContent: mockScreenContent,
    prayerTimes: mockPrayerTimesArray,
    events: mockEventsResponse.events,
    schedule: mockSchedule,
    loading: false,
    error: null,
    lastUpdated: Date.now(),
  },
  emergency: {
    alert: null,
    isActive: false,
  },
  errors: {
    errors: [],
  },
  ui: {
    theme: "light",
    orientation: "LANDSCAPE",
    isKioskMode: false,
  },
};

// ============================================================================
// Date/Time Mocks
// ============================================================================

export const mockDate = (dateString: string) => {
  const mockDateInstance = new Date(dateString);
  global.Date = jest.fn(() => mockDateInstance) as any;
  global.Date.now = jest.fn(() => mockDateInstance.getTime());
  global.Date.UTC = Date.UTC;
  global.Date.parse = Date.parse;
  return mockDateInstance;
};

export const restoreDate = () => {
  global.Date = Date;
};

// ============================================================================
// Network Mocks
// ============================================================================

export const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, "onLine", {
    writable: true,
    value: online,
  });
};

export const triggerOnlineEvent = () => {
  window.dispatchEvent(new Event("online"));
};

export const triggerOfflineEvent = () => {
  window.dispatchEvent(new Event("offline"));
};

// ============================================================================
// Custom Event Mocks
// ============================================================================

export const waitForCustomEvent = (
  eventName: string,
  timeout = 1000,
): Promise<CustomEvent> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    const handler = (event: Event) => {
      clearTimeout(timer);
      window.removeEventListener(eventName, handler);
      resolve(event as CustomEvent);
    };

    window.addEventListener(eventName, handler);
  });
};

// ============================================================================
// Wait Utilities
// ============================================================================

export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const flushPromises = () =>
  new Promise((resolve) => setImmediate(resolve));
