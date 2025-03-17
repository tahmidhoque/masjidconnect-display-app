// Authentication Types
export interface ApiCredentials {
  apiKey: string;
  screenId: string;
}

export interface PairingRequest {
  pairingCode: string;
  deviceInfo: {
    deviceType: string;
    orientation: 'LANDSCAPE' | 'PORTRAIT';
  };
}

// Step 1: Request a pairing code
export interface RequestPairingCodeRequest {
  deviceType: string;
  orientation: string;
}

export interface RequestPairingCodeResponse {
  pairingCode: string;
  expiresAt: string;
  checkInterval: number;
}

// Step 3: Check pairing status
export interface CheckPairingStatusRequest {
  pairingCode: string;
}

export interface CheckPairingStatusResponse {
  paired: boolean;
  apiKey?: string;
  screenId?: string;
  checkAgainIn?: number;
}

export interface PairingResponse {
  screen: {
    id: string;
    name: string;
    apiKey: string;
  };
}

export interface HeartbeatRequest {
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  metrics: {
    uptime: number;
    memoryUsage: number;
    lastError: string;
  };
}

export interface HeartbeatResponse {
  success: boolean;
  screen: {
    id: string;
    name: string;
    orientation: 'LANDSCAPE' | 'PORTRAIT';
    schedule: any; // This will be defined more specifically as needed
    masjid: {
      id: string;
      name: string;
      timezone: string;
    };
  };
}

// Content Types
export type ContentItemType = 'VERSE_HADITH' | 'ANNOUNCEMENT' | 'EVENT' | 'CUSTOM' | 'ASMA_AL_HUSNA';

export interface ContentItem {
  id: string;
  type: ContentItemType;
  title: string;
  content: any; // This will be different based on the type
  duration: number;
}

export interface ScheduleItem {
  id: string;
  order: number;
  contentItem: ContentItem;
}

export interface Schedule {
  id: string;
  name: string;
  items: ScheduleItem[];
}

export interface PrayerTimes {
  date: string;
  fajr: string;
  sunrise: string;
  zuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  fajrJamaat: string;
  zuhrJamaat: string;
  asrJamaat: string;
  maghribJamaat: string;
  ishaJamaat: string;
  jummahKhutbah?: string;
  jummahJamaat?: string;
}

export interface ContentOverride {
  contentType: string;
  enabled: boolean;
  config: any;
}

export interface ScreenContent {
  screen: {
    id: string;
    name: string;
    orientation: 'LANDSCAPE' | 'PORTRAIT';
    contentConfig: any;
  };
  masjid: {
    name: string;
    timezone: string;
  };
  schedule: Schedule;
  prayerTimes: PrayerTimes;
  contentOverrides: ContentOverride[];
  lastUpdated: string;
}

// Prayer Status Types
export type PrayerName = 'FAJR' | 'SUNRISE' | 'ZUHR' | 'ASR' | 'MAGHRIB' | 'ISHA' | 'JUMMAH';

export interface PrayerStatus {
  currentPrayer: PrayerName;
  currentPrayerTime: string;
  currentPrayerJamaat: string;
  nextPrayer: PrayerName;
  nextPrayerTime: string;
  nextPrayerJamaat: string;
  timeUntilNextPrayer: string; // Duration in format HH:MM:SS
  timeUntilNextJamaat: string; // Duration in format HH:MM:SS
}

// Event Types
export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  category: string;
}

export interface EventsResponse {
  events: Event[];
}

// Generic API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number; // HTTP status code for error responses
} 