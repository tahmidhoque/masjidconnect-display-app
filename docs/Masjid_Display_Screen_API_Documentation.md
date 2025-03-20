# Masjid Display Screen API Documentation

## Overview

This document outlines the APIs available for the display screen application that will connect to the masjid management system. The display screen will show prayer times, announcements, events, and other content configured through the management system.

## Authentication

### Screen Authentication
All display screen API requests must include:
- `Authorization` header with `Bearer {apiKey}`
- `X-Screen-ID` header with the screen's unique ID

These credentials are obtained during the pairing process.

## API Endpoints

### 1. Screen Pairing

#### A. Check Unpaired Screens
```
GET /api/screens/unpaired
```
Returns a list of screens that are in the PAIRING state.

#### B. Pair a Screen
```
POST /api/screens/pair
```
**Request Body:**
```json
{
  "pairingCode": "string",
  "deviceInfo": {
    "deviceType": "string",
    "orientation": "LANDSCAPE | PORTRAIT"
  }
}
```
**Response:**
```json
{
  "screen": {
    "id": "string",
    "name": "string",
    "apiKey": "string"
  }
}
```

### 2. Screen Heartbeat
```
POST /api/screen/heartbeat
```
**Headers:**
- `Authorization: Bearer {apiKey}`
- `X-Screen-ID: {screenId}`

**Request Body:**
```json
{
  "status": "ONLINE",
  "metrics": {
    "uptime": "number",
    "memoryUsage": "number",
    "lastError": "string"
  }
}
```
**Response:**
```json
{
  "success": true,
  "screen": {
    "id": "string",
    "name": "string",
    "orientation": "LANDSCAPE | PORTRAIT",
    "schedule": { /* schedule details */ },
    "masjid": {
      "id": "string",
      "name": "string",
      "timezone": "string"
    }
  }
}
```

### 3. Fetch Screen Content
```
GET /api/screen/content
```
**Headers:**
- `Authorization: Bearer {apiKey}`
- `X-Screen-ID: {screenId}`

**Response:**
```json
{
  "screen": {
    "id": "string",
    "name": "string",
    "orientation": "LANDSCAPE | PORTRAIT",
    "contentConfig": "object"
  },
  "masjid": {
    "name": "string",
    "timezone": "string"
  },
  "schedule": {
    "id": "string",
    "name": "string",
    "items": [
      {
        "id": "string",
        "order": "number",
        "contentItem": {
          "id": "string",
          "type": "VERSE_HADITH | ANNOUNCEMENT | EVENT | CUSTOM | ASMA_AL_HUSNA",
          "title": "string",
          "content": "object",
          "duration": "number"
        }
      }
    ]
  },
  "prayerTimes": {
    "date": "string",
    "fajr": "string",
    "sunrise": "string",
    "zuhr": "string",
    "asr": "string",
    "maghrib": "string",
    "isha": "string",
    "fajrJamaat": "string",
    "zuhrJamaat": "string",
    "asrJamaat": "string",
    "maghribJamaat": "string",
    "ishaJamaat": "string",
    "jummahKhutbah": "string",
    "jummahJamaat": "string"
  },
  "contentOverrides": [
    {
      "contentType": "string",
      "enabled": "boolean",
      "config": "object"
    }
  ],
  "lastUpdated": "string"
}
```

## Content Types

The system supports the following content types that can be displayed on screens:

1. **VERSE_HADITH**: Islamic verses and hadith
2. **ANNOUNCEMENT**: Masjid announcements
3. **EVENT**: Upcoming events and programs
4. **CUSTOM**: Custom content (text, images, etc.)
5. **ASMA_AL_HUSNA**: The 99 names of Allah

Each content type has specific structure in the `content` field of the ContentItem.

## Identified Gaps & Enhancement Recommendations

Based on the codebase analysis, here are the gaps that need to be addressed for a complete display screen implementation:

### 1. Future Prayer Times API

**Gap:** The current API only provides today's prayer times. For a display screen, it's useful to have access to upcoming prayer times as well.

**Recommendation:** Create a new endpoint to fetch prayer times for a specified date range:

```
GET /api/screen/prayer-times
Query Parameters:
- startDate: ISO date string
- endDate: ISO date string
```

**Response Example:**
```json
{
  "prayerTimes": [
    {
      "date": "2023-04-01",
      "fajr": "05:15",
      "sunrise": "06:45",
      "zuhr": "13:15",
      "asr": "16:45",
      "maghrib": "19:30",
      "isha": "21:00",
      "fajrJamaat": "05:45",
      "zuhrJamaat": "13:45",
      "asrJamaat": "17:15",
      "maghribJamaat": "19:40",
      "ishaJamaat": "21:30"
    },
    // Additional days...
  ]
}
```

### 2. Events API

**Gap:** While there's an event content type, there's no specialized API to fetch upcoming events.

**Recommendation:** Create an endpoint to fetch upcoming events:

```
GET /api/screen/events
Query Parameters:
- count: number (default 5)
```

**Response Example:**
```json
{
  "events": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "location": "string",
      "startDate": "datetime",
      "endDate": "datetime",
      "category": "string"
    }
  ]
}
```

