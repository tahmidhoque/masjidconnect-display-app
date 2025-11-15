# CORS Configuration for MasjidConnect API

## Issue

The MasjidConnect Display App is experiencing CORS (Cross-Origin Resource Sharing) errors when trying to access several API endpoints:

- `/content`
- `/prayer-status`
- `/prayer-times`
- `/events`

These errors prevent the application from properly caching data for offline use.

## Solution

### Express.js Backend

If you're using Express.js, add the following middleware to your server:

```javascript
const express = require("express");
const cors = require("cors");
const app = express();

// Enable CORS for all routes with proper configuration
app.use(
  cors({
    origin: "*", // Allow all origins, or specify ['http://localhost:3001', 'https://your-production-domain.com']
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Screen-ID"],
    credentials: true,
    maxAge: 86400, // 24 hours
  }),
);

// Set headers on all responses (alternative approach)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Screen-ID",
  );
  res.header("Access-Control-Max-Age", "86400");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});
```

### Node.js without Express

If you're using Node.js without Express:

```javascript
const http = require("http");

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Screen-ID",
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  // Continue with normal request handling
  // ...
});

server.listen(3000);
```

### PHP Backend

If you're using PHP:

```php
<?php
// Add these headers to all API endpoint files
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Screen-ID");
header("Access-Control-Max-Age: 86400");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit();
}

// Continue with normal request handling
// ...
?>
```

### Nginx Configuration

If you're using Nginx as a reverse proxy:

```nginx
server {
  # Other server configurations...

  location /api/ {
    # Add CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Screen-ID' always;
    add_header 'Access-Control-Max-Age' '86400' always;

    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
      add_header 'Access-Control-Allow-Origin' '*';
      add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
      add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Screen-ID';
      add_header 'Access-Control-Max-Age' '86400';
      add_header 'Content-Type' 'text/plain charset=UTF-8';
      add_header 'Content-Length' '0';
      return 204;
    }

    # Proxy to your backend
    proxy_pass http://backend_server/;
    # Other proxy settings...
  }
}
```

## Special Considerations for Development

### Local Development with Different Ports

For local development where frontend and backend are on different ports:

```javascript
// Configure CORS more specifically
app.use(
  cors({
    origin: ["http://localhost:3001", "http://127.0.0.1:3001"],
    credentials: true,
  }),
);
```

### Testing CORS without Backend Changes

If you can't immediately change the backend, you can test with a CORS proxy during development:

1. Install a CORS proxy package:

```bash
npm install -g cors-anywhere
```

2. Run the proxy server:

```bash
cors-anywhere
```

3. Modify your API client to use the proxy:

```javascript
// Change your API base URL
const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8080/http://your-api-server.com" // CORS proxy URL
    : "http://your-api-server.com";
```

## Security Considerations

- In production, replace `'*'` with your specific allowed origins.
- Only expose the minimum required headers and methods.
- Consider implementing rate limiting to prevent abuse.

## Testing

After implementing these changes, you can test if CORS is properly configured using:

```bash
curl -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Screen-ID" \
  -X OPTIONS \
  --verbose \
  http://your-api-server.com/api/prayer-times
```

You should see the CORS headers in the response.
