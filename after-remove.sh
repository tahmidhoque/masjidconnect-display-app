#!/bin/bash
# After remove script - cleans up when package is uninstalled

set +e  # Don't exit on error

LOGFILE="/var/log/masjidconnect-uninstall.log"
touch "$LOGFILE" 2>/dev/null || LOGFILE="/tmp/masjidconnect-uninstall.log"

echo "Running MasjidConnect Display uninstall cleanup..." | tee -a "$LOGFILE"
date | tee -a "$LOGFILE"

# Remove desktop entry
if [ -f "/usr/share/applications/masjidconnect-display.desktop" ]; then
  rm -f /usr/share/applications/masjidconnect-display.desktop
  echo "Removed desktop entry" | tee -a "$LOGFILE"
fi

# Remove autostart entry
if [ -f "/etc/xdg/autostart/masjidconnect-display.desktop" ]; then
  rm -f /etc/xdg/autostart/masjidconnect-display.desktop
  echo "Removed autostart entry" | tee -a "$LOGFILE"
fi

# Remove fonts (optional - keep if other apps might use them)
# Uncomment to remove fonts on uninstall:
# if [ -d "/usr/local/share/fonts/masjidconnect" ]; then
#   rm -rf /usr/local/share/fonts/masjidconnect
#   fc-cache -f 2>/dev/null
#   echo "Removed fonts" | tee -a "$LOGFILE"
# fi

echo "Uninstall cleanup completed" | tee -a "$LOGFILE"
exit 0

