#!/bin/bash
# MasjidConnect Display App Installer for Raspberry Pi
# This script handles installation and dependency resolution with proper permissions

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

# Fix APT sandbox issue (common on Raspberry Pi OS)
echo "Configuring APT for proper package installation..."
if [ ! -f "/etc/apt/apt.conf.d/99masjidconnect-fix" ]; then
    cat > /etc/apt/apt.conf.d/99masjidconnect-fix << EOF
APT::Sandbox::User "root";
EOF
    echo "✓ APT configuration fixed for Raspberry Pi"
fi

# Copy the .deb file to a system location to avoid permission issues
TEMP_DEB="/tmp/$(basename "$DEB_FILE")"
echo "Copying package to system location..."
cp "$DEB_FILE" "$TEMP_DEB"
chmod 644 "$TEMP_DEB"

# Install required dependencies first
echo "Installing required dependencies..."
apt-get update
apt-get install -y libasound2 libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 \
    xdg-utils libatspi2.0-0 libuuid1 libgbm1 libdrm2 libxkbcommon0 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libxcb-dri3-0

# Install the application using dpkg first, then fix dependencies
echo "Installing MasjidConnect Display App..."
if dpkg -i "$TEMP_DEB" 2>/dev/null; then
    echo "✓ Package installed successfully"
else
    echo "Package installation needs dependency fix, running apt-get install -f..."
    apt-get install -f -y
    
    # Try installing again
    if dpkg -i "$TEMP_DEB"; then
        echo "✓ Package installed successfully after dependency fix"
    else
        echo "✗ Package installation failed. Trying alternative method..."
        # Alternative: use gdebi if available, or force install
        if command -v gdebi >/dev/null 2>&1; then
            gdebi -n "$TEMP_DEB"
        else
            echo "Installing gdebi and trying again..."
            apt-get install -y gdebi-core
            gdebi -n "$TEMP_DEB"
        fi
    fi
fi

# Clean up temporary file
rm -f "$TEMP_DEB"

# Verify installation
if command -v masjidconnect-display >/dev/null 2>&1 || [ -f "/opt/masjidconnect-display/masjidconnect-display" ]; then
    echo
    echo "✓ Installation completed successfully!"
    echo
    echo "The MasjidConnect Display App has been installed to:"
    echo "  /opt/masjidconnect-display/"
    echo
    echo "The application will start automatically on next boot."
    echo "To start it manually right now, run:"
    echo "  /opt/masjidconnect-display/masjidconnect-display"
    echo
    echo "Or for kiosk mode:"
    echo "  /opt/masjidconnect-display/launcher.sh"
    echo
    echo "To configure your display, pair it with your MasjidConnect account"
    echo "when the pairing screen appears."
    
    # Clean up the APT configuration fix
    rm -f /etc/apt/apt.conf.d/99masjidconnect-fix
    echo
    echo "Installation log available at: /var/log/masjidconnect-install.log"
else
    echo
    echo "✗ Installation verification failed."
    echo "Please check the output above for details."
    echo "You may need to install missing dependencies manually."
    exit 1
fi

echo
echo "Installation complete! 🎉"
echo "Reboot your Raspberry Pi to start the display automatically." 