### 3. Current Prayer Status 

**Gap:** There's no API to determine the current prayer status (e.g., which prayer is next, time until next prayer).

**Recommendation:** Create an endpoint to get the current prayer status:

```
GET /api/screen/prayer-status
```

**Response Example:**
```json
{
  "currentPrayer": "ASR",
  "currentPrayerTime": "16:45",
  "currentPrayerJamaat": "17:15",
  "nextPrayer": "MAGHRIB", 
  "nextPrayerTime": "19:30",
  "nextPrayerJamaat": "19:40",
  "timeUntilNextPrayer": "02:45:00",
  "timeUntilNextJamaat": "03:00:00"
}
```

### 4. Screen Configuration Update

**Gap:** There's no way for the display to update its configuration outside of the heartbeat.

**Recommendation:** Create an endpoint for the screen to update its configuration:

```
PUT /api/screen/config
```

**Request Body:**
```json
{
  "orientation": "LANDSCAPE | PORTRAIT",
  "contentConfig": {
    "transitionDuration": "number",
    "enabledContentTypes": ["VERSE_HADITH", "ANNOUNCEMENT", "EVENT"],
    "customSettings": {}
  }
}
```

### 5. Support for Offline Mode

**Gap:** The system doesn't currently support caching or offline functionality.

**Recommendation:** Add support for the display to download content for offline use:

```
GET /api/screen/offline-data
```

**Response Example:**
```json
{
  "contentItems": [...],
  "prayerTimes": [...],
  "announcements": [...],
  "events": [...],
  "configuration": {...},
  "expiresAt": "datetime"
}
```

### 6. Real-time Updates

**Gap:** The screen must poll for updates, which is inefficient.

**Recommendation:** Implement WebSocket support for real-time updates:

```
WebSocket: /api/ws/screen
```

**Events:**
- `content-updated`: When content items are updated
- `prayer-times-updated`: When prayer times are updated
- `config-updated`: When screen configuration is updated
- `force-refresh`: Force screen to refresh all data

## Implementation Guide for Display Screen

### Architecture Overview

The display screen application should be structured as follows:

1. **Authentication Layer**
   - Handles pairing and API authentication
   - Securely stores credentials

2. **Data Layer**
   - Fetches and caches content from API
   - Manages offline data
   - Synchronizes with server

3. **Presentation Layer**
   - Renders different content types
   - Handles transitions between content
   - Displays prayer times and status
   - Shows announcements and events

### Implementation Steps

1. **Initialization:**
   - Start with a pairing flow if no credentials exist
   - Store API key and screen ID securely
   - Configure timezone based on masjid settings

2. **Data Synchronization:**
   - Fetch initial content via `/api/screen/content`
   - Send heartbeat every 30-60 seconds
   - Check for content updates every 5 minutes or upon schedule change notification

3. **UI Components:**
   - Prayer Times Display
   - Announcement Ticker/Carousel
   - Event Schedule
   - Custom Content Display
   - Islamic Content (Verses, Hadiths, Asma al-Husna)

4. **Error Handling:**
   - Implement robust offline error recovery
   - Cache content for offline display
   - Auto-reconnect when connection is restored

5. **Responsive Design:**
   - Support both landscape and portrait orientations
   - Scale content appropriately for different screen sizes

### Display Screen Requirements

1. **Hardware:**
   - Support for various screen resolutions (HD, Full HD, 4K)
   - Touchscreen support (optional for interactive displays)
   - Internet connectivity (Ethernet/Wi-Fi)

2. **Software:**
   - Web-based application (Progressive Web App recommended)
   - Offline capability
   - Auto-update mechanism
   - Crash recovery
   - Low resource usage

3. **Networking:**
   - Support for proxy configurations
   - Fallback mechanisms for temporary connectivity loss
   - Bandwidth optimization

## API Implementation Tasks

To fulfill the identified gaps, the following new API endpoints should be implemented:

1. Create `/api/screen/prayer-times` endpoint
2. Create `/api/screen/events` endpoint 
3. Create `/api/screen/prayer-status` endpoint
4. Create `/api/screen/config` endpoint
5. Create `/api/screen/offline-data` endpoint
6. Implement WebSocket support for real-time updates

## Security Considerations

1. **API Key Security**
   - Implement rate limiting
   - Set appropriate API key expiration
   - Monitor for suspicious activity

2. **Secure Communication**
   - Enforce HTTPS for all API calls
   - Implement proper CORS settings

3. **Data Privacy**
   - Ensure sensitive information is not exposed to displays
   - Implement proper data pruning for cached information

## Testing Strategy

1. **Unit Testing**
   - Test each API endpoint independently
   - Validate request/response formats

2. **Integration Testing**
   - Test the complete flow from management system to display
   - Verify real-time updates

3. **Stress Testing**
   - Test with multiple concurrent display screens
   - Simulate network interruptions

4. **User Acceptance Testing**
   - Verify content displays correctly
   - Ensure prayer times are accurate
   - Test in real mosque environments 