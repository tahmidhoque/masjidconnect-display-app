#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — WiFi Boot-Partition Config Apply
#
# Runs as a oneshot systemd service very early in boot (before networking
# starts). If the user has placed a WiFi credentials file on the FAT32 boot
# partition (accessible from any OS without SSH), it reads the credentials,
# writes the wpa_supplicant config, and enables the right services so the Pi
# connects automatically on this and every subsequent boot.
#
# The source file is DELETED after being applied so it does not re-apply on
# every reboot (and so credentials are not left sitting on the boot partition).
#
# Supported file locations (checked in order):
#
#   /boot/firmware/masjidconnect-wifi.conf   ← simple key=value format (recommended)
#   /boot/firmware/wpa_supplicant.conf       ← standard wpa_supplicant format (advanced)
#
# Simple format (masjidconnect-wifi.conf):
#   SSID=MyNetworkName
#   PASSWORD=MyPassword
#   COUNTRY=GB
#
# The COUNTRY code is optional and defaults to GB. Use your two-letter ISO 3166
# country code (e.g. US, FR, DE, AE, SA, PK, BD) for correct 5GHz channel
# selection. An incorrect country code will prevent 5GHz networks from working.
#
# Must run as root.
# =============================================================================

set -euo pipefail

BOOT_DIR="/boot/firmware"
SIMPLE_CONF="${BOOT_DIR}/masjidconnect-wifi.conf"
WPA_CONF="${BOOT_DIR}/wpa_supplicant.conf"

IFACE="wlan0"
WPA_DEST="/etc/wpa_supplicant/wpa_supplicant-${IFACE}.conf"
NETWORKD_CONF="/etc/systemd/network/25-${IFACE}.network"
WIFI_STATE_DIR="/var/lib/masjidconnect"
WIFI_CONNECTED_MARKER="${WIFI_STATE_DIR}/wifi-connected-once"

LOG="/tmp/wifi-bootconf.log"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [wifi-bootconf] $*" | tee -a "$LOG" || true; }

log "Starting WiFi boot-partition config check..."

# ---------------------------------------------------------------------------
# Determine which source file to use
# ---------------------------------------------------------------------------
SOURCE_FILE=""
SOURCE_FORMAT=""

if [ -f "$SIMPLE_CONF" ]; then
  SOURCE_FILE="$SIMPLE_CONF"
  SOURCE_FORMAT="simple"
  log "Found: $SIMPLE_CONF (simple format)"
elif [ -f "$WPA_CONF" ]; then
  SOURCE_FILE="$WPA_CONF"
  SOURCE_FORMAT="wpa"
  log "Found: $WPA_CONF (wpa_supplicant format)"
fi

if [ -z "$SOURCE_FILE" ]; then
  log "No WiFi boot config found — nothing to do"
  exit 0
fi

# ---------------------------------------------------------------------------
# Parse and apply credentials
# ---------------------------------------------------------------------------
if [ "$SOURCE_FORMAT" = "simple" ]; then
  WIFI_SSID=""
  WIFI_PASSWORD=""
  WIFI_COUNTRY="GB"
  WIFI_TIMEZONE=""

  while IFS= read -r line; do
    case "$line" in
      SSID=*)     WIFI_SSID="${line#SSID=}" ;;
      PASSWORD=*) WIFI_PASSWORD="${line#PASSWORD=}" ;;
      COUNTRY=*)  WIFI_COUNTRY="${line#COUNTRY=}" ;;
      TIMEZONE=*) WIFI_TIMEZONE="${line#TIMEZONE=}" ;;
    esac
  done < "$SOURCE_FILE"

  if [ -z "$WIFI_SSID" ]; then
    log "ERROR: SSID is empty in $SOURCE_FILE — aborting"
    rm -f "$SOURCE_FILE"
    exit 1
  fi

  log "Applying credentials: SSID=${WIFI_SSID} COUNTRY=${WIFI_COUNTRY}"

  mkdir -p /etc/wpa_supplicant
  # Write header
  printf 'ctrl_interface=/run/wpa_supplicant\nupdate_config=1\ncountry=%s\n\n' \
    "$WIFI_COUNTRY" > "$WPA_DEST"

  if [ -n "$WIFI_PASSWORD" ]; then
    # Derive PSK properly (same as wpa_passphrase)
    printf '%s' "$WIFI_PASSWORD" | wpa_passphrase "$WIFI_SSID" - >> "$WPA_DEST"
  else
    # Open network
    printf 'network={\n\tssid="%s"\n\tkey_mgmt=NONE\n}\n' \
      "$(printf '%s' "$WIFI_SSID" | sed 's/\\/\\\\/g; s/"/\\"/g')" >> "$WPA_DEST"
  fi
  chmod 600 "$WPA_DEST"

