# Display App Backend Communication Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Device Pairing & Authentication](#device-pairing--authentication)
4. [REST API Endpoints](#rest-api-endpoints)
5. [WebSocket Communication](#websocket-communication)
6. [Data Flows](#data-flows)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Implementation Checklist](#implementation-checklist)

---

## Overview

The MasjidConnect Display App communicates with the backend through two primary channels:

1. **REST API** - For fetching data (prayer times, content, events) and reporting status
2. **WebSocket (via Realtime Server)** - For real-time updates (emergency alerts, remote commands, orientation changes)

**Base URLs:**
- **API Server (REST):** `https://your-admin-domain.com/api`
- **Realtime Server (WebSocket):** `wss://realtime.masjidconnect.app` or `wss://your-realtime-domain.com`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Display App                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  REST Client   │  │  WS Client     │  │  Local Cache   │ │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘ │
└──────────┼────────────────────┼────────────────────┼──────────┘
           │                    │                    │
           │                    │                    │
    ┌──────▼─────────┐   ┌──────▼─────────┐  ┌──────▼─────────┐
    │   API Server   │   │ Realtime Server │  │  Local Storage │
    │   (Next.js)    │   │   (Socket.io)   │  │  (IndexedDB)   │
    └────────────────┘   └─────────────────┘  └────────────────┘
           │                    │
           └──────────┬─────────┘
                      │
              ┌───────▼────────┐
              │   PostgreSQL    │
              │    Database     │
              └─────────────────┘
```

---

## Device Pairing & Authentication

### Pairing Flow

```
Display App          API Server           Admin Portal
    │                    │                      │
    │  1. Request Code   │                      │
    ├───────────────────►│                      │
    │  POST /api/screens/unpaired              │
    │                    │                      │
    │  2. Pairing Code   │                      │
    │◄───────────────────┤                      │
    │  { pairingCode }   │                      │
    │                    │                      │
    │  3. Display Code   │                      │
    │  on Screen         │                      │
    │                    │                      │
    │                    │  4. Admin Pairs      │
    │                    │◄─────────────────────┤
    │                    │  POST /api/screens/pair
    │                    │                      │
    │  5. Poll Status    │                      │
    ├───────────────────►│                      │
    │  POST /api/screens/check-simple          │
    │                    │                      │
    │  6. Paired Response│                      │
    │◄───────────────────┤                      │
    │  { isPaired: true, needsDevicePairing }  │
    │                    │                      │
    │  7. Get Credentials│                      │
    ├───────────────────►│                      │
    │  POST /api/screens/paired-credentials    │
    │                    │                      │
    │  8. API Key        │                      │
    │◄───────────────────┤                      │
    │  { apiKey, screenId, masjidId }          │
    │                    │                      │
```

### Step-by-Step Implementation

#### Step 1: Request Pairing Code

**Endpoint:** `POST /api/screens/unpaired`

**Request:**
```json
{
  "deviceType": "DISPLAY",
  "orientation": "LANDSCAPE"
}
```

**Response:**
```json
{
  "pairingCode": "123456",
  "expiresAt": "2023-12-31T12:30:00Z",
  "checkInterval": 5000
}
```

**Device Types:** `DISPLAY`, `TABLET`, `MOBILE`, `OTHER`  
**Orientations:** `LANDSCAPE`, `PORTRAIT`

#### Step 2: Display Pairing Code

Display the 6-digit code prominently on the screen for the admin to enter in the admin portal.

#### Step 3: Poll for Pairing Status

**Endpoint:** `POST /api/screens/check-simple`

**Request:**
```json
{
  "pairingCode": "123456"
}
```

**Response (Not Paired Yet):**
```json
{
  "isPaired": false,
  "valid": true,
  "message": "Code is valid but not yet paired by admin",
  "checkAgainIn": 3000
}
```

**Response (Admin Paired):**
```json
{
  "isPaired": true,
  "screenId": "screen_abc123",
  "masjidId": "masjid_xyz789",
  "needsDevicePairing": true,
  "message": "Admin approved - complete device pairing now",
  "checkAgainIn": 1000
}
```

**Polling Strategy:**
- Check every 3-5 seconds while waiting for admin pairing
- Continue until `isPaired: true` or code expires
- Show appropriate UI feedback during waiting period

#### Step 4: Retrieve Credentials

**Endpoint:** `POST /api/screens/paired-credentials`

**Request:**
```json
{
  "pairingCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "sk_live_abc123...",
    "screenId": "screen_abc123",
    "masjidId": "masjid_xyz789"
  }
}
```

#### Step 5: Store Credentials Securely

Store the credentials in secure local storage:
- **apiKey** - For authenticating REST API requests
- **screenId** - Unique identifier for this screen
- **masjidId** - Masjid this screen belongs to

**Example (Electron):**
```javascript
const Store = require('electron-store');
const store = new Store({ encryptionKey: 'your-encryption-key' });

store.set('credentials', {
  apiKey,
  screenId,
  masjidId
});
```

---

## REST API Endpoints

All REST API requests after pairing must include the authentication header:

```
Authorization: Bearer {apiKey}
```

### 1. Heartbeat

**Purpose:** Report status and check for pending commands  
**Endpoint:** `POST /api/screen/heartbeat`  
**Frequency:** Every 30-60 seconds  

**Request:**
```json
{
  "screenId": "screen_abc123",
  "status": "ONLINE",
  "deviceInfo": {
    "deviceType": "DISPLAY",
    "platform": "Electron",
    "version": "1.0.0",
    "os": "Windows 10"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "serverTime": "2023-12-31T12:00:00Z",
    "hasPendingEvents": true,
    "pendingCommands": [
      {
        "commandId": "cmd_123",
        "commandType": "RELOAD_CONTENT",
        "payload": {},
        "_queueId": "queue_456"
      }
    ],
    "nextHeartbeatInterval": 5000
  }
}
```

**Command Types:**
- `RESTART_APP` - Restart the display application
- `RELOAD_CONTENT` - Refresh all content from server
- `CLEAR_CACHE` - Clear local cache
- `FORCE_UPDATE` - Force app update
- `UPDATE_SETTINGS` - Update display settings
- `FACTORY_RESET` - Reset to factory defaults
- `CAPTURE_SCREENSHOT` - Take and upload screenshot

**Command Acknowledgement:**

After executing a command, acknowledge it in the next heartbeat:

```json
{
  "screenId": "screen_abc123",
  "status": "ONLINE",
  "commandAcknowledgements": [
    {
      "queueId": "queue_456",
      "commandId": "cmd_123",
      "success": true,
      "executedAt": "2023-12-31T12:00:30Z"
    }
  ]
}
```

### 2. Get Content

**Purpose:** Fetch all content to display (schedules, announcements, events, etc.)  
**Endpoint:** `GET /api/screen/content?screenId={screenId}`  
**Frequency:** Every 5-15 minutes or when app returns to foreground  

**Response:**
```json
{
  "success": true,
  "data": {
    "screen": {
      "id": "screen_abc123",
      "name": "Main Hall Display",
      "orientation": "LANDSCAPE",
      "contentConfig": {
        "layout": "LANDSCAPE",
        "customSettings": {},
        "contentOverrides": []
      }
    },
    "masjid": {
      "name": "Central Mosque",
      "timezone": "Europe/London",
      "coordinates": {
        "latitude": 51.5074,
        "longitude": -0.1278
      }
    },
    "prayerTimes": [
      {
        "date": "2023-12-31",
        "fajr": "06:00",
        "sunrise": "07:30",
        "zuhr": "12:00",
        "asr": "14:30",
        "maghrib": "16:45",
        "isha": "18:30",
        "fajrJamaat": "06:15",
        "zuhrJamaat": "12:30",
        "asrJamaat": "15:00",
        "maghribJamaat": "16:55",
        "ishaJamaat": "18:45",
        "jummahKhutbah": "12:45",
        "jummahJamaat": "13:15"
      }
    ],
    "events": [
      {
        "id": "event_123",
        "title": "Quran Class",
        "description": "Weekly Quran study session",
        "location": "Main Hall",
        "startDate": "2024-01-01T19:00:00Z",
        "endDate": "2024-01-01T21:00:00Z",
        "category": "Education",
        "imageUrl": "https://...",
        "displayDuration": 20,
        "displayPriority": 5
      }
    ],
    "schedule": {
      "id": "schedule_abc",
      "name": "Default Schedule",
      "isDefault": true,
      "isActive": true,
      "items": [
        {
          "id": "item_1",
          "order": 1,
          "type": "ANNOUNCEMENT",
          "title": "Welcome Message",
          "duration": 10,
          "content": {
            "text": "Welcome to Central Mosque",
            "backgroundColor": "#1976d2"
          }
        },
        {
          "id": "item_2",
          "order": 2,
          "type": "VERSE_HADITH",
          "title": "Daily Verse",
          "duration": 15,
          "content": {
            "contentType": "verse",
            "text": "And your Lord is Forgiving, full of Mercy.",
            "reference": "Quran 18:58",
            "translation": "Sahih International"
          }
        }
      ]
    },
    "lastUpdated": "2023-12-31T12:00:00Z"
  },
  "cacheControl": {
    "maxAge": 300,
    "staleWhileRevalidate": 3600
  }
}
```

**Content Types:**
- `ANNOUNCEMENT` - Text announcements
- `VERSE_HADITH` - Quranic verses or Hadith
- `ASMA_AL_HUSNA` - Names of Allah
- `EVENT` - Upcoming events
- `CUSTOM` - Custom HTML/media content

### 3. Get Prayer Times

**Purpose:** Fetch prayer times for a date range  
**Endpoint:** `GET /api/screen/prayer-times?screenId={screenId}&startDate={date}&endDate={date}`  
**Frequency:** Once per day or on app restart  

**Query Parameters:**
- `screenId` (required) - Screen identifier
- `startDate` (optional) - Start date (YYYY-MM-DD), defaults to today
- `endDate` (optional) - End date (YYYY-MM-DD), defaults to 7 days from start

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2023-12-31",
      "fajr": "06:00",
      "sunrise": "07:30",
      "zuhr": "12:00",
      "asr": "14:30",
      "maghrib": "16:45",
      "isha": "18:30",
      "fajrJamaat": "06:15",
      "zuhrJamaat": "12:30",
      "asrJamaat": "15:00",
      "maghribJamaat": "16:55",
      "ishaJamaat": "18:45",
      "jummahKhutbah": "12:45",
      "jummahJamaat": "13:15"
    }
  ],
  "metadata": {
    "masjid": {
      "name": "Central Mosque",
      "timezone": "Europe/London"
    },
    "calculationMethod": "MWL",
    "madhab": "Hanafi"
  },
  "cacheControl": {
    "maxAge": 86400,
    "staleWhileRevalidate": 604800
  }
}
```

### 4. Get Prayer Status

**Purpose:** Get current prayer and time until next prayer/jamaat  
**Endpoint:** `GET /api/screen/prayer-status?screenId={screenId}`  
**Frequency:** Every 60 seconds  

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPrayer": {
      "name": "ZUHR",
      "time": "12:00"
    },
    "nextPrayer": {
      "name": "ASR",
      "time": "14:30"
    },
    "currentPrayerTime": "12:00",
    "currentJamaatTime": "12:30",
    "nextPrayerTime": "14:30",
    "nextJamaatTime": "15:00",
    "timeUntilNextPrayer": "02:25:30",
    "timeUntilNextJamaat": "02:55:30",
    "timestamp": "2023-12-31T12:05:00Z",
    "isAfterIsha": false
  },
  "cacheControl": {
    "maxAge": 60,
    "staleWhileRevalidate": 3600
  }
}
```

**Prayer Names:**
- `FAJR` - Dawn prayer
- `SUNRISE` - Sunrise time (not a prayer)
- `ZUHR` - Noon prayer
- `ASR` - Afternoon prayer
- `MAGHRIB` - Sunset prayer
- `ISHA` - Night prayer

### 5. Get Events

**Purpose:** Fetch upcoming events to display  
**Endpoint:** `GET /api/screen/events?screenId={screenId}&count={number}`  
**Frequency:** Every 30 minutes  

**Query Parameters:**
- `screenId` (required) - Screen identifier
- `count` (optional) - Number of events to fetch (default: 5, max: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event_123",
        "title": "Quran Class",
        "description": "Weekly Quran study session for beginners",
        "shortDescription": "Weekly Quran Class",
        "location": "Main Hall",
        "startDate": "2024-01-01T19:00:00Z",
        "endDate": "2024-01-01T21:00:00Z",
        "category": "Education",
        "imageUrl": "https://cdn.example.com/event-image.jpg",
        "displayDuration": 20,
        "displayPriority": 5,
        "isVirtual": false,
        "featuredEvent": true,
        "tags": ["education", "quran"]
      }
    ],
    "count": 1
  },
  "cacheControl": {
    "maxAge": 1800,
    "staleWhileRevalidate": 86400
  }
}
```

