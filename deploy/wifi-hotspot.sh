#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — Wi-Fi Hotspot (AP) lifecycle manager
#
# Creates a temporary open hotspot so users can configure Wi-Fi from their phone.
# Uses hostapd for the access point and dnsmasq for DHCP + captive-portal DNS.
#
# Commands:
#   scan   — scan nearby networks (wlan must be in managed mode) and cache results
#   start  — bring up the AP with SSID "MasjidConnect-Setup"
#   stop   — tear down AP and restore interface to managed mode
#   status — print whether the AP is currently running
#
# Must run as root.
# Usage:  sudo /opt/masjidconnect/deploy/wifi-hotspot.sh <scan|start|stop|status> [<iface>]
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Binary resolution — bypass PATH entirely.
# sudo's secure_path in /etc/sudoers overrides any PATH the script exports,
# so we cannot rely on PATH at all. Find each binary by directly searching
# the filesystem locations where Debian/RPi OS installs them.
# ---------------------------------------------------------------------------
_require() {
  local name="$1"
  for d in /usr/sbin /sbin /usr/bin /bin /usr/local/sbin /usr/local/bin; do
    [ -x "$d/$name" ] && { echo "$d/$name"; return 0; }
  done
  echo "$(date '+%Y-%m-%d %H:%M:%S') [wifi-hotspot] FATAL: '$name' not found — is it installed?" >&2
  exit 1
}

_find() {
  local name="$1"
  for d in /usr/sbin /sbin /usr/bin /bin /usr/local/sbin /usr/local/bin; do
    [ -x "$d/$name" ] && { echo "$d/$name"; return 0; }
  done
  echo ""
}

IP=$(_require ip)
IW=$(_require iw)
HOSTAPD=$(_require hostapd)
DNSMASQ=$(_require dnsmasq)
SYSTEMCTL=$(_require systemctl)
KILLALL=$(_find killall)   # optional — use kill if absent

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [wifi-hotspot] $*"; }

# Interface: prefer positional arg $2, then env var, then default wlan0.
# Using an arg avoids sudo env-var restrictions (sudo strips arbitrary env vars).
IFACE="${2:-${WIFI_HOTSPOT_IFACE:-wlan0}}"
AP_IP="192.168.4.1"
AP_NETMASK="255.255.255.0"
AP_CIDR="${AP_IP}/24"
DHCP_RANGE_START="192.168.4.2"
DHCP_RANGE_END="192.168.4.20"
DHCP_LEASE="24h"
AP_SSID="MasjidConnect-Setup"
AP_CHANNEL="6"

HOSTAPD_CONF="/tmp/masjidconnect-hostapd.conf"
DNSMASQ_CONF="/tmp/masjidconnect-dnsmasq.conf"
PID_FILE="/tmp/masjidconnect-hotspot.pid"
SCAN_CACHE="/tmp/masjidconnect-wifi-scan.json"

log "Resolved: ip=$IP iw=$IW hostapd=$HOSTAPD dnsmasq=$DNSMASQ"

