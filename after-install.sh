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

echo "Post-installation completed successfully!" | tee -a $LOGFILE
exit 0
