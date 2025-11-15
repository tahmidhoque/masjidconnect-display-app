# Blank Screen Debugging Guide

## Symptom

After installing and launching the app on Raspberry Pi, you see:

- ✅ Background gradient renders
- ❌ No loading screen
- ❌ No content
- ❌ Just a blank colored background

## What This Means

The **React app IS running** (gradient shows), but **components are not rendering**. This indicates:

1. React Router or state management issue
2. JavaScript error preventing component mount
3. API/authentication blocking render
4. Loading state stuck/broken

## 🔍 Step-by-Step Debugging

### Step 1: Open Chrome DevTools

```bash
# On RPi, press F12 or:
# Right-click → Inspect Element

# Or use remote debugging:
chromium-browser --remote-debugging-port=9222
# Then access from another computer: http://rpi-ip:9222
```

### Step 2: Check Console for Errors

Look for red error messages in the Console tab:

#### Common Errors & Solutions

**Error: "Cannot read property 'X' of undefined"**

```
Solution: API data not loading. Check network tab.
```

**Error: "Failed to fetch"**

```
Solution: API not reachable. Verify API URL.
```

**Error: "Uncaught TypeError"**

```
Solution: Check stack trace, fix the component causing error.
```

**Error: "ChunkLoadError"**

```
Solution: Build issue. Rebuild the package.
```

### Step 3: Check Console Logs

Look for these key log messages:

```javascript
// Should see:
✅ "Initializing MasjidDisplayClient with baseURL: https://portal.masjidconnect.co.uk/api"
✅ "RPi performance mode activated"
✅ "[App] Current app state: ..."
✅ "[InitFlow] Starting App Initialization"

// Should NOT be stuck on:
❌ "[InitFlow] Checking credentials..." (stuck forever)
❌ "Loading..." (never progresses)
❌ No logs at all (JavaScript crashed)
```

### Step 4: Force Console Logging

In the console, run:

```javascript
// Enable all debug logs
localStorage.setItem("debug", "*");
location.reload();

// Check current state
console.log({
  isInitializing: window.location.href,
  localStorage: Object.keys(localStorage),
  credentials: {
    apiKey: localStorage.getItem("masjid_api_key"),
    screenId: localStorage.getItem("masjid_screen_id"),
  },
});
```

### Step 5: Check Network Tab

1. Open Network tab in DevTools
2. Reload the page
3. Look for API requests

**Expected:**

```
GET https://portal.masjidconnect.co.uk/api/screens/content
Status: 200 OK (or 401 if not paired)
```

**Problems:**

```
❌ No network requests = API client not initializing
❌ Status 0 / CORS error = API not configured correctly
❌ Status 404 = Wrong API endpoint
❌ Status 500 = Backend error
```

### Step 6: Manual State Check

```javascript
// In console, check Redux state:
window.__REDUX_DEVTOOLS_EXTENSION__?.();

// Or manually check:
console.log("Auth state:", {
  hasApiKey: !!localStorage.getItem("masjid_api_key"),
  hasScreenId: !!localStorage.getItem("masjid_screen_id"),
});
```

## 🛠️ Quick Fixes

### Fix 1: Clear Everything and Re-pair

```javascript
// In browser console:
localStorage.clear();
location.reload();
```

This forces the app to show the pairing screen.

### Fix 2: Force Pairing Mode

```javascript
// In console:
localStorage.removeItem("masjid_api_key");
localStorage.removeItem("masjid_screen_id");
localStorage.removeItem("isPaired");
location.reload();
```

### Fix 3: Check API URL

```javascript
// In console:
console.log("API URL:", localStorage.getItem("REACT_APP_API_URL"));

// Should show:
// null (uses default: portal.masjidconnect.co.uk/api)
```

### Fix 4: Force Error Screen

```javascript
// Test if error screen works:
throw new Error("Test error");
```

If error screen shows, React is working fine.

### Fix 5: Disable RPi Performance Mode

```javascript
// In console:
localStorage.setItem(
  "rpi_config_override",
  JSON.stringify({
    disableAnimations: false,
    disableGPUOptimizer: false,
    disableMemoryManager: false,
  }),
);
location.reload();
```

## 📊 Diagnostic Commands

### Check if React is Running

```javascript
// In console:
document.querySelector("#root").innerHTML.length > 100;
// Should return: true
```

### Check if App Component Mounted

```javascript
// Look for specific elements:
document.querySelector('[class*="MuiBox"]') !== null;
// Should return: true
```