elif [ "$SOURCE_FORMAT" = "wpa" ]; then
  log "Applying wpa_supplicant.conf directly"
  mkdir -p /etc/wpa_supplicant
  # Ensure ctrl_interface points to the correct location for wpa_supplicant@<iface>
  if grep -q 'ctrl_interface' "$SOURCE_FILE"; then
    sed 's|ctrl_interface=.*|ctrl_interface=/run/wpa_supplicant|' "$SOURCE_FILE" > "$WPA_DEST"
  else
    printf 'ctrl_interface=/run/wpa_supplicant\nupdate_config=1\n\n' > "$WPA_DEST"
    cat "$SOURCE_FILE" >> "$WPA_DEST"
  fi
  chmod 600 "$WPA_DEST"
fi

# ---------------------------------------------------------------------------
# Apply timezone if specified (simple format only)
# ---------------------------------------------------------------------------
if [ -n "${WIFI_TIMEZONE:-}" ]; then
  if timedatectl set-timezone "$WIFI_TIMEZONE" 2>/dev/null; then
    log "Timezone set to $WIFI_TIMEZONE"
  elif [ -f "/usr/share/zoneinfo/$WIFI_TIMEZONE" ]; then
    ln -sf "/usr/share/zoneinfo/$WIFI_TIMEZONE" /etc/localtime
    echo "$WIFI_TIMEZONE" > /etc/timezone
    log "Timezone set to $WIFI_TIMEZONE (via symlink)"
  else
    log "WARNING: Unknown timezone '$WIFI_TIMEZONE' — ignored"
  fi
fi

# ---------------------------------------------------------------------------
# Ensure systemd-networkd DHCP config exists for this interface
# ---------------------------------------------------------------------------
mkdir -p /etc/systemd/network
printf '[Match]\nName=%s\n\n[Network]\nDHCP=yes\n' "$IFACE" > "$NETWORKD_CONF"
log "Wrote $NETWORKD_CONF"

# ---------------------------------------------------------------------------
# Enable services so WiFi connects on this and every subsequent boot
# ---------------------------------------------------------------------------
systemctl enable "wpa_supplicant@${IFACE}.service" 2>/dev/null || true
systemctl enable systemd-networkd.service 2>/dev/null || true
log "Enabled wpa_supplicant@${IFACE} and systemd-networkd"

# ---------------------------------------------------------------------------
# Reset the connectivity marker so the kiosk boot sequence validates the new
# credentials properly rather than skipping to the parallel offline path.
# ---------------------------------------------------------------------------
rm -f "$WIFI_CONNECTED_MARKER" 2>/dev/null || true
log "Reset wifi-connected marker"

# ---------------------------------------------------------------------------
# Delete the source file so credentials don't persist on the boot partition
# and the service does not re-apply on every reboot.
# ---------------------------------------------------------------------------
rm -f "$SOURCE_FILE"
log "Deleted $SOURCE_FILE"

log "WiFi boot config applied successfully — new credentials will take effect immediately"
