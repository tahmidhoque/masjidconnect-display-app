#!/bin/bash
# MasjidConnect Display App - Quick Installer for Raspberry Pi
# Handles _apt user permission issues

set -e

echo "MasjidConnect Display App - Quick Installer"
echo "==========================================="

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
   echo "Error: This script must be run as root"
   echo "Run: sudo $0"
   exit 1
fi

# Find the .deb file in current directory
DEB_FILE=$(find . -maxdepth 1 -name "masjidconnect-display-*.deb" | head -1)

if [ -z "$DEB_FILE" ]; then
    echo "Error: No .deb file found in current directory"
    echo "Please ensure the .deb package is in the same directory as this script"
    exit 1
fi

echo "Found package: $(basename "$DEB_FILE")"

# Copy to /var/cache/apt/archives/ where APT expects packages
echo "Preparing package for installation..."
cp "$DEB_FILE" /var/cache/apt/archives/

# Install dependencies
echo "Installing dependencies..."
apt-get update
apt-get install -y \
    libasound2 libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 \
    xdg-utils libatspi2.0-0 libuuid1 libgbm1 libdrm2 \
    libxkbcommon0 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libxcb-dri3-0

# Install the package using dpkg
echo "Installing MasjidConnect Display App..."
if dpkg -i "$DEB_FILE"; then
    echo "✓ Installation successful!"
else
    echo "Fixing dependencies..."
    apt-get install -f -y
    echo "✓ Installation completed with dependency fixes"
fi

# Clean up
rm -f /var/cache/apt/archives/$(basename "$DEB_FILE")

echo
echo "🎉 MasjidConnect Display App installed successfully!"
echo
echo "The app will start automatically on next boot."
echo "To start it now: /opt/masjidconnect-display/masjidconnect-display"
echo
echo "Reboot recommended: sudo reboot" 