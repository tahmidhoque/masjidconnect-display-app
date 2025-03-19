# Display App API Integration Documentation

## Authentication & Device Pairing

### Device Pairing Process
1. **Register Display for Pairing**
   - **Endpoint:** `POST /api/screens/unpaired`
   - **Request Body:** 
     ```json
     {
       "deviceInfo": {
         "deviceId": "unique-device-id",
         "model": "Device Model",
         "platform": "Web/Android/iOS"
       }
     }
     ```
   - **Response:** Returns a pairing code to display on the screen
     ```json
     {
       "pairingCode": "123456",
       "expiresAt": "2023-08-01T12:00:00Z"
     }
     ```

2. **Check Pairing Status**
   - **Endpoint:** `POST /api/screens/check-simple`
   - **Request Body:**
     ```json
     {
       "pairingCode": "123456"
     }
     ```
   - **Response:**
     ```json
     {
       "isPaired": true|false,
       "screenId": "screen-id" // Only if paired
     }
     ```

3. **Complete Pairing & Get Credentials**
   - **Endpoint:** `POST /api/screens/paired-credentials`
   - **Request Body:**
     ```json
     {
       "pairingCode": "123456",
       "deviceInfo": {
         "deviceId": "unique-device-id",
         "model": "Device Model",
         "platform": "Web/Android/iOS"
       }
     }
     ```
   - **Response:** Returns API key for subsequent requests
     ```json
     {
       "apiKey": "api-key-for-authentication",
       "screenId": "screen-id",
       "masjidId": "masjid-id"
     }
     ```

## Regular API Usage (After Pairing)

For all subsequent requests, include the API key in the headers:
```
Authorization: Bearer {apiKey}
```

### Heartbeat (Status Update)
- **Endpoint:** `POST /api/screen/heartbeat`
- **Frequency:** Every 30-60 seconds
- **Request Body:**
  ```json
  {
    "screenId": "screen-id",
    "status": "ONLINE",
    "deviceInfo": { /* device info object */ }
  }
  ```
- **Response:** Status 200 OK

### Content Retrieval

1. **Get Screen-Specific Content**
   - **Endpoint:** `GET /api/screen/content?screenId={screenId}`
   - **Response:** Content items to display including announcements, events, verses, etc.
   
2. **Get Current Prayer Times**
   - **Endpoint:** `GET /api/screen/prayer-times?screenId={screenId}`
   - **Response:**
     ```json
     {
       "date": "2023-08-01",
       "fajr": "04:30",
       "sunrise": "05:45",
       "zuhr": "12:30",
       "asr": "15:45",
       "maghrib": "19:15",
       "isha": "20:45",
       "fajrJamaat": "05:00",
       "zuhrJamaat": "13:00",
       "asrJamaat": "16:15",
       "maghribJamaat": "19:25",
       "ishaJamaat": "21:15",
       "jummahKhutbah": "13:15",
       "jummahJamaat": "13:30"
     }
     ```

3. **Get Prayer Status**
   - **Endpoint:** `GET /api/screen/prayer-status?screenId={screenId}`
   - **Response:**
     ```json
     {
       "currentPrayer": "ZUHR",
       "nextPrayer": "ASR",
       "currentPrayerTime": "12:30",
       "currentJamaatTime": "13:00",
       "nextPrayerTime": "15:45",
       "nextJamaatTime": "16:15",
       "timeUntilNextPrayer": "03:15:00", // HH:MM:SS format
       "timeUntilNextJamaat": "03:45:00"
     }
     ```

4. **Get Upcoming Events**
   - **Endpoint:** `GET /api/screen/events?screenId={screenId}`
   - **Response:** List of upcoming events to display
     ```json
     [
       {
         "id": "event-id",
         "title": "Event Title",
         "description": "Event Description",
         "startDate": "2023-08-01T18:00:00Z",
         "endDate": "2023-08-01T20:00:00Z",
         "location": "Main Hall"
       }
     ]
     ```

## Implementation Guidelines

### Display App Best Practices

1. **Persistent Storage**
   - Store the API key securely in local storage after pairing
   - Cache content when possible to handle offline scenarios

2. **Error Handling**
   - Implement exponential backoff for failed requests
   - If API key becomes invalid, prompt for re-pairing
   - Show appropriate fallback content if API is unreachable

3. **Refresh Strategies**
   - Prayer times: Once per day or on app restart
   - Prayer status: Every minute
   - Content: Every 5-15 minutes or when app returns to foreground
   - Heartbeat: Every 30-60 seconds while display is active

4. **Offline Capabilities**
   - Cache the most recent prayer times
   - Use device clock to estimate current prayer even when offline
   - Display last known content with "Last updated" timestamp

5. **Network Efficiency**
   - Use If-Modified-Since headers when appropriate
   - Implement a queue for heartbeat requests if network is spotty

### Display Considerations

1. **Screen Layouts**
   - Support both landscape and portrait orientations
   - Design for various screen sizes (TV, tablet, etc.)
   - Implement appropriate transitions between content types

2. **Prayer Time Display**
   - Highlight current prayer and next prayer
   - Show countdown to next prayer/jamaat
   - Use clear typography and high contrast for readability

3. **Content Rotation**
   - Cycle through announcements, events, and Islamic content
   - Allow for configurable display durations
   - Prioritize time-sensitive content

4. **Prayer in Progress**
   - Show special screen during prayer times
   - Return to regular content after prayer ends

## Example Integration Flow

```javascript
// Initialization
async function initializeDisplay() {
  const apiKey = localStorage.getItem('apiKey');
  const screenId = localStorage.getItem('screenId');
  
  if (apiKey && screenId) {
    // Already paired, start regular content cycle
    startHeartbeat();
    loadContent();
  } else {
    // Start pairing flow
    showPairingScreen();
  }
}

// Pairing process
async function startPairing() {
  try {
    const deviceInfo = getDeviceInfo();
    const response = await fetch('/api/screens/unpaired', {
      method: 'POST',
      body: JSON.stringify({ deviceInfo }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    displayPairingCode(data.pairingCode);
    
    // Start polling to check pairing status
    startPairingStatusCheck(data.pairingCode);
  } catch (error) {
    showError('Failed to start pairing process');
  }
}

// Regular content fetching
async function fetchPrayerTimes() {
  try {
    const response = await fetch(`/api/screen/prayer-times?screenId=${screenId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (response.ok) {
      const prayerTimes = await response.json();
      updatePrayerTimesDisplay(prayerTimes);
      localStorage.setItem('cachedPrayerTimes', JSON.stringify(prayerTimes));
    } else if (response.status === 401) {
      // API key invalid, need to re-pair
      clearCredentials();
      showPairingScreen();
    }
  } catch (error) {
    // Use cached prayer times
    const cachedTimes = localStorage.getItem('cachedPrayerTimes');
    if (cachedTimes) {
      updatePrayerTimesDisplay(JSON.parse(cachedTimes));
    }
  }
}
``` 