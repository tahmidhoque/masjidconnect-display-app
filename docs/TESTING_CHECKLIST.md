# Testing Checklist - Loading Screen and SSE Fixes

## Pre-Testing Setup

### Clear All App Data

```bash
# Run the clear app data script
./clear-app-data.sh

# Or manually clear:
# - localStorage in browser DevTools
# - Any Electron storage
# - Browser cache
```

### Start Backend Server

Ensure the admin backend is running on `localhost:3000`

## Test Case 1: Fresh Pairing Flow ⏳

**Objective**: Verify smooth transition from pairing to display without manual refresh

### Steps:

1. [ ] Clear all app data (localStorage, etc.)
2. [ ] Start the display app (`npm start`)
3. [ ] Verify app shows pairing screen with QR code and pairing code
4. [ ] Note the pairing code displayed
5. [ ] Open admin panel and pair the device using the code
6. [ ] **CRITICAL**: Watch the display app closely

### Expected Results:

- [ ] Within 3-4 seconds: "Pairing successful!" message appears
- [ ] App shows "Loading your content..." message
- [ ] Content loads (may take 2-5 seconds)
- [ ] **App automatically transitions to display screen**
- [ ] **NO manual refresh required**
- [ ] Loading screen never shows for more than 10 seconds total
- [ ] Display shows prayer times, announcements, etc.

### What to Check in Logs:

```
[InitFlow] 🎉 Pairing successful!
[InitFlow] Content refresh completed
[InitFlow] Content ready, transitioning to ready state
[ContentSlice] All content refresh completed, setting isLoading=false
[LoadingStateManager] Fast-tracking to preparing phase
[LoadingStateManager] Phase change needed: preparing -> ready
```

### If It Fails:

- [ ] Check browser console for errors
- [ ] Note which phase it gets stuck on
- [ ] Check if failsafe timeout triggered (10 seconds)
- [ ] Verify credentials are in localStorage

## Test Case 2: SSE Connection Authentication ⏳

**Objective**: Verify SSE connects with proper credentials

### Steps:

1. [ ] Complete Test Case 1 (or have an already paired device)
2. [ ] Open browser DevTools > Network tab
3. [ ] Filter for "sse" or "EventSource"
4. [ ] Observe the SSE connection

### Expected Results:

