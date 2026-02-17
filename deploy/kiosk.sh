#!/usr/bin/env bash
# =============================================================================
# MasjidConnect Kiosk Launcher
#
# Starts Chromium in kiosk mode pointed at the local display server.
# Designed for Raspberry Pi OS (Bookworm+).
#
# Usage:  ./deploy/kiosk.sh [PORT]
# =============================================================================

set -euo pipefail

PORT="${1:-3001}"
URL="http://localhost:${PORT}"

# Disable DPMS (screen sleep) and screen saver
xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

# Hide the mouse cursor after 0.5s of inactivity
if command -v unclutter &>/dev/null; then
  unclutter -idle 0.5 -root &
fi

# Wait for the server to be ready
echo "[Kiosk] Waiting for server at ${URL}..."
for i in $(seq 1 30); do
  if curl -sf "${URL}/health" >/dev/null 2>&1; then
    echo "[Kiosk] Server ready."
    break
  fi
  sleep 1
done

# Launch Chromium in kiosk mode
#   --kiosk               : Full-screen, no address bar
#   --noerrdialogs        : Suppress error pop-ups
#   --disable-infobars    : No "Chrome is controlled by automated software" bar
#   --check-for-update-interval=31536000 : Disable update checks (1 year)
#   --disable-features=TranslateUI : No translation prompts
#   --disable-pinch       : Disable pinch-to-zoom
#   --overscroll-history-navigation=0 : No swipe-to-go-back
#   --enable-gpu-rasterization : Use GPU for rendering
#   --enable-oop-rasterization : Off-process GPU raster for stability
#   --disable-dev-shm-usage : Use /tmp for shared memory (avoids /dev/shm limits on RPi)
#   --force-device-scale-factor=1 : Prevent display scaling issues

exec chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --check-for-update-interval=31536000 \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --enable-gpu-rasterization \
  --enable-oop-rasterization \
  --disable-dev-shm-usage \
  --force-device-scale-factor=1 \
  --autoplay-policy=no-user-gesture-required \
  --disable-session-crashed-bubble \
  --disable-component-update \
  --password-store=basic \
  "${URL}"
