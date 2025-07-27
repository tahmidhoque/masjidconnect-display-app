#!/bin/bash
# MasjidConnect Display App - Auto-Update Service Installer
# Sets up automatic background updates for source-built installations

set -e

print_status() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    print_error "This script must be run as root"
    echo "Try: sudo $0"
    exit 1
fi

print_status "Setting up MasjidConnect Display Auto-Update Service..."

# Create update script in system location
UPDATE_SCRIPT="/usr/local/bin/masjidconnect-update"
cp update-manager-rpi.sh "$UPDATE_SCRIPT"
chmod +x "$UPDATE_SCRIPT"

print_status "✓ Update script installed to $UPDATE_SCRIPT"

# Create systemd timer for automatic updates
cat > /etc/systemd/system/masjidconnect-update.service << 'EOF'
[Unit]
Description=MasjidConnect Display Update Service
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/masjidconnect-update update
StandardOutput=journal
StandardError=journal
TimeoutSec=3600

# Restart policies
Restart=no
EOF

cat > /etc/systemd/system/masjidconnect-update.timer << 'EOF'
[Unit]
Description=MasjidConnect Display Update Timer
Requires=masjidconnect-update.service

[Timer]
# Check for updates every 6 hours
OnCalendar=*-*-* 06,12,18,00:00:00
# Run 5 minutes after boot if missed
OnBootSec=5min
# If system was off, run update check on next boot
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Create update notification script
cat > /usr/local/bin/masjidconnect-update-notify << 'EOF'
#!/bin/bash
# Update notification for MasjidConnect Display

# Check if X display is available
if [ -z "$DISPLAY" ] && [ -n "$XDG_SESSION_TYPE" ]; then
    export DISPLAY=:0
fi

# Try to show desktop notification
if command -v notify-send >/dev/null 2>&1; then
    notify-send "MasjidConnect Display" "Update completed successfully" --icon=info
fi

# Log to syslog
logger -t masjidconnect "Display app updated successfully"
EOF

chmod +x /usr/local/bin/masjidconnect-update-notify

# Create manual update checker for desktop
cat > /usr/local/bin/masjidconnect-check-updates << 'EOF'
#!/bin/bash
# Manual update checker with GUI

RESULT=$(/usr/local/bin/masjidconnect-update check)

if echo "$RESULT" | grep -q "Update available"; then
    if command -v zenity >/dev/null 2>&1; then
        if zenity --question --title="MasjidConnect Update" \
           --text="A new version of MasjidConnect Display is available.\n\nWould you like to update now?" \
           --width=300; then
            
            # Show progress dialog
            /usr/local/bin/masjidconnect-update update | \
                zenity --progress --title="Updating MasjidConnect Display" \
                       --text="Downloading and installing update..." \
                       --pulsate --auto-close
            
            zenity --info --title="Update Complete" \
                   --text="MasjidConnect Display has been updated successfully."
        fi
    else
        echo "Update available. Run 'sudo masjidconnect-update update' to install."
    fi
else
    if command -v zenity >/dev/null 2>&1; then
        zenity --info --title="No Updates" \
               --text="MasjidConnect Display is up to date."
    else
        echo "No updates available."
    fi
fi
EOF

chmod +x /usr/local/bin/masjidconnect-check-updates

# Enable and start the timer
systemctl daemon-reload
systemctl enable masjidconnect-update.timer
systemctl start masjidconnect-update.timer

print_status "✓ Auto-update timer enabled (checks every 6 hours)"

# Create desktop shortcut for manual update check
cat > /usr/share/applications/masjidconnect-update-checker.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Check MasjidConnect Updates
Exec=/usr/local/bin/masjidconnect-check-updates
Icon=system-software-update
Comment=Check for MasjidConnect Display updates
Categories=System;Settings;
StartupNotify=false
Terminal=false
EOF

print_status "✓ Desktop update checker created"

# Create logrotate configuration
cat > /etc/logrotate.d/masjidconnect << 'EOF'
/var/log/masjidconnect-update.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

print_status "✓ Log rotation configured"

echo
print_status "🎉 Auto-update service setup complete!"
echo
print_status "Configuration:"
echo "  ⏰ Automatic updates: Every 6 hours"
echo "  📝 Update logs: /var/log/masjidconnect-update.log"
echo "  🔧 Manual commands:"
echo "    Check updates:  sudo masjidconnect-update check"
echo "    Force update:   sudo masjidconnect-update update"
echo "    GUI checker:    masjidconnect-check-updates"
echo
print_status "⚡ Service status:"
systemctl status masjidconnect-update.timer --no-pager -l

echo
print_status "💡 Tips:"
echo "  • Updates happen automatically in the background"
echo "  • The app will restart automatically after updates"
echo "  • Backups are created before each update"
echo "  • Failed updates are automatically rolled back"
echo
print_status "To disable auto-updates: sudo systemctl disable masjidconnect-update.timer" 