#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — WiFi Watchdog / recovery manager (NetworkManager edition)
#
# Persistent background service that monitors connectivity and recovers it:
#
#   1. Escalating station-mode recovery: rfkill/rescan → restart NM → full
#      interface reset. NM handles routine reconnects natively; these cover
#      the edge cases (rfkill soft-blocks, wedged driver, stuck NM).
#   2. Setup hotspot escalation: if the device stays offline after recovery
#      attempts (e.g. the mosque changed router or WiFi password), it brings
#      up the MasjidConnect-Setup access point + setup server so staff can
#      re-configure WiFi from a phone AT ANY TIME — not just at first boot.
#      The display keeps running with cached content; the app shows a banner
#      with the hotspot instructions.
#   3. Hotspot recycling: if nobody uses the hotspot for a while, it is torn
#      down and station mode is retried (the outage may have been temporary
#      — while the AP is up the radio cannot reconnect to the saved WiFi).
#      If still offline, the hotspot comes back after the next escalation.
#
# Must run as root. Intended to be run via systemd (masjidconnect-wifi-watchdog.service).
# =============================================================================

set -euo pipefail

POLL_INTERVAL="${WIFI_WATCHDOG_INTERVAL:-30}"
LOG="/tmp/wifi-watchdog.log"
WIFI_STATE_DIR="/var/lib/masjidconnect"
WIFI_CONNECTED_MARKER="${WIFI_STATE_DIR}/wifi-connected-once"
WIFI_HOTSPOT_ACTIVE_MARKER="/tmp/masjidconnect-hotspot-active"
HOTSPOT_SCRIPT="/opt/masjidconnect/deploy/wifi-hotspot.sh"
SETUP_SERVER="/opt/masjidconnect/deploy/wifi-setup-server.mjs"
SETUP_SERVER_PID_FILE="/tmp/masjidconnect-wifi-setup-server.pid"
# Touched by the setup server on every API request — proves someone is mid-setup.
ACTIVITY_FILE="/tmp/masjidconnect-wifi-setup-activity"

OFFLINE_THRESHOLD=2       # consecutive failed checks before recovery starts (~60s)
ESCALATION_THRESHOLD=6
HOTSPOT_AFTER_CYCLES=6    # recovery cycles before the setup hotspot is raised (~4min offline)
HOTSPOT_RETRY_WINDOW=600  # seconds of hotspot uptime before recycling to retry station mode
HOTSPOT_ACTIVITY_GRACE=300 # never recycle if setup activity within this many seconds

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
# Check if any station-mode WiFi profile is saved in NetworkManager.
# The hotspot's own AP profile must not count — it would make a first-run
# device (whose only profile is the setup AP) look "configured".
# ---------------------------------------------------------------------------
wifi_is_configured() {
  nmcli -t -f NAME,TYPE con show 2>/dev/null \
    | grep ':802-11-wireless$' \
    | grep -qv '^MasjidConnect-Hotspot:'
}

wlan_iface() {
  local iface
  iface=$(nmcli -t -f DEVICE,TYPE dev 2>/dev/null | awk -F: '$2 == "wifi" {print $1; exit}')
  [ -z "$iface" ] && iface=$(iw dev 2>/dev/null | awk '/^\tInterface / {print $2; exit}')
  echo "${iface:-wlan0}"
}

setup_server_running() {
  pgrep -f "wifi-setup-server" >/dev/null 2>&1
}

