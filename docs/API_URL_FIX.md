# API URL Configuration Fix

## Problem

The app was showing a blank screen because it was connecting to the wrong API URL:

- ❌ **Was connecting to**: `http://localhost:3000` (default)
- ✅ **Should connect to**: `https://portal.masjidconnect.co.uk/api`

## Root Cause

1. No `.env` file existed in the project
2. The default fallback URL was set to `localhost:3000` (for development)
3. Environment variable `REACT_APP_API_URL` was not being loaded

## Solution Applied

### 1. Created `.env` File

```bash
REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api
```

### 2. Updated Default URL in Code

Changed `src/api/masjidDisplayClient.ts`:

```typescript
// Before:
let baseURL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// After:
let baseURL =
  process.env.REACT_APP_API_URL || "https://portal.masjidconnect.co.uk/api";
```

**Why both changes?**

- `.env` file is used during development and builds
- Code fallback ensures production builds always have the correct URL even if `.env` is missing

### 3. Rebuilt Package

```bash
npm run rpi:build:arm64
```

**New package**: `masjidconnect-display-0.0.1-arm64.deb` (94 MB)  
**Build time**: 2025-10-12T16:44:54.991Z

## Verification

### Check API URL in Console

After installing and launching the app, check the browser console (F12):

```
Initializing MasjidDisplayClient with baseURL: https://portal.masjidconnect.co.uk/api
```

### Test API Connectivity

Before installing, verify the API is reachable:

```bash
# Test heartbeat endpoint
curl -v https://portal.masjidconnect.co.uk/api/screen/heartbeat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Screen-ID: YOUR_SCREEN_ID" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 200 OK with JSON response
```

### Check API in App

After pairing, check console for API requests:

```
✅ Should see:
- "Making request to api/screens/content"
- "Response from api/screens/content: status 200"
- Prayer times and content loading

❌ Should NOT see:
- Connection refused errors
- CORS errors
- 404 errors
- HTML error pages
```

## Installation

### 1. Transfer New Package

```bash
scp dist/masjidconnect-display-0.0.1-arm64.deb pi@your-pi-ip:/home/pi/
```

### 2. Remove Old Version (if installed)

```bash
ssh pi@your-pi-ip
sudo apt remove masjidconnect-display
```

### 3. Install New Version

```bash
sudo dpkg -i masjidconnect-display-0.0.1-arm64.deb
```

### 4. Launch and Test

```bash
/opt/masjidconnect-display/masjidconnect-display --no-sandbox
```

## Expected Behavior

### ✅ Working Correctly

1. **Loading Screen** appears for 5-10 seconds
2. **Pairing Screen** shows (if not paired)
3. After pairing: **Display Screen** shows with prayer times
4. **Console shows**: `Initializing MasjidDisplayClient with baseURL: https://portal.masjidconnect.co.uk/api`
5. **Network requests** go to `portal.masjidconnect.co.uk`
6. **NO blank screen**

### ❌ Still Issues?

If you still see a blank screen after this fix:

1. **Check Console for Errors** (F12)

   ```javascript
   // Should see API URL
   console.log in console: "Initializing MasjidDisplayClient with baseURL: https://portal.masjidconnect.co.uk/api"

   // Check for errors
   Look for red error messages
   ```

2. **Verify API is Reachable**

   ```bash
   # From RPi, test connection
   ping portal.masjidconnect.co.uk

   # Test HTTPS
   curl -v https://portal.masjidconnect.co.uk/api/screen/heartbeat
   ```

3. **Check Network Tab** (F12 → Network)
   - Are requests going to `portal.masjidconnect.co.uk`?
   - What status codes are returned? (200 = good, 404/500 = error)
   - Any CORS errors?

4. **Check Authentication**
   ```javascript
   // In console
   localStorage.getItem("masjid_api_key");
   localStorage.getItem("masjid_screen_id");
   // Should return your credentials, not null
   ```

## Environment Variables

### For Development (npm start)

Create `.env` in project root:

```bash
REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api
```

### For Production Builds

The API URL is now baked into the code with the correct default, so builds will automatically use the right URL.

### Override at Runtime (Testing)

You can't change the API URL at runtime in the built app, but during development you can:

```bash
# Start with different API
REACT_APP_API_URL=https://different-api.com npm start
```

## Troubleshooting

### Issue: Still connecting to localhost

**Check:**

1. Did you rebuild the package after the fix?
2. Did you install the NEW package (not the old one)?
3. Check console for the API URL being used

**Fix:**

```bash
# Rebuild
cd /Users/tahmidhoque/dev/masjidconnect-display-app
rm -rf dist/ build/
npm run rpi:build:arm64

# Reinstall on RPi
scp dist/masjidconnect-display-0.0.1-arm64.deb pi@your-pi-ip:/home/pi/
ssh pi@your-pi-ip
sudo dpkg -i masjidconnect-display-0.0.1-arm64.deb
```

### Issue: CORS errors

If you see CORS errors in console:

```
Access to fetch at 'https://portal.masjidconnect.co.uk/api/...' has been blocked by CORS policy
```

**This means:**

- The backend server needs to allow requests from the Electron app
- Add these CORS headers on the backend:
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Authorization, Content-Type, X-Screen-ID
  ```

### Issue: 404 Not Found

If requests return 404:

```
GET https://portal.masjidconnect.co.uk/api/screens/content → 404
```

**Check:**

- Is the API endpoint path correct?
- Is the API server running?
- Check backend logs for the request

### Issue: Authentication Failed

If you see 401 Unauthorized:

**Fix:**

1. Clear credentials and re-pair:
   ```javascript
   localStorage.clear();
   location.reload();
   ```
2. Generate new pairing code
3. Pair the display from the admin portal

## Files Changed

1. **`.env`** (CREATED)
   - Sets `REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api`

2. **`src/api/masjidDisplayClient.ts`** (MODIFIED)
   - Changed default fallback URL from `localhost:3000` to `portal.masjidconnect.co.uk/api`

## Related Issues Fixed

This fix also resolves:

- ✅ HTML response errors (now hitting correct API)
- ✅ Authentication failures (correct API endpoints)
- ✅ Content not loading (can now fetch from correct API)
- ✅ Blank screen after loading (API was unreachable)

## Summary

**Problem**: Blank screen because wrong API URL  
**Cause**: No `.env` file, default was `localhost:3000`  
**Solution**: Created `.env` file + updated default URL in code  
**Result**: App now connects to `https://portal.masjidconnect.co.uk/api`

---

**Build Date:** 2025-10-12  
**Version:** 0.0.1  
**Package:** masjidconnect-display-0.0.1-arm64.deb  
**Build Time:** 2025-10-12T16:44:54.991Z  
**API URL:** https://portal.masjidconnect.co.uk/api
