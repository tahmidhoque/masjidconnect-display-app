#!/usr/bin/env bash
# =============================================================================
# Apply MasjidConnect kiosk autologin on an already-flashed Pi (no reflash).
# Run on the Pi as root (e.g. sudo ./apply-kiosk-autologin.sh).
#
# - Enables getty autologin on tty1 for the first user (UID 1000).
# - Appends kiosk start to that user's ~/.profile (console tty1 only).
# - Disables masjidconnect-kiosk.service so the kiosk runs from the session.
# - Prompts to reboot so the kiosk starts on next boot.
# =============================================================================
set -euo pipefail

USER_1000=$(getent passwd 1000 | cut -d: -f1)
HOME_1000=$(getent passwd 1000 | cut -d: -f6)

if [ -z "$USER_1000" ] || [ -z "$HOME_1000" ]; then
  echo "ERROR: No user with UID 1000 found." >&2
  exit 1
fi

echo "Using user: $USER_1000 (home: $HOME_1000)"

# 1. getty@tty1 autologin drop-in (minimal form so no password prompt; 38400 linux is standard for console).
GETTY_DROPIN="/etc/systemd/system/getty@tty1.service.d"
mkdir -p "$GETTY_DROPIN"
cat > "${GETTY_DROPIN}/autologin.conf" << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${USER_1000} --noclear %I 38400 linux
EOF
echo "Created ${GETTY_DROPIN}/autologin.conf"

# 1b. PAM: allow passwordless login on tty1 for first user (so autologin never prompts for password).
if [ -f /etc/pam.d/login ]; then
  LINE="auth sufficient pam_succeed_if.so user = ${USER_1000} tty = tty1"
  if grep -qF "pam_succeed_if.so user = ${USER_1000} tty = tty1" /etc/pam.d/login; then
    echo "PAM rule for tty1 autologin already present in /etc/pam.d/login"
  else
    echo "$LINE" | cat - /etc/pam.d/login > /etc/pam.d/login.tmp && mv /etc/pam.d/login.tmp /etc/pam.d/login
    echo "Added PAM rule for passwordless tty1 login (user ${USER_1000})"
  fi
fi

# 2. Append kiosk to .profile (idempotent)
PROFILE="${HOME_1000}/.profile"
KIOSK_MARKER="# MasjidConnect kiosk (console only)"
KIOSK_LINE='[ "$(tty)" = "/dev/tty1" ] 2>/dev/null && exec /opt/masjidconnect/deploy/start-kiosk-x11.sh'

if [ -f "$PROFILE" ]; then
  if grep -q "start-kiosk-x11.sh" "$PROFILE" 2>/dev/null; then
    echo "Kiosk line already in $PROFILE, skipping."
  else
    echo "" >> "$PROFILE"
    echo "$KIOSK_MARKER" >> "$PROFILE"
    echo "$KIOSK_LINE" >> "$PROFILE"
    chown 1000:1000 "$PROFILE"
    echo "Appended kiosk start to $PROFILE"
  fi
else
  touch "$PROFILE"
  echo "$KIOSK_MARKER" >> "$PROFILE"
  echo "$KIOSK_LINE" >> "$PROFILE"
  chown 1000:1000 "$PROFILE"
  echo "Created $PROFILE with kiosk start"
fi

# 3. Disable the systemd kiosk service (so we use autologin instead)
if systemctl is-enabled masjidconnect-kiosk.service &>/dev/null; then
  systemctl disable --now masjidconnect-kiosk.service
  echo "Disabled masjidconnect-kiosk.service"
else
  systemctl stop masjidconnect-kiosk.service 2>/dev/null || true
  echo "masjidconnect-kiosk.service was not enabled, stopped if running"
fi

# 4. Reload systemd so getty override is picked up
systemctl daemon-reload
echo "Reloaded systemd"

# 5. Install and enable console-vt1 so the display switches to tty1 (kiosk) instead of kernel log (tty2)
CONSOLE_VT1_UNIT="/etc/systemd/system/masjidconnect-console-vt1.service"
if [ ! -f "$CONSOLE_VT1_UNIT" ]; then
  cat > "$CONSOLE_VT1_UNIT" << 'UNIT'
[Unit]
Description=Switch display to VT 1 (kiosk) so the screen shows getty/X instead of kernel console
After=plymouth-quit-wait.service
Before=getty@tty1.service

[Service]
Type=oneshot
ExecStart=/usr/bin/chvt 1
RemainAfterExit=yes

[Install]
WantedBy=default.target
UNIT
  echo "Created $CONSOLE_VT1_UNIT"
fi
systemctl enable masjidconnect-console-vt1.service
echo "Enabled masjidconnect-console-vt1.service (switch display to VT 1)"

# 6. Ensure the kiosk script runs chvt 1 when it starts (so display flips to tty1 even if console-vt1 ran too early)
KIOSK_SCRIPT="/opt/masjidconnect/deploy/start-kiosk-x11.sh"
if [ -f "$KIOSK_SCRIPT" ] && ! grep -q "chvt 1" "$KIOSK_SCRIPT" 2>/dev/null; then
  sed -i '/^set -euo pipefail$/a /usr\/bin\/chvt 1 2>\/dev\/null || true' "$KIOSK_SCRIPT"
  echo "Patched $KIOSK_SCRIPT to run chvt 1 at start"
fi

# 7. Remove console=tty2 from kernel cmdline so the display shows tty1 (getty/kiosk) not tty2 (boot log).
#    With console=tty2 the HDMI output stays on the kernel console; chvt 1 does not switch it on RPi.
for CMDLINE in /boot/firmware/cmdline.txt /boot/cmdline.txt; do
  if [ -f "$CMDLINE" ]; then
    if grep -q 'console=tty2' "$CMDLINE"; then
      sed -i 's/ console=tty2//g' "$CMDLINE"
      echo "Removed console=tty2 from $CMDLINE (display will show tty1 / kiosk)"
    fi
    break
  fi
done

echo ""
echo "Done. Reboot for the kiosk to start from console autologin:"
echo "  sudo reboot"
echo ""
echo "After reboot, the first user will autologin on tty1 and ~/.profile will"
echo "run the X11 kiosk (Chromium on http://localhost:3001)."
