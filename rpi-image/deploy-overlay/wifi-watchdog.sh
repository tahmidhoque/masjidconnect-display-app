#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — WiFi Watchdog
#
# Persistent background service that monitors WiFi connectivity and attempts
# automatic recovery when the connection drops. Designed for 24/7 kiosk
# operation on Raspberry Pi where manual intervention is not feasible.
#
# Recovery strategy (escalating):
#   1. rfkill unblock + restart wpa_supplicant (covers soft-block / driver glitch)
#   2. Restart systemd-networkd (covers DHCP lease expiry)
#   3. Full interface reset (ip link down/up) + wpa_supplicant restart
#
# Must run as root. Intended to be run via systemd (masjidconnect-wifi-watchdog.service).
# =============================================================================

set -euo pipefail

POLL_INTERVAL="${WIFI_WATCHDOG_INTERVAL:-30}"
LOG="/tmp/wifi-watchdog.log"
WIFI_STATE_DIR="/var/lib/masjidconnect"
WIFI_CONNECTED_MARKER="${WIFI_STATE_DIR}/wifi-connected-once"
WIFI_HOTSPOT_ACTIVE_MARKER="/tmp/masjidconnect-hotspot-active"

# Consecutive offline checks before attempting recovery
OFFLINE_THRESHOLD=2
# Consecutive offline checks before logging escalation warning
ESCALATION_THRESHOLD=6

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [wifi-watchdog] $*" >> "$LOG" 2>/dev/null || true; }
: >> "$LOG" 2>/dev/null || true

log "WiFi watchdog started (poll=${POLL_INTERVAL}s)"

# ---------------------------------------------------------------------------
# Connectivity check — same logic as xinitrc-kiosk
# ---------------------------------------------------------------------------
have_connectivity() {
  if curl -sf --connect-timeout 4 -o /dev/null "https://portal.masjidconnect.co.uk" 2>/dev/null; then
    return 0
  fi
  if ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# Find the wireless interface
# ---------------------------------------------------------------------------
find_wlan_iface() {
  local iface
  iface=$(iw dev 2>/dev/null | awk '/^\tInterface / {print $2; exit}')
  [ -n "$iface" ] && { echo "$iface"; return 0; }

  for f in /sys/class/net/*/wireless; do
    [ -e "$f" ] || continue
    iface=$(basename "$(dirname "$f")")
    echo "$iface"; return 0
  done

  for iface in $(ip -o link show 2>/dev/null | awk -F': ' '{print $2}' | grep -E '^(wlan|wlp|wlx)'); do
    echo "$iface"; return 0
  done

  return 1
}

# ---------------------------------------------------------------------------
# Check if a wpa_supplicant config exists (WiFi was previously configured)
# ---------------------------------------------------------------------------
wifi_is_configured() {
  local iface="${1:-wlan0}"
  [ -f "/etc/wpa_supplicant/wpa_supplicant-${iface}.conf" ]
}

# ---------------------------------------------------------------------------
# Recovery actions (escalating severity)
# ---------------------------------------------------------------------------
recover_level_1() {
  local iface="$1"
  log "Recovery L1: rfkill unblock + restart wpa_supplicant@${iface}"
  rfkill unblock wifi 2>/dev/null || true
  rfkill unblock wlan 2>/dev/null || true
  rfkill unblock all  2>/dev/null || true
  systemctl restart "wpa_supplicant@${iface}.service" 2>/dev/null || true
}

recover_level_2() {
  local iface="$1"
  log "Recovery L2: restart systemd-networkd (DHCP renewal)"
  systemctl restart systemd-networkd.service 2>/dev/null || true
  # Fallback DHCP clients
  dhcpcd "$iface" 2>/dev/null || true
  dhclient "$iface" 2>/dev/null || true
}

recover_level_3() {
  local iface="$1"
  log "Recovery L3: full interface reset + wpa_supplicant restart"
  ip link set "$iface" down 2>/dev/null || true
  sleep 1
  ip link set "$iface" up 2>/dev/null || true
  sleep 1
  rfkill unblock wifi 2>/dev/null || true
  rfkill unblock all  2>/dev/null || true
  systemctl restart "wpa_supplicant@${iface}.service" 2>/dev/null || true
  sleep 2
  systemctl restart systemd-networkd.service 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
offline_count=0
recovery_cycle=0

while true; do
  sleep "$POLL_INTERVAL"

  # Skip if the hotspot is actively running (user is reconfiguring WiFi)
  if [ -f "$WIFI_HOTSPOT_ACTIVE_MARKER" ]; then
    offline_count=0
    continue
  fi

  # Skip if WiFi was never configured (first-time setup hasn't happened yet)
  IFACE=$(find_wlan_iface 2>/dev/null || true)
  if [ -z "$IFACE" ]; then
    continue
  fi
  if ! wifi_is_configured "$IFACE"; then
    continue
  fi

  if have_connectivity; then
    if [ "$offline_count" -gt 0 ]; then
      log "Connectivity restored after ${offline_count} offline checks (recovery_cycle=$recovery_cycle)"
      # Update the connectivity marker
      mkdir -p "$WIFI_STATE_DIR" 2>/dev/null || true
      touch "$WIFI_CONNECTED_MARKER" 2>/dev/null || true
    fi
    offline_count=0
    recovery_cycle=0
    continue
  fi

  # Offline detected
  offline_count=$((offline_count + 1))

  if [ "$offline_count" -lt "$OFFLINE_THRESHOLD" ]; then
    log "Offline check $offline_count/$OFFLINE_THRESHOLD — waiting before recovery"
    continue
  fi

  # Determine recovery level based on how many cycles we've attempted
  recovery_cycle=$((recovery_cycle + 1))

  case "$recovery_cycle" in
    1|2)
      recover_level_1 "$IFACE"
      ;;
    3|4)
      recover_level_2 "$IFACE"
      ;;
    *)
      recover_level_3 "$IFACE"
      # Cap the cycle counter to avoid overflow on very long outages
      [ "$recovery_cycle" -gt 100 ] && recovery_cycle=5
      ;;
  esac

  if [ "$offline_count" -ge "$ESCALATION_THRESHOLD" ]; then
    log "WARNING: offline for $((offline_count * POLL_INTERVAL))s+ (recovery_cycle=$recovery_cycle)"
  fi
done
