# MasjidConnect Backend - Offline Support Implementation Examples

This document provides code examples for implementing backend endpoints that support the offline functionality requirements outlined in the Offline API Integration Guide.

## Node.js/Express Implementation Examples

### Setting Up Required Middleware

```javascript
const express = require("express");
const cors = require("cors");
const compression = require("compression");

const app = express();

// Enable CORS for all routes
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
    credentials: true,
  }),
);

// Enable compression
app.use(compression());

// Parse JSON request bodies
app.use(express.json());

// Add cache control headers middleware
const addCacheControlHeaders = (maxAge, staleWhileRevalidate) => {
  return (req, res, next) => {
    res.set(
      "Cache-Control",
      `max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    );
    next();
  };
};

// Add timestamp to all responses
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (body && typeof body === "object") {
      body.timestamp = new Date().toISOString();
    }
    return originalJson.call(this, body);
  };
  next();
});
```

### Prayer Times Endpoint

```javascript
// Prayer times endpoint with caching headers
app.get(
  "/api/prayer-times",
  addCacheControlHeaders(86400, 604800),
  async (req, res) => {
    try {
      // Parse date range parameters
      const startDate =
        req.query.startDate || new Date().toISOString().split("T")[0];
      const endDate = req.query.endDate;

      // Check If-Modified-Since header
      const ifModifiedSince = req.get("If-Modified-Since");
      const lastModified = await getPrayerTimesLastModifiedDate();

      if (
        ifModifiedSince &&
        new Date(ifModifiedSince) >= new Date(lastModified)
      ) {
        // Data hasn't changed
        return res.status(304).end();
      }

      // Set Last-Modified header
      res.set("Last-Modified", new Date(lastModified).toUTCString());

      // Get prayer times from database
      const prayerTimes = await getPrayerTimesForDateRange(startDate, endDate);

      // Return standardized response
      res.json({
        success: true,
        data: prayerTimes,
        cacheControl: {
          maxAge: 86400,
          staleWhileRevalidate: 604800,
        },
      });
    } catch (error) {
      console.error("Error fetching prayer times:", error);
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to fetch prayer times",
        cacheControl: {
          maxAge: 60,
          staleWhileRevalidate: 3600,
        },
      });
    }
  },
);

// Helper functions (implementation depends on your data source)
async function getPrayerTimesLastModifiedDate() {
  // Return the last time prayer times were updated in the database
  // ...
}

async function getPrayerTimesForDateRange(startDate, endDate) {
  // Fetch prayer times from database for the given date range
  // ...
}
```

### Prayer Status Endpoint

```javascript
// Prayer status endpoint with shorter cache time
app.get(
  "/api/prayer-status",
  addCacheControlHeaders(60, 3600),
  async (req, res) => {
    try {
      // Get prayer times for today
      const today = new Date().toISOString().split("T")[0];
      const prayerTimes = await getPrayerTimesForDate(today);

      // Calculate current and next prayer
      const now = new Date();
      const { currentPrayer, nextPrayer } = calculatePrayerStatus(
        prayerTimes,
        now,
      );

      // Calculate time until next prayer
      const timeUntilNextPrayer = calculateTimeUntil(nextPrayer.time);
      const timeUntilNextJamaat = calculateTimeUntil(nextPrayer.jamaatTime);

      // Return standardized response
      res.json({
        success: true,
        data: {
          currentPrayer: {
            name: currentPrayer.name,
            time: currentPrayer.time,
          },
          nextPrayer: {
            name: nextPrayer.name,
            time: nextPrayer.time,
          },
          currentPrayerTime: currentPrayer.time,
          currentJamaatTime: currentPrayer.jamaatTime,
          nextPrayerTime: nextPrayer.time,
          nextJamaatTime: nextPrayer.jamaatTime,
          timeUntilNextPrayer,
          timeUntilNextJamaat,
          timestamp: now.toISOString(),
          isAfterIsha: currentPrayer.name === "ISHA",
        },
        cacheControl: {
          maxAge: 60,
          staleWhileRevalidate: 3600,
        },
      });
    } catch (error) {
      console.error("Error calculating prayer status:", error);
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to calculate prayer status",
        cacheControl: {
          maxAge: 60,
          staleWhileRevalidate: 300,
        },
      });
    }
  },
);

