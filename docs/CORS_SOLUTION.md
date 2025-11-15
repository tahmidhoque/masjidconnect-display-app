# CORS Solution for MasjidConnect Display App

## Overview

This document explains how the MasjidConnect Display App handles Cross-Origin Resource Sharing (CORS) issues that may arise when connecting to backend API services, especially during local development.

## What is CORS?

CORS (Cross-Origin Resource Sharing) is a security mechanism that restricts HTTP requests from scripts running in a browser from accessing resources from a different domain than the one that served the original script. The backend server must explicitly allow cross-origin requests by setting specific HTTP headers.

## Implemented Solution

### 1. User-Friendly Error Handling

- **CorsErrorNotification Component**: A dedicated component that displays when CORS errors are detected, providing clear information about the issue and how to resolve it.
- **Detailed Error Information**: Shows which endpoint failed and provides instructions for fixing the issue on the backend.

### 2. Temporary Development Workaround

- **CORS Proxy Integration**: The app can use a CORS proxy for development purposes, which can be enabled via environment variables.
- **Configuration Options**:
  ```
  REACT_APP_USE_CORS_PROXY=true
  REACT_APP_CORS_PROXY_URL=https://cors-anywhere.herokuapp.com/
  ```

### 3. API Client Enhancement

- The `masjidDisplayClient.ts` has been enhanced to:
  - Detect CORS errors accurately
  - Provide detailed error information
  - Optionally route requests through a CORS proxy in development mode
  - Emit custom events that UI components can listen for

## How to Enable the CORS Proxy for Development

1. Create or modify your `.env.local` file:

   ```
   REACT_APP_USE_CORS_PROXY=true
   REACT_APP_CORS_PROXY_URL=https://cors-anywhere.herokuapp.com/
   ```

2. Restart your development server.

> **Note:** The CORS proxy solution is intended only for development and testing. For production, the backend should properly implement CORS headers.

## Backend Configuration

The backend server should add the following headers to API responses:

```
Access-Control-Allow-Origin: *  # In production, use specific origins instead of *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Screen-ID
Access-Control-Max-Age: 86400
```

For detailed backend configuration examples, refer to the `CORS_Configuration.md` file.

## Testing CORS Configuration

You can test if CORS is properly configured using the following `curl` command:

```bash
curl -X OPTIONS https://your-api-url.com/api/endpoint \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

The response should include the appropriate `Access-Control-Allow-*` headers.

## Conclusion

With these changes, the MasjidConnect Display App now provides a better experience when encountering CORS issues, with clear error messages and temporary workarounds for development, while guiding developers toward the proper backend solution.
