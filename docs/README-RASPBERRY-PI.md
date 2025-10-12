# MasjidConnect Display App - Raspberry Pi Build Guide

This guide explains how to build and deploy the MasjidConnect Display App for Raspberry Pi devices.

## Prerequisites

- Node.js 16+ and npm installed on your development machine
- Git access to the repository
- For publishing releases: GitHub access token with repository write permissions

## Building for Raspberry Pi

The Raspberry Pi build process creates optimized Debian packages (.deb) that can be installed directly on Raspberry Pi OS.

### Using the Build Script (Recommended)

The easiest way to build for Raspberry Pi is to use the included build script:

```bash
# Clone the repository
git clone https://github.com/masjidSolutions/masjidconnect-display-app.git
cd masjidconnect-display-app

# Make the build script executable (if needed)
chmod +x build-rpi-package.sh

# Build for 32-bit Raspberry Pi (ARMv7l)
./build-rpi-package.sh --armv7l

# OR Build for 64-bit Raspberry Pi (ARM64)
./build-rpi-package.sh --arm64

# OR Build for both architectures
./build-rpi-package.sh --all
```

The build script handles:
- Installing dependencies if needed
- Creating necessary installation scripts
- Building the React app
- Packaging the Electron app as deb packages
- Creating tar.gz archives as fallbacks

### Publishing a Release

To publish a release to GitHub (for auto-updates):

1. Update the version number in `package.json`
2. Set up GitHub token:
   ```bash
   export GH_TOKEN=your_github_token_here
   ```
3. Run the build script with the publish flag:
   ```bash
   ./build-rpi-package.sh --all --publish
   ```

### Manual Build (Alternative)

If you prefer to use npm scripts directly:

```bash
# Install dependencies
npm install

# Create a local build for ARMv7l (32-bit)
npm run electron:build:rpi:noicon

# OR Build for ARM64 (64-bit)
npm run electron:build:rpi:arm64

# OR Publish a release
npm run electron:build:rpi:publish
```

## Installing on Raspberry Pi

### Using the Debian Package

1. Copy the .deb file to the Raspberry Pi
2. Install it using:
   ```bash
   sudo apt install ./masjidconnect-display-[version]-[arch].deb
   ```

### Auto-updates

The app includes an auto-updater that will check for updates hourly when connected to the internet. When a new version is available, it will:

1. Download the update in the background
2. Install it automatically when the device is restarted

### Manual Updates

To manually update:

```bash
sudo apt update
sudo apt install --only-upgrade masjidconnect-display
```

## Troubleshooting

### Installation Issues

If the installation fails:
- Check the installation log: `cat /var/log/masjidconnect-install.log`
- Verify package dependencies are satisfied

If you see an error about "_apt" user and unsandboxed downloads:
- This is a permissions issue with APT. You can fix it by running:
  ```bash
  sudo sh -c 'echo "APT::Sandbox::User \"_apt\";" > /etc/apt/apt.conf.d/99temp-allow-sandbox'
  ```
  Then try installing the package again.

### Missing Library Errors

If you see "libgbm.so.1 cannot open shared object file: no such file or directory":
- Install the missing library manually:
  ```bash
  sudo apt update
  sudo apt install -y libgbm1
  ```
- Then restart the application

### Display Issues

If there are rendering issues:
- Edit `/boot/config.txt` and ensure proper GPU memory allocation (at least 128MB)
- Add `dtoverlay=vc4-fkms-v3d` to `/boot/config.txt`

### Permission Issues

If the app doesn't launch properly:
- Check permissions: `sudo chmod +x /opt/masjidconnect-display/masjidconnect-display`
- Check logs: `cat /var/log/masjidconnect-install.log`

### Auto-update Issues

If auto-updates aren't working:
- Ensure internet connectivity
- Check logs at `~/.config/masjidconnect-display/logs/main.log`

## System Requirements

- Raspberry Pi 3 or newer (Pi 4 with 2GB+ RAM recommended)
- Raspberry Pi OS Bullseye or newer (64-bit recommended for Pi 4)
- 1GB+ free storage space
- Display connected via HDMI
- Network connection (for updates and content synchronization)

## Build Process Details

The build process includes:
1. Building the React application
2. Creating optimized electron packages for ARM architectures
3. Setting up desktop integration via the after-install script
4. Configuring auto-update through GitHub releases

For more technical details, examine the `build-rpi-package.sh` script. 