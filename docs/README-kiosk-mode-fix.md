# Kiosk Mode & Prayer Times Loading Fixes

## Issue Summary
The prayer times countdown was not consistently displaying data when the app loaded, even though data was available. The countdown would only work after a webpack refresh or when the user tabbed out and back in.

## Root Causes
1. **Visibility Change Handling**: The app wasn't properly detecting when it regained focus and wasn't refreshing data when that happened
2. **Cache Management**: API requests were being served from disk cache but not properly invalidated
3. **Retry Logic**: The retry mechanism was giving up too early rather than continuing to try loading data
4. **Kiosk Mode Behavior**: No specific handling for kiosk mode where there's no user interaction to trigger refreshes

## Key Changes Made

### 1. Created useKioskMode Hook
Added a new hook specifically designed for kiosk mode operation that:
- Manages window focus events to refresh data when the app regains focus
- Implements background polling to ensure data is refreshed periodically
- Provides backup mechanisms to prevent the app from getting stuck in loading states
- Simulates visibility changes to force updates even in Electron kiosk mode

### 2. Improved ContentContext Refresh Mechanism
- Enhanced the `refreshPrayerTimes` and `refreshContent` methods to be more aggressive with data refreshing
- Added visibility change handlers to the ContentProvider to refresh data when the app becomes visible
- Improved error handling and fallback strategies when API requests fail

### 3. Enhanced GlassmorphicCombinedPrayerCard Component
- Implemented better retry logic that continues indefinitely instead of giving up after 5 attempts
- Added dedicated visibility change and focus event listeners
- Added exponential backoff for retries to avoid overwhelming the API
- Improved logging to better track loading states and retries

### 4. App-level Integration
- Integrated the useKioskMode hook into the main App component
- Ensures the app automatically refreshes data without requiring user interaction

## Testing Instructions
1. Start the app in kiosk mode
2. Verify that prayer times load correctly on initial startup
3. Test tab switching - data should refresh when returning to the app
4. Leave the app running for extended periods to verify it continues to update

These changes should ensure the prayer times component remains responsive and displays up-to-date information even in kiosk mode with minimal user interaction. 