### Check Loading State

```javascript
// Check if stuck in loading:
document.querySelector('[class*="loading"]') !== null;
```

## 🎯 Root Causes & Solutions

### Cause 1: API Not Reachable

**Symptoms:**

- Network tab shows failed requests
- Console shows fetch errors

**Solution:**

```bash
# Test API from RPi terminal:
curl -v https://portal.masjidconnect.co.uk/api/screen/heartbeat

# If fails:
ping portal.masjidconnect.co.uk
```

**Fix:** Check RPi network connection, DNS settings.

### Cause 2: Authentication Loop

**Symptoms:**

- Console logs show repeated "Checking credentials"
- Never proceeds to pairing or display

**Solution:**

```javascript
// Break the loop:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Cause 3: React Components Failed to Load

**Symptoms:**

- Console shows "ChunkLoadError"
- Module not found errors

**Solution:**
Rebuild the package:

```bash
cd /Users/tahmidhoque/dev/masjidconnect-display-app
rm -rf dist/ build/ node_modules/.cache
npm run rpi:build:arm64
```

### Cause 4: RPi Performance Mode Too Aggressive

**Symptoms:**

- No errors in console
- Just blank screen
- RPi Config shows it's active

**Solution:**

```javascript
// Disable RPi mode:
window.rpiConfig.forceRPiMode(false);
location.reload();
```

### Cause 5: Redux State Corruption

**Symptoms:**

- App worked before, now doesn't
- Strange state values in console

**Solution:**

```javascript
// Clear persisted Redux state:
localStorage.removeItem("persist:root");
location.reload();
```

## 📝 Debugging Checklist

Run through this checklist:

- [ ] Open Chrome DevTools (F12)
- [ ] Check Console for errors (red messages)
- [ ] Check Network tab for API requests
- [ ] Verify API URL is correct
- [ ] Check if credentials exist in localStorage
- [ ] Try clearing localStorage and reloading
- [ ] Check if `#root` div has content
- [ ] Look for any JavaScript errors
- [ ] Test API connectivity from terminal
- [ ] Try disabling RPi performance mode
- [ ] Check if service worker is interfering

## 🚀 Nuclear Option (Full Reset)

If nothing else works:

```bash
# On RPi:
# 1. Uninstall app
sudo apt remove --purge masjidconnect-display

# 2. Clear all data
rm -rf ~/.config/masjidconnect-display
rm -rf ~/Library/Application\ Support/masjidconnect-display

# 3. Reinstall fresh package
sudo dpkg -i masjidconnect-display-0.0.1-arm64.deb

# 4. Launch with debug flags
/opt/masjidconnect-display/masjidconnect-display --no-sandbox --enable-logging --v=1
```

## 📞 Report the Issue

If still stuck, collect this info:

```javascript
// Run in console and copy output:
console.log(
  JSON.stringify(
    {
      // Environment
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenRes: `${screen.width}x${screen.height}`,

      // App State
      hasApiKey: !!localStorage.getItem("masjid_api_key"),
      hasScreenId: !!localStorage.getItem("masjid_screen_id"),

      // DOM
      hasRootContent: document.querySelector("#root").innerHTML.length,

      // Console Errors (check manually)
      errors: "Check console for red errors",
    },
    null,
    2,
  ),
);
```

Also provide:

- Screenshot of blank screen
- Console errors (screenshot)
- Network tab (screenshot showing failed requests)
- Output of `curl -v https://portal.masjidconnect.co.uk/api/screen/heartbeat`

## 💡 Success Indicators

When working correctly, you should see:

1. **Console Logs:**

   ```
   Initializing MasjidDisplayClient with baseURL: https://portal.masjidconnect.co.uk/api
   [InitFlow] Starting App Initialization
   [InitFlow] Checking credentials...
   [InitFlow] No valid credentials, starting pairing OR
   [InitFlow] Authentication successful from storage
   ```

2. **Network Requests:**

   ```
   GET portal.masjidconnect.co.uk/api/screens/content
   GET portal.masjidconnect.co.uk/api/prayers
   ```

3. **Screen Shows:**
   - Loading screen (5-10 seconds)
   - Then either Pairing screen or Display screen
   - **NOT** just gradient background

---

**Build Date:** 2025-10-12  
**Version:** 0.0.1  
**Package:** masjidconnect-display-0.0.1-arm64.deb  
**Build Time:** 2025-10-12T17:30:28.705Z
