# Build Process Fixes for Raspberry Pi

## Overview

This document describes the fixes applied to resolve Raspberry Pi installation issues with electron-builder deb packages.

## Key Problems Identified

### 1. Multiple Architecture Build Issue
**Problem**: Building for both `armv7l` and `arm64` in a single electron-builder command doesn't work reliably.

**Solution**: 
- Build each architecture separately
- Created `scripts/build-rpi.sh` that builds architectures sequentially
- Each build is validated before proceeding

### 2. Build Script Configuration
**Problem**: Original scripts used incorrect electron-builder syntax and didn't validate builds.

**Solution**:
- Created robust `build-rpi.sh` script with:
  - Prerequisite checking
  - Build validation
  - Artifact verification
  - Proper error handling
  - Clear progress output

### 3. Deb Package Configuration
**Problem**: electron-builder deb configuration needed optimization for RPI.

**Solution**:
- Removed `tar.gz` targets (not needed for RPI)
- Added `afterRemove` script for clean uninstall
- Added `fpm` options for better deb package handling
- Simplified `files` configuration (electron-builder handles node_modules automatically)

### 4. File Structure Issues
**Problem**: Package structure might not match what electron-builder creates.

**Solution**:
- Simplified `extraResources` configuration
- Ensured `asarUnpack` includes necessary modules (electron-store, electron-log)
- Fixed file paths in after-install script

## Build Process Changes

### Before (Broken)
```json
"rpi:build": "npm run build:fix-paths && node scripts/prepare-rpi-build.js && electron-builder build --linux deb --armv7l --arm64 --publish never"
```

**Issues**:
- Tries to build both architectures at once
- No validation
- No error handling
- Doesn't verify artifacts

### After (Fixed)
```json
"rpi:build": "bash scripts/build-rpi.sh all never"
```

**Improvements**:
- Builds architectures separately
- Validates each build
- Verifies artifact size and existence
- Provides clear error messages
- Handles failures gracefully

## New Build Script Features

The `scripts/build-rpi.sh` script provides:

1. **Prerequisite Checking**
   - Verifies Node.js version
   - Checks for required tools
   - Validates environment

2. **Build Process**
   - Cleans previous builds
   - Installs dependencies
   - Builds React app
   - Prepares RPI files
   - Builds Electron app per architecture
   - Validates artifacts

3. **Artifact Validation**
   - Checks .deb file exists
   - Verifies file size (> 1MB)
   - Validates file format

4. **Error Handling**
   - Clear error messages
   - Proper exit codes
   - Build summary

## Installation Verification

After installing on Raspberry Pi, run:

```bash
bash scripts/verify-installation.sh
```

This checks:
- Main executable exists and is executable
- Required files are present
- Desktop entry created
- Autostart configured
- Package registered in dpkg

## Common Installation Issues Fixed

### Issue: Package installs but app doesn't run

**Fix**: 
- After-install script now properly sets executable permissions
- Checks for file existence before operations
- Handles permission errors gracefully

### Issue: Missing dependencies

**Fix**:
- All required dependencies listed in `deb.depends`
- After-install script doesn't fail if optional operations fail
- Package can be installed even if fonts can't be installed

### Issue: Wrong installation path

**Fix**:
- Consistent `productName` (no spaces)
- Proper `executableName` configuration
- Correct paths in after-install script

## Testing the Build

### Local Testing

```bash
# Build for one architecture
npm run rpi:build:arm64

# Verify artifact
ls -lh dist/*.deb

# Test package info
dpkg-deb -I dist/masjidconnect-display-*.deb
```

### On Raspberry Pi

```bash
# Transfer .deb file
scp dist/masjidconnect-display-*.deb pi@rpi-ip:/home/pi/

# Install
ssh pi@rpi-ip
sudo dpkg -i masjidconnect-display-*.deb
sudo apt-get install -f  # Fix any missing dependencies

# Verify installation
bash scripts/verify-installation.sh

# Test app
/opt/masjidconnect-display/masjidconnect-display --no-sandbox
```

## GitHub Actions Integration

The workflow now:
1. Builds each architecture in separate matrix jobs
2. Validates artifacts after build
3. Ensures scripts are executable
4. Uses `npx electron-builder` for consistency

## Best Practices

1. **Always build architectures separately** - Don't try to build both at once
2. **Validate builds** - Check artifact size and existence
3. **Test on actual hardware** - Virtual machines may not catch RPI-specific issues
4. **Check logs** - Review `/var/log/masjidconnect-install.log` after installation
5. **Verify permissions** - Ensure executable has proper permissions

## Troubleshooting

### Build fails with "Cannot find module"

```bash
# Clean and rebuild
rm -rf node_modules package-lock.json dist build
npm install
npm run rpi:build
```

### .deb file is too small

- Check build logs for errors
- Verify React app built successfully (`build/` directory exists)
- Ensure electron-builder completed without errors

### Installation fails on RPI

```bash
# Check installation log
cat /var/log/masjidconnect-install.log

# Fix dependencies
sudo apt-get install -f

# Check package info
dpkg -l | grep masjidconnect
```

### App doesn't start

```bash
# Check executable permissions
ls -l /opt/masjidconnect-display/masjidconnect-display

# Fix if needed
sudo chmod +x /opt/masjidconnect-display/masjidconnect-display

# Check logs
cat ~/.config/masjidconnect-display/logs/main.log
```

## Summary

The build process has been completely redesigned to:
- ✅ Build architectures separately for reliability
- ✅ Validate builds at every step
- ✅ Provide clear error messages
- ✅ Handle RPI-specific requirements
- ✅ Ensure proper file permissions
- ✅ Support clean installation and uninstallation

