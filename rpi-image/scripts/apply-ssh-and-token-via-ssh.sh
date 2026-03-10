#!/usr/bin/env bash
# =============================================================================
# Apply RPi resilience updates to an already-flashed Pi (no reflash).
# Deploys: WiFi flow (xinitrc, wifi-setup-server, server, update scripts),
# app (dist/), SSH keys, GitHub token. Creates /var/lib/masjidconnect for markers.
#
# Usage:
#   ./apply-ssh-and-token-via-ssh.sh [user@]hostname
#   PI_HOST=pi@192.168.1.10 ./apply-ssh-and-token-via-ssh.sh
#   PI_HOST=pi@192.168.1.10 ./apply-ssh-and-token-via-ssh.sh --skip-app  # deploy scripts only, no dist/
#
# Options:
#   --skip-app   Skip building and deploying dist/ (deploy scripts + keys/token only)
#
# From the repo root or from rpi-image/scripts/.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RPI_IMAGE="${SCRIPT_DIR}/.."
REPO_ROOT="$(cd "${RPI_IMAGE}/.." && pwd)"
DEPLOY="${REPO_ROOT}/deploy"
AUTH_KEYS="${RPI_IMAGE}/ssh/authorized_keys"
GITHUB_TOKEN="${RPI_IMAGE}/secrets/github-token"
APP_DIR="/opt/masjidconnect"

SKIP_APP=false
PI_HOST="${PI_HOST:-}"

for arg in "$@"; do
  case "$arg" in
    --skip-app) SKIP_APP=true ;;
    -h|--help)
      echo "Usage: $0 [options] [user@]hostname"
      echo "   or: PI_HOST=pi@192.168.1.10 $0 [options]"
      echo ""
      echo "Options:"
      echo "  --skip-app   Skip building and deploying dist/ (scripts + keys/token only)"
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
  exit 1
fi

HAS_KEYS=false
HAS_TOKEN=false
[ -f "$AUTH_KEYS" ] && HAS_KEYS=true
[ -f "$GITHUB_TOKEN" ] && HAS_TOKEN=true

echo "============================================"
echo "  Apply RPi resilience updates to $PI_HOST"
echo "============================================"
echo ""

# --- 1. WiFi flow: deploy scripts and state dir ---
echo "[1/4] Deploying WiFi flow and update scripts..."
ssh "$PI_HOST" "sudo mkdir -p ${APP_DIR}/deploy /var/lib/masjidconnect && sudo chown 1000:1000 /var/lib/masjidconnect"
REMOTE_USER=$(ssh "$PI_HOST" whoami)
for f in xinitrc-kiosk wifi-setup-server.mjs wifi-hotspot.sh server.mjs update-from-github.sh install-release.sh; do
  if [ -f "${DEPLOY}/${f}" ]; then
    scp -q "${DEPLOY}/${f}" "${PI_HOST}:/tmp/${f}"
    ssh "$PI_HOST" "sudo mv /tmp/${f} ${APP_DIR}/deploy/ && sudo chmod +x ${APP_DIR}/deploy/${f} 2>/dev/null || true"
    echo "  -> ${APP_DIR}/deploy/${f}"
  fi
done
ssh "$PI_HOST" "sudo chown -R ${REMOTE_USER}:${REMOTE_USER} ${APP_DIR}/deploy"
echo ""

# --- 2. App (dist/) ---
if [ "$SKIP_APP" = false ]; then
  echo "[2/4] Building and deploying app (dist/)..."
  cd "${REPO_ROOT}"
  npm run build
  rsync -avz --delete dist/ "${PI_HOST}:/tmp/masjidconnect-dist/"
  ssh "$PI_HOST" "sudo rm -rf ${APP_DIR}/dist.old && sudo mv ${APP_DIR}/dist ${APP_DIR}/dist.old 2>/dev/null || true; sudo mv /tmp/masjidconnect-dist ${APP_DIR}/dist && sudo chown -R ${REMOTE_USER}:${REMOTE_USER} ${APP_DIR}/dist"
  echo "  dist/ deployed."
else
  echo "[2/4] Skipping app (--skip-app)"
fi
echo ""

# --- 3. SSH keys and GitHub token ---
echo "[3/4] Applying SSH keys and/or GitHub token..."
if [ "$HAS_KEYS" = true ]; then
  ssh "$PI_HOST" "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
  scp -q "$AUTH_KEYS" "${PI_HOST}:/tmp/authorized_keys.new"
  ssh "$PI_HOST" "
    if [ -f ~/.ssh/authorized_keys ]; then
      # Append new keys, avoid duplicates
      while IFS= read -r line; do
        [ -z \"\$line\" ] && continue
        grep -qF \"\$line\" ~/.ssh/authorized_keys 2>/dev/null || echo \"\$line\" >> ~/.ssh/authorized_keys
      done < /tmp/authorized_keys.new
    else
      mv /tmp/authorized_keys.new ~/.ssh/authorized_keys
    fi
    [ -f ~/.ssh/authorized_keys ] && chmod 600 ~/.ssh/authorized_keys
    rm -f /tmp/authorized_keys.new
  "
  echo "  -> ~/.ssh/authorized_keys"
fi

if [ "$HAS_TOKEN" = true ]; then
  scp -q "$GITHUB_TOKEN" "${PI_HOST}:/tmp/github-token"
  ssh "$PI_HOST" "sudo cp /tmp/github-token /opt/masjidconnect/.github-token && sudo chmod 600 /opt/masjidconnect/.github-token && sudo chown 1000:1000 /opt/masjidconnect/.github-token && rm -f /tmp/github-token"
  echo "  -> /opt/masjidconnect/.github-token"
fi

if [ "$HAS_KEYS" = false ] && [ "$HAS_TOKEN" = false ]; then
  echo "  (No authorized_keys or github-token; skipping)"
fi
echo ""

# --- 4. Restart services ---
echo "[4/4] Restarting services..."
ssh "$PI_HOST" "sudo systemctl restart masjidconnect-display.service masjidconnect-kiosk.service"
echo "  masjidconnect-display and masjidconnect-kiosk restarted."
echo ""
echo "============================================"
echo "  Done. WiFi flow, app, keys/token applied."
echo "============================================"
