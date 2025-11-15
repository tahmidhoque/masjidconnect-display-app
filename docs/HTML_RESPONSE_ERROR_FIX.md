# HTML Response Error Fix

## Issue Description

After installing the `.deb` package and launching the app, users were encountering a critical JavaScript error:

```
TypeError: Cannot use 'in' operator to search for 'data' in [HTML content with static chunk references]
```

This error occurred when the app tried to load data from the API.

## Root Cause

The error was caused by the API returning HTML (likely an error page) instead of JSON, and the code attempting to use the `in` operator on a string value without first verifying it was an object.

**Common scenarios that trigger this:**

1. **CORS errors** - Browser blocks the request, server returns HTML error page
2. **404 errors** - API endpoint doesn't exist, server returns HTML 404 page
3. **500 errors** - Server error, returns HTML error page
4. **Wrong API URL** - Connecting to wrong server/path returns HTML
5. **Authentication issues** - Redirect to login page returns HTML

## Fixes Applied

### 1. **Enhanced `validateApiResponse` Function** (`src/utils/apiErrorHandler.ts`)

Added validation to check if response is actually an object before using the `in` operator:

```typescript
export function validateApiResponse<T>(response: any): ApiResponse<T> {
  // First check if response is a valid object (not string, not null, not array)
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    logger.error("Invalid API response: not an object", {
      response: typeof response,
    });
    return createErrorResponse("Invalid API response format");
  }

  // Check if this is already a valid API response
  if (
    "success" in response &&
    ("data" in response || response.success === false)
  ) {
    // Process normally...
  }

  return createErrorResponse<T>("Invalid API response format");
}
```

**What this fixes:**

- Prevents `TypeError: Cannot use 'in' operator` on strings
- Logs the actual type received for debugging
- Returns a proper error response instead of crashing

### 2. **HTML Detection in `normalizeApiResponse`** (`src/utils/apiErrorHandler.ts`)

Added check to detect if data is HTML:

```typescript
export function normalizeApiResponse<T>(
  response: Partial<ApiResponse<T>>,
): ApiResponse<T> {
  // Check if data is an HTML string (common error case)
  if (
    response.data &&
    typeof response.data === "string" &&
    (response.data as string).trim().startsWith("<")
  ) {
    logger.error("Received HTML in API response data", {
      preview: (response.data as string).substring(0, 200),
    });
    return createErrorResponse("API returned HTML instead of JSON");
  }

  // Process normally...
}
```

**What this fixes:**

- Detects HTML responses early in the processing pipeline
- Provides clear error message: "API returned HTML instead of JSON"
- Logs first 200 characters of HTML for debugging

### 3. **HTML Response Detection in API Client** (`src/api/masjidDisplayClient.ts`)

Added validation immediately after receiving response from axios:

```typescript
const response = await this.client.request<any, AxiosResponse<T>>({
  url: normalizedEndpoint,
  ...options,
});

// Check if response.data is HTML (common error response)
if (typeof response.data === "string" && response.data.trim().startsWith("<")) {
  logger.error(
    `Received HTML response instead of JSON from ${normalizedEndpoint}`,
    {
      status: response.status,
      contentType: response.headers?.["content-type"],
      preview: response.data.substring(0, 200),
    },
  );
  throw new Error(
    `API returned HTML instead of JSON. This usually indicates a server error or incorrect URL.`,
  );
}
```

**What this fixes:**

- Catches HTML responses before they're processed
- Provides detailed logging (status code, content-type, preview)
- Gives actionable error message pointing to server error or wrong URL

## Debugging HTML Response Errors

If you still see this error after the fix, check the following:

### 1. Check the Browser Console

The error logs now include:

- Response type (string, object, etc.)
- Preview of HTML content (first 200 characters)
- HTTP status code
- Content-Type header
- Endpoint URL

### 2. Verify API URL Configuration

Check `process.env.REACT_APP_API_URL` or the default URL:

```javascript
// In src/api/masjidDisplayClient.ts
const baseURL = process.env.REACT_APP_API_URL || "https://api.masjid.app";
```

**Common issues:**

- Missing `https://` or `http://`
- Trailing slash causing double slashes
- Wrong domain or port
- Incorrect path

### 3. Test API Endpoint Manually

```bash
# Test the API endpoint directly
curl -v https://api.masjid.app/api/screens/content \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Screen-ID: YOUR_SCREEN_ID" \
  -H "Accept: application/json"

# Look for:
# - Response status code (should be 200)
# - Content-Type header (should be application/json)
# - Valid JSON response body
```

