#!/usr/bin/env bash
# Create or update wifi.conf for build-time WiFi so the RPi image connects to your
# network on first boot. Run this before building the image; then run build-image.sh.
# wifi.conf is gitignored so your password is not committed.
#
# Usage:
#   ./rpi-image/configure-wifi.sh
#   ./rpi-image/configure-wifi.sh "MySSID" "MyPassword" [GB]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIFI_CONF="${SCRIPT_DIR}/wifi.conf"

SSID="${1:-}"
PASSWORD="${2:-}"
COUNTRY="${3:-GB}"

if [ -z "$SSID" ]; then
  echo "MasjidConnect Display — WiFi configuration"
  echo "Enter the WiFi details to bake into the image (leave blank to skip)."
  echo ""
  read -r -p "Network name (SSID): " SSID
  if [ -z "$SSID" ]; then
    echo "No SSID entered. To add WiFi later, run this script again or create rpi-image/wifi.conf manually."
    exit 0
  fi
  read -r -s -p "Password: " PASSWORD
  echo ""
  if [ -z "$PASSWORD" ]; then
    echo "Password cannot be empty."
    exit 1
  fi
  read -r -p "Country code [GB]: " COUNTRY_INPUT
  [ -n "$COUNTRY_INPUT" ] && COUNTRY="$COUNTRY_INPUT"
fi

if [ -z "$PASSWORD" ]; then
  echo "Usage: $0 [SSID PASSWORD [COUNTRY]]"
  exit 1
fi

# Write wifi.conf (no spaces around = so it's easy to parse)
cat > "$WIFI_CONF" << EOF
SSID=$SSID
PASSWORD=$PASSWORD
COUNTRY=$COUNTRY
EOF
chmod 600 "$WIFI_CONF"
echo "Written: $WIFI_CONF"
echo ""
echo "Next step: build the image so WiFi is included:"
echo "  ./rpi-image/build-image.sh pi4"
echo ""
echo "Then flash the image to the SD card and boot — the Pi will connect to this network."
