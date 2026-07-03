#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — HTTPS time fallback
#
# Some venue networks block NTP (UDP 123), leaving systemd-timesyncd unable
# to sync and the clock drifting minutes off — which breaks prayer time
# accuracy. This script is run periodically by masjidconnect-http-time.timer:
# if NTP has NOT synchronised, it takes the Date header from an HTTPS
# response from the MasjidConnect portal (TCP 443 — always open, since the
# display needs it anyway) and steps the system clock when it differs by
# 10 seconds or more. The RTC (Pi 5) is updated too so the corrected time
# survives reboots.
#
# TLS chicken-and-egg: certificate validation fails if the clock is wildly
# wrong (outside the cert validity window). If the verified request fails
# AND the clock is obviously bogus (year < 2024), retry once without
# verification — a rough unauthenticated time is better than an epoch clock,
# and the next verified run corrects it precisely.
#
# Must run as root.
# =============================================================================

set -uo pipefail

URL="${MASJIDCONNECT_TIME_URL:-https://portal.masjidconnect.co.uk}"
MIN_STEP_SECONDS=10
LOG="/tmp/http-time-sync.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [http-time] $*" >> "$LOG" 2>/dev/null || true; }

# NTP already synchronised — nothing to do (timesyncd keeps it accurate).
if timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qi '^yes$'; then
  exit 0
fi

fetch_date_header() {
  # $1: extra curl flags
  # shellcheck disable=SC2086  # $1 is intentionally word-split (curl flags)
  curl -sI $1 --connect-timeout 5 --max-time 10 "$URL" 2>/dev/null \
    | tr -d '\r' \
    | awk -F': ' 'tolower($1) == "date" { print substr($0, index($0, ": ") + 2); exit }'
}

HDR="$(fetch_date_header "")"
if [ -z "$HDR" ] && [ "$(date +%Y)" -lt 2024 ]; then
  log "Verified request failed and clock looks bogus ($(date +%Y)) — retrying without TLS verification"
  HDR="$(fetch_date_header "-k")"
fi

[ -z "$HDR" ] && { log "No Date header (offline?) — skipping"; exit 0; }

REMOTE_TS="$(date -d "$HDR" +%s 2>/dev/null || echo 0)"
[ "$REMOTE_TS" -le 0 ] && { log "Unparseable Date header: $HDR"; exit 0; }

LOCAL_TS="$(date +%s)"
DIFF=$(( REMOTE_TS - LOCAL_TS ))
[ "$DIFF" -lt 0 ] && DIFF=$(( -DIFF ))

if [ "$DIFF" -lt "$MIN_STEP_SECONDS" ]; then
  log "Clock within ${DIFF}s of HTTPS time — no step needed"
  exit 0
fi

if date -s "@${REMOTE_TS}" >/dev/null 2>&1; then
  log "Stepped system clock by ${DIFF}s from HTTPS Date header (NTP unavailable)"
  # Persist to the Pi 5 RTC so the corrected time survives a reboot.
  if [ -e /dev/rtc0 ] && command -v hwclock >/dev/null 2>&1; then
    hwclock --systohc --rtc=/dev/rtc0 2>/dev/null && log "RTC updated from corrected system clock"
  fi
  # Persist for battery-less devices too.
  command -v fake-hwclock >/dev/null 2>&1 && fake-hwclock save 2>/dev/null || true
else
  log "ERROR: failed to set system clock"
fi