### 6. Get Sync Status

**Purpose:** Check last updated timestamps to determine if refresh is needed  
**Endpoint:** `GET /api/screen/sync?screenId={screenId}`  
**Frequency:** Before fetching content to check if update is needed  

**Response:**
```json
{
  "success": true,
  "data": {
    "prayerTimes": "2023-12-31T00:00:00Z",
    "content": "2023-12-31T10:30:00Z",
    "screen": "2023-12-31T09:15:00Z",
    "overrides": "2023-12-30T14:20:00Z"
  },
  "timestamp": "2023-12-31T12:00:00Z"
}
```

**Usage:**
Store these timestamps locally and compare them before making expensive requests. Only fetch new data if the timestamp has changed.

---

## WebSocket Communication

### Connection Setup

The display app connects to the realtime server via WebSocket for real-time updates.

**WebSocket URL:** `wss://realtime.masjidconnect.app`

### Authentication

Authenticate the WebSocket connection using the socket.io handshake:

```javascript
const socket = io('wss://realtime.masjidconnect.app', {
  auth: {
    type: 'display',
    screenId: 'screen_abc123',
    masjidId: 'masjid_xyz789',
    token: 'sk_live_abc123...' // Your API key
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});
```

### Connection Events

#### 1. display:connected

Emitted by server immediately after connection.