### 4. Check CORS Configuration

If you see CORS errors in the console, the server may be blocking requests:

```
Access to fetch at 'https://api.masjid.app/...' from origin '...'
has been blocked by CORS policy
```

**Solution:**

- Backend must include proper CORS headers
- Check if CORS proxy is needed (currently disabled by default)

### 5. Check Network Tab in DevTools

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Reload the page
4. Click on failed API requests
5. Check:
   - **Status code** (404, 500, etc.)
   - **Response tab** - Is it JSON or HTML?
   - **Headers tab** - Check Content-Type
   - **Preview tab** - See formatted response

### 6. Common Error Patterns

#### 404 Not Found

```html
<!DOCTYPE html>
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    ...
  </body>
</html>
```

**Fix:** Verify API endpoint path is correct

#### 500 Internal Server Error

```html
<!DOCTYPE html>
<html>
  <head>
    <title>500 Internal Server Error</title>
  </head>
  <body>
    <h1>Internal Server Error</h1>
    ...
  </body>
</html>
```

**Fix:** Check server logs, API might be down

#### NGINX/Apache Error Pages

```html
<html>
  <head>
    <title>502 Bad Gateway</title>
  </head>
  <body bgcolor="white">
    <center><h1>502 Bad Gateway</h1></center>
    <hr />
    <center>nginx</center>
  </body>
</html>
```

**Fix:** API server is not responding, check backend status

### 7. Enable Verbose Logging

In the browser console, enable verbose logging:

```javascript
localStorage.setItem("debug", "masjidconnect:*");
```

Then reload the page. You'll see detailed logs including:

- API request URLs
- Request headers
- Response data types
- Error details

## Testing the Fix

### 1. Simulate HTML Response

```javascript
// In browser console, test the error handling
const htmlResponse = "<html><body>Error</body></html>";
console.log(typeof htmlResponse); // "string"
console.log("data" in htmlResponse); // TypeError (before fix)

// After fix, the code checks typeof first, preventing the error
```

### 2. Test with Invalid API URL

```bash
# Set wrong API URL to trigger HTML response
REACT_APP_API_URL=https://wrong-domain.com npm start
```

The app should now show a clear error message instead of crashing.

### 3. Test with Network Errors

1. Disconnect from internet
2. Launch app
3. Should see: "Device is offline. Please check your internet connection."
4. Not: "Cannot use 'in' operator..."

## Rebuild and Deploy

After these fixes, rebuild the package:

```bash
# Clean and rebuild
rm -rf dist/
npm run rpi:build:arm64

# Transfer to RPi
scp dist/masjidconnect-display-0.0.1-arm64.deb pi@your-pi-ip:/home/pi/

# Install
ssh pi@your-pi-ip
sudo dpkg -i masjidconnect-display-0.0.1-arm64.deb

# Launch and check logs
/opt/masjidconnect-display/masjidconnect-display --no-sandbox

# Check console for any HTML response errors
# Should now see clear error messages instead of crashes
```

## Related Files Changed

1. **`src/utils/apiErrorHandler.ts`**
   - Enhanced `validateApiResponse` with object type checking
   - Added HTML detection in `normalizeApiResponse`

2. **`src/api/masjidDisplayClient.ts`**
   - Added HTML response detection after axios request
   - Improved error logging with response details

## Prevention Best Practices

To prevent this error in the future:

### Backend Team

1. **Always return JSON** for API endpoints
2. **Set proper Content-Type**: `application/json`
3. **Return structured errors**:
   ```json
   {
     "success": false,
     "error": "Error message",
     "status": 400
   }
   ```
4. **Enable CORS** properly for display app domains
5. **Use consistent error format** across all endpoints

### Frontend Team

1. **Always validate response type** before accessing properties
2. **Use `in` operator only on objects**
3. **Check `Content-Type` header** in responses
4. **Log preview of unexpected responses**
5. **Provide fallback for offline scenarios**

## Status

✅ **Fixed in version 0.0.1** (Build: 2025-10-12T15:48:58.651Z)

The app now gracefully handles HTML responses and provides clear error messages instead of crashing with `TypeError: Cannot use 'in' operator`.

---

**Build Date:** 2025-10-12  
**Version:** 0.0.1  
**Package:** masjidconnect-display-0.0.1-arm64.deb