- [ ] SSE connection URL includes query parameters
- [ ] URL format: `/api/sse?screenId=xxx&apiKey=xxx`
- [ ] Connection status shows "open" (green indicator)
- [ ] Connection remains stable (doesn't disconnect every 5 seconds)

### Backend Server Logs Should Show:

```
[SSE] New connection request from http://localhost:3001
[SSE] Connection established for screenId: xxx
[SSE] Screen authenticated with screenId: xxx
```

### Backend Logs Should NOT Show:

```
❌ [SSE] No screenId provided
❌ [SSE] Connection established for unknown screen
❌ [SSE] Connection closed after 5 seconds
```

## Test Case 3: Authenticated Startup ⏳

**Objective**: Verify app loads directly to display when already paired

### Steps:

1. [ ] Ensure device is already paired (Test Case 1 completed)
2. [ ] Refresh the browser or restart the app
3. [ ] Watch the loading sequence

### Expected Results:

- [ ] App shows "Checking credentials..." for ~1 second
- [ ] Transitions to "Welcome back!" message
- [ ] Shows "Loading your content..." briefly
- [ ] **Transitions directly to display screen (no pairing screen)**
- [ ] Total time from start to display: 3-7 seconds
- [ ] No 404 errors in console

### What to Check in Logs:

```
[InitFlow] === Starting App Initialization ===
[InitFlow] ✅ Found valid credentials from masjid_* format
[InitFlow] Authentication successful from storage
[ContentSlice] Content refresh complete, all loading finished
```

### Should NOT See:

```
❌ POST /api/screens/check-simple 404
❌ [InitFlow] No valid credentials, starting pairing
❌ Any pairing-related activity
```

## Test Case 4: Network Interruption Recovery ⏳

**Objective**: Verify SSE reconnects properly after network issues

### Steps:

1. [ ] Have app running and displaying content
2. [ ] Open DevTools > Network tab
3. [ ] Toggle "Offline" mode (or disconnect network)
4. [ ] Wait 5 seconds
5. [ ] Toggle back to "Online" mode (or reconnect network)
6. [ ] Observe SSE reconnection

### Expected Results:

- [ ] App shows offline indicator when disconnected
- [ ] After reconnection, SSE reconnects within 2-3 seconds
- [ ] New SSE connection includes credentials (screenId)
- [ ] App continues functioning normally
- [ ] No loading screen appears during reconnection

### Backend Logs Should Show:

```
[EmergencyMiddleware] Device came back online
[EmergencyMiddleware] Reconnecting SSE after coming online
[SSE] Connection established for screenId: xxx
```

## Test Case 5: Failsafe Timeout ⏳

**Objective**: Verify failsafe prevents infinite loading

### Simulation:

This is hard to test directly, but the failsafe should trigger if:

- Content fetch takes too long (>10 seconds)
- State transitions get stuck
- Any unexpected blocking occurs

### How to Verify:

1. [ ] Look for failsafe timeout logs during normal operation (should not trigger)
2. [ ] If stuck on loading > 10 seconds, check for this log:

```
⚠️ [LoadingStateManager] FAILSAFE TRIGGERED - Forcing transition to display
```

### Expected Behavior:

- [ ] After 10 seconds in loading/preparing/ready phase, app force-transitions
- [ ] Display screen appears even if content isn't fully loaded
- [ ] App remains functional (doesn't crash)

## Quick Diagnostic Checks

### Check Credentials in localStorage:

```javascript
// In browser console:
console.log({
  screenId: localStorage.getItem('masjid_screen_id'),
  apiKey: localStorage.getItem('masjid_api_key'),
  isPaired: localStorage.getItem('isPaired'),
});
```

### Check SSE Connection Status:

```javascript
// In browser console (after connection attempt):
// Look for EventSource in DevTools > Network tab
// Status should be "pending" (means active/open)
```

### Check Current App Phase:

Look for latest log line starting with:

```
[LoadingStateManager] Phase change needed: X -> Y
```

## Common Issues and Solutions

### Issue: App Stuck on Loading Screen

**Check**:

- [ ] Is content actually loaded in Redux? (Check DevTools > Redux)
- [ ] Did failsafe trigger after 10 seconds?
- [ ] Are there any errors in console?

**Solutions**:

- Refresh browser (temporary)
- Check if backend is responding
- Verify credentials are stored

### Issue: SSE Connects Without Credentials

**Check**:

- [ ] Does URL include `?screenId=...`?
- [ ] Are credentials in localStorage?
- [ ] Did SSE initialize before credentials were stored?

**Solutions**:

- Restart app after pairing
- Check timing of SSE initialization

### Issue: Pairing Checks Continue After Auth

**Check**:

- [ ] Look for `/api/screens/check-simple` requests
- [ ] Are there 404 errors for pairing code?

**Solutions**:

- Should be fixed by this implementation
- Report if still occurring

## Success Criteria Summary

All of these should be TRUE:

- [ ] Pairing → Display transition happens automatically
- [ ] No manual refresh required after pairing
- [ ] SSE URL includes `screenId` parameter
- [ ] No "unknown screen" in server logs
- [ ] No pairing checks after authentication
- [ ] Loading never hangs > 10 seconds
- [ ] App recovers from network interruptions

## Reporting Issues

If any test fails, please capture:

1. Full browser console log
2. Network tab screenshot
3. Backend server logs
4. localStorage contents
5. Exact steps to reproduce

## Sign-Off

- [ ] Test Case 1: Fresh Pairing - **PASSED** ☑️
- [ ] Test Case 2: SSE Authentication - **PASSED** ☑️
- [ ] Test Case 3: Authenticated Startup - **PASSED** ☑️
- [ ] Test Case 4: Network Recovery - **PASSED** ☑️
- [ ] Test Case 5: Failsafe Timeout - **VERIFIED** ☑️

**Tester**: ******\_\_\_******  
**Date**: ******\_\_\_******  
**Notes**: ******\_\_\_******