```javascript
socket.on('display:connected', (data) => {
  console.log('Connected to realtime server', data);
  // {
  //   screenId: 'screen_abc123',
  //   masjidId: 'masjid_xyz789',
  //   serverTime: 1704067200000,
  //   timestamp: '2023-12-31T12:00:00Z'
  // }
});
```

#### 2. display:heartbeat:ack

Acknowledgement of heartbeat sent by display.

```javascript
socket.on('display:heartbeat:ack', (data) => {
  console.log('Heartbeat acknowledged', data);
  // {
  //   timestamp: '2023-12-31T12:00:00Z',
  //   serverTime: 1704067200000
  // }
});
```

### Events to Emit (Display → Server)

#### 1. display:heartbeat

Send heartbeat to report status and metrics.

**Frequency:** Every 30 seconds

```javascript
socket.emit('display:heartbeat', {
  timestamp: new Date().toISOString(),
  status: 'ONLINE',
  cpuUsage: 45.2,
  memoryUsage: 68.5,
  networkLatency: 50,
  temperature: 65,
  currentContent: 'announcement_123',
  version: '1.0.0'
});
```

**Status Values:**
- `ONLINE` - Display is active and working
- `BUSY` - Display is performing a task
- `OFFLINE` - Display is shutting down (use before disconnect)
- `PAIRING` - Display is in pairing mode (preserved by server)

#### 2. display:command:ack

Acknowledge command execution.

```javascript
socket.emit('display:command:ack', {
  commandId: 'cmd_123',
  commandType: 'RELOAD_CONTENT',
  success: true,
  error: null // or error message if failed
});
```

#### 3. display:error

Report errors to admin.

```javascript
socket.emit('display:error', {
  errorType: 'CONTENT_LOAD_ERROR',
  errorCode: 'ERR_FETCH_FAILED',
  message: 'Failed to load content from server',
  stack: '...' // Optional stack trace
});
```

