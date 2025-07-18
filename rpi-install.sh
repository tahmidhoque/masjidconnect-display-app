#!/bin/bash
# MasjidConnect Display App Installer for Raspberry Pi
# This script handles installation and dependency resolution

echo "MasjidConnect Display App Installer"
echo "=================================="
echo

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
   echo "This script must be run as root" 
   echo "Try: sudo $0"
   exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Find the .deb file
DEB_FILE=$(find "$SCRIPT_DIR" -name "masjidconnect-display-*.deb" | sort -V | tail -n 1)

if [ -z "$DEB_FILE" ]; then
    echo "Error: Could not find any MasjidConnect Display .deb file in $SCRIPT_DIR"
    exit 1
fi

echo "Found installation package: $(basename "$DEB_FILE")"
echo

# Install required dependencies first
echo "Installing required dependencies..."
apt-get update
apt-get install -y libasound2 libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 \
    xdg-utils libatspi2.0-0 libuuid1 libgbm1 libdrm2 libxkbcommon0 libx11-xcb1

# Install the application with dependency handling
echo "Installing MasjidConnect Display App..."
apt-get install -f -y "$DEB_FILE"

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo
    echo "✓ Installation completed successfully!"
    echo "You can now run MasjidConnect Display from the applications menu"
    echo "or by typing 'masjidconnect-display' in a terminal."
    echo
    echo "To run in kiosk mode on startup, consider adding it to autostart or"
    echo "creating a systemd service."
else
    echo
    echo "✗ Installation encountered errors."
    echo "Please check the output above for details."
    exit 1
fi 