hotspot_running() {
  [ "$("$HOTSPOT_SCRIPT" status 2>/dev/null || echo stopped)" = "running" ]
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
  iface=$(wlan_iface)
  log "Recovery L3: full interface reset on ${iface}"
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
# Setup hotspot lifecycle (watchdog-owned)
# ---------------------------------------------------------------------------
hotspot_started_at=0

start_recovery_hotspot() {
  local iface
  iface=$(wlan_iface)
  if [ ! -x "$HOTSPOT_SCRIPT" ] || [ ! -f "$SETUP_SERVER" ]; then
    log "Hotspot escalation skipped — hotspot script or setup server missing"
    return 1
  fi
  log "Escalation: raising MasjidConnect-Setup hotspot on ${iface} for remote reconfiguration"
  touch "$WIFI_HOTSPOT_ACTIVE_MARKER" 2>/dev/null || true
  rm -f "$ACTIVITY_FILE" 2>/dev/null || true
  "$HOTSPOT_SCRIPT" scan "$iface" >>"$LOG" 2>&1 || true
  if ! "$HOTSPOT_SCRIPT" start "$iface" >>"$LOG" 2>&1; then
    log "Hotspot start failed — will retry after next escalation"
    rm -f "$WIFI_HOTSPOT_ACTIVE_MARKER" 2>/dev/null || true
    return 1
  fi
  "$SETUP_SERVER" --ap-mode --iface="$iface" >>"$LOG" 2>&1 &
  echo "$!" > "$SETUP_SERVER_PID_FILE" 2>/dev/null || true
  hotspot_started_at=$(date +%s)
  log "Hotspot up (setup server PID $!)"
  return 0
}

stop_recovery_hotspot() {
  local reason="$1"
  log "Tearing down setup hotspot (${reason})"
  if [ -f "$SETUP_SERVER_PID_FILE" ]; then
    kill "$(cat "$SETUP_SERVER_PID_FILE" 2>/dev/null)" 2>/dev/null || true
    rm -f "$SETUP_SERVER_PID_FILE"
  fi
  pkill -f "wifi-setup-server" 2>/dev/null || true
  "$HOTSPOT_SCRIPT" stop >>"$LOG" 2>&1 || true
  rm -f "$WIFI_HOTSPOT_ACTIVE_MARKER" 2>/dev/null || true
  hotspot_started_at=0
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
offline_count=0
recovery_cycle=0
hotspot_stale_count=0

while true; do
  sleep "$POLL_INTERVAL"

  # -------------------------------------------------------------------------
  # Hotspot active (raised by us, by first-run setup, or by the setup server
  # after a failed connect attempt): manage its lifecycle, skip recovery.
  # -------------------------------------------------------------------------
  if [ -f "$WIFI_HOTSPOT_ACTIVE_MARKER" ]; then
    offline_count=0
    recovery_cycle=0

    # Connectivity while the AP is up means another path came online
    # (e.g. Ethernet plugged in) — the hotspot is no longer needed.
    if have_connectivity; then
      mkdir -p "$WIFI_STATE_DIR" 2>/dev/null || true
      touch "$WIFI_CONNECTED_MARKER" 2>/dev/null || true
      stop_recovery_hotspot "connectivity restored via another interface"
      continue
    fi

    # Recycle a watchdog-owned hotspot after HOTSPOT_RETRY_WINDOW with no
    # recent setup activity: drop the AP so NM can retry the saved WiFi
    # (the outage may have been temporary). Never cut off an active user.
    if [ "$hotspot_started_at" -gt 0 ]; then
      now=$(date +%s)
      recent_activity=false
      if [ -f "$ACTIVITY_FILE" ]; then
        activity_age=$(( now - $(stat -c %Y "$ACTIVITY_FILE" 2>/dev/null || echo 0) ))
        [ "$activity_age" -lt "$HOTSPOT_ACTIVITY_GRACE" ] && recent_activity=true
      fi
      if [ $(( now - hotspot_started_at )) -ge "$HOTSPOT_RETRY_WINDOW" ] && [ "$recent_activity" = false ]; then
        stop_recovery_hotspot "no setup activity for ${HOTSPOT_RETRY_WINDOW}s — retrying station mode"
        continue
      fi
    fi

    # Stale marker: neither the AP nor the setup server is alive (a setup
    # flow crashed or exited without cleanup). Require 3 consecutive stale
    # checks — during a connect attempt the AP is legitimately down while
    # the setup server is still running.
    if ! hotspot_running && ! setup_server_running; then
      hotspot_stale_count=$((hotspot_stale_count + 1))
      if [ "$hotspot_stale_count" -ge 3 ]; then
        log "Stale hotspot marker (AP and setup server both gone) — cleaning up"
        stop_recovery_hotspot "stale marker cleanup"
        hotspot_stale_count=0
      fi
    else
      hotspot_stale_count=0
    fi
    continue
  fi
  hotspot_stale_count=0

  # Skip if WiFi was never configured (first-run setup owns that flow)
  if ! wifi_is_configured; then
    continue
  fi

  if have_connectivity; then
    if [ "$offline_count" -gt 0 ]; then
      log "Connectivity restored after ${offline_count} offline checks (recovery_cycle=$recovery_cycle)"
      mkdir -p "$WIFI_STATE_DIR" 2>/dev/null || true
      touch "$WIFI_CONNECTED_MARKER" 2>/dev/null || true
    fi
    # Reap any leftover setup server from a completed reconfiguration
    if setup_server_running; then
      log "Reaping leftover wifi-setup-server after connectivity restore"
      pkill -f "wifi-setup-server" 2>/dev/null || true
      rm -f "$SETUP_SERVER_PID_FILE" 2>/dev/null || true
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

  # After repeated failed recovery, raise the setup hotspot so staff can fix
  # the WiFi from a phone without touching the device.
  if [ "$recovery_cycle" -ge "$HOTSPOT_AFTER_CYCLES" ]; then
    if start_recovery_hotspot; then
      offline_count=0
      recovery_cycle=0
    else
      # Try again a few cycles later rather than hammering every poll
      recovery_cycle=$((HOTSPOT_AFTER_CYCLES - 2))
    fi
    continue
  fi

  case "$recovery_cycle" in
    1|2)
      recover_level_1
      ;;
    3|4)
      recover_level_2
      ;;
    *)
      recover_level_3
      ;;
  esac

  if [ "$offline_count" -ge "$ESCALATION_THRESHOLD" ]; then
    log "WARNING: offline for $((offline_count * POLL_INTERVAL))s+ (recovery_cycle=$recovery_cycle)"
  fi
done
