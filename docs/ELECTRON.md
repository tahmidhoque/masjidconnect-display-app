# MasjidConnect Display App - Electron Version

This document outlines how to develop, build, and deploy the MasjidConnect Display App as an Electron application with OTA (Over-The-Air) update capabilities.

## Table of Contents

- [Overview](#overview)
- [Development](#development)
- [Building](#building)
- [OTA Updates](#ota-updates)
- [Raspberry Pi Deployment](#raspberry-pi-deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The MasjidConnect Display App has been converted to an Electron desktop application to provide:

1. A standalone, installable application for macOS and Raspberry Pi
2. Automatic updates when new versions are released
3. Enhanced offline capabilities
4. Full-screen display mode with no browser chrome

## Development

### Prerequisites

- Node.js 16+ and npm
- Git

### Setup

1. Clone the repository:

   ```sh
   git clone https://github.com/masjidSolutions/masjidconnect-display-app.git
   cd masjidconnect-display-app
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Start the development server:
   ```sh
   npm run electron:dev
   ```

This command starts both the React development server and Electron application in development mode.

### Project Structure

- `electron/` - Electron-specific files
  - `main.js` - Main Electron process
  - `preload.js` - Preload script for secure IPC communication
- `src/` - React application source code
  - `contexts/UpdaterContext.tsx` - Context for managing app updates
  - `components/common/UpdateNotification.tsx` - Component for showing update notifications
  - `hooks/useContentUpdates.ts` - Hook for managing content updates

## Building

### Building for Development (Local Testing)

To build the app without publishing:

```sh
npm run electron:build
```

This will create a distributable package in the `dist` directory.

### Building for Production (with Auto-Updates)

To build and publish to GitHub Releases:

```sh
npm run electron:build:publish
```

> Note: This requires proper setup of GitHub authentication.

## OTA Updates

The app uses `electron-updater` for automatic updates. The update process works as follows:

1. The app checks for updates on startup
2. If an update is available, it downloads in the background
3. The user is notified when the update is ready to install
4. The user can choose to restart the app to apply the update

### Creating a New Release

To create a new release with auto-update capability:

1. Update the version in `package.json`:

   ```json
   "version": "0.1.0" -> "version": "0.1.1"
   ```

2. Commit the changes:

   ```sh
   git add package.json
   git commit -m "Bump version to 0.1.1"
   ```

3. Create a Git tag:

   ```sh
   git tag v0.1.1
   ```

4. Push changes and tags:

   ```sh
   git push
   git push --tags
   ```

5. Build and publish:

   ```sh
   npm run electron:build:publish
   ```

6. Go to GitHub Releases and ensure the release is published:
   - The release should have the tag `v0.1.1`
   - The release assets should include distributable packages (DMG for macOS, AppImage/DEB for Linux)

## GitHub Release Configuration

For auto-updates to work correctly, the GitHub repository must be set up as follows:

1. In the repository settings, ensure that the Releases feature is enabled
2. Make sure your GitHub token has the correct permissions to create releases
3. Configure your environment to authenticate with GitHub:
   ```sh
   export GH_TOKEN=your_github_token
   ```

## Raspberry Pi Deployment

### Building for Raspberry Pi

The Electron app can be built for Raspberry Pi (ARM architecture) with:

```sh
# On a Raspberry Pi or using cross-compilation
npm run electron:build
```

### Installing on Raspberry Pi

On a Raspberry Pi:

1. Download the `.deb` package from GitHub Releases
2. Install the package:
   ```sh
   sudo dpkg -i masjidconnect-display-app_0.1.0_armv7l.deb
   sudo apt-get install -f  # Install dependencies if needed
   ```

### Auto-startup on Raspberry Pi

To make the app start automatically on boot:

1. Create a desktop entry:

   ```sh
   mkdir -p ~/.config/autostart
   touch ~/.config/autostart/masjidconnect.desktop
   ```

2. Edit the file:
   ```
   [Desktop Entry]
   Type=Application
   Name=MasjidConnect Display
   Exec=/opt/MasjidConnect\ Display/masjidconnect-display-app
   Hidden=false
   X-GNOME-Autostart-enabled=true
   ```

## Troubleshooting

### Update Not Working

1. Check internet connectivity
2. Verify GitHub Releases contains the correct assets
3. Ensure the app has proper permissions to write to its directory
4. Check the app logs at:
   - macOS: `~/Library/Logs/masjidconnect-display-app/`
   - Linux: `~/.config/masjidconnect-display-app/logs/`

### App Crashes on Startup

1. Check Electron logs:

   ```sh
   # On macOS
   cat ~/Library/Logs/masjidconnect-display-app/main.log

   # On Linux/Raspberry Pi
   cat ~/.config/masjidconnect-display-app/logs/main.log
   ```

2. Verify all required dependencies are installed on the system

### Network Issues

The app is designed to work offline, but requires internet connectivity for updates:

1. Ensure the device has a working internet connection for updates
2. Check firewall settings to ensure the app can communicate with GitHub
3. If behind a proxy, configure proxy settings for the system
