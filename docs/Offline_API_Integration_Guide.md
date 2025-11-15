# MasjidConnect Display App - Offline API Integration Guide

## Overview

This document outlines the backend API requirements to support the enhanced offline capabilities in the MasjidConnect Display App. The frontend has been updated with robust offline functionality, and this guide explains how the backend endpoints should be designed to work seamlessly with these changes.

## Key Offline Features Implemented

1. **Client-side Data Caching**: All API responses are cached in IndexedDB (via localforage)
2. **Service Worker with Workbox**: Strategic caching of assets and API responses
3. **Intelligent Fallback Logic**: System uses cached data when offline
4. **Offline Prayer Time Calculations**: Local computation when network is unavailable
5. **Synchronization Mechanism**: Updates when connection is restored

## Backend API Requirements

### 1. Response Format Standardization

All API endpoints should follow a consistent response format:

```json
{
  "success": boolean,
  "data": object | array | null,
  "error": string | null,
  "timestamp": ISO8601 string,
  "cacheControl": {
    "maxAge": number,
    "staleWhileRevalidate": number
  }
}
```

#### Fields Explanation:

- `success`: Boolean indicating if the request was successful
- `data`: The actual response data (null for error responses)
- `error`: Error message (null for successful responses)
- `timestamp`: Server timestamp to track data freshness
- `cacheControl`: Cache directives for the client

### 2. HTTP Headers for Caching

Backend endpoints should include appropriate cache-control headers:

```
Cache-Control: max-age=<seconds>, stale-while-revalidate=<seconds>
ETag: "<entity-tag>"
Last-Modified: <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT
```

### 3. Required API Endpoints

#### 3.1 Prayer Times Endpoint

**GET /api/prayer-times**

- Should return prayer times for multiple days (at least 7 days)
- Include metadata about calculation methods
- Support conditional requests with If-Modified-Since
- Support date range parameters

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2023-05-01",
      "fajr": "04:30",
      "sunrise": "06:00",
      "zuhr": "13:00",
      "asr": "16:30",
      "maghrib": "19:45",
      "isha": "21:15",
      "fajrJamaat": "05:00",
      "zuhrJamaat": "13:30",
      "asrJamaat": "17:00",
      "maghribJamaat": "19:50",
      "ishaJamaat": "21:30"
    },
    {
      // Additional days...
    }
  ],
  "timestamp": "2023-05-01T00:00:00Z",
  "cacheControl": {
    "maxAge": 86400,
    "staleWhileRevalidate": 604800
  }
}
```

#### 3.2 Prayer Status Endpoint

**GET /api/prayer-status**

- Return current and next prayer details
- Include time information and durations
- Include timestamp of calculation

**Example Response:**

```json
{
  "success": true,
  "data": {
    "currentPrayer": {
      "name": "ZUHR",
      "time": "13:00"
    },
    "nextPrayer": {
      "name": "ASR",
      "time": "16:30"
    },
    "currentPrayerTime": "13:00",
    "currentJamaatTime": "13:30",
    "nextPrayerTime": "16:30",
    "nextJamaatTime": "17:00",
    "timeUntilNextPrayer": "03:30:00",
    "timeUntilNextJamaat": "04:00:00",
    "timestamp": "2023-05-01T13:15:00Z",
    "isAfterIsha": false
  },
  "timestamp": "2023-05-01T13:15:00Z",
  "cacheControl": {
    "maxAge": 60,
    "staleWhileRevalidate": 3600
  }
}
```

#### 3.3 Screen Content Endpoint

**GET /api/screens/content**

- Return complete display screen content
- Support incremental updates
- Include version information

**Example Response:**

```json
{
  "success": true,
  "data": {
    "screen": {
      "id": "screen-123",
      "name": "Main Prayer Hall",
      "orientation": "LANDSCAPE",
      "contentConfig": {
        /* configuration */
      }
    },
    "masjid": {
      "name": "Masjid Al-Noor",
      "timezone": "America/New_York"
    },
    "schedule": {
      /* schedule data */
    },
    "prayerTimes": {
      /* prayer times data */
    },
    "contentOverrides": [
      /* overrides */
    ],
    "lastUpdated": "2023-05-01T12:00:00Z"
  },
  "timestamp": "2023-05-01T12:00:00Z",
  "cacheControl": {
    "maxAge": 300,
    "staleWhileRevalidate": 3600
  }
}
```

#### 3.4 Events Endpoint

**GET /api/events**

- Return upcoming events
- Support count parameter
- Include date range information

**Example Response:**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event-123",
        "title": "Quran Study",
        "description": "Weekly Quran study session",
        "location": "Main Hall",
        "startDate": "2023-05-02T19:00:00Z",
        "endDate": "2023-05-02T21:00:00Z",
        "category": "education"
      },
      {
        // Additional events...
      }
    ]
  },
  "timestamp": "2023-05-01T12:00:00Z",
  "cacheControl": {
    "maxAge": 1800,
    "staleWhileRevalidate": 86400
  }
}
```