# ---------------------------------------------------------------------------
# scan — enumerate nearby SSIDs while interface is still in managed/station mode
# ---------------------------------------------------------------------------
do_scan() {
  log "Scanning for networks on ${IFACE}..."

  $IP link set "$IFACE" up 2>/dev/null || true
  sleep 1

  # Run two scans — the first triggers the driver to cycle all channels
  # (both 2.4 GHz and 5 GHz); the second picks up results that arrived
  # late. Merging both gives the most complete picture.
  local raw1 raw2
  raw1=$($IW dev "$IFACE" scan 2>/dev/null || true)
  sleep 2
  raw2=$($IW dev "$IFACE" scan 2>/dev/null || true)

  local ssids
  ssids=$(printf '%s\n%s' "$raw1" "$raw2" \
    | awk '/^[[:space:]]*SSID:/ { line=$0; sub(/^[[:space:]]*SSID:[[:space:]]*/, "", line); if (length(line) > 0) print line }' \
    | sort -u \
    | awk '
      BEGIN { printf "[" }
      NR > 1 { printf "," }
      {
        gsub(/\\/, "\\\\")
        gsub(/"/, "\\\"")
        printf "\"%s\"", $0
      }
      END { printf "]" }
    ')

  [ -z "$ssids" ] && ssids="[]"

  echo "{\"ssids\":${ssids}}" > "$SCAN_CACHE"
  log "Cached $(echo "$ssids" | grep -o '"' | wc -l | awk '{print int($1/2)}') network(s) to ${SCAN_CACHE}"
}

# ---------------------------------------------------------------------------
# start — bring up hostapd + dnsmasq as an open AP
# ---------------------------------------------------------------------------
do_start() {
  if [ -f "$PID_FILE" ]; then
    log "Hotspot already running (PID file exists) — stopping first."
    do_stop
  fi

  log "Starting hotspot on ${IFACE} (SSID: ${AP_SSID})..."

  # Stop any conflicting services
  $SYSTEMCTL stop "wpa_supplicant@${IFACE}.service" 2>/dev/null || true
  $SYSTEMCTL stop wpa_supplicant.service 2>/dev/null || true
  if [ -n "$KILLALL" ]; then
    "$KILLALL" wpa_supplicant 2>/dev/null || true
  fi
  sleep 0.5

  # Put interface into AP mode
  $IP link set "$IFACE" down 2>/dev/null || true
  $IW dev "$IFACE" set type __ap 2>/dev/null || true
  $IP addr flush dev "$IFACE" 2>/dev/null || true
  $IP addr add "$AP_CIDR" dev "$IFACE" 2>/dev/null || true
  $IP link set "$IFACE" up 2>/dev/null || true

  # Write hostapd config
  cat > "$HOSTAPD_CONF" <<HOSTAPD_EOF
interface=${IFACE}
driver=nl80211
ssid=${AP_SSID}
hw_mode=g
channel=${AP_CHANNEL}
wmm_enabled=0
auth_algs=1
wpa=0
HOSTAPD_EOF

  # Write dnsmasq config — all DNS resolves to AP_IP (captive portal)
  cat > "$DNSMASQ_CONF" <<DNSMASQ_EOF
interface=${IFACE}
bind-interfaces
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},${AP_NETMASK},${DHCP_LEASE}
address=/#/${AP_IP}
DNSMASQ_EOF

  $HOSTAPD -B "$HOSTAPD_CONF" -P /tmp/masjidconnect-hostapd.pid
  sleep 1

  $DNSMASQ -C "$DNSMASQ_CONF" --pid-file=/tmp/masjidconnect-dnsmasq.pid --log-facility=/tmp/masjidconnect-dnsmasq.log

  local hostapd_pid dnsmasq_pid
  hostapd_pid=$(cat /tmp/masjidconnect-hostapd.pid 2>/dev/null || echo "")
  dnsmasq_pid=$(cat /tmp/masjidconnect-dnsmasq.pid 2>/dev/null || echo "")
  echo "${hostapd_pid}:${dnsmasq_pid}" > "$PID_FILE"

  log "Hotspot running — hostapd PID=${hostapd_pid}, dnsmasq PID=${dnsmasq_pid}"
  log "AP IP: ${AP_IP}, SSID: ${AP_SSID}"
}

# ---------------------------------------------------------------------------
# stop — tear down AP, restore interface to managed mode
# ---------------------------------------------------------------------------
do_stop() {
  log "Stopping hotspot..."

  if [ -f /tmp/masjidconnect-hostapd.pid ]; then
    kill "$(cat /tmp/masjidconnect-hostapd.pid)" 2>/dev/null || true
    rm -f /tmp/masjidconnect-hostapd.pid
  fi
  if [ -n "$KILLALL" ]; then
    "$KILLALL" hostapd 2>/dev/null || true
  fi

  if [ -f /tmp/masjidconnect-dnsmasq.pid ]; then
    kill "$(cat /tmp/masjidconnect-dnsmasq.pid)" 2>/dev/null || true
    rm -f /tmp/masjidconnect-dnsmasq.pid
  fi

  rm -f "$PID_FILE" "$HOSTAPD_CONF" "$DNSMASQ_CONF"

  $IP link set "$IFACE" down 2>/dev/null || true
  $IP addr flush dev "$IFACE" 2>/dev/null || true
  $IW dev "$IFACE" set type managed 2>/dev/null || true
  $IP link set "$IFACE" up 2>/dev/null || true

  log "Hotspot stopped, ${IFACE} restored to managed mode"
}

# ---------------------------------------------------------------------------
# status — report whether hotspot is active
# ---------------------------------------------------------------------------
do_status() {
  if [ -f "$PID_FILE" ]; then
    local pids
    pids=$(cat "$PID_FILE")
    local hostapd_pid="${pids%%:*}"
    if [ -n "$hostapd_pid" ] && kill -0 "$hostapd_pid" 2>/dev/null; then
      echo "running"
      exit 0
    fi
  fi
  echo "stopped"
  exit 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
case "${1:-}" in
  scan)   do_scan ;;
  start)  do_start ;;
  stop)   do_stop ;;
  status) do_status ;;
  *)
    echo "Usage: $0 {scan|start|stop|status} [<iface>]" >&2
    exit 1
    ;;
esac
