#!/bin/bash

# MasjidConnect Display App - Post Installation Script for Raspberry Pi
# This script configures the system for optimal display app performance

# Log file for installation
LOGFILE="/var/log/masjidconnect-install.log"

# Ensure log file exists and is writable
touch $LOGFILE 2>/dev/null || {
    echo "Warning: Cannot create log file, using stdout only"
    LOGFILE="/dev/stdout"
}
chmod 644 $LOGFILE 2>/dev/null

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOGFILE
}

log_message "=== MasjidConnect Display Post-Installation Started ==="

# Set installation directory
INSTALL_DIR="/opt/masjidconnect-display"
FONTS_DIR="/usr/local/share/fonts/masjidconnect"

# Create desktop file with optimized configuration for RPi
log_message "Creating desktop entry..."
cat > /usr/share/applications/masjidconnect-display.desktop << EOD
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=$INSTALL_DIR/masjidconnect-display --no-sandbox --disable-gpu-compositing --disable-software-rasterizer
Icon=$INSTALL_DIR/resources/assets/icon.png
Comment=Digital signage for mosques - Optimized for Raspberry Pi
Categories=Utility;Education;AudioVideo;
X-GNOME-Autostart-enabled=true
StartupNotify=false
Terminal=false
Keywords=mosque;prayer;display;signage;
EOD

if [ $? -eq 0 ]; then
    log_message "✓ Desktop entry created successfully"
else
    log_message "✗ Failed to create desktop entry"
fi

# Set up autostart for display
log_message "Setting up autostart..."
mkdir -p /etc/xdg/autostart/
if cp /usr/share/applications/masjidconnect-display.desktop /etc/xdg/autostart/; then
    log_message "✓ Autostart configured successfully"
else
    log_message "✗ Failed to configure autostart"
fi

# Create systemd service for kiosk mode (optional, for advanced setups)
log_message "Creating systemd service..."
cat > /etc/systemd/system/masjidconnect-display.service << EOD
[Unit]
Description=MasjidConnect Display App
After=graphical-session.target network-online.target
Wants=graphical-session.target network-online.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
Environment=XDG_RUNTIME_DIR=/run/user/1000
ExecStart=$INSTALL_DIR/masjidconnect-display --no-sandbox --disable-gpu-compositing
Restart=always
RestartSec=10

[Install]
WantedBy=graphical-session.target
EOD

# Enable the service but don't start it (let desktop autostart handle it)
systemctl daemon-reload
systemctl enable masjidconnect-display.service --quiet
log_message "✓ Systemd service created and enabled"

# Set proper permissions for the application
log_message "Setting permissions..."
if [ -f "$INSTALL_DIR/masjidconnect-display" ]; then
    chmod +x "$INSTALL_DIR/masjidconnect-display"
    log_message "✓ Application permissions set"
else
    log_message "✗ Application binary not found at $INSTALL_DIR"
fi

# Install fonts system-wide for proper Arabic text rendering
log_message "Installing Arabic fonts..."
mkdir -p "$FONTS_DIR"

# Try multiple font source locations
FONT_SOURCES=(
    "$INSTALL_DIR/resources/app/build/static/fonts"
    "$INSTALL_DIR/resources/app/src/assets/fonts"
    "$INSTALL_DIR/resources/build/static/fonts"
    "$INSTALL_DIR/build/static/fonts"
)

