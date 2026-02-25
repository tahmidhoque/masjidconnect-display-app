#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — Show WiFi setup on the display
#
# Use this when the Pi is already running the kiosk but you need to configure
# WiFi after the fact (e.g. you booted with no LAN and no WiFi). Run from a
# text console (TTY) after switching with Ctrl+Alt+F2.
#
# Steps on the Pi:
#   1. Connect a USB keyboard. Press Ctrl+Alt+F2 (or F3/F4) to get a text console.
#   2. Log in (pi or your user + password).
#   3. Run:  sudo /opt/masjidconnect/deploy/show-wifi-setup.sh
#   4. The display will show the WiFi setup page. Configure WiFi, then click
#      "Start display" or close the window.
#   5. Restart the kiosk:  sudo systemctl start masjidconnect-kiosk
#
# Usage:  sudo /opt/masjidconnect/deploy/show-wifi-setup.sh
# =============================================================================

set -euo pipefail

APP_DIR="/opt/masjidconnect"
DEPLOY_DIR="${APP_DIR}/deploy"
WIFI_SETUP_PORT="${WIFI_SETUP_PORT:-3002}"
WIFI_SETUP_URL="http://127.0.0.1:${WIFI_SETUP_PORT}"
SERVICE_USER="${SUDO_USER:-pi}"
# Use the session user's X authority (when running under sudo, HOME is root's)
if [ -n "${SUDO_USER:-}" ]; then
  XAUTH="/home/${SUDO_USER}/.Xauthority"
else
  XAUTH="${HOME:-/home/pi}/.Xauthority"
fi

if [ "$EUID" -ne 0 ]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if [ ! -f "${DEPLOY_DIR}/wifi-setup-server.mjs" ]; then
  echo "ERROR: wifi-setup-server.mjs not found at ${DEPLOY_DIR}/wifi-setup-server.mjs"
  exit 1
fi

echo "Stopping kiosk..."
systemctl stop masjidconnect-kiosk.service 2>/dev/null || true

echo "Starting WiFi setup server on port ${WIFI_SETUP_PORT}..."
node "${DEPLOY_DIR}/wifi-setup-server.mjs" &
WIFI_PID=$!
trap 'kill $WIFI_PID 2>/dev/null || true' EXIT

for i in $(seq 1 15); do
  if curl -sf -o /dev/null "${WIFI_SETUP_URL}/api/status" 2>/dev/null; then
    break
  fi
  sleep 0.5
done
if ! curl -sf -o /dev/null "${WIFI_SETUP_URL}/api/status" 2>/dev/null; then
  echo "ERROR: WiFi setup server did not start."
  exit 1
fi

CHROMIUM=""
command -v chromium-browser &>/dev/null && CHROMIUM="chromium-browser" || true
command -v chromium &>/dev/null && CHROMIUM="chromium" || true
if [ -z "$CHROMIUM" ]; then
  echo "ERROR: Chromium not found."
  exit 1
fi

echo "Opening WiFi setup on the display (close the window when done)..."
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$XAUTH}"
# Ensure pi (or session user) can access X
if [ -f "$XAUTH" ]; then
  : # use it
else
  # Fallback: common path on RPi with autologin
  [ -f /home/pi/.Xauthority ] && export XAUTHORITY=/home/pi/.Xauthority
fi
CHROMIUM_USER_DATA="/tmp/chromium-wifi-setup-$$"
mkdir -p "$CHROMIUM_USER_DATA"

sudo -u "$SERVICE_USER" \
  DISPLAY="$DISPLAY" XAUTHORITY="${XAUTHORITY:-$XAUTH}" \
  "$CHROMIUM" \
  --start-fullscreen \
  --window-position=0,0 \
  --user-data-dir="$CHROMIUM_USER_DATA" \
  --noerrdialogs \
  --disable-infobars \
  --password-store=basic \
  "${WIFI_SETUP_URL}" 2>/dev/null || true

rm -rf "$CHROMIUM_USER_DATA"
echo "WiFi setup closed. Restart kiosk with: sudo systemctl start masjidconnect-kiosk"
