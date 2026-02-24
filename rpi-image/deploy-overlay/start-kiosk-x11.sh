#!/usr/bin/env bash
# Start X11 kiosk on the current VT (tty1 when run from autologin .profile).
# HOME is set to UID 1000's home so .Xauthority is created there; xinitrc runs Chromium as UID 1000.
set -euo pipefail
# Ensure the display shows tty1 (kiosk) not the kernel console (tty2). User must be in group tty.
/usr/bin/chvt 1 2>/dev/null || true
export HOME=$(getent passwd 1000 | cut -d: -f6)
exec /usr/bin/xinit /opt/masjidconnect/deploy/xinitrc-kiosk -- :0 vt1