**Error Types:**
- `CONTENT_LOAD_ERROR` - Failed to fetch content
- `PRAYER_TIME_ERROR` - Failed to load prayer times
- `DISPLAY_ERROR` - Display rendering issue
- `NETWORK_ERROR` - Network connectivity issue
- `STORAGE_ERROR` - Local storage error
- `UNKNOWN_ERROR` - Uncategorised error

#### 4. display:status

Update display status.

```javascript
socket.emit('display:status', {
  status: 'ONLINE',
  oldStatus: 'BUSY'
});
```

#### 5. display:content:changed

Notify when content changes on screen.

```javascript
socket.emit('display:content:changed', {
  contentId: 'announcement_123',
  contentType: 'ANNOUNCEMENT'
});
```

#### 6. display:sync:request

Request full content sync from server.

```javascript
socket.emit('display:sync:request', {
  type: 'full', // or 'partial'
  lastSyncTime: '2023-12-31T11:00:00Z'
});

socket.on('display:sync:response', (data) => {
  console.log('Sync response', data);
  // {
  //   success: true,
  //   timestamp: '2023-12-31T12:00:00Z',
  //   message: 'Sync completed'
  // }
});
```

### Events to Listen For (Server → Display)

#### 1. EMERGENCY_ALERT

Critical alert to display immediately.

```javascript
socket.on('EMERGENCY_ALERT', (data) => {
  console.log('Emergency alert received', data);
  
  if (data.action === 'show') {
    showEmergencyAlert({
      id: data.id,
      title: data.title,
      message: data.message,
      color: data.color,
      duration: data.timing.remaining,
      autoCloseAt: data.timing.autoCloseAt
    });
  } else if (data.action === 'clear') {
    clearEmergencyAlert(data.id);
  }
});
```

**Data Structure:**
```json
{
  "id": "alert_123",
  "title": "Emergency Alert",
  "message": "Please evacuate the building immediately",
  "color": "#F44336",
  "masjidId": "masjid_xyz789",
  "createdAt": "2023-12-31T12:00:00Z",
  "expiresAt": "2023-12-31T12:05:00Z",
  "timing": {
    "duration": 300000,
    "remaining": 240000,
    "autoCloseAt": "2023-12-31T12:05:00Z"
  },
  "action": "show"
}
```

**Alert Actions:**
- `show` - Display the alert
- `clear` - Remove the alert

#### 2. SCREEN_ORIENTATION

Screen orientation change from admin.

```javascript
socket.on('SCREEN_ORIENTATION', (data) => {
  console.log('Orientation change received', data);
  
  updateOrientation(data.orientation);
  // {
  //   id: 'screen_abc123',
  //   orientation: 'PORTRAIT',
  //   updatedAt: '2023-12-31T12:00:00Z'
  // }
});
```

#### 3. screen:command:{commandType}

Remote commands from admin.

```javascript
// Restart app
socket.on('screen:command:RESTART_APP', (data) => {
  console.log('Restart command received', data);
  
  // Acknowledge command
  socket.emit('display:command:ack', {
    commandId: data.commandId,
    commandType: 'RESTART_APP',
    success: true
  });
  
  // Restart the app
  app.relaunch();
  app.exit(0);
});

// Reload content
socket.on('screen:command:RELOAD_CONTENT', (data) => {
  console.log('Reload content command received', data);
  
  fetchLatestContent().then(() => {
    socket.emit('display:command:ack', {
      commandId: data.commandId,
      commandType: 'RELOAD_CONTENT',
      success: true
    });
  }).catch((error) => {
    socket.emit('display:command:ack', {
      commandId: data.commandId,
      commandType: 'RELOAD_CONTENT',
      success: false,
      error: error.message
    });
  });
});

// Clear cache
socket.on('screen:command:CLEAR_CACHE', (data) => {
  clearLocalCache().then(() => {
    socket.emit('display:command:ack', {
      commandId: data.commandId,
      commandType: 'CLEAR_CACHE',
      success: true
    });
  });
});

// Force update
socket.on('screen:command:FORCE_UPDATE', (data) => {
  checkForUpdates(true).then(() => {
    socket.emit('display:command:ack', {
      commandId: data.commandId,
      commandType: 'FORCE_UPDATE',
      success: true
    });
  });
});

// Update settings
socket.on('screen:command:UPDATE_SETTINGS', (data) => {
  updateSettings(data.payload.settings).then(() => {
    socket.emit('display:command:ack', {
      commandId: data.commandId,
      commandType: 'UPDATE_SETTINGS',
      success: true
    });
  });
});

// Factory reset
socket.on('screen:command:FACTORY_RESET', (data) => {
  // CAUTION: This will erase all data
  if (confirm('This will reset the display to factory settings. Continue?')) {
    performFactoryReset().then(() => {
      socket.emit('display:command:ack', {
        commandId: data.commandId,
        commandType: 'FACTORY_RESET',
        success: true
      });
    });
  }
});

// Capture screenshot
socket.on('screen:command:CAPTURE_SCREENSHOT', (data) => {
  captureScreenshot().then((screenshotUrl) => {
    socket.emit('display:command:ack', {
      commandId: data.commandId,
      commandType: 'CAPTURE_SCREENSHOT',
      success: true,
      payload: { screenshotUrl }
    });
  });
});
```

#### 4. screen:metrics

Request for metrics from admin.

```javascript
socket.on('screen:metrics', () => {
  socket.emit('display:heartbeat', {
    timestamp: new Date().toISOString(),
    cpuUsage: getCPUUsage(),
    memoryUsage: getMemoryUsage(),
    networkLatency: getNetworkLatency(),
    temperature: getTemperature(),
    currentContent: getCurrentContentId()
  });
});
```

