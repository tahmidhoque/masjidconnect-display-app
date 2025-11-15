# Build Process Summary - Raspberry Pi Fixes

## Overview

The build and release process has been completely redesigned to fix installation issues on Raspberry Pi. The main problem was attempting to build multiple architectures simultaneously and lack of proper validation.

## Key Changes

### 1. Separate Architecture Builds

**Before**:

```bash
electron-builder build --linux deb --armv7l --arm64
```

This doesn't work reliably - electron-builder struggles with multiple architectures.

**After**:

```bash
# Build each architecture separately
electron-builder --linux deb --armv7l
electron-builder --linux deb --arm64
```

### 2. New Build Script (`scripts/build-rpi.sh`)

Created a comprehensive build script that:

- ✅ Checks prerequisites (Node.js version, tools)
- ✅ Cleans previous builds
- ✅ Builds React app
- ✅ Prepares RPI files
- ✅ Builds each architecture separately
- ✅ Validates artifacts (size, existence)
- ✅ Provides clear progress and error messages

### 3. Fixed Package Configuration

**Changes**:

- Removed `tar.gz` targets (not needed for RPI)
- Simplified `files` configuration (electron-builder handles node_modules)
- Added `afterRemove` script for clean uninstall
- Added `fpm` options for better deb handling
- Fixed `asarUnpack` paths

### 4. Improved After-Install Script

**Fixes**:

- Handles multiple possible file locations (asar vs unpacked)
- Better font installation (searches multiple paths)
- Icon path detection (handles missing icons gracefully)
- All operations are non-fatal (installation completes even if optional steps fail)

### 5. GitHub Actions Updates

**Changes**:

- Builds architectures in separate matrix jobs
- Validates artifacts after each build
- Ensures scripts are executable
- Uses `npx electron-builder` for consistency

## Usage

### Local Build

```bash
# Build both architectures
npm run rpi:build

# Build specific architecture
npm run rpi:build:armv7l  # Raspberry Pi 3
npm run rpi:build:arm64   # Raspberry Pi 4/5

# Build and publish
export GH_TOKEN=your_token
npm run rpi:publish
```

### On Raspberry Pi

```bash
# Install
sudo dpkg -i masjidconnect-display-*.deb
sudo apt-get install -f  # Fix dependencies if needed

# Verify installation
bash scripts/verify-installation.sh

# Run app
/opt/masjidconnect-display/masjidconnect-display --no-sandbox
```

## File Structure

After installation, the app is located at:

```
/opt/masjidconnect-display/
├── masjidconnect-display          # Main executable
├── resources/
│   ├── app.asar                   # Packaged app (or app/ directory)
│   └── assets/                    # Extra resources
└── [Electron runtime files]
```

## Verification

The `scripts/verify-installation.sh` script checks:

- ✅ Main executable exists and is executable
- ✅ Required files present
- ✅ Desktop entry created
- ✅ Autostart configured
- ✅ Package registered in dpkg

## Troubleshooting

### Build Issues

**Problem**: Build fails
**Solution**: Check build logs, ensure Node.js 18+, clean and rebuild

**Problem**: .deb file too small
**Solution**: Build failed silently - check React build completed, verify electron-builder output

### Installation Issues

**Problem**: Package won't install
**Solution**:

- Check architecture matches (armv7l for Pi 3, arm64 for Pi 4/5)
- Fix dependencies: `sudo apt-get install -f`
- Check log: `cat /var/log/masjidconnect-install.log`

**Problem**: App doesn't start
**Solution**:

- Check permissions: `ls -l /opt/masjidconnect-display/masjidconnect-display`
- Fix if needed: `sudo chmod +x /opt/masjidconnect-display/masjidconnect-display`
- Check logs: `cat ~/.config/masjidconnect-display/logs/main.log`

## Best Practices

1. **Always build architectures separately** - Never use `--armv7l --arm64` together
2. **Validate builds** - Check artifact size and existence
3. **Test on hardware** - Virtual machines may miss RPI-specific issues
4. **Check logs** - Review installation logs after install
5. **Verify installation** - Use verification script after install

## What Was Fixed

- ✅ Builds now work reliably for both architectures
- ✅ Packages install correctly on Raspberry Pi
- ✅ Proper file permissions set automatically
- ✅ Installation completes even if optional steps fail
- ✅ Clear error messages and validation
- ✅ Proper cleanup on uninstall
