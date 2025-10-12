# Raspberry Pi Build Guide

## Overview

This guide explains how to build the MasjidConnect Display App for Raspberry Pi, including local builds on your M4 MacBook Pro and automated builds via GitHub Actions.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding the Build Process](#understanding-the-build-process)
3. [Local Build on M4 Mac](#local-build-on-m4-mac)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Installing on Raspberry Pi](#installing-on-raspberry-pi)
6. [Testing the Build](#testing-the-build)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### On Your M4 MacBook Pro

```bash
# Node.js and npm (should already be installed)
node --version  # Should be v16+
npm --version   # Should be v8+

# Verify git is installed
git --version

# Check that you have the project dependencies installed
cd /Users/tahmidhoque/dev/masjidconnect-display-app
npm install
```

### For Raspberry Pi Deployment

- **Raspberry Pi 3** (ARMv7l architecture) or **Raspberry Pi 4/5** (ARM64 architecture)
- **Raspberry Pi OS** (formerly Raspbian) - Bookworm or Bullseye recommended
- SSH access to your Pi or physical access with keyboard/monitor
- Network connection

---

## Understanding the Build Process

The build process has several stages:

### 1. **React Build** (`npm run build`)

- Compiles TypeScript to JavaScript
- Bundles React app with webpack
- Optimizes assets (minification, tree-shaking)
- Outputs to `build/` directory
- Injects `REACT_APP_VERSION` from package.json

### 2. **Path Fixing** (`./fix-paths.sh`)

- Converts absolute paths (`/static/`) to relative paths (`./static/`)
- Adds `<base href="./" />` tag for Electron compatibility
- Ensures assets load correctly in packaged app

### 3. **RPI Preparation** (`node scripts/prepare-rpi-build.js`)

- Validates semantic version format
- Generates build metadata (git hash, branch, timestamp)
- Creates `version.json` file
- Prepares post-install scripts
- Creates build report

### 4. **Electron Builder** (`electron-builder`)

- Packages Electron app with React build
- Cross-compiles for ARM architectures (ARMv7l and ARM64)
- Creates `.deb` packages for easy installation
- Creates `.tar.gz` archives as backup
- Signs and notarizes (if configured)

### 5. **Output**

Final builds are placed in `dist/` directory:

- `masjidconnect-display-{version}-armv7l.deb` (for RPi 3)
- `masjidconnect-display-{version}-arm64.deb` (for RPi 4/5)
- `masjidconnect-display-{version}-armv7l.tar.gz` (alternative format)
- `masjidconnect-display-{version}-arm64.tar.gz` (alternative format)

---

## Local Build on M4 Mac

### Step 1: Update Version (Optional)

Before building, you may want to bump the version:

```bash
# For a patch release (0.0.1 -> 0.0.2)
npm run version:bump:patch

# For a minor release (0.0.1 -> 0.1.0)
npm run version:bump:minor

# For a major release (0.0.1 -> 1.0.0)
npm run version:bump:major
```

This updates `package.json` version. Commit this change:

```bash
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
```

### Step 2: Build for Both Architectures

This is the **recommended approach** for testing - builds for both RPi 3 and RPi 4/5:

```bash
cd /Users/tahmidhoque/dev/masjidconnect-display-app

# Build for both ARMv7l (RPi 3) and ARM64 (RPi 4/5)
npm run rpi:build
```

This command does:

1. ✅ Runs `npm run build:fix-paths` (builds React app + fixes paths)
2. ✅ Runs `node scripts/prepare-rpi-build.js` (prepares RPI-specific files)
3. ✅ Runs `electron-builder` for both architectures
4. ⏱️ **Build time: ~5-10 minutes** depending on your Mac

**Output:**

```
dist/
├── masjidconnect-display-0.0.1-armv7l.deb    (~150MB)
├── masjidconnect-display-0.0.1-arm64.deb     (~150MB)
├── masjidconnect-display-0.0.1-armv7l.tar.gz (~140MB)
└── masjidconnect-display-0.0.1-arm64.tar.gz  (~140MB)
```

### Step 3: Build for Specific Architecture (Optional)

If you only need one architecture:

```bash
# For Raspberry Pi 3 only (ARMv7l)
npm run rpi:build:armv7l

# For Raspberry Pi 4/5 only (ARM64)
npm run rpi:build:arm64
```

### Step 4: Verify Build

Check that the build completed successfully:

```bash
ls -lh dist/*.deb
```

You should see:

```
-rw-r--r--  1 you  staff  147M Oct 12 15:30 masjidconnect-display-0.0.1-arm64.deb
-rw-r--r--  1 you  staff  149M Oct 12 15:30 masjidconnect-display-0.0.1-armv7l.deb
```

Check the build metadata:

```bash
cat build/version.json
```

Expected output:

```json
{
  "version": "0.0.1",
  "buildTimestamp": "2025-10-12T14:30:45.123Z",
  "gitHash": "a1b2c3d",
  "gitBranch": "main",
  "nodeVersion": "v20.10.0",
  "platform": "linux",
  "architectures": ["armv7l", "arm64"]
}
```

---

## GitHub Actions CI/CD

### Automated Builds

The project includes a GitHub Actions workflow (`.github/workflows/build-and-release.yml`) that automatically builds the app when you push to main or create a release.

### Triggering a Build

#### Method 1: Push to Main Branch

```bash
git push origin main
```

- Automatically triggers build workflow
- Creates builds but **does not publish** to GitHub Releases
- Artifacts are available in Actions tab

#### Method 2: Create a Release Tag

```bash
# Create and push a version tag
git tag v0.0.1
git push origin v0.0.1
```

- Triggers build workflow
- **Publishes** `.deb` files to GitHub Releases
- Creates release notes from git commits
- Makes builds publicly accessible

#### Method 3: Manual Workflow Dispatch

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Build and Release Electron App** workflow
4. Click **Run workflow** button
5. Choose branch and click **Run workflow**

### Monitoring Build Status

1. Go to **Actions** tab in GitHub
2. Click on the running workflow
3. View logs for each job (build, test, release)
4. Download artifacts from the **Artifacts** section

### Workflow Configuration

The workflow (`.github/workflows/build-and-release.yml`) does:

1. ✅ Checks out code
2. ✅ Sets up Node.js 20
3. ✅ Installs dependencies
4. ✅ Builds React app
5. ✅ Runs prepare-rpi-build.js
6. ✅ Cross-compiles for ARM using electron-builder
7. ✅ Publishes to GitHub Releases (if on main/release branch)

**Note:** The workflow uses Linux runners with Docker for ARM cross-compilation.

---

## Installing on Raspberry Pi

### Prerequisites on RPi

```bash
# Update system packages (recommended)
sudo apt update
sudo apt upgrade -y

# Install required dependencies (should auto-install with .deb, but just in case)
sudo apt install -y \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnotify4 \
  libnss3 \
  libx11-xcb1 \
  libxcb-dri3-0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  libuuid1 \
  xdg-utils
```

### Method 1: Install from Local Build

1. **Transfer the .deb file to your Raspberry Pi:**

   ```bash
   # From your Mac, use scp to transfer
   cd /Users/tahmidhoque/dev/masjidconnect-display-app

   # For Raspberry Pi 3 (ARMv7l)
   scp dist/masjidconnect-display-0.0.1-armv7l.deb pi@your-pi-ip:/home/pi/

   # For Raspberry Pi 4/5 (ARM64)
   scp dist/masjidconnect-display-0.0.1-arm64.deb pi@your-pi-ip:/home/pi/
   ```

2. **SSH into your Raspberry Pi:**

   ```bash
   ssh pi@your-pi-ip
   ```

3. **Install the package:**

   ```bash
   # For RPi 3
   sudo dpkg -i masjidconnect-display-0.0.1-armv7l.deb

   # For RPi 4/5
   sudo dpkg -i masjidconnect-display-0.0.1-arm64.deb

   # Fix any missing dependencies (if needed)
   sudo apt-get install -f
   ```

4. **Verify installation:**

   ```bash
   # Check if installed
   dpkg -l | grep masjidconnect

   # Check installation location
   ls -la /opt/masjidconnect-display/

   # Check desktop entry
   cat /usr/share/applications/masjidconnect-display.desktop
   ```

### Method 2: Install from GitHub Release

1. **Download directly on RPi:**

   ```bash
   # Get the latest release URL from GitHub
   RELEASE_URL="https://github.com/masjidSolutions/masjidconnect-display-app/releases/download/v0.0.1/masjidconnect-display-0.0.1-arm64.deb"

   # Download
   wget $RELEASE_URL

   # Install
   sudo dpkg -i masjidconnect-display-0.0.1-arm64.deb
   sudo apt-get install -f
   ```

### Starting the Application

#### Option 1: Launch from Desktop

- Open the application menu
- Look for **MasjidConnect Display** under **Utilities**
- Click to launch

#### Option 2: Launch from Terminal

```bash
# Run in foreground
/opt/masjidconnect-display/masjidconnect-display --no-sandbox

# Run in background
nohup /opt/masjidconnect-display/masjidconnect-display --no-sandbox > /dev/null 2>&1 &
```

#### Option 3: Auto-start on Boot

The .deb installer should have configured this, but verify:

```bash
# Check if autostart entry exists
cat ~/.config/autostart/masjidconnect-display.desktop

# If not, create it
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/masjidconnect-display.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=/opt/masjidconnect-display/masjidconnect-display --no-sandbox
X-GNOME-Autostart-enabled=true
EOF
```

---

## Testing the Build

### 1. Check Application Startup

After launching, verify:

- ✅ Application window opens
- ✅ Pairing screen appears with QR code
- ✅ No console errors
- ✅ Network connectivity indicator shows online

### 2. Check Version Display

- ✅ Version number visible in footer (e.g., "v0.0.1")
- ✅ Matches the version in `package.json`

### 3. Test Pairing Flow

1. Generate pairing code
2. Verify QR code displays
3. Test pairing with admin portal
4. Verify credentials are saved
5. Check transition to display screen

### 4. Test OTA Updates (if configured)

1. **Check for updates manually:**

   - Updates should check on app start
   - Look for update notification if newer version exists

2. **Simulate update:**
   - Push new version to GitHub
   - Restart app on RPi
   - Verify update prompt appears

### 5. Test Remote Control (if configured)

From admin portal, test:

- ✅ Force update command
- ✅ Restart app command
- ✅ Reload content command
- ✅ Clear cache command
- ✅ Screenshot capture

### 6. Performance Checks

Monitor on Raspberry Pi:

```bash
# CPU usage
top | grep masjidconnect

# Memory usage
ps aux | grep masjidconnect

# Check logs
journalctl -f | grep masjidconnect
```

### 7. Long-term Stability Test

Leave the app running for 24+ hours and check:

- ✅ No memory leaks
- ✅ No crashes
- ✅ Smooth rendering
- ✅ Responsive to commands

---

## Troubleshooting

### Build Issues

#### Issue: `fix-paths.sh: command not found`

**Solution:**

```bash
chmod +x fix-paths.sh
```

#### Issue: `electron-builder: command not found`

**Solution:**

```bash
npm install
# Ensure electron-builder is in devDependencies
```

#### Issue: Build fails with "Cannot find module"

**Solution:**

```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
npm install
npm run rpi:build
```

#### Issue: Cross-compilation fails on M4 Mac

**Solution:**

- Electron-builder may need Docker for ARM cross-compilation
- Alternative: Use GitHub Actions for builds

### Installation Issues

#### Issue: dpkg dependency errors

**Solution:**

```bash
# Fix missing dependencies
sudo apt-get install -f

# Or install dependencies manually
sudo apt install libasound2 libgtk-3-0 libnss3
```

#### Issue: Permission denied on `/opt/masjidconnect-display/`

**Solution:**

```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/masjidconnect-display/

# Or run with sudo
sudo /opt/masjidconnect-display/masjidconnect-display --no-sandbox
```

### Runtime Issues

#### Issue: Application won't start

**Solution:**

```bash
# Check logs
cat /var/log/masjidconnect-install.log

# Run with verbose logging
/opt/masjidconnect-display/masjidconnect-display --no-sandbox --enable-logging
```

#### Issue: Black screen or blank window

**Solution:**

```bash
# Disable hardware acceleration
/opt/masjidconnect-display/masjidconnect-display --no-sandbox --disable-gpu
```

#### Issue: High CPU/memory usage

**Solution:**

- Check for memory leaks in console
- Restart application
- Update to latest version

---

## Quick Reference

### Common Commands

```bash
# Version management
npm run version:bump:patch      # 0.0.1 -> 0.0.2
npm run version:bump:minor      # 0.0.1 -> 0.1.0
npm run version:bump:major      # 0.0.1 -> 1.0.0

# Building
npm run rpi:build               # Build for both architectures
npm run rpi:build:armv7l        # Build for RPi 3
npm run rpi:build:arm64         # Build for RPi 4/5
npm run rpi:publish             # Build and publish to GitHub

# Testing locally
npm run electron:dev            # Run in development mode
npm run build                   # Build React app only

# Installation on RPi
sudo dpkg -i masjidconnect-display-*.deb
sudo apt-get install -f

# Uninstallation on RPi
sudo apt remove masjidconnect-display
```

### File Locations

```
Local Development:
├── /Users/tahmidhoque/dev/masjidconnect-display-app/    # Project root
├── build/                                               # React build output
├── dist/                                                # Electron build output
└── node_modules/                                        # Dependencies

Raspberry Pi:
├── /opt/masjidconnect-display/                          # Application files
├── /usr/share/applications/                             # Desktop entry
├── /var/log/masjidconnect-install.log                   # Installation log
└── ~/.config/autostart/                                 # Auto-start config
```

---

## Next Steps

1. ✅ Complete a test build locally
2. ✅ Test installation on a Raspberry Pi 3 or 4
3. ✅ Verify all features work (pairing, updates, remote control)
4. ✅ Document any platform-specific issues
5. ✅ Set up GitHub Actions for automated releases

---

## Support

For issues or questions:

- Check existing documentation in `docs/`
- Review GitHub Issues
- Check application logs
- Contact the development team