#### 5. screen:status

Status update from admin (usually for monitoring).

```javascript
socket.on('screen:status', (data) => {
  console.log('Status update from admin', data);
  // {
  //   screenId: 'screen_abc123',
  //   oldStatus: 'ONLINE',
  //   newStatus: 'BUSY',
  //   timestamp: '2023-12-31T12:00:00Z'
  // }
});
```

#### 6. screen:content

Notification that content has been updated.

```javascript
socket.on('screen:content', (data) => {
  console.log('Content update notification', data);
  // {
  //   screenId: 'screen_abc123',
  //   contentId: 'announcement_456',
  //   contentType: 'ANNOUNCEMENT',
  //   timestamp: '2023-12-31T12:00:00Z'
  // }
  
  // Fetch latest content
  fetchLatestContent();
});
```

---

## Data Flows

### 1. Initial Setup Flow

```
Display App Starts
       │
       ▼
┌──────────────┐
│ Check Local  │
│ Credentials  │
└──────┬───────┘
       │
       ├─── Has Credentials? ───► Yes ───┐
       │                                  │
       └─── No                            │
              │                           │
              ▼                           ▼
       ┌──────────────┐         ┌─────────────────┐
       │ Start Pairing│         │ Validate Creds  │
       │ Process      │         └────────┬─────── ┘
       └──────────────┘                  │
                                         ├─── Valid? ───► Yes ───┐
                                         │                        │
                                         └─── No                  │
                                                │                 │
                                                ▼                 ▼
                                         ┌──────────────┐   ┌──────────────┐
                                         │ Start Pairing│   │ Connect WS   │
                                         │ Process      │   │ & REST       │
                                         └──────────────┘   └──────┬───────┘
                                                                   │
                                                                   ▼
                                                            ┌──────────────┐
                                                            │ Fetch Content│
                                                            │ & Start Loop │
                                                            └──────────────┘
```

### 2. Normal Operation Flow

```
Display App Running
       │
       ├──────────── REST API Loop ────────────┐
       │                                        │
       │  Every 30-60s:                         │
       │  POST /api/screen/heartbeat            │
       │    ├─ Report status                    │
       │    ├─ Check for pending commands       │
       │    └─ Execute commands                 │
       │                                        │
       │  Every 60s:                            │
       │  GET /api/screen/prayer-status         │
       │    └─ Update prayer countdown          │
       │                                        │
       │  Every 5-15 minutes:                   │
       │  GET /api/screen/content               │
       │    ├─ Check if update needed           │
       │    └─ Refresh content                  │
       │                                        │
       │  Once per day:                         │
       │  GET /api/screen/prayer-times          │
       │    └─ Get week's prayer times          │
       │                                        │
       └──────────── WebSocket Loop ────────────┤
                                                │
          Persistent Connection:                │
          - Listen for emergency alerts         │
          - Listen for orientation changes      │
          - Listen for remote commands          │
          - Send heartbeat every 30s            │
          - Report errors as they occur         │
                                                │
                    ┌───────────────────────────┘
                    │
                    ▼
            ┌──────────────┐
            │ Update Display│
            │ Render Content│
            └──────────────┘
```

### 3. Emergency Alert Flow

```
Admin Portal               Realtime Server            Display App
     │                            │                        │
     │  1. Trigger Alert          │                        │
     ├───────────────────────────►│                        │
     │  POST /api/displays/emergency                      │
     │                            │                        │
     │                            │  2. Broadcast Alert    │
     │                            ├───────────────────────►│
     │                            │  EMERGENCY_ALERT       │
     │                            │                        │
     │                            │                        ├─ 3. Show Alert
     │                            │                        │   Immediately
     │                            │                        │
     │                            │  4. Acknowledge        │
     │                            │◄───────────────────────┤
     │                            │  display:command:ack   │
     │                            │                        │
     │  5. Alert Metrics          │                        │
     │◄───────────────────────────┤                        │
     │  screen:metrics            │                        │
     │                            │                        │
     │                            │                        │
     │  6. Deactivate Alert       │                        │
     ├───────────────────────────►│                        │
     │  DELETE /api/displays/emergency                    │
     │                            │                        │
     │                            │  7. Clear Alert        │
     │                            ├───────────────────────►│
     │                            │  EMERGENCY_ALERT       │
     │                            │  { action: 'clear' }   │
     │                            │                        │
     │                            │                        ├─ 8. Remove Alert
     │                            │                        │   from Display
```

### 4. Remote Command Flow

```
Admin Portal               API Server              Display App
     │                        │                         │
     │  1. Send Command       │                         │
     ├───────────────────────►│                         │
     │  POST /api/displays/   │                         │
     │  [screenId]/commands   │                         │
     │                        │                         │
     │                        ├─ 2. Queue Command       │
     │                        │   in Database           │
     │                        │                         │
     │                        │                         │
     │                        │  3. Heartbeat           │
     │                        │◄────────────────────────┤
     │                        │  POST /api/screen/      │
     │                        │  heartbeat              │
     │                        │                         │
     │                        │  4. Return Command      │
     │                        ├────────────────────────►│
     │                        │  { pendingCommands }    │
     │                        │                         │
     │                        │                         ├─ 5. Execute
     │                        │                         │   Command
     │                        │                         │
     │                        │  6. Acknowledge         │
     │                        │◄────────────────────────┤
     │                        │  POST /api/screen/      │
     │                        │  heartbeat              │
     │                        │  { commandAcknowledgements }
     │                        │                         │
     │  7. Command Status     │                         │
     │◄───────────────────────┤                         │
     │  WebSocket: screen:    │                         │
     │  command:completed     │                         │
```

