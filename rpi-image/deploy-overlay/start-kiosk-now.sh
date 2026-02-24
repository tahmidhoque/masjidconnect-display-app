#!/usr/bin/env bash
# =============================================================================
# Start the MasjidConnect kiosk on the physical display (VT 1) from SSH.
# Run on the Pi: sudo /opt/masjidconnect/deploy/start-kiosk-now.sh
#
# Ensures the Node server is up, then runs the X11 kiosk on VT 1 via openvt
# so the connected screen shows Chromium (works from an SSH session).
# =============================================================================
set -euo pipefail

USER_1000=$(getent passwd 1000 | cut -d: -f1)
HOME_1000=$(getent passwd 1000 | cut -d: -f6)
[ -z "$USER_1000" ] && { echo "No user 1000" >&2; exit 1; }

# Ensure display server is running
if ! systemctl is-active --quiet masjidconnect-display.service 2>/dev/null; then
  echo "Starting masjidconnect-display.service..."
  systemctl start masjidconnect-display.service
  sleep 2
fi

# Optional: switch display to VT 1 in case it was on tty2
/usr/bin/chvt 1 2>/dev/null || true

# Run kiosk on VT 1 as root so Xorg can open the VT (Chromium is started as UID 1000 from xinitrc)
echo "Starting kiosk on VT 1 (display should switch to Chromium)..."
exec openvt -c 1 -s -- /opt/masjidconnect/deploy/start-kiosk-x11.sh
