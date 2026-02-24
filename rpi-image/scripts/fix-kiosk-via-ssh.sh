#!/usr/bin/env bash
# =============================================================================
# Fix kiosk on an already-flashed Pi over SSH (no reflash).
# Use when the image has: tty1 asking for a password, missing
# /opt/masjidconnect/deploy/start-kiosk-x11.sh, or Xorg "Cannot run in framebuffer mode".
#
# Usage:
#   ./fix-kiosk-via-ssh.sh [user@]hostname
#   PI_HOST=pi@192.168.1.10 ./fix-kiosk-via-ssh.sh
#
# From the repo root or from rpi-image/scripts/. Copies deploy scripts to the
# Pi, applies getty autologin and .profile kiosk line, then offers to reboot.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Repo root: rpi-image/scripts -> .. = rpi-image, ../.. = repo root
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY="${REPO_ROOT}/deploy"
ON_PI_SCRIPT="${SCRIPT_DIR}/apply-kiosk-autologin.sh"

PI_HOST="${PI_HOST:-${1:-}}"
if [ -z "$PI_HOST" ]; then
  echo "Usage: $0 [user@]hostname" >&2
  echo "   or: PI_HOST=pi@192.168.1.10 $0" >&2
  exit 1
fi

if [ ! -f "$ON_PI_SCRIPT" ]; then
  echo "ERROR: $ON_PI_SCRIPT not found." >&2
  exit 1
fi

echo "Fix kiosk on $PI_HOST (deploy scripts + autologin)"
echo ""

# 1. Ensure deploy dir exists on the Pi and copy missing scripts
echo "Copying deploy scripts to Pi..."
ssh "$PI_HOST" "sudo mkdir -p /opt/masjidconnect/deploy"
for f in start-kiosk-x11.sh start-kiosk-now.sh xinitrc-kiosk; do
  if [ -f "${DEPLOY}/${f}" ]; then
    scp -q "${DEPLOY}/${f}" "${PI_HOST}:/tmp/${f}"
    ssh "$PI_HOST" "sudo mv /tmp/${f} /opt/masjidconnect/deploy/ && sudo chmod +x /opt/masjidconnect/deploy/${f}"
    echo "  -> /opt/masjidconnect/deploy/${f}"
  fi
done

# 2. Run autologin + .profile fix on the Pi
echo ""
echo "Applying getty autologin and .profile kiosk line..."
REMOTE_PATH="/tmp/apply-kiosk-autologin-$$.sh"
scp -q "$ON_PI_SCRIPT" "${PI_HOST}:${REMOTE_PATH}"
ssh -t "$PI_HOST" "sudo bash ${REMOTE_PATH}; rm -f ${REMOTE_PATH}"

# 3. Xorg vc4 fix for Pi 4/5 ("Cannot run in framebuffer mode")
XORG_VC4="${SCRIPT_DIR}/../layer/xorg.conf.d/99-vc4.conf"
if [ -f "$XORG_VC4" ]; then
  echo ""
  echo "Applying Xorg vc4 config (fixes framebuffer mode on Pi 4/5)..."
  scp -q "$XORG_VC4" "${PI_HOST}:/tmp/99-vc4.conf"
  ssh "$PI_HOST" "sudo mkdir -p /etc/X11/xorg.conf.d && sudo mv /tmp/99-vc4.conf /etc/X11/xorg.conf.d/99-vc4.conf"
  echo "  -> /etc/X11/xorg.conf.d/99-vc4.conf"
fi

echo ""
read -r -p "Reboot the Pi now? [y/N] " yn
case "${yn:-n}" in
  [yY]|[yY][eE][sS])
    echo "Rebooting $PI_HOST..."
    ssh "$PI_HOST" "sudo reboot" || true
    ;;
  *)
    echo "Skipping reboot. Run 'sudo reboot' on the Pi when ready."
    ;;
esac
