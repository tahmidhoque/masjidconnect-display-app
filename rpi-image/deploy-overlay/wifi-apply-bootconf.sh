#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — WiFi Boot-Partition Config Apply (NetworkManager edition)
#
# Runs as a oneshot systemd service early in boot (before networking starts).
# If the user has placed a WiFi credentials file on the FAT32 boot partition
# (accessible from any OS without SSH), it reads the credentials, creates a
# NetworkManager connection profile, and the Pi connects automatically.
#
# The source file is DELETED after being applied so credentials are not left
# sitting on the boot partition.
#
# Supported file locations (checked in order):
#
#   /boot/firmware/masjidconnect-wifi.conf   <- simple key=value (recommended)
#   /boot/firmware/wpa_supplicant.conf       <- legacy wpa_supplicant format
#
# Simple format (masjidconnect-wifi.conf):
#   SSID=MyNetworkName
#   PASSWORD=MyPassword
#   COUNTRY=GB
#   TIMEZONE=Europe/London
#
# Must run as root.
# =============================================================================

set -euo pipefail

BOOT_DIR="/boot/firmware"
SIMPLE_CONF="${BOOT_DIR}/masjidconnect-wifi.conf"
WPA_CONF="${BOOT_DIR}/wpa_supplicant.conf"

IFACE="wlan0"
NM_CON_DIR="/etc/NetworkManager/system-connections"
NM_CON_NAME="masjidconnect-wifi"
NM_CON_FILE="${NM_CON_DIR}/${NM_CON_NAME}.nmconnection"
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
  log "Found: $WPA_CONF (legacy wpa_supplicant format)"
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

  # Remove any existing profile with the same name
  nmcli con delete "$NM_CON_NAME" 2>/dev/null || true

  # Write NetworkManager connection file directly (NM may not be running yet at boot)
  mkdir -p "$NM_CON_DIR"
  cat > "$NM_CON_FILE" <<NMEOF
[connection]
id=${NM_CON_NAME}
type=wifi
autoconnect=true
autoconnect-priority=100

[wifi]
mode=infrastructure
ssid=${WIFI_SSID}

[wifi-security]
key-mgmt=wpa-psk
psk=${WIFI_PASSWORD}

[ipv4]
method=auto

[ipv6]
method=auto
NMEOF
  chmod 600 "$NM_CON_FILE"
  log "Wrote NM connection profile: $NM_CON_FILE"

  # Set WiFi regulatory domain
  iw reg set "$WIFI_COUNTRY" 2>/dev/null || true

elif [ "$SOURCE_FORMAT" = "wpa" ]; then
  # Legacy format: extract SSID and PSK from wpa_supplicant.conf, create NM profile
  log "Converting wpa_supplicant.conf to NetworkManager profile"
  WPA_SSID=$(grep -oP 'ssid="?\K[^"]+' "$SOURCE_FILE" | head -1)
  WPA_PSK=$(grep -oP 'psk="?\K[^"]+' "$SOURCE_FILE" | head -1)
  WPA_COUNTRY=$(grep -oP 'country=\K\w+' "$SOURCE_FILE" | head -1)

  if [ -z "$WPA_SSID" ]; then
    log "ERROR: Could not extract SSID from $SOURCE_FILE — aborting"
    rm -f "$SOURCE_FILE"
    exit 1
  fi

  nmcli con delete "$NM_CON_NAME" 2>/dev/null || true

  mkdir -p "$NM_CON_DIR"
  cat > "$NM_CON_FILE" <<NMEOF
[connection]
id=${NM_CON_NAME}
type=wifi
autoconnect=true
autoconnect-priority=100

[wifi]
mode=infrastructure
ssid=${WPA_SSID}

[wifi-security]
key-mgmt=wpa-psk
psk=${WPA_PSK}

[ipv4]
method=auto

[ipv6]
method=auto
NMEOF
  chmod 600 "$NM_CON_FILE"

  [ -n "${WPA_COUNTRY:-}" ] && iw reg set "$WPA_COUNTRY" 2>/dev/null || true
  log "Converted and wrote NM connection profile"
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
# Tell NetworkManager to reload connections (if it's running)
# ---------------------------------------------------------------------------
nmcli con reload 2>/dev/null || true
log "Reloaded NetworkManager connections"

# ---------------------------------------------------------------------------
# Reset the connectivity marker so the kiosk boot sequence validates the new
# credentials properly rather than skipping to the parallel offline path.
# ---------------------------------------------------------------------------
rm -f "$WIFI_CONNECTED_MARKER" 2>/dev/null || true
log "Reset wifi-connected marker"

# ---------------------------------------------------------------------------
# Delete the source file so credentials don't persist on the boot partition
# ---------------------------------------------------------------------------
rm -f "$SOURCE_FILE"
log "Deleted $SOURCE_FILE"

log "WiFi boot config applied successfully — new credentials will take effect immediately"