#### 3.5 Heartbeat Endpoint

**POST /api/screen/heartbeat**

- Accept status updates from the display
- Return minimal response
- Support tracking of screen connectivity

**Request Body:**

```json
{
  "screenId": "screen-123",
  "status": "ONLINE",
  "deviceInfo": {
    "uptime": 3600,
    "memoryUsage": 75,
    "lastError": ""
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "serverTime": "2023-05-01T13:15:00Z"
  },
  "timestamp": "2023-05-01T13:15:00Z"
}
```

### 4. Handling Offline Reconnection

#### 4.1 Data Synchronization Endpoint

**GET /api/sync**

- Return timestamps of latest data for each resource type
- Allow clients to determine what needs updating

**Example Response:**

```json
{
  "success": true,
  "data": {
    "prayerTimes": "2023-05-01T00:00:00Z",
    "events": "2023-05-01T10:30:00Z",
    "content": "2023-05-01T08:15:00Z",
    "announcements": "2023-05-01T12:45:00Z"
  },
  "timestamp": "2023-05-01T13:15:00Z"
}
```

#### 4.2 Bulk Update Support

**POST /api/sync/bulk**

- Accept a list of resources to fetch
- Return multiple resources in one response
- Reduce number of requests needed after reconnection

**Request Body:**

```json
{
  "resources": ["prayerTimes", "events", "content"],
  "sinceTimestamp": "2023-05-01T08:00:00Z"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "prayerTimes": {
      /* prayer times data */
    },
    "events": {
      /* events data */
    },
    "content": {
      /* content data */
    }
  },
  "timestamp": "2023-05-01T13:15:00Z"
}
```

## Recommended Implementation Practices

### 1. HTTP Status Codes

Use appropriate HTTP status codes:

- `200 OK`: Successful response
- `304 Not Modified`: When content hasn't changed (with If-Modified-Since/ETag)
- `400 Bad Request`: Client error
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

### 2. Versioning

Include API version information:

- In URL: `/api/v1/prayer-times`
- Or in header: `Accept: application/vnd.masjidconnect.v1+json`

### 3. Compression

Enable compression to reduce payload size:

- Support gzip/brotli compression
- Set appropriate `Content-Encoding` headers

### 4. CORS Headers

Ensure proper CORS headers for cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

## Client-Server Interaction Patterns

### 1. Initial Data Load

1. Client requests all required data
2. Server responds with full data sets
3. Client caches all data in IndexedDB

### 2. Regular Updates

1. Client periodically requests updates with If-Modified-Since
2. Server returns 304 if no changes, or full/partial data if changed
3. Client updates cache with new data

### 3. Offline Mode

1. Client detects network disconnection
2. Data requests are served from local cache
3. UI indicates offline status with the subtle indicator
4. Calculations (like current prayer status) happen locally

### 4. Reconnection

1. Client detects network restoration
2. Requests `/api/sync` to identify outdated resources
3. Fetches only the resources that have changed
4. Updates local cache with fresh data
5. UI indicates connection has been restored

## Security Considerations

- Ensure authentication tokens are cached securely
- Include token refresh mechanism that works with offline mode
- Consider implementing a reduced set of features in offline mode if security is a concern

## Performance Recommendations

- Keep response payloads small
- Use compression
- Implement HTTP/2 for multiplexing requests
- Consider implementing a time-to-live (TTL) for cached data
- Use binary formats for large datasets if appropriate

## Conclusion

By following these guidelines, the backend API will integrate seamlessly with the enhanced offline capabilities in the MasjidConnect Display App, providing users with a reliable experience even in unstable network conditions.
