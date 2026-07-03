#!/usr/bin/env bash
# =============================================================================
# MasjidConnect — RTC → system clock sync (Raspberry Pi 5)
#
# Run by masjidconnect-rtc-sync.service when /dev/rtc0 appears. Reads the
# hardware RTC and applies it to the system clock so prayer times are correct
# immediately on boot even without internet.
#
# Guard: only applied when the RTC is AHEAD of the current system clock.
#   - Valid RTC (battery fitted / warm reboot): always ahead of the stale
#     fake-hwclock restore → applied.
#   - Battery-less RTC after power loss (~epoch) or already NTP-synced
#     system: not ahead → skipped, keeping the better time.
#
# Requires hwclock (util-linux-extra on Debian Bookworm).
# =============================================================================

set -uo pipefail

RTC_DEV="${1:-/dev/rtc0}"

[ -e "$RTC_DEV" ] || { echo "[masjidconnect-rtc-sync] ${RTC_DEV} not present — nothing to do"; exit 0; }

if ! command -v hwclock >/dev/null 2>&1; then
  echo "[masjidconnect-rtc-sync] ERROR: hwclock not installed (util-linux-extra) — cannot read RTC" >&2
  exit 1
fi

RTC_RAW="$(hwclock --get --rtc="$RTC_DEV" 2>/dev/null || true)"
RTC_TS="$(date -d "$RTC_RAW" +%s 2>/dev/null || echo 0)"
SYS_TS="$(date +%s)"

if [ "$RTC_TS" -gt "$SYS_TS" ]; then
  if hwclock --hctosys --rtc="$RTC_DEV"; then
    echo "[masjidconnect-rtc-sync] System clock set from RTC: $(date) (was ${SYS_TS}, rtc ${RTC_TS})"
  else
    echo "[masjidconnect-rtc-sync] ERROR: hwclock --hctosys failed" >&2
    exit 1
  fi
else
  echo "[masjidconnect-rtc-sync] RTC not ahead of system clock (rtc=${RTC_TS} sys=${SYS_TS}) — keeping system time"
fi
