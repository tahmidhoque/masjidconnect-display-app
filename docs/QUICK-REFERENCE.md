# Display App Backend Communication - Quick Reference

## Authentication

```javascript
// All REST API requests must include:
headers: {
  'Authorization': 'Bearer {apiKey}'
}

// WebSocket authentication:
auth: {
  type: 'display',
  screenId: 'screen_abc123',
  masjidId: 'masjid_xyz789',
  token: 'sk_live_abc123...'
}
```

## Base URLs

- **REST API:** `https://your-admin-domain.com/api`
- **WebSocket:** `wss://realtime.masjidconnect.app`

---

## REST API Endpoints

### Pairing

| Endpoint | Method | Purpose | Frequency |
|----------|--------|---------|-----------|
| `/api/screens/unpaired` | POST | Get pairing code | Once at setup |
| `/api/screens/check-simple` | POST | Check pairing status | Every 3-5s while pairing |
| `/api/screens/paired-credentials` | POST | Get API key | Once after paired |

### Data Fetching

| Endpoint | Method | Purpose | Frequency |
|----------|--------|---------|-----------|
| `/api/screen/heartbeat` | POST | Report status & get commands | Every 30-60s |
| `/api/screen/content` | GET | Get all content | Every 5-15 mins |
| `/api/screen/prayer-times` | GET | Get prayer times | Daily |
| `/api/screen/prayer-status` | GET | Get current prayer info | Every 60s |
| `/api/screen/events` | GET | Get upcoming events | Every 30 mins |
| `/api/screen/sync` | GET | Check for updates | Before fetching |

---

## Request/Response Examples

### Heartbeat

**Request:**
```json
POST /api/screen/heartbeat
{
  "screenId": "screen_123",
  "status": "ONLINE",
  "deviceInfo": { "deviceType": "DISPLAY" }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "serverTime": "2024-01-01T12:00:00Z",
    "hasPendingEvents": false,
    "pendingCommands": [],
    "nextHeartbeatInterval": 30000
  }
}
```

### Get Content

**Request:**
```http
GET /api/screen/content?screenId=screen_123
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "screen": { /* screen config */ },
    "masjid": { /* masjid info */ },
    "prayerTimes": [ /* prayer times array */ ],
    "events": [ /* events array */ ],
    "schedule": {
      "items": [ /* content items */ ]
    }
  }
}
```

### Prayer Status

**Request:**
```http
GET /api/screen/prayer-status?screenId=screen_123
Authorization: Bearer sk_live_abc123...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentPrayer": { "name": "ZUHR", "time": "12:00" },
    "nextPrayer": { "name": "ASR", "time": "14:30" },
    "currentJamaatTime": "12:30",
    "nextJamaatTime": "15:00",
    "timeUntilNextPrayer": "02:25:30",
    "timeUntilNextJamaat": "02:55:30"
  }
}
```

---

## WebSocket Events

### Events to Emit (Display → Server)

```javascript
// Heartbeat
socket.emit('display:heartbeat', {
  timestamp: new Date().toISOString(),
  status: 'ONLINE',
  cpuUsage: 45.2,
  memoryUsage: 68.5,
  currentContent: 'announcement_123'
});

// Command acknowledgement
socket.emit('display:command:ack', {
  commandId: 'cmd_123',
  commandType: 'RELOAD_CONTENT',
  success: true
});

// Error report
socket.emit('display:error', {
  errorType: 'CONTENT_LOAD_ERROR',
  message: 'Failed to load content',
  errorCode: 'ERR_FETCH_FAILED'
});

// Status update
socket.emit('display:status', {
  status: 'ONLINE',
  oldStatus: 'BUSY'
});

// Content changed
socket.emit('display:content:changed', {
  contentId: 'announcement_123',
  contentType: 'ANNOUNCEMENT'
});
```

### Events to Listen For (Server → Display)

```javascript
// Connection confirmed
socket.on('display:connected', (data) => {
  console.log('Connected:', data.screenId);
});

// Heartbeat acknowledged
socket.on('display:heartbeat:ack', (data) => {
  console.log('Heartbeat ack:', data.serverTime);
});

// Emergency alert
socket.on('EMERGENCY_ALERT', (data) => {
  if (data.action === 'show') {
    showEmergencyAlert(data);
  } else if (data.action === 'clear') {
    clearEmergencyAlert(data.id);
  }
});

// Orientation change
socket.on('SCREEN_ORIENTATION', (data) => {
  updateOrientation(data.orientation);
});

// Remote commands
socket.on('screen:command:RESTART_APP', (data) => {
  app.relaunch();
  app.exit(0);
});

socket.on('screen:command:RELOAD_CONTENT', async (data) => {
  await fetchLatestContent();
  socket.emit('display:command:ack', {
    commandId: data.commandId,
    commandType: 'RELOAD_CONTENT',
    success: true
  });
});

socket.on('screen:command:CLEAR_CACHE', async (data) => {
  await clearCache();
  socket.emit('display:command:ack', {
    commandId: data.commandId,
    commandType: 'CLEAR_CACHE',
    success: true
  });
});
```

---

## Status Values

| Status | Description |
|--------|-------------|
| `ONLINE` | Display active and working |
| `OFFLINE` | Display disconnected |
| `BUSY` | Display performing a task |
| `PAIRING` | Display in pairing mode |

---

## Prayer Names

| Name | Prayer |
|------|--------|
| `FAJR` | Dawn |
| `SUNRISE` | Sunrise (not a prayer) |
| `ZUHR` | Noon |
| `ASR` | Afternoon |
| `MAGHRIB` | Sunset |
| `ISHA` | Night |

---

## Content Types

