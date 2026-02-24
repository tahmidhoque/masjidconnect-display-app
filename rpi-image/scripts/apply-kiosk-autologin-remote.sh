#!/usr/bin/env bash
# =============================================================================
# Run apply-kiosk-autologin.sh on a Pi over SSH (from your dev machine).
#
# Usage:
#   ./apply-kiosk-autologin-remote.sh [user@]hostname
#   PI_HOST=pi@192.168.1.10 ./apply-kiosk-autologin-remote.sh
#
# Copies apply-kiosk-autologin.sh to the Pi and runs it with sudo.
# Asks whether to reboot the Pi after applying.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
ON_PI_SCRIPT="${SCRIPT_DIR}/apply-kiosk-autologin.sh"

if [ ! -f "$ON_PI_SCRIPT" ]; then
  echo "ERROR: $ON_PI_SCRIPT not found." >&2
  exit 1
fi

PI_HOST="${PI_HOST:-${1:-}}"
if [ -z "$PI_HOST" ]; then
  echo "Usage: $0 [user@]hostname" >&2
  echo "   or: PI_HOST=pi@192.168.1.10 $0" >&2
  exit 1
fi

REMOTE_PATH="/tmp/apply-kiosk-autologin-$$.sh"
echo "Copying script to $PI_HOST and running with sudo..."
scp -q "$ON_PI_SCRIPT" "${PI_HOST}:${REMOTE_PATH}"
ssh -t "$PI_HOST" "sudo bash ${REMOTE_PATH}; rm -f ${REMOTE_PATH}"

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
