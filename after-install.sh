#!/bin/bash

# Exit on error for critical operations, but allow some to fail gracefully
set +e  # Don't exit on error (we'll handle errors manually)

# Log file for installation
LOGFILE="/var/log/masjidconnect-install.log"

# Ensure log file exists and is writable (with error handling)
touch "$LOGFILE" 2>/dev/null || LOGFILE="/tmp/masjidconnect-install.log"
chmod 644 "$LOGFILE" 2>/dev/null || true

echo "Running MasjidConnect Display post-installation script..." | tee -a "$LOGFILE"
date | tee -a "$LOGFILE"

# Create desktop file in proper location
echo "Creating desktop entry..." | tee -a $LOGFILE
cat > /usr/share/applications/masjidconnect-display.desktop << EOL
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=/opt/masjidconnect-display/masjidconnect-display --no-sandbox
Icon=/opt/masjidconnect-display/resources/app/assets/icon.png
Comment=Digital signage for mosques
Categories=Utility;Education;
X-GNOME-Autostart-enabled=true
EOL

# Set up autostart for display
echo "Setting up autostart..." | tee -a $LOGFILE
mkdir -p /etc/xdg/autostart/
cp /usr/share/applications/masjidconnect-display.desktop /etc/xdg/autostart/

# Make sure the app has proper permissions
echo "Setting permissions..." | tee -a "$LOGFILE"
if [ -f /opt/masjidconnect-display/masjidconnect-display ]; then
  chmod +x /opt/masjidconnect-display/masjidconnect-display 2>/dev/null || {
    echo "Warning: Could not set executable permission on main binary" | tee -a "$LOGFILE"
  }
else
  echo "Warning: Main binary not found at expected location" | tee -a "$LOGFILE"
fi

# Install fonts system-wide for proper Arabic text rendering
echo "Installing Arabic fonts..." | tee -a "$LOGFILE"
FONTS_DIR="/usr/local/share/fonts/masjidconnect"

# Create fonts directory with error handling
if mkdir -p "$FONTS_DIR" 2>/dev/null; then
  echo "Fonts directory created: $FONTS_DIR" | tee -a "$LOGFILE"
  
  # Try to copy fonts from various possible locations
  FONT_COPIED=false
  
  # Try build directory first
  if [ -d "/opt/masjidconnect-display/resources/app/build/static/media" ]; then
    echo "Copying fonts from build/static/media..." | tee -a "$LOGFILE"
    cp /opt/masjidconnect-display/resources/app/build/static/media/*.woff2 "$FONTS_DIR/" 2>/dev/null && FONT_COPIED=true
  fi
  
  # Try assets directory
  if [ -d "/opt/masjidconnect-display/resources/app/src/assets/fonts" ]; then
    echo "Copying fonts from src/assets/fonts..." | tee -a "$LOGFILE"
    cp /opt/masjidconnect-display/resources/app/src/assets/fonts/*.woff2 "$FONTS_DIR/" 2>/dev/null && FONT_COPIED=true
  fi
  
  # Set proper permissions only if files exist
  if [ "$(ls -A $FONTS_DIR 2>/dev/null)" ]; then
    chmod 644 "$FONTS_DIR"/*.woff2 2>/dev/null || true
    chmod 755 "$FONTS_DIR" 2>/dev/null || true
    
    # Update font cache (silently fail if not available)
    if command -v fc-cache >/dev/null 2>&1; then
      echo "Updating font cache..." | tee -a "$LOGFILE"
      fc-cache -f 2>/dev/null || echo "Warning: Font cache update failed" | tee -a "$LOGFILE"
    else
      echo "Note: fc-cache not available, skipping font cache update" | tee -a "$LOGFILE"
    fi
    
    echo "Arabic fonts installed successfully" | tee -a "$LOGFILE"
  else
    echo "Warning: No font files found to install" | tee -a "$LOGFILE"
  fi
else
  echo "Warning: Could not create fonts directory, fonts may not render correctly" | tee -a "$LOGFILE"
fi

# Create optimized launcher script
echo "Creating optimized launcher script..." | tee -a "$LOGFILE"
if [ -d "/opt/masjidconnect-display" ]; then
  cat > /opt/masjidconnect-display/launcher.sh << 'EOL'
#!/bin/bash

# Set environment variables for better performance on Raspberry Pi
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1

# Graphics environment variables for improved RPi performance
export GDK_BACKEND=x11
export LIBGL_DRIVERS_PATH=/usr/lib/arm-linux-gnueabihf/dri:/usr/lib/aarch64-linux-gnu/dri

# Start the application with optimal flags
exec "/opt/masjidconnect-display/masjidconnect-display" "$@" --no-sandbox
EOL

  chmod +x /opt/masjidconnect-display/launcher.sh 2>/dev/null || {
    echo "Warning: Could not make launcher script executable" | tee -a "$LOGFILE"
  }
else
  echo "Warning: /opt/masjidconnect-display directory not found" | tee -a "$LOGFILE"
fi

echo "Post-installation completed!" | tee -a "$LOGFILE"
echo "Check $LOGFILE for details" | tee -a "$LOGFILE"

# Always exit successfully to allow package installation to complete
exit 0
