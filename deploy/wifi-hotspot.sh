#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — Wi-Fi Hotspot (AP) lifecycle manager
#
# Creates a temporary open hotspot so users can configure Wi-Fi from their phone.
# Uses NetworkManager's built-in AP mode (nmcli connection add type wifi mode ap)
# which works on all Raspberry Pi models including Pi 5 (brcmfmac PCIe driver).
# NM handles hostapd and DHCP internally — no need to stop NM or manage
# hostapd/dnsmasq directly.
#
# Commands:
#   scan   — scan nearby networks and cache results as JSON (NM must manage iface)
#   start  — bring up the AP with SSID "MasjidConnect-Setup"
#   stop   — tear down AP and return interface to station mode
#   status — print "running" or "stopped"
#
# Must run as root.
# Usage:  sudo /opt/masjidconnect/deploy/wifi-hotspot.sh <scan|start|stop|status> [<iface>]
# =============================================================================

set -uo pipefail

IFACE="${2:-${WIFI_HOTSPOT_IFACE:-wlan0}}"
AP_SSID="MasjidConnect-Setup"
AP_IP="192.168.4.1"
AP_CHANNEL=6
COUNTRY="${WIFI_COUNTRY:-GB}"
SCAN_CACHE="/tmp/masjidconnect-wifi-scan.json"
PID_FILE="/tmp/masjidconnect-hotspot.pid"
# NM connection name for the hotspot profile
AP_CON_NAME="MasjidConnect-Hotspot"
LOG="/tmp/kiosk.log"

# Ensure the log file exists and is world-writable so root and pi can both append
touch "$LOG" 2>/dev/null || true
chmod a+rw "$LOG" 2>/dev/null || true

log()     { echo "$(date '+%Y-%m-%d %H:%M:%S') [wifi-hotspot] $*"         | tee -a "$LOG" 2>/dev/null || true; }
log_err() { echo "$(date '+%Y-%m-%d %H:%M:%S') [wifi-hotspot] ERROR: $*"  | tee -a "$LOG" >&2 2>/dev/null || true; }

