# Display App Analytics & Heartbeat Integration Specification

## Overview

This document provides detailed technical specifications for implementing analytics data collection and heartbeat functionality in the MasjidConnect Display App. The analytics system tracks display performance, content engagement, and system health metrics to provide administrators with comprehensive monitoring capabilities.

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Authentication](#authentication)
3. [Data Collection Types](#data-collection-types)
4. [Data Structures](#data-structures)
5. [Implementation Guidelines](#implementation-guidelines)
6. [Error Handling](#error-handling)
7. [Code Examples](#code-examples)
8. [Testing Guidelines](#testing-guidelines)

---

## API Endpoints

### Heartbeat/Analytics Data Submission

**Endpoint:** `POST /api/displays/heartbeat`

**Base URL:** `https://portal.masjidconnect.co.uk` (or localhost:3000 for development. This URL should already be in the .env for the display app)

**Purpose:** Submit various types of analytics data including heartbeats, content views, errors, and schedule events.

---

## Authentication

### Screen API Key Authentication

Every request must include the screen's API key in the Authorization header:

```
Authorization: Bearer <SCREEN_API_KEY>
```

The API key is obtained during the screen pairing process and should be stored securely in the display app.

---

## Data Collection Types

The analytics system supports four main types of data collection:

### 1. Heartbeat Data (`type: "heartbeat"`)
- **Frequency:** Every 30 seconds
- **Purpose:** Monitor system health and performance metrics

### 2. Content View Data (`type: "content_view"`)
- **Frequency:** When content starts/stops displaying
- **Purpose:** Track content engagement and display statistics

### 3. Error Reporting (`type: "error"`)
- **Frequency:** When errors occur
- **Purpose:** Monitor system stability and identify issues

### 4. Schedule Events (`type: "schedule_event"`)
- **Frequency:** When scheduled content changes
- **Purpose:** Track schedule adherence and content transitions

---

## Data Structures

### Request Format

All requests should follow this structure:

```typescript
{
  type: "heartbeat" | "content_view" | "error" | "schedule_event",
  timestamp: string, // ISO 8601 format
  data: object // Type-specific data (see below)
}
```

### 1. Heartbeat Data Structure

```typescript
{
  type: "heartbeat",
  timestamp: "2025-01-26T10:30:00.000Z",
  data: {
    // System Performance (REQUIRED)
    cpuUsage: number,              // CPU usage percentage (0-100)
    memoryUsage: number,           // Memory usage percentage (0-100)
    
    // Storage & Network (REQUIRED)
    storageUsed: number,           // Storage used percentage (0-100)
    networkLatency: number,        // Network latency in milliseconds
    bandwidthUsage: number,        // Current bandwidth usage in Mbps
    
    // Display Metrics (REQUIRED)
    frameRate: number,             // Current frame rate (fps)
    displayBrightness: number,     // Display brightness percentage (0-100)
    resolution: string,            // Current resolution (e.g., "1920x1080")
    
    // Hardware Monitoring (OPTIONAL)
    temperature?: number,          // Device temperature in Celsius
    powerConsumption?: number,     // Power consumption in watts
    ambientLight?: number,         // Ambient light sensor reading (0-100)
    
    // Content Information (REQUIRED)
    currentContent: string,        // ID or name of currently displayed content
    contentLoadTime: number,       // Time taken to load current content (ms)
    contentErrors: number,         // Number of content errors since last heartbeat
    
    // Network Details (REQUIRED)
    signalStrength: number,        // WiFi/Network signal strength percentage (0-100)
    connectionType: string         // Connection type: "wifi", "ethernet", "cellular"
  }
}
```

### 2. Content View Data Structure

```typescript
{
  type: "content_view",
  timestamp: "2025-01-26T10:30:00.000Z",
  data: {
    contentId: string,             // Unique identifier for the content
    contentType: string,           // Type: "announcement", "verse_hadith", "prayer_times", etc.
    startTime: string,             // ISO 8601 timestamp when content started displaying
    endTime?: string,              // ISO 8601 timestamp when content stopped (if applicable)
    duration: number,              // Display duration in milliseconds
    viewComplete: boolean          // Whether the content was fully displayed
  }
}
```

### 3. Error Reporting Data Structure

```typescript
{
  type: "error",
  timestamp: "2025-01-26T10:30:00.000Z",
  data: {
    errorType: "NETWORK" | "CONTENT" | "DISPLAY" | "SYSTEM" | "API",
    errorCode?: string,            // Application-specific error code
    message: string,               // Human-readable error message
    stack?: string,                // Stack trace (if available)
    resolved: boolean              // Whether the error has been resolved
  }
}
```

### 4. Schedule Event Data Structure

```typescript
{
  type: "schedule_event",
  timestamp: "2025-01-26T10:30:00.000Z",
  data: {
    eventType: "content_change" | "schedule_update" | "override_start" | "override_end",
    scheduleId?: string,           // ID of the schedule being executed
    contentId?: string,            // ID of the content being displayed
    expectedStartTime: string,     // When the event was scheduled to occur
    actualStartTime: string,       // When the event actually occurred
    delay?: number                 // Delay in milliseconds (if any)
  }
}
```

---

## Implementation Guidelines

### 1. Data Collection Timing

#### Heartbeat Collection
```typescript
// Send heartbeat every 30 seconds
setInterval(() => {
  sendHeartbeat();
}, 30000);
```

#### Content View Tracking
```typescript
// Track when content starts
function onContentStart(contentId: string, contentType: string) {
  const startTime = new Date().toISOString();
  // Store start time for later use
  currentContentView = {
    contentId,
    contentType,
    startTime,
    viewComplete: false
  };
}

// Track when content ends
function onContentEnd() {
  if (currentContentView) {
    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(currentContentView.startTime).getTime();
    
    sendContentView({
      ...currentContentView,
      endTime,
      duration,
      viewComplete: true
    });
  }
}
```

#### Error Reporting
```typescript
// Report errors immediately
function reportError(error: Error, type: ErrorType) {
  sendError({
    errorType: type,
    message: error.message,
    stack: error.stack,
    resolved: false
  });
}
```

### 2. System Metrics Collection

#### CPU Usage (Example for Electron apps)
```typescript
// For Electron applications
const os = require('os');

function getCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startMeasure = process.cpuUsage();
    
    setTimeout(() => {
      const endMeasure = process.cpuUsage(startMeasure);
      const totalUsage = endMeasure.user + endMeasure.system;
      const percentage = (totalUsage / 1000000) * 100; // Convert to percentage
      resolve(Math.min(percentage, 100));
    }, 100);
  });
}
```

#### Memory Usage
```typescript
function getMemoryUsage(): number {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return (usedMem / totalMem) * 100;
}
```

#### Network Latency
```typescript
async function measureNetworkLatency(): Promise<number> {
  const start = Date.now();
  try {
    await fetch('/api/ping', { method: 'HEAD' });
    return Date.now() - start;
  } catch (error) {
    return -1; // Indicate network error
  }
}
```

### 3. Display Metrics

#### Frame Rate Monitoring
```typescript
let frameCount = 0;
let lastFrameTime = Date.now();

function updateFrameRate() {
  frameCount++;
  const currentTime = Date.now();
  
  if (currentTime - lastFrameTime >= 1000) {
    const fps = frameCount;
    frameCount = 0;
    lastFrameTime = currentTime;
    return fps;
  }
  
  requestAnimationFrame(updateFrameRate);
}
```

### 4. Content Tracking

#### Content Load Time
```typescript
async function loadContent(contentId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    await fetchAndDisplayContent(contentId);
    const loadTime = Date.now() - startTime;
    
    // Include load time in next heartbeat
    lastContentLoadTime = loadTime;
  } catch (error) {
    reportError(error, 'CONTENT');
  }
}
```

---

## Error Handling

### Network Errors
- Implement retry logic with exponential backoff
- Queue data locally if network is unavailable
- Send queued data when connection is restored

### Data Validation
- Validate all data before sending
- Ensure timestamps are in ISO 8601 format
- Check that numeric values are within expected ranges

### Example Error Handling
```typescript
async function sendAnalyticsData(data: AnalyticsData, retries = 3): Promise<void> {
  try {
    const response = await fetch('/api/displays/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    if (retries > 0) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, 3 - retries) * 1000;
      setTimeout(() => sendAnalyticsData(data, retries - 1), delay);
    } else {
      // Queue for later or log error
      queueFailedData(data);
      console.error('Failed to send analytics data:', error);
    }
  }
}
```

---

## Code Examples

### Complete Heartbeat Implementation

```typescript
class AnalyticsManager {
  private apiKey: string;
  private baseUrl: string;
  private heartbeatInterval: NodeJS.Timeout;
  private contentErrors = 0;
  private currentContent = '';
  private lastContentLoadTime = 0;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.startHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 30 seconds
  }

  private async sendHeartbeat() {
    try {
      const heartbeatData = await this.collectHeartbeatData();
      await this.sendData('heartbeat', heartbeatData);
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }

  private async collectHeartbeatData() {
    return {
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      storageUsed: await this.getStorageUsage(),
      networkLatency: await this.measureNetworkLatency(),
      bandwidthUsage: await this.getBandwidthUsage(),
      frameRate: this.getCurrentFrameRate(),
      displayBrightness: await this.getDisplayBrightness(),
      resolution: this.getCurrentResolution(),
      temperature: await this.getDeviceTemperature(),
      currentContent: this.currentContent,
      contentLoadTime: this.lastContentLoadTime,
      contentErrors: this.contentErrors,
      signalStrength: await this.getSignalStrength(),
      connectionType: this.getConnectionType(),
      powerConsumption: await this.getPowerConsumption(),
      ambientLight: await this.getAmbientLight()
    };
  }

  public async sendContentView(data: ContentViewData) {
    await this.sendData('content_view', data);
  }

  public async sendError(data: ErrorData) {
    await this.sendData('error', data);
  }

  public async sendScheduleEvent(data: ScheduleEventData) {
    await this.sendData('schedule_event', data);
  }

  private async sendData(type: string, data: any) {
    const payload = {
      type,
      timestamp: new Date().toISOString(),
      data
    };

    const response = await fetch(`${this.baseUrl}/api/displays/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }
  }

  // Implement all the metric collection methods
  private async getCPUUsage(): Promise<number> {
    // Implementation depends on platform
    return 0;
  }

  private getMemoryUsage(): number {
    // Implementation depends on platform
    return 0;
  }

  // ... other metric collection methods
}
```

### Usage Example

```typescript
// Initialize analytics manager
const analytics = new AnalyticsManager(screenApiKey, backendUrl);

// Track content changes
function displayContent(contentId: string, contentType: string) {
  const startTime = new Date().toISOString();
  
  // Display the content
  showContent(contentId);
  
  // Track the view
  setTimeout(() => {
    analytics.sendContentView({
      contentId,
      contentType,
      startTime,
      endTime: new Date().toISOString(),
      duration: 5000, // 5 seconds
      viewComplete: true
    });
  }, 5000);
}

// Report errors
window.addEventListener('error', (event) => {
  analytics.sendError({
    errorType: 'SYSTEM',
    message: event.error.message,
    stack: event.error.stack,
    resolved: false
  });
});

// Track schedule events
function onScheduleChange(scheduleId: string, contentId: string) {
  analytics.sendScheduleEvent({
    eventType: 'content_change',
    scheduleId,
    contentId,
    expectedStartTime: new Date().toISOString(),
    actualStartTime: new Date().toISOString(),
    delay: 0
  });
}
```

---

## Testing Guidelines

### 1. Development Testing
- Test against local backend: `http://localhost:3000`
- Verify all data types are sent correctly
- Check authentication with valid API keys
- Test error scenarios and retry logic

### 2. Data Validation Testing
- Ensure all required fields are present
- Verify data types and ranges
- Test with invalid data to ensure proper error handling

### 3. Performance Testing
- Monitor impact of analytics collection on display performance
- Test under various network conditions
- Verify heartbeat timing accuracy

### 4. Integration Testing
- Verify data appears correctly in admin dashboard
- Test analytics filtering and time range selection
- Confirm all metrics are calculated correctly

---

## Important Notes

1. **API Key Security**: Store API keys securely and never log them
2. **Data Privacy**: Ensure no sensitive information is included in analytics data
3. **Performance Impact**: Analytics collection should not impact display performance
4. **Network Efficiency**: Batch data when possible to reduce network requests
5. **Error Recovery**: Implement robust error handling and retry mechanisms
6. **Time Synchronization**: Ensure device time is synchronized for accurate timestamps

---

## Support and Troubleshooting

### Common Issues

1. **Authentication Failures**: Verify API key is correct and not expired
2. **Network Timeouts**: Implement proper timeout handling (30 seconds recommended)
3. **Data Validation Errors**: Check data structure matches specification exactly
4. **Performance Issues**: Monitor analytics overhead and optimize collection frequency if needed

### Debug Mode

For development, implement a debug mode that logs all analytics data before sending:

```typescript
if (DEBUG_MODE) {
  console.log('Sending analytics data:', JSON.stringify(payload, null, 2));
}
```

This specification should provide the display app development team with all necessary information to implement comprehensive analytics and heartbeat functionality that integrates seamlessly with the MasjidConnect backend system. 