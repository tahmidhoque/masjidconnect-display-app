#!/usr/bin/env bash
# =============================================================================
# MasjidConnect Display — Deploy build to Raspberry Pi over SSH
#
# Pushes the current production build (dist/) to an existing Pi at /opt/masjidconnect/
# and restarts the display service. No new image or full install needed.
#
# Prerequisites:
#   - SSH access to the Pi (key-based or password)
#   - App already installed at /opt/masjidconnect (e.g. from a previous image or install.sh)
#
# Usage:
#   ./scripts/deploy-via-ssh.sh [user@]hostname
#   PI_HOST=pi@192.168.1.10 ./scripts/deploy-via-ssh.sh
#   PI_HOST=pi@rpi.local ./scripts/deploy-via-ssh.sh --skip-build   # use existing dist/
#
# Options:
#   --skip-build    Use existing dist/; do not run npm run build
#   --deploy-scripts  Also rsync deploy/ (server.mjs, kiosk.sh, etc.) to the Pi
#   --restart-kiosk  Restart the kiosk service so Chromium reloads (default: display only)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="/opt/masjidconnect"

SKIP_BUILD=false
DEPLOY_SCRIPTS=false
RESTART_KIOSK=false
PI_HOST="${PI_HOST:-}"

for arg in "$@"; do
  case "$arg" in
    --skip-build)      SKIP_BUILD=true ;;
    --deploy-scripts)  DEPLOY_SCRIPTS=true ;;
    --restart-kiosk)   RESTART_KIOSK=true ;;
    -h|--help)
      echo "Usage: $0 [options] [user@]hostname"
      echo "   or: PI_HOST=pi@192.168.1.10 $0 [options]"
      echo ""
      echo "Options:"
      echo "  --skip-build       Use existing dist/; do not run npm run build"
      echo "  --deploy-scripts  Also rsync deploy/ to the Pi"
      echo "  --restart-kiosk   Restart kiosk service so Chromium reloads"
      exit 0
      ;;
    -*)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
    *)
      PI_HOST="$arg"
      ;;
  esac
done

if [ -z "$PI_HOST" ]; then
  echo "Usage: $0 [options] [user@]hostname" >&2
  echo "   or: PI_HOST=pi@192.168.1.10 $0" >&2
  echo "Use --help for options." >&2
  exit 1
fi

cd "${PROJECT_DIR}"

echo "============================================"
echo "  Deploy to Raspberry Pi over SSH"
echo "  Target: $PI_HOST"
echo "============================================"
echo ""

# --- Build --------------------------------------------------------------------

if [ "$SKIP_BUILD" = true ]; then
  echo "[1/4] Skipping build (--skip-build)"
  if [ ! -d "dist" ]; then
    echo "ERROR: dist/ not found. Run 'npm run build' first." >&2
    exit 1
  fi
else
  echo "[1/4] Building production bundle..."
  npm run build
fi
echo ""

# --- Rsync dist/ --------------------------------------------------------------

echo "[2/4] Syncing dist/ to ${PI_HOST}:${APP_DIR}/dist/ ..."
REMOTE_USER=$(ssh "$PI_HOST" whoami)
ssh "$PI_HOST" "sudo mkdir -p ${APP_DIR}"
rsync -avz --delete \
  dist/ \
  "${PI_HOST}:/tmp/masjidconnect-dist/"
ssh "$PI_HOST" "sudo rm -rf ${APP_DIR}/dist.old && sudo mv ${APP_DIR}/dist ${APP_DIR}/dist.old 2>/dev/null || true; sudo mv /tmp/masjidconnect-dist ${APP_DIR}/dist && sudo chown -R ${REMOTE_USER}:${REMOTE_USER} ${APP_DIR}/dist"
echo "  dist/ deployed."
echo ""

# --- Optional: deploy/ --------------------------------------------------------

if [ "$DEPLOY_SCRIPTS" = true ]; then
  echo "[3/4] Syncing deploy/ to ${PI_HOST}:${APP_DIR}/deploy/ ..."
  rsync -avz \
    deploy/ \
    "${PI_HOST}:/tmp/masjidconnect-deploy/"
  ssh "$PI_HOST" "sudo mkdir -p ${APP_DIR}/deploy && sudo cp -r /tmp/masjidconnect-deploy/* ${APP_DIR}/deploy/ && sudo chmod +x ${APP_DIR}/deploy/*.sh ${APP_DIR}/deploy/xinitrc-kiosk 2>/dev/null; sudo chown -R ${REMOTE_USER}:${REMOTE_USER} ${APP_DIR}/deploy"
  echo "  deploy/ updated."
  echo ""
else
  echo "[3/4] Skipping deploy/ (use --deploy-scripts to push server/kiosk changes)"
  echo ""
fi

# --- Restart services ---------------------------------------------------------

echo "[4/4] Restarting masjidconnect-display service..."
ssh "$PI_HOST" "sudo systemctl restart masjidconnect-display.service"
echo "  masjidconnect-display restarted."

if [ "$RESTART_KIOSK" = true ]; then
  echo "  Restarting masjidconnect-kiosk so Chromium reloads..."
  ssh "$PI_HOST" "sudo systemctl restart masjidconnect-kiosk.service"
  echo "  masjidconnect-kiosk restarted."
else
  echo "  (Kiosk not restarted; page may reload on next navigation or use --restart-kiosk)"
fi

echo ""
echo "============================================"
echo "  Deploy complete!"
echo "============================================"
echo ""
echo "  App at ${PI_HOST}:${APP_DIR}/"
echo "  Server: http://localhost:3001"
echo "  To force browser reload: $0 --restart-kiosk $PI_HOST"
echo ""