# ---------------------------------------------------------------------------
# scan — enumerate nearby SSIDs while interface is in NM-managed/station mode
# ---------------------------------------------------------------------------
do_scan() {
  log "Scanning for networks on ${IFACE}..."

  # Set regulatory domain before scanning.
  # Without the per-PHY set, brcmfmac CLM stays at country 99 which restricts
  # visible channels — many 2.4 GHz networks will be hidden from scan results.
  if command -v iw &>/dev/null; then
    iw reg set "$COUNTRY" 2>/dev/null || true
    local SCAN_PHY
    SCAN_PHY=$(iw dev "$IFACE" info 2>/dev/null | awk '/wiphy/ {print "phy" $2}' || echo "phy0")
    iw phy "$SCAN_PHY" reg set "$COUNTRY" 2>/dev/null || true
    sleep 0.5
    log "Scan regulatory domain: $(iw reg get 2>/dev/null | tr '\n' ' ' || echo unavailable)"
  fi

  nmcli radio wifi on 2>/dev/null || true
  sleep 1

  # Two-pass rescan — first pass wakes the radio, second captures networks that
  # only appear after the channel list is fully populated (common with brcmfmac).
  nmcli dev wifi rescan ifname "$IFACE" 2>/dev/null || true
  sleep 3
  nmcli dev wifi rescan ifname "$IFACE" 2>/dev/null || true
  sleep 2

  local raw
  raw=$(nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list ifname "$IFACE" 2>/dev/null || true)

  # Build JSON array of unique non-empty SSIDs
  local json
  json=$(echo "$raw" | awk -F: '
    NF >= 1 && $1 != "" && !seen[$1]++ {
      ssid = $1; signal = $2; security = $3
      gsub(/\\/, "\\\\", ssid);    gsub(/"/, "\\\"", ssid)
      gsub(/\\/, "\\\\", security); gsub(/"/, "\\\"", security)
      list = list (count++ ? "," : "") "{\"ssid\":\"" ssid "\",\"signal\":" (signal+0) ",\"security\":\"" security "\"}"
    }
    END { printf "[%s]", list }
  ')

  [ -z "$json" ] && json="[]"
  echo "{\"ssids\":${json}}" > "$SCAN_CACHE"
  log "Cached $(echo "$json" | grep -o '"ssid"' | wc -l) networks to ${SCAN_CACHE}"
}

# ---------------------------------------------------------------------------
# start — bring up a NetworkManager AP connection for the setup hotspot.
#
# Uses the NM keyfile approach (write connection profile to disk, reload NM,
# then activate) rather than `nmcli connection add` via D-Bus. This is more
# reliable because:
#   - `nmcli connection add type wifi mode ap` via D-Bus fails if wpa_supplicant
#     has not yet been D-Bus-activated by NM (common on first boot).
#   - Writing a keyfile and calling `nmcli con reload` does not require D-Bus
#     for the add step — only the subsequent `nmcli con up` needs it, and by
#     that point wpa_supplicant is already running and registered.
#   - This is the same approach used by wifi-apply-bootconf.sh (proven reliable).
#   - All nmcli errors are captured to variables and written via log_err(),
#     avoiding the `2>>"$LOG"` redirect that can fail with permission denied.
# ---------------------------------------------------------------------------
do_start() {
  log "Starting hotspot on ${IFACE} (SSID: ${AP_SSID})..."

  # Unblock any rfkill soft-block
  rfkill unblock wifi 2>/dev/null || true
  rfkill unblock wlan 2>/dev/null || true
  sleep 0.5

  # Ensure NetworkManager is running
  if ! systemctl is-active --quiet NetworkManager 2>/dev/null; then
    log "NetworkManager not running — starting it..."
    systemctl start NetworkManager 2>/dev/null || true
    sleep 3
  fi

  # ---------------------------------------------------------------------------
  # Pre-flight diagnostics and recovery
  # ---------------------------------------------------------------------------
  log "Pre-flight: NM general: $(nmcli general status 2>/dev/null | head -3 | tr '\n' '|' || echo 'unavailable')"
  log "Pre-flight: devices: $(nmcli -t -f DEVICE,TYPE,STATE dev 2>/dev/null | tr '\n' '|' || echo 'unavailable')"

  # wpa_supplicant must NOT be masked — NM D-Bus-activates it for AP mode.
  if command -v wpa_supplicant &>/dev/null; then
    WPA_STATE=$(systemctl is-enabled wpa_supplicant.service 2>/dev/null || echo "unknown")
    log "Pre-flight: wpa_supplicant: ${WPA_STATE}"
    if [ "$WPA_STATE" = "masked" ]; then
      log "WARNING: wpa_supplicant is masked — attempting unmask before AP start..."
      systemctl unmask wpa_supplicant.service 2>/dev/null || true
      sleep 1
    fi
  else
    log_err "wpa_supplicant binary not found — install wpasupplicant"
    return 1
  fi

  # Ensure the interface is managed by NM
  IFACE_STATE=$(nmcli -t -f DEVICE,STATE dev 2>/dev/null | grep "^${IFACE}:" | cut -d: -f2 || echo "")
  log "Pre-flight: ${IFACE} state: '${IFACE_STATE}'"
  if [ "${IFACE_STATE}" = "unmanaged" ]; then
    log "WARNING: ${IFACE} unmanaged — attempting nmcli device set managed yes..."
    nmcli device set "$IFACE" managed yes 2>/dev/null || true
    sleep 2
    IFACE_STATE=$(nmcli -t -f DEVICE,STATE dev 2>/dev/null | grep "^${IFACE}:" | cut -d: -f2 || echo "")
    log "Pre-flight: ${IFACE} state after fix: '${IFACE_STATE}'"
  fi
  if [ -z "${IFACE_STATE}" ]; then
    log_err "Interface ${IFACE} not in NM device list"
    log_err "  rfkill: $(rfkill list 2>/dev/null || echo unavailable)"
    log_err "  iw dev: $(iw dev 2>/dev/null | head -6 || echo unavailable)"
    return 1
  fi

  # Set regulatory domain — required for AP mode on 2.4 GHz channels.
  #
  # Two-step approach is required for brcmfmac (Broadcom WiFi on RPi):
  #   1. `iw reg set` — sets the kernel cfg80211 regulatory domain
  #   2. `iw phy <phy> reg set` — sends an nl80211 per-PHY command that
  #      brcmfmac intercepts and propagates into the firmware's CLM
  #      (Country Locale Matrix). Without this second command the CLM
  #      stays at country 99 ("unset"), which silently disables AP beacon
  #      transmission even though `nmcli con up` reports success.
  if command -v iw &>/dev/null; then
    iw reg set "$COUNTRY" 2>/dev/null \
      && log "Kernel regulatory domain set to ${COUNTRY}" \
      || log "iw reg set (kernel) failed (non-fatal)"
    # Derive the phy name from the interface (e.g. wlan0 → phy0)
    local PHY
    PHY=$(iw dev "$IFACE" info 2>/dev/null | awk '/wiphy/ {print "phy" $2}' || echo "phy0")
    iw phy "$PHY" reg set "$COUNTRY" 2>/dev/null \
      && log "Per-PHY (${PHY}) CLM regulatory domain set to ${COUNTRY}" \
      || log "iw phy reg set failed (non-fatal)"
    sleep 1
    log "Regulatory state after set: $(iw reg get 2>/dev/null | tr '\n' ' ' || echo unavailable)"
  fi

  # ---------------------------------------------------------------------------
  # Remove any stale hotspot connection profile from a previous run
  # ---------------------------------------------------------------------------
  nmcli connection delete "$AP_CON_NAME" 2>/dev/null || true
  local NM_CON_DIR="/etc/NetworkManager/system-connections"
  local NM_CON_FILE="${NM_CON_DIR}/${AP_CON_NAME}.nmconnection"
  rm -f "$NM_CON_FILE" 2>/dev/null || true
  sleep 0.5

  # ---------------------------------------------------------------------------
  # Write the AP connection as an NM keyfile instead of using `nmcli connection add`.
  #
  # `nmcli connection add type wifi mode ap` calls NM's D-Bus AddConnection method
  # which fails if wpa_supplicant hasn't been D-Bus-activated yet (common on first
  # boot). Writing the keyfile directly and using `nmcli con reload` bypasses the
  # D-Bus add step entirely — only the subsequent `nmcli con up` needs D-Bus, and
  # by that point NM has had time to activate wpa_supplicant.
  #
  # Open AP: no [wifi-security] section. Adding key-mgmt=none creates a WEP
  # section that Bookworm's wpa_supplicant rejects (WEP compiled out).
  # ---------------------------------------------------------------------------
  log "Writing AP keyfile to ${NM_CON_FILE}..."
  mkdir -p "$NM_CON_DIR"
  # Use printf to avoid heredoc issues in constrained environments
  printf '[connection]\nid=%s\ntype=wifi\nautoconnect=false\n\n[wifi]\nmode=ap\nssid=%s\nband=bg\nchannel=%s\n\n[ipv4]\nmethod=shared\naddress1=%s/24\n\n[ipv6]\nmethod=disabled\n' \
    "$AP_CON_NAME" "$AP_SSID" "$AP_CHANNEL" "$AP_IP" > "$NM_CON_FILE"
  if [ ! -s "$NM_CON_FILE" ]; then
    log_err "Failed to write AP keyfile — filesystem issue?"
    return 1
  fi
  chmod 600 "$NM_CON_FILE"
  log "Keyfile written ($(wc -c < "$NM_CON_FILE") bytes)"

  # Reload NM connection profiles to pick up the new keyfile
  log "Reloading NM connections..."
  local RELOAD_ERR
  RELOAD_ERR=$(nmcli con reload 2>&1) || true
  log "NM reload: ${RELOAD_ERR:-ok}"
  sleep 1

  # Activate the AP connection
  log "Activating AP connection..."
  local UP_ERR
  if ! UP_ERR=$(nmcli connection up "$AP_CON_NAME" 2>&1); then
    log_err "nmcli connection up failed: ${UP_ERR}"
    log_err "  NM devices: $(nmcli -t -f DEVICE,TYPE,STATE dev 2>/dev/null | tr '\n' '|' || echo unavailable)"
    log_err "  wpa_supplicant active: $(systemctl is-active wpa_supplicant.service 2>/dev/null || echo unknown)"
    log_err "  NM journal: $(journalctl -u NetworkManager -n 10 --no-pager 2>/dev/null | tail -10 | tr '\n' '|' || echo unavailable)"
    nmcli connection delete "$AP_CON_NAME" 2>/dev/null || true
    rm -f "$NM_CON_FILE" 2>/dev/null || true
    return 1
  fi
  log "nmcli connection up: ok"

  # Poll until the interface enters AP mode (NM switches it asynchronously)
  log "Waiting for ${IFACE} to enter AP mode..."
  local ap_ready=false
  local i
  for i in $(seq 1 20); do
    if iw dev "$IFACE" info 2>/dev/null | grep -q "type AP"; then
      log "Interface in AP mode after ${i}s"
      ap_ready=true
      break
    fi
    sleep 1
  done
  if [ "$ap_ready" = false ]; then
    log_err "Timed out waiting for AP mode — SSID will not broadcast"
    log_err "  iw dev: $(iw dev 2>/dev/null | head -10 || echo unavailable)"
    log_err "  NM active cons: $(nmcli con show --active 2>/dev/null | head -5 | tr '\n' '|' || echo unavailable)"
    log_err "  NM journal: $(journalctl -u NetworkManager -n 15 --no-pager 2>/dev/null | tail -15 | tr '\n' '|' || echo unavailable)"
  fi

  local mode
  mode=$(iw dev "$IFACE" info 2>/dev/null | awk '/type/ {print $2}' || echo "unknown")
  local ip
  ip=$(ip -4 addr show dev "$IFACE" 2>/dev/null | awk '/inet / {print $2}' | head -1)
  log "Hotspot done — SSID: ${AP_SSID}, mode: ${mode}, IP: ${ip:-unknown}"
  echo "$$" > "$PID_FILE"
}

# ---------------------------------------------------------------------------
# stop — tear down the NM AP connection and return to station mode.
# NM is kept running throughout — no restart needed.
# ---------------------------------------------------------------------------
do_stop() {
  log "Stopping hotspot..."

  nmcli connection down "$AP_CON_NAME" 2>/dev/null || true
  sleep 1
  nmcli connection delete "$AP_CON_NAME" 2>/dev/null || true
  # Remove keyfile so NM doesn't try to activate it on next reload
  rm -f "/etc/NetworkManager/system-connections/${AP_CON_NAME}.nmconnection" 2>/dev/null || true
  rm -f "$PID_FILE"

  log "Hotspot stopped — NM station mode restored"
}

# ---------------------------------------------------------------------------
# status — report whether the NM AP connection is currently active
# ---------------------------------------------------------------------------
do_status() {
  # Check if the AP NM connection is active
  if nmcli -t -f NAME,STATE con show --active 2>/dev/null | grep -q "^${AP_CON_NAME}:activated"; then
    echo "running"
    exit 0
  fi
  # Fallback: check if interface is physically in AP mode
  if iw dev "$IFACE" info 2>/dev/null | grep -q "type AP"; then
    echo "running"
    exit 0
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
