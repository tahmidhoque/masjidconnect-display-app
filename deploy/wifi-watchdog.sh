#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — WiFi Watchdog (NetworkManager edition)
#
# Persistent background service that monitors WiFi connectivity and assists
# NetworkManager with edge-case recovery. NM handles most reconnection natively;
# this watchdog covers rfkill soft-blocks and extended outages that may need
# the hotspot to be started for user reconfiguration.
#
# Must run as root. Intended to be run via systemd (masjidconnect-wifi-watchdog.service).
# =============================================================================

set -euo pipefail

POLL_INTERVAL="${WIFI_WATCHDOG_INTERVAL:-30}"
LOG="/tmp/wifi-watchdog.log"
WIFI_STATE_DIR="/var/lib/masjidconnect"
WIFI_CONNECTED_MARKER="${WIFI_STATE_DIR}/wifi-connected-once"
WIFI_HOTSPOT_ACTIVE_MARKER="/tmp/masjidconnect-hotspot-active"

OFFLINE_THRESHOLD=2
ESCALATION_THRESHOLD=6

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [wifi-watchdog] $*" >> "$LOG" 2>/dev/null || true; }
: >> "$LOG" 2>/dev/null || true

log "WiFi watchdog started (poll=${POLL_INTERVAL}s, backend=NetworkManager)"

# ---------------------------------------------------------------------------
# Connectivity check — same as xinitrc-kiosk
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
# Check if any WiFi connection profile is saved in NetworkManager
# ---------------------------------------------------------------------------
wifi_is_configured() {
  nmcli -t -f TYPE con show 2>/dev/null | grep -q '802-11-wireless'
}

# ---------------------------------------------------------------------------
# Recovery actions (escalating severity)
# ---------------------------------------------------------------------------
recover_level_1() {
  log "Recovery L1: ensure WiFi radio is on, trigger NM rescan"
  rfkill unblock wifi 2>/dev/null || true
  rfkill unblock wlan 2>/dev/null || true
  nmcli radio wifi on 2>/dev/null || true
  nmcli dev wifi rescan 2>/dev/null || true
}

recover_level_2() {
  log "Recovery L2: restart NetworkManager"
  systemctl restart NetworkManager.service 2>/dev/null || true
}

recover_level_3() {
  local iface
  iface=$(nmcli -t -f DEVICE,TYPE dev 2>/dev/null | awk -F: '$2 == "wifi" {print $1; exit}')
  log "Recovery L3: full interface reset on ${iface:-wlan0}"
  iface="${iface:-wlan0}"
  nmcli dev disconnect "$iface" 2>/dev/null || true
  ip link set "$iface" down 2>/dev/null || true
  sleep 1
  ip link set "$iface" up 2>/dev/null || true
  rfkill unblock wifi 2>/dev/null || true
  nmcli radio wifi on 2>/dev/null || true
  sleep 1
  systemctl restart NetworkManager.service 2>/dev/null || true
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

  # Skip if WiFi was never configured
  if ! wifi_is_configured; then
    continue
  fi

  if have_connectivity; then
    if [ "$offline_count" -gt 0 ]; then
      log "Connectivity restored after ${offline_count} offline checks (recovery_cycle=$recovery_cycle)"
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

  recovery_cycle=$((recovery_cycle + 1))

  case "$recovery_cycle" in
    1|2)
      recover_level_1
      ;;
    3|4)
      recover_level_2
      ;;
    *)
      recover_level_3
      [ "$recovery_cycle" -gt 100 ] && recovery_cycle=5
      ;;
  esac

  if [ "$offline_count" -ge "$ESCALATION_THRESHOLD" ]; then
    log "WARNING: offline for $((offline_count * POLL_INTERVAL))s+ (recovery_cycle=$recovery_cycle)"
  fi
done