### 5. Content Update Flow

```
Display App              API Server              Database
     │                       │                       │
     │  1. Check Sync        │                       │
     ├──────────────────────►│                       │
     │  GET /api/screen/sync │                       │
     │                       │                       │
     │                       │  2. Query Last        │
     │                       │     Updated           │
     │                       ├──────────────────────►│
     │                       │                       │
     │                       │  3. Timestamps        │
     │                       │◄──────────────────────┤
     │                       │                       │
     │  4. Timestamps        │                       │
     │◄──────────────────────┤                       │
     │                       │                       │
     ├─ 5. Compare with      │                       │
     │   Local Cache         │                       │
     │                       │                       │
     ├─ 6. Need Update?      │                       │
     │   Yes                 │                       │
     │                       │                       │
     │  7. Fetch Content     │                       │
     ├──────────────────────►│                       │
     │  GET /api/screen/     │                       │
     │  content              │                       │
     │                       │                       │
     │                       │  8. Query Content     │
     │                       ├──────────────────────►│
     │                       │                       │
     │                       │  9. Content Data      │
     │                       │◄──────────────────────┤
     │                       │                       │
     │  10. Full Content     │                       │
     │◄──────────────────────┤                       │
     │                       │                       │
     ├─ 11. Update Local     │                       │
     │   Cache               │                       │
     │                       │                       │
     ├─ 12. Refresh Display  │                       │
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 401 | Unauthorised | Invalid API key, re-pair device |
| 404 | Not Found | Resource doesn't exist, check request |
| 429 | Too Many Requests | Back off and retry with exponential delay |
| 500 | Server Error | Retry with exponential backoff |
| 503 | Service Unavailable | Server maintenance, retry later |

### Retry Strategy

Implement exponential backoff for failed requests:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // Don't retry client errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error: ${response.status}`);
      }
      
      // Retry server errors with backoff
      lastError = new Error(`Server error: ${response.status}`);
      
    } catch (error) {
      lastError = error;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s...
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  throw lastError;
}
```

### WebSocket Reconnection

Socket.io handles reconnection automatically, but you should handle connection state:

```javascript
const socket = io(REALTIME_URL, {
  auth: { /* credentials */ },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

socket.on('connect', () => {
  console.log('WebSocket connected');
  setConnectionStatus('connected');
  
  // Re-sync after reconnection
  fetchLatestContent();
});

socket.on('disconnect', (reason) => {
  console.log('WebSocket disconnected:', reason);
  setConnectionStatus('disconnected');
  
  if (reason === 'io server disconnect') {
    // Server disconnected us, reconnect manually
    socket.connect();
  }
  // Otherwise socket.io will reconnect automatically
});

socket.on('connect_error', (error) => {
  console.error('WebSocket connection error:', error);
  setConnectionStatus('error');
});

socket.on('reconnect', (attemptNumber) => {
  console.log('WebSocket reconnected after', attemptNumber, 'attempts');
  setConnectionStatus('connected');
  
  // Re-sync after reconnection
  fetchLatestContent();
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('WebSocket reconnection attempt', attemptNumber);
  setConnectionStatus('reconnecting');
});

socket.on('reconnect_failed', () => {
  console.error('WebSocket reconnection failed');
  setConnectionStatus('failed');
});
```

### Offline Handling

```javascript
// Cache content for offline use
async function fetchContent() {
  try {
    const response = await fetchWithRetry(`/api/screen/content?screenId=${screenId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const data = await response.json();
    
    // Cache in IndexedDB
    await db.content.put({
      id: 'latest',
      data: data.data,
      cachedAt: new Date().toISOString()
    });
    
    return data.data;
    
  } catch (error) {
    console.error('Failed to fetch content, using cache:', error);
    
    // Fallback to cached content
    const cached = await db.content.get('latest');
    
    if (cached) {
      showOfflineIndicator();
      return cached.data;
    }
    
    throw new Error('No cached content available');
  }
}

// Monitor network status
window.addEventListener('online', () => {
  console.log('Network online');
  hideOfflineIndicator();
  fetchLatestContent();
  socket.connect();
});

window.addEventListener('offline', () => {
  console.log('Network offline');
  showOfflineIndicator();
});
```

### Error Reporting

Report errors to the backend for admin monitoring:

```javascript
function reportError(errorType, error) {
  // Report via WebSocket if connected
  if (socket.connected) {
    socket.emit('display:error', {
      errorType,
      errorCode: error.code || 'UNKNOWN',
      message: error.message,
      stack: error.stack
    });
  }
  
  // Also log locally
  console.error(`[${errorType}]`, error);
  
  // Store in local error log for debugging
  db.errors.add({
    type: errorType,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
}

// Usage
try {
  await fetchContent();
} catch (error) {
  reportError('CONTENT_LOAD_ERROR', error);
  
  // Fallback to cached content
  const cached = await getCachedContent();
  if (cached) {
    displayContent(cached);
  } else {
    displayErrorScreen('Unable to load content');
  }
}
```

---

## Best Practices

### 1. Caching Strategy

**Cache Everything:**
- Prayer times (update daily)
- Content items (update when changed)
- Events (update when changed)
- Masjid information (rarely changes)

**Cache Storage:**
```javascript
// Use IndexedDB for structured data
const db = await openDB('masjid-connect', 1, {
  upgrade(db) {
    db.createObjectStore('content');
    db.createObjectStore('prayerTimes');
    db.createObjectStore('events');
    db.createObjectStore('credentials');
    db.createObjectStore('errors');
  }
});

// Cache with timestamp
async function cacheData(storeName, key, data) {
  await db.put(storeName, {
    key,
    data,
    cachedAt: new Date().toISOString()
  });
}

// Get cached data with freshness check
async function getCachedData(storeName, key, maxAge = 3600000) {
  const cached = await db.get(storeName, key);
  
  if (!cached) return null;
  
  const age = Date.now() - new Date(cached.cachedAt).getTime();
  
  if (age > maxAge) {
    // Cache expired
    return null;
  }
  
  return cached.data;
}
```

### 2. Request Timing

**Optimise Request Frequency:**

| Endpoint | Frequency | Trigger |
|----------|-----------|---------|
| `/api/screen/heartbeat` | 30-60s | Timer + on command |
| `/api/screen/prayer-status` | 60s | Timer |
| `/api/screen/content` | 5-15 minutes | Timer + WS notification |
| `/api/screen/prayer-times` | Daily | Midnight + app start |
| `/api/screen/events` | 30 minutes | Timer |
| `/api/screen/sync` | Before fetch | Pre-flight check |

**Stagger Requests:**
Don't fetch everything at once. Spread requests over time to reduce server load.

```javascript
// Stagger initial requests
setTimeout(() => fetchPrayerTimes(), 0);
setTimeout(() => fetchContent(), 2000);
setTimeout(() => fetchEvents(), 4000);

// Then set up periodic timers
setInterval(() => fetchPrayerStatus(), 60000);
setInterval(() => fetchContent(), 300000);
setInterval(() => fetchEvents(), 1800000);
```

### 3. Battery & Performance

**For Raspberry Pi / Low-Power Devices:**

- Cache aggressively to reduce network requests
- Use efficient rendering (hardware acceleration)
- Throttle animations and transitions
- Monitor CPU/memory usage and report via heartbeat
- Implement sleep/wake cycles if supported

```javascript
// Monitor system resources
function getSystemMetrics() {
  return {
    cpuUsage: os.loadavg()[0] * 100 / os.cpus().length,
    memoryUsage: (1 - os.freemem() / os.totalmem()) * 100,
    uptime: os.uptime()
  };
}

// Report in heartbeat
setInterval(() => {
  const metrics = getSystemMetrics();
  
  // Throttle if CPU is high
  if (metrics.cpuUsage > 80) {
    reduceAnimations();
  }
  
  socket.emit('display:heartbeat', {
    timestamp: new Date().toISOString(),
    status: 'ONLINE',
    ...metrics
  });
}, 30000);
```

### 4. Security

**Secure Storage:**
- Store API keys in encrypted storage
- Never log API keys
- Validate all incoming data
- Use HTTPS for all REST API requests
- Use WSS for WebSocket connections

```javascript
// Electron secure storage example
const keytar = require('keytar');

// Store credentials securely
await keytar.setPassword('masjid-connect', 'api-key', apiKey);

// Retrieve credentials
const apiKey = await keytar.getPassword('masjid-connect', 'api-key');

// Delete credentials (e.g., on unpair)
await keytar.deletePassword('masjid-connect', 'api-key');
```

### 5. Logging

**Structured Logging:**
```javascript
const logger = {
  info: (message, data) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
    // Send to log service if needed
  },
  
  error: (message, error, data) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error, data);
    // Report to backend
    reportError(message, error);
  },
  
  debug: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
    }
  }
};

// Usage
logger.info('Content fetched successfully', { itemCount: 10 });
logger.error('Failed to fetch prayer times', error, { screenId });
logger.debug('WebSocket heartbeat sent', { timestamp: Date.now() });
```

### 6. User Feedback

**Visual Indicators:**
- Connection status (online/offline)
- Loading states
- Error messages
- Last updated timestamp
- Emergency alert prominence

```javascript
// Connection status indicator
function updateConnectionStatus(status) {
  const indicator = document.getElementById('connection-status');
  
  const states = {
    connected: { color: 'green', text: 'Connected' },
    disconnected: { color: 'red', text: 'Disconnected' },
    reconnecting: { color: 'orange', text: 'Reconnecting...' },
    error: { color: 'red', text: 'Connection Error' }
  };
  
  const state = states[status] || states.disconnected;
  indicator.style.backgroundColor = state.color;
  indicator.textContent = state.text;
}

// Last updated indicator
function showLastUpdated(timestamp) {
  const lastUpdated = document.getElementById('last-updated');
  const timeAgo = formatTimeAgo(new Date(timestamp));
  lastUpdated.textContent = `Last updated: ${timeAgo}`;
}

// Loading overlay
function showLoading(message = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  overlay.querySelector('.message').textContent = message;
  overlay.style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}
```

### 7. Testing

**Test Scenarios:**
- Pairing flow (happy path and errors)
- Network interruptions
- Server downtime
- Invalid/expired credentials
- Emergency alerts
- Remote commands
- Prayer time calculations
- Content rotation
- Cache expiry
- Offline mode

**Mock Server:**
Create a mock server for testing without backend:

```javascript
// mock-server.js
const mockServer = {
  async heartbeat(data) {
    return {
      success: true,
      data: {
        acknowledged: true,
        serverTime: new Date().toISOString(),
        hasPendingEvents: Math.random() > 0.9,
        pendingCommands: [],
        nextHeartbeatInterval: 30000
      }
    };
  },
  
  async getContent() {
    return {
      success: true,
      data: {
        screen: { /* mock screen data */ },
        masjid: { /* mock masjid data */ },
        prayerTimes: [ /* mock prayer times */ ],
        events: [ /* mock events */ ],
        schedule: { /* mock schedule */ }
      }
    };
  }
};

// Use in development
if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_SERVER) {
  // Use mock server
} else {
  // Use real API
}
```

---

## Implementation Checklist

### Phase 1: Device Pairing ✓

- [ ] Implement pairing code request (`POST /api/screens/unpaired`)
- [ ] Display pairing code prominently on screen
- [ ] Poll for pairing status (`POST /api/screens/check-simple`)
- [ ] Retrieve credentials (`POST /api/screens/paired-credentials`)
- [ ] Store credentials securely (encrypted storage)
- [ ] Handle pairing errors and expiry
- [ ] Test pairing flow end-to-end

### Phase 2: REST API Integration ✓

- [ ] Implement authentication (Bearer token in headers)
- [ ] Set up heartbeat loop (`POST /api/screen/heartbeat`)
- [ ] Fetch initial content (`GET /api/screen/content`)
- [ ] Fetch prayer times (`GET /api/screen/prayer-times`)
- [ ] Fetch prayer status (`GET /api/screen/prayer-status`)
- [ ] Fetch events (`GET /api/screen/events`)
- [ ] Implement sync checking (`GET /api/screen/sync`)
- [ ] Handle HTTP errors and retries
- [ ] Implement request timing strategy

### Phase 3: WebSocket Integration ✓

- [ ] Set up WebSocket connection (socket.io-client)
- [ ] Implement authentication handshake
- [ ] Handle connection/disconnection events
- [ ] Implement heartbeat emission
- [ ] Listen for emergency alerts
- [ ] Listen for orientation changes
- [ ] Listen for remote commands
- [ ] Implement command acknowledgements
- [ ] Handle WebSocket errors and reconnection
- [ ] Test WebSocket in various network conditions

### Phase 4: Caching & Offline ✓

- [ ] Set up IndexedDB for caching
- [ ] Cache prayer times (daily)
- [ ] Cache content items (with TTL)
- [ ] Cache events
- [ ] Implement cache freshness checks
- [ ] Fallback to cache when offline
- [ ] Show offline indicator
- [ ] Test offline scenarios

### Phase 5: Display Logic ✓

- [ ] Implement prayer times display
- [ ] Implement prayer countdown timer
- [ ] Implement content rotation
- [ ] Implement event cards
- [ ] Implement emergency alert overlay
- [ ] Handle orientation changes
- [ ] Implement transitions and animations
- [ ] Test various content types

### Phase 6: Error Handling ✓

- [ ] Implement retry logic with exponential backoff
- [ ] Handle authentication errors (re-pairing)
- [ ] Handle network errors
- [ ] Report errors to backend
- [ ] Local error logging
- [ ] Show user-friendly error messages
- [ ] Test error scenarios

### Phase 7: Remote Commands ✓

- [ ] Handle RESTART_APP command
- [ ] Handle RELOAD_CONTENT command
- [ ] Handle CLEAR_CACHE command
- [ ] Handle FORCE_UPDATE command
- [ ] Handle UPDATE_SETTINGS command
- [ ] Handle FACTORY_RESET command
- [ ] Handle CAPTURE_SCREENSHOT command
- [ ] Test all commands

### Phase 8: Testing & QA ✓

- [ ] Unit tests for API client
- [ ] Integration tests for pairing flow
- [ ] E2E tests for display scenarios
- [ ] Network interruption tests
- [ ] Performance tests
- [ ] Security tests
- [ ] Accessibility tests
- [ ] Cross-platform tests (if applicable)

### Phase 9: Optimisation ✓

- [ ] Optimise request frequency
- [ ] Implement efficient caching
- [ ] Reduce memory footprint
- [ ] Optimise rendering performance
- [ ] Battery/power optimisation
- [ ] Network bandwidth optimisation
- [ ] Monitor and report metrics

### Phase 10: Production Readiness ✓

- [ ] Configure production API URLs
- [ ] Implement logging strategy
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Implement analytics (optional)
- [ ] Create deployment scripts
- [ ] Write documentation
- [ ] Create user manual
- [ ] Production testing

---

## Summary

### Key Takeaways

1. **Two Communication Channels:**
   - REST API for data fetching and status reporting
   - WebSocket for real-time updates and commands

2. **Authentication:**
   - Device pairing generates API key
   - API key used for both REST and WebSocket

3. **Caching is Essential:**
   - Cache all content locally
   - Support offline operation
   - Use sync endpoint to check for updates

4. **Error Handling:**
   - Implement robust retry logic
   - Fallback to cached content
   - Report errors to backend

5. **Performance:**
   - Optimise request frequency
   - Stagger initial requests
   - Monitor system resources

6. **Security:**
   - Store credentials securely
   - Use HTTPS/WSS
   - Validate all input

### Support

For questions or issues with implementation:
- Technical Documentation: `/docs/apps/display/`
- API Reference: `/docs/api/`
- Contact: [support email or Slack channel]

---

**Document Version:** 1.0  
**Last Updated:** 26 December 2025  
**Maintained By:** MasjidConnect Development Team