| Type | Description |
|------|-------------|
| `ANNOUNCEMENT` | Text announcements |
| `VERSE_HADITH` | Quranic verses or Hadith |
| `ASMA_AL_HUSNA` | Names of Allah |
| `EVENT` | Upcoming events |
| `CUSTOM` | Custom HTML/media |

---

## Command Types

| Command | Description |
|---------|-------------|
| `RESTART_APP` | Restart display app |
| `RELOAD_CONTENT` | Refresh content from server |
| `CLEAR_CACHE` | Clear local cache |
| `FORCE_UPDATE` | Force app update |
| `UPDATE_SETTINGS` | Update display settings |
| `FACTORY_RESET` | Reset to defaults |
| `CAPTURE_SCREENSHOT` | Take screenshot |

---

## Error Types

| Type | Description |
|------|-------------|
| `CONTENT_LOAD_ERROR` | Failed to fetch content |
| `PRAYER_TIME_ERROR` | Failed to load prayer times |
| `DISPLAY_ERROR` | Display rendering issue |
| `NETWORK_ERROR` | Network connectivity issue |
| `STORAGE_ERROR` | Local storage error |
| `UNKNOWN_ERROR` | Uncategorised error |

---

## HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 401 | Unauthorised | Re-pair device |
| 404 | Not Found | Check request |
| 429 | Too Many Requests | Back off, retry |
| 500 | Server Error | Retry with backoff |
| 503 | Service Unavailable | Retry later |

---

## Timing Recommendations

| Operation | Frequency | Notes |
|-----------|-----------|-------|
| Heartbeat | 30-60 seconds | More frequent if commands pending |
| Prayer Status | 60 seconds | Update countdown |
| Content Fetch | 5-15 minutes | Check sync first |
| Prayer Times | Daily | Midnight + app start |
| Events | 30 minutes | Check for new events |
| WS Heartbeat | 30 seconds | Keep connection alive |

---

## Pairing Flow Summary

```
1. POST /api/screens/unpaired
   → Get pairing code

2. Display code on screen

3. Poll POST /api/screens/check-simple
   → Wait for admin to pair

4. POST /api/screens/paired-credentials
   → Get API key

5. Store credentials securely

6. Connect WebSocket + Start REST API loops
```

---

## Error Handling

### Retry with Exponential Backoff

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Client error: ${response.status}`);
      }
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
    
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### WebSocket Connection Handling

```javascript
socket.on('connect', () => {
  setConnectionStatus('connected');
  fetchLatestContent();
});

socket.on('disconnect', (reason) => {
  setConnectionStatus('disconnected');
  if (reason === 'io server disconnect') {
    socket.connect();
  }
});

socket.on('reconnect', () => {
  setConnectionStatus('connected');
  fetchLatestContent();
});
```

---

## Caching Strategy

```javascript
// Cache with timestamp
await db.content.put({
  id: 'latest',
  data: contentData,
  cachedAt: new Date().toISOString()
});

// Check freshness before fetch
const cached = await db.content.get('latest');
const age = Date.now() - new Date(cached.cachedAt).getTime();

if (age < MAX_AGE) {
  return cached.data; // Use cache
} else {
  return await fetchFreshContent(); // Fetch new
}
```

---

## Emergency Alert Handling

```javascript
socket.on('EMERGENCY_ALERT', (data) => {
  if (data.action === 'show') {
    // Show alert immediately
    showFullScreenAlert({
      title: data.title,
      message: data.message,
      color: data.color,
      autoCloseAt: data.timing.autoCloseAt
    });
    
    // Auto-close when time expires
    const remaining = data.timing.remaining;
    setTimeout(() => {
      clearEmergencyAlert(data.id);
    }, remaining);
  } else if (data.action === 'clear') {
    // Clear alert
    clearEmergencyAlert(data.id);
  }
});
```

---

## Offline Mode

```javascript
// Monitor network status
window.addEventListener('online', () => {
  hideOfflineIndicator();
  fetchLatestContent();
  socket.connect();
});

window.addEventListener('offline', () => {
  showOfflineIndicator();
});

// Fetch with cache fallback
async function fetchContent() {
  try {
    const data = await fetchFromServer();
    await cacheData(data);
    return data;
  } catch (error) {
    const cached = await getCachedData();
    if (cached) {
      showOfflineIndicator();
      return cached;
    }
    throw new Error('No cached content available');
  }
}
```

---

## Security

```javascript
// Store credentials securely (Electron example)
const keytar = require('keytar');

// Store
await keytar.setPassword('masjid-connect', 'api-key', apiKey);

// Retrieve
const apiKey = await keytar.getPassword('masjid-connect', 'api-key');

// Delete
await keytar.deletePassword('masjid-connect', 'api-key');
```

---

## Testing Checklist

- [ ] Pairing flow (happy path + errors)
- [ ] Network interruptions
- [ ] Server downtime
- [ ] Invalid credentials
- [ ] Emergency alerts
- [ ] Remote commands
- [ ] Prayer calculations
- [ ] Content rotation
- [ ] Cache expiry
- [ ] Offline mode

---

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorised | Invalid API key | Re-pair device |
| Content not updating | Cache not expiring | Check sync timestamps |
| WebSocket disconnects | Network issues | Implement reconnection |
| Prayer times wrong | Timezone mismatch | Verify masjid timezone |
| High CPU usage | Excessive animations | Throttle rendering |

---

## Support

- **Full Documentation:** `/docs/apps/display/DISPLAY-BACKEND-COMMUNICATION.md`
- **API Reference:** `/docs/api/`
- **Example Code:** `/examples/display-app-example.js`

**Last Updated:** 26 December 2025

