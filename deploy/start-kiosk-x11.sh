#!/usr/bin/env bash
# Start X11 kiosk on the current VT (tty1 when run from autologin .profile).
# HOME is set to UID 1000's home so .Xauthority is created there; xinitrc runs Chromium as UID 1000.
set -euo pipefail
# Ensure the display shows tty1 (kiosk) not the kernel console (tty2). User must be in group tty.
/usr/bin/chvt 1 2>/dev/null || true
export HOME=$(getent passwd 1000 | cut -d: -f6)
# Redirect xinit/Xorg output away from the VT — otherwise X server startup
# messages are drawn over the boot splash. Full X log: /tmp/xorg-kiosk.log
exec /usr/bin/xinit /opt/masjidconnect/deploy/xinitrc-kiosk -- :0 vt1 >/tmp/xorg-kiosk.log 2>&1
