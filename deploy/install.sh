#!/usr/bin/env bash
# =============================================================================
# MasjidConnect Display — Raspberry Pi Install Script
#
# Prerequisites:
#   - Raspberry Pi OS (Bookworm or later) with desktop (for Chromium)
#   - Node.js 18+ installed (use NodeSource: https://deb.nodesource.com/)
#   - Internet connection for initial setup
#
# Usage:
#   chmod +x deploy/install.sh
#   sudo ./deploy/install.sh
# =============================================================================

set -euo pipefail

APP_DIR="/opt/masjidconnect"
# Use the user who ran sudo (e.g. mcadmin); fall back to pi for classic Raspberry Pi OS
SERVICE_USER="${SUDO_USER:-pi}"

echo "============================================"
echo "  MasjidConnect Display — Installer"
echo "============================================"
echo ""

# Must be root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root (sudo)."
  exit 1
fi

# Check for Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Install it with: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required (found v$(node -v))."
  exit 1
fi

# Check for Chromium (chromium-browser on Bookworm, chromium on Trixie and others)
if ! command -v chromium-browser &>/dev/null && ! command -v chromium &>/dev/null; then
  echo "Installing Chromium..."
  apt-get update
  if ! apt-get install -y chromium-browser 2>/dev/null; then
    apt-get install -y chromium
  fi
fi

# Install unclutter for hiding cursor
if ! command -v unclutter &>/dev/null; then
  echo "Installing unclutter..."
  apt-get install -y unclutter
fi

# Ensure SERVICE_USER exists
if ! getent passwd "${SERVICE_USER}" >/dev/null 2>&1; then
  echo "ERROR: User '${SERVICE_USER}' not found. Create it or run as: sudo -u <your-username> -- bash -c './deploy/install.sh'"
  exit 1
fi

# Create app directory
echo "Setting up ${APP_DIR}..."
mkdir -p "${APP_DIR}"

# Copy application files
echo "Copying application files..."
cp -r dist/ "${APP_DIR}/dist/"
cp -r deploy/ "${APP_DIR}/deploy/"
cp package.json "${APP_DIR}/"

# Make scripts executable
chmod +x "${APP_DIR}/deploy/kiosk.sh"
chmod +x "${APP_DIR}/deploy/server.mjs"

# Set ownership
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"

# Install systemd services (substitute SERVICE_USER into unit files)
echo "Installing systemd services (running as ${SERVICE_USER})..."
sed -e "s/^User=.*/User=${SERVICE_USER}/" \
    -e "s/^Group=.*/Group=${SERVICE_USER}/" \
    deploy/masjidconnect-display.service > /etc/systemd/system/masjidconnect-display.service
sed -e "s/^User=.*/User=${SERVICE_USER}/" \
    -e "s/^Group=.*/Group=${SERVICE_USER}/" \
    -e "s|/home/pi/|/home/${SERVICE_USER}/|g" \
    deploy/masjidconnect-kiosk.service > /etc/systemd/system/masjidconnect-kiosk.service
systemctl daemon-reload

# Enable services
systemctl enable masjidconnect-display.service
systemctl enable masjidconnect-kiosk.service

# Start services
echo "Starting services..."
systemctl start masjidconnect-display.service
sleep 3
systemctl start masjidconnect-kiosk.service

echo ""
echo "============================================"
echo "  Installation complete!"
echo "============================================"
echo ""
echo "  Display server: http://localhost:3001"
echo "  Chromium kiosk will launch automatically."
echo ""
echo "  Manage with:"
echo "    systemctl status masjidconnect-display"
echo "    systemctl status masjidconnect-kiosk"
echo "    journalctl -u masjidconnect-display -f"
echo ""