// Helper functions (implementation depends on your data source and calculation methods)
async function getPrayerTimesForDate(date) {
  // Fetch prayer times from database for the given date
  // ...
}

function calculatePrayerStatus(prayerTimes, currentTime) {
  // Calculate current and next prayer based on current time
  // ...
}

function calculateTimeUntil(timeStr) {
  // Calculate duration until the given time in HH:MM:SS format
  // ...
}
```

### Synchronization Endpoint

```javascript
// Sync endpoint to check for data updates
app.get("/api/sync", async (req, res) => {
  try {
    // Collect last update timestamps for different resources
    const lastUpdates = await getLastUpdateTimestamps();

    res.json({
      success: true,
      data: lastUpdates,
      cacheControl: {
        maxAge: 60,
        staleWhileRevalidate: 300,
      },
    });
  } catch (error) {
    console.error("Error fetching sync info:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch sync information",
      cacheControl: {
        maxAge: 60,
        staleWhileRevalidate: 300,
      },
    });
  }
});

// Bulk data sync endpoint
app.post("/api/sync/bulk", async (req, res) => {
  try {
    const { resources, sinceTimestamp } = req.body;

    if (!resources || !Array.isArray(resources)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Invalid resources array",
        cacheControl: {
          maxAge: 60,
          staleWhileRevalidate: 300,
        },
      });
    }

    // Collect requested resources
    const data = {};

    // Fetch each requested resource
    await Promise.all(
      resources.map(async (resource) => {
        if (resource === "prayerTimes") {
          data.prayerTimes = await getPrayerTimesUpdatedSince(sinceTimestamp);
        } else if (resource === "events") {
          data.events = await getEventsUpdatedSince(sinceTimestamp);
        } else if (resource === "content") {
          data.content = await getContentUpdatedSince(sinceTimestamp);
        }
        // Add other resources as needed
      }),
    );

    res.json({
      success: true,
      data,
      cacheControl: {
        maxAge: 300,
        staleWhileRevalidate: 3600,
      },
    });
  } catch (error) {
    console.error("Error fetching bulk data:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch bulk data",
      cacheControl: {
        maxAge: 60,
        staleWhileRevalidate: 300,
      },
    });
  }
});

// Helper functions (implementation depends on your data source)
async function getLastUpdateTimestamps() {
  // Return the last update timestamps for each resource
  // ...
}

async function getPrayerTimesUpdatedSince(timestamp) {
  // Return prayer times data updated since the given timestamp
  // ...
}

async function getEventsUpdatedSince(timestamp) {
  // Return events data updated since the given timestamp
  // ...
}

async function getContentUpdatedSince(timestamp) {
  // Return content data updated since the given timestamp
  // ...
}
```

## Database Schema Example (MongoDB)

Here's an example of MongoDB schemas that support the offline functionality:

```javascript
const mongoose = require("mongoose");

// Prayer Times Schema
const prayerTimeSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    index: true,
  },
  fajr: String,
  sunrise: String,
  zuhr: String,
  asr: String,
  maghrib: String,
  isha: String,
  fajrJamaat: String,
  zuhrJamaat: String,
  asrJamaat: String,
  maghribJamaat: String,
  ishaJamaat: String,
  jummahKhutbah: String,
  jummahJamaat: String,
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Event Schema
const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  location: String,
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  endDate: Date,
  category: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Screen Schema
const screenSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  apiKey: {
    type: String,
    required: true,
  },
  orientation: {
    type: String,
    enum: ["LANDSCAPE", "PORTRAIT"],
    default: "LANDSCAPE",
  },
  contentConfig: {
    type: Object,
    default: {},
  },
  lastHeartbeat: Date,
  status: {
    type: String,
    enum: ["ONLINE", "OFFLINE", "ERROR"],
    default: "OFFLINE",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Heartbeat Schema (for logging)
const heartbeatSchema = new mongoose.Schema({
  screenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Screen",
    required: true,
  },
  status: {
    type: String,
    enum: ["ONLINE", "OFFLINE", "ERROR"],
    required: true,
  },
  deviceInfo: {
    uptime: Number,
    memoryUsage: Number,
    lastError: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Add pre-save hooks to update the updatedAt timestamp
prayerTimeSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

eventSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

screenSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Create models
const PrayerTime = mongoose.model("PrayerTime", prayerTimeSchema);
const Event = mongoose.model("Event", eventSchema);
const Screen = mongoose.model("Screen", screenSchema);
const Heartbeat = mongoose.model("Heartbeat", heartbeatSchema);

module.exports = {
  PrayerTime,
  Event,
  Screen,
  Heartbeat,
};
```

## Redis Implementation for Caching

You can use Redis to cache API responses for faster access:

```javascript
const redis = require("redis");
const { promisify } = require("util");

// Create Redis client
const client = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

// Promisify Redis commands
const getAsync = promisify(client.get).bind(client);
const setexAsync = promisify(client.setex).bind(client);

// Middleware for Redis caching
const cacheMiddleware = (prefix, expiryInSeconds) => {
  return async (req, res, next) => {
    try {
      // Create a cache key based on the request path and query parameters
      const cacheKey = `${prefix}:${req.originalUrl}`;

      // Check if the data exists in cache
      const cachedData = await getAsync(cacheKey);

      if (cachedData) {
        // Return cached data
        const data = JSON.parse(cachedData);
        return res.json({
          ...data,
          cached: true,
          timestamp: new Date().toISOString(),
        });
      }

      // Store the original res.json function
      const originalJson = res.json;

      // Override res.json method to cache the response
      res.json = function (body) {
        if (body && body.success) {
          // Only cache successful responses
          setexAsync(cacheKey, expiryInSeconds, JSON.stringify(body)).catch(
            (err) => console.error(`Error caching response: ${err}`),
          );
        }

        // Call the original method
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      console.error("Cache middleware error:", error);
      next();
    }
  };
};

// Apply cache middleware to prayer times endpoint
app.get(
  "/api/prayer-times",
  cacheMiddleware("prayer-times", 86400),
  async (req, res) => {
    // Endpoint implementation
    // ...
  },
);
```

## Authentication with Offline Support

Here's an example of authentication that works with offline mode:

```javascript
// Token refresh endpoint that supports offline mode
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Refresh token is required",
        cacheControl: {
          maxAge: 0,
          staleWhileRevalidate: 0,
        },
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Get user from database
    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        error: "User not found",
        cacheControl: {
          maxAge: 0,
          staleWhileRevalidate: 0,
        },
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Set long expiry for offline use
    const expiresIn = 30 * 24 * 60 * 60; // 30 days

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      },
      cacheControl: {
        maxAge: 0,
        staleWhileRevalidate: 0,
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({
      success: false,
      data: null,
      error: "Invalid refresh token",
      cacheControl: {
        maxAge: 0,
        staleWhileRevalidate: 0,
      },
    });
  }
});

// Helper functions for authentication
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "24h" }, // Longer expiry for offline use
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "30d" }, // Very long expiry for offline use
  );
}
```

## Conclusion

These examples provide a starting point for implementing backend APIs that support the offline functionality requirements of the MasjidConnect Display App. The actual implementations may vary based on your specific technology stack and requirements, but the principles remain the same:

1. Include appropriate cache headers
2. Provide consistent response formats
3. Support conditional requests
4. Include timestamps for data freshness tracking
5. Implement efficient sync mechanisms for reconnection

By following these patterns, your backend will integrate seamlessly with the enhanced offline capabilities in the frontend application.
