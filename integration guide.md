# Masjid Display Screen Integration Guide

This document provides guidelines for integrating display screens with the Masjid Admin API, including best practices for API usage, polling frequencies, and error handling strategies.

## API Usage Best Practices

### Authentication

- **Store credentials securely**: Store the API key and screen ID in secure local storage.
- **Refresh credentials**: If authentication fails, attempt to re-pair the screen using the pairing flow.
- **Include headers with every request**:
  ```javascript
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'X-Screen-ID': screenId,
    'Content-Type': 'application/json'
  };
  ```

### Polling Frequencies

To avoid overloading the server, adhere to these recommended polling intervals:

| Endpoint | Recommended Polling Interval | Notes |
|----------|------------------------------|-------|
| `/api/screen/heartbeat` | Every 60 seconds | Maintains the screen's "online" status |
| `/api/screen/content` | Every 5 minutes | Fetches content schedule and configuration |
| `/api/screen/prayer-status` | Every 30 seconds | Updates current prayer information |
| `/api/screen/prayer-times` | Once daily | Fetches prayer times for the week |
| `/api/screen/events` | Every 30 minutes | Updates upcoming events |

### Caching Strategy

- **Cache all responses** with appropriate expiration times:
  - Prayer times: Cache for 24 hours
  - Content: Cache for 5 minutes
  - Events: Cache for 30 minutes
  - Prayer status: Cache for 30 seconds
  
- **Use conditional requests** with the `If-Modified-Since` header when supported to reduce bandwidth usage.

- **Implement local fallbacks** for all critical data to ensure the display continues functioning during connectivity issues.

## Network Optimization

### Bandwidth Conservation

1. **Limit request frequency** according to the polling guidelines above.
2. **Request only what you need**:
   - Use the `count` parameter for the events endpoint
   - Use appropriate date ranges for prayer times

3. **Implement exponential backoff** for failed requests:
   ```javascript
   let retryDelay = 1000; // Start with 1 second
   const maxRetries = 5;
   
   async function fetchWithRetry(url, options, retries = 0) {
     try {
       return await fetch(url, options);
     } catch (error) {
       if (retries >= maxRetries) throw error;
       
       // Exponential backoff with jitter
       const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
       await new Promise(resolve => setTimeout(resolve, retryDelay * jitter));
       
       retryDelay *= 2; // Double the delay for next retry
       return fetchWithRetry(url, options, retries + 1);
     }
   }
   ```

### Offline Handling

1. **Detect offline status** and pause API requests:
   ```javascript
   window.addEventListener('online', resumeApiRequests);
   window.addEventListener('offline', pauseApiRequests);
   ```

2. **Queue updates** to be sent when connectivity is restored.

3. **Display appropriate offline indicators** to users.

## Error Handling

### Common Error Scenarios

| Status Code | Meaning | Recommended Action |
|-------------|---------|-------------------|
| 401 | Unauthorized | Attempt to re-authenticate or initiate pairing flow |
| 404 | Resource not found | Check endpoint URL and parameters |
| 429 | Too many requests | Implement exponential backoff and reduce polling frequency |
| 500 | Server error | Retry with backoff, then use cached data |

### Graceful Degradation

1. **Prioritize critical information**:
   - Prayer times are highest priority
   - Current prayer status is second priority
   - Content and events are lower priority

2. **Implement fallback displays** when data is unavailable:
   - Show cached prayer times with a "last updated" timestamp
   - Display static content when dynamic content is unavailable

3. **Log errors** for troubleshooting but continue operation:
   ```javascript
   try {
     const response = await fetchWithRetry('/api/screen/prayer-status', { headers });
     updatePrayerStatus(await response.json());
   } catch (error) {
     console.error('Failed to fetch prayer status:', error);
     useCachedPrayerStatus();
   }
   ```

## Implementation Example

Here's a simplified example of a display screen client implementation:

```javascript
class MasjidDisplayClient {
  constructor(apiKey, screenId, baseUrl = 'http://localhost:3000/api') {
    this.apiKey = apiKey;
    this.screenId = screenId;
    this.baseUrl = baseUrl;
    this.cache = new Map();
    this.online = navigator.onLine;
    
    // Set up listeners
    window.addEventListener('online', () => {
      this.online = true;
      this.resumePolling();
    });
    
    window.addEventListener('offline', () => {
      this.online = false;
      this.pausePolling();
    });
    
    // Initialize polling
    this.initializePolling();
  }
  
  get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Screen-ID': this.screenId,
      'Content-Type': 'application/json'
    };
  }
  
  async fetchWithCache(endpoint, options = {}, cacheTime = 0) {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if valid
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    try {
      const response = await fetchWithRetry(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: this.headers
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the response if cacheTime > 0
      if (cacheTime > 0) {
        this.cache.set(cacheKey, {
          data,
          expiry: Date.now() + cacheTime
        });
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      
      // Return expired cache as fallback if available
      if (cached) {
        console.log(`Using expired cache for ${endpoint}`);
        return cached.data;
      }
      
      throw error;
    }
  }
  
  // API methods
  async sendHeartbeat() {
    if (!this.online) return null;
    
    return this.fetchWithCache('/screen/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        status: 'ONLINE',
        metrics: {
          uptime: Math.floor(performance.now() / 1000),
          memoryUsage: window.performance?.memory?.usedJSHeapSize || 0,
          lastError: this.lastError || null
        }
      })
    }, 0); // No caching for heartbeat
  }
  
  async getContent() {
    return this.fetchWithCache('/screen/content', {}, 5 * 60 * 1000); // Cache for 5 minutes
  }
  
  async getPrayerStatus() {
    return this.fetchWithCache('/screen/prayer-status', {}, 30 * 1000); // Cache for 30 seconds
  }
  
  async getPrayerTimes(startDate, endDate) {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    
    return this.fetchWithCache(
      `/screen/prayer-times?${query.toString()}`, 
      {}, 
      24 * 60 * 60 * 1000 // Cache for 24 hours
    );
  }
  
  async getEvents(count = 5) {
    return this.fetchWithCache(
      `/screen/events?count=${count}`, 
      {}, 
      30 * 60 * 1000 // Cache for 30 minutes
    );
  }
  
  // Polling management
  initializePolling() {
    // Set up polling intervals
    this.intervals = {
      heartbeat: setInterval(() => this.sendHeartbeat(), 60 * 1000),
      content: setInterval(() => this.getContent(), 5 * 60 * 1000),
      prayerStatus: setInterval(() => this.getPrayerStatus(), 30 * 1000),
      prayerTimes: setInterval(() => this.getPrayerTimes(), 24 * 60 * 60 * 1000),
      events: setInterval(() => this.getEvents(), 30 * 60 * 1000)
    };
    
    // Initial data fetch
    this.getContent();
    this.getPrayerStatus();
    this.getPrayerTimes();
    this.getEvents();
  }
  
  pausePolling() {
    Object.values(this.intervals).forEach(interval => clearInterval(interval));
  }
  
  resumePolling() {
    this.initializePolling();
  }
}

// Helper function for fetch with retry
async function fetchWithRetry(url, options, retries = 0) {
  const maxRetries = 5;
  let retryDelay = 1000;
  
  try {
    return await fetch(url, options);
  } catch (error) {
    if (retries >= maxRetries) throw error;
    
    const jitter = Math.random() * 0.3 + 0.85;
    await new Promise(resolve => setTimeout(resolve, retryDelay * jitter));
    
    retryDelay *= 2;
    return fetchWithRetry(url, options, retries + 1);
  }
}
```

## Performance Considerations

### Memory Management

- **Limit DOM updates** to reduce reflows and repaints
- **Clean up event listeners** when components unmount
- **Monitor memory usage** and implement cleanup routines for long-running displays

### Battery Optimization (for battery-powered displays)

- **Reduce screen brightness** during off-hours
- **Decrease polling frequencies** during low-traffic periods
- **Implement sleep mode** when the masjid is closed

### CPU Usage

- **Throttle animations** to reduce CPU load
- **Optimize rendering** by using efficient DOM operations
- **Implement request batching** to reduce processing overhead

## Troubleshooting

### Common Issues

1. **Authentication failures**:
   - Verify API key and screen ID are correct
   - Check if screen is still active in the admin panel
   - Ensure the clock is synchronized (for token validation)

2. **Stale data**:
   - Clear local cache
   - Verify polling is functioning
   - Check network connectivity

3. **High resource usage**:
   - Reduce polling frequencies
   - Simplify UI animations
   - Check for memory leaks

### Logging

Implement structured logging to assist with troubleshooting:

```javascript
function log(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    screenId: client.screenId,
    ...data
  };
  
  console.log(JSON.stringify(logEntry));
  
  // Optionally send logs to server during heartbeat
  if (level === 'error') {
    client.lastError = `${message}: ${JSON.stringify(data)}`;
  }
}
```

## Security Considerations

1. **Protect API credentials**:
   - Never expose API keys in client-side code
   - Use secure storage for credentials
   - Implement automatic credential rotation

2. **Validate all server responses** before processing

3. **Implement Content Security Policy** to prevent XSS attacks

## Conclusion

Following these guidelines will ensure your display screen application maintains a stable connection to the Masjid Admin API while minimizing server load and providing a reliable experience for masjid visitors.

For additional assistance, refer to the [SCREEN_API_ENDPOINTS.md](./SCREEN_API_ENDPOINTS.md) documentation or contact the development team. 