FONTS_INSTALLED=0
for font_source in "${FONT_SOURCES[@]}"; do
    if [ -d "$font_source" ]; then
        if cp -r "$font_source"/* "$FONTS_DIR/" 2>/dev/null; then
            log_message "✓ Fonts copied from $font_source"
            FONTS_INSTALLED=1
            break
        fi
    fi
done

if [ $FONTS_INSTALLED -eq 0 ]; then
    log_message "⚠ No fonts found to install, Arabic text may not render properly"
else
# Set proper permissions for font files
    find "$FONTS_DIR" -type f -exec chmod 644 {} \; 2>/dev/null
    
    # Update font cache
    if command -v fc-cache >/dev/null 2>&1; then
        fc-cache -f 2>/dev/null && log_message "✓ Font cache updated"
    fi
fi

# Create optimized launcher script for manual execution
log_message "Creating optimized launcher script..."
cat > "$INSTALL_DIR/launcher.sh" << EOD
#!/bin/bash
# MasjidConnect Display Launcher - Optimized for Raspberry Pi

# Set environment variables for better performance
export ELECTRON_ENABLE_LOGGING=false
export ELECTRON_DISABLE_SANDBOX=1
export DISPLAY=:0

# Graphics optimizations for Raspberry Pi
export GDK_BACKEND=x11
export LIBGL_ALWAYS_SOFTWARE=1

# Launch the application with optimal flags
exec "$INSTALL_DIR/masjidconnect-display" \\
    --no-sandbox \\
    --disable-gpu-compositing \\
    --disable-software-rasterizer \\
    --disable-dev-shm-usage \\
    --disable-extensions \\
    --disable-plugins \\
    --disable-background-timer-throttling \\
    --disable-backgrounding-occluded-windows \\
    --disable-renderer-backgrounding \\
    --max-old-space-size=256 \\
    "\$@"
EOD

chmod +x "$INSTALL_DIR/launcher.sh"
log_message "✓ Launcher script created"

# Apply basic Raspberry Pi optimizations
log_message "Applying Raspberry Pi optimizations..."

# Check if we're on a Raspberry Pi
if grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
    log_message "Raspberry Pi detected, applying specific optimizations..."
    
    # Create GPU memory configuration for better performance
    CONFIG_FILE="/boot/config.txt"
    if [ ! -f "$CONFIG_FILE" ] && [ -f "/boot/firmware/config.txt" ]; then
        CONFIG_FILE="/boot/firmware/config.txt"
    fi
    
    if [ -f "$CONFIG_FILE" ]; then
        # Backup config file
        cp "$CONFIG_FILE" "${CONFIG_FILE}.masjidconnect-backup" 2>/dev/null
        
        # Ensure minimum GPU memory for display applications
        if ! grep -q "^gpu_mem=" "$CONFIG_FILE"; then
            echo "gpu_mem=128" >> "$CONFIG_FILE"
            log_message "✓ Set GPU memory to 128MB"
        fi
    else
        log_message "⚠ Raspberry Pi config file not found"
    fi
else
    log_message "Not running on Raspberry Pi, skipping Pi-specific optimizations"
fi

# Create uninstall script
log_message "Creating uninstall script..."
cat > "$INSTALL_DIR/uninstall.sh" << EOD
#!/bin/bash
# MasjidConnect Display Uninstaller

echo "Removing MasjidConnect Display..."

# Stop and disable service
systemctl stop masjidconnect-display.service 2>/dev/null
systemctl disable masjidconnect-display.service 2>/dev/null

# Remove desktop files
rm -f /usr/share/applications/masjidconnect-display.desktop
rm -f /etc/xdg/autostart/masjidconnect-display.desktop

# Remove systemd service
rm -f /etc/systemd/system/masjidconnect-display.service
systemctl daemon-reload

# Remove fonts
rm -rf "$FONTS_DIR"
fc-cache -f 2>/dev/null

echo "MasjidConnect Display removed successfully"
EOD

chmod +x "$INSTALL_DIR/uninstall.sh"
log_message "✓ Uninstall script created"

log_message "=== Post-Installation Completed Successfully ==="
log_message "The MasjidConnect Display App is now installed and configured."
log_message "It will start automatically on the next boot."
log_message "To start manually, run: $INSTALL_DIR/masjidconnect-display"
log_message "For kiosk mode, use: $INSTALL_DIR/launcher.sh"
log_message "To uninstall, run: $INSTALL_DIR/uninstall.sh"

exit 0
