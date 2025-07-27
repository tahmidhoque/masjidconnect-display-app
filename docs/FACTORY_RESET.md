# Factory Reset Feature

## Overview
The MasjidConnect Display App includes a factory reset feature that allows you to completely reset the display to its initial state, as if it has never been connected before.

## 🎹 Keyboard Shortcut
**`Ctrl+Shift+R`** (Windows/Linux) or **`Cmd+Shift+R`** (Mac)

This keyboard shortcut can be pressed at any time while the display app is running.

## ⚠️ What Factory Reset Does

When you perform a factory reset, the following data is **permanently deleted**:

- **Screen pairing and authentication** - The display will be unpaired from your MasjidConnect account
- **Cached prayer times and content** - All downloaded prayer times and content will be removed
- **Display preferences and settings** - Any customized settings will be reset to defaults
- **All locally stored data** - Everything stored in localStorage, sessionStorage, and IndexedDB

## 🔄 Reset Process

1. **Trigger**: Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. **Confirmation**: A styled warning modal will appear
3. **Review**: Read the warning message carefully
4. **Confirm or Cancel**:
   - Press **`Enter`** or click **"Reset Display"** to confirm
   - Press **`Escape`** or click **"Cancel"** to abort
5. **Reset**: If confirmed, the app will:
   - Clear all stored data
   - Show a "Resetting..." message
   - Automatically reload the application
6. **Result**: The display returns to the initial pairing screen

## 🎨 Modal Features

The factory reset confirmation modal is styled to match the app's branding:

- **Glassmorphic design** with gold accents
- **Warning indicators** with clear messaging
- **Keyboard shortcuts** displayed prominently
- **Loading state** during reset process
- **Branded colors** matching the display theme

## 🔧 Technical Details

### Components Involved
- `FactoryResetModal.tsx` - The styled confirmation modal
- `factoryResetService.ts` - Service handling the reset logic
- `useFactoryReset.ts` - React hook for keyboard shortcuts and state management

### What Gets Cleared
1. **localStorage** - All keys including credentials, cache, and preferences
2. **sessionStorage** - Temporary session data
3. **IndexedDB** - LocalForage databases used for offline storage
4. **Browser caches** - Service worker caches if available
5. **Application state** - Redux store is reset via page reload

### Safety Features
- **Confirmation required** - Cannot be triggered accidentally
- **Clear warnings** - Modal explains exactly what will happen
- **Keyboard controls** - Both mouse and keyboard interaction supported
- **Loading states** - Visual feedback during reset process

## 🚨 Use Cases

### When to Use Factory Reset
- **Display not responding properly** - Clear corrupted data
- **Moving to different location** - Unpair from old masjid account
- **Testing/development** - Return to clean state
- **Troubleshooting connection issues** - Start fresh pairing process
- **Before returning/selling device** - Remove all masjid-specific data

### When NOT to Use
- **Minor display issues** - Try refreshing the page first
- **Temporary network problems** - Wait for connection to restore
- **Content not updating** - Check internet connection first

## 🔐 Security Considerations

- Factory reset completely removes all authentication data
- No recovery of data is possible after reset
- The display will be completely disconnected from the masjid account
- Admin will need to generate a new pairing code to reconnect

## 📱 User Experience

The factory reset feature is designed to be:
- **Easy to access** via memorable keyboard shortcut
- **Hard to trigger accidentally** with confirmation requirement
- **Clear about consequences** with detailed warning messages
- **Visually consistent** with the app's branding
- **Responsive to user input** with immediate feedback

---

*This feature ensures that displays can always be returned to a clean state when needed, while maintaining the security and branding standards of the MasjidConnect platform.* 