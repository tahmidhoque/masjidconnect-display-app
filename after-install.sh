#!/bin/bash

# Log file for installation
LOGFILE="/var/log/masjidconnect-install.log"

# Ensure log file exists and is writable
touch $LOGFILE
chmod 644 $LOGFILE

echo "Running MasjidConnect Display post-installation script..." | tee -a $LOGFILE
date | tee -a $LOGFILE

# Create desktop file in proper location
echo "Creating desktop entry..." | tee -a $LOGFILE
cat > /usr/share/applications/masjidconnect-display.desktop << EOD
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=/opt/masjidconnect-display/masjidconnect-display --no-sandbox
Icon=/opt/masjidconnect-display/resources/assets/icon.png
Comment=Digital signage for mosques
Categories=Utility;Education;
X-GNOME-Autostart-enabled=true
EOD

# Set up autostart for display
echo "Setting up autostart..." | tee -a $LOGFILE
mkdir -p /etc/xdg/autostart/
cp /usr/share/applications/masjidconnect-display.desktop /etc/xdg/autostart/

# Make sure the app has proper permissions
echo "Setting permissions..." | tee -a $LOGFILE
chmod +x /opt/masjidconnect-display/masjidconnect-display

# Install fonts system-wide for proper Arabic text rendering
echo "Installing Arabic fonts..." | tee -a $LOGFILE
FONTS_DIR="/usr/local/share/fonts/masjidconnect"
mkdir -p "$FONTS_DIR"

# Copy fonts from the app directory to system fonts
cp -r /opt/masjidconnect-display/resources/app/build/static/fonts/* "$FONTS_DIR" 2>/dev/null || true
cp -r /opt/masjidconnect-display/resources/app/src/assets/fonts/* "$FONTS_DIR" 2>/dev/null || true

# Set proper permissions for font files
chmod 644 "$FONTS_DIR"/*
fc-cache -f

echo "Post-installation completed successfully!" | tee -a $LOGFILE
exit 0
