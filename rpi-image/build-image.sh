#!/usr/bin/env bash
# Build MasjidConnect RPi image via Docker (avoids GH Actions artifact size limits).
# Supports Pi 3 (masjidconnect-pi3.yaml) and Pi 4/5 (masjidconnect.yaml).
# Custom splash: put your image at rpi-image/assets/splash.png (and optional rpi-image/assets/background.png).
#
# Usage:
#   ./rpi-image/build-image.sh                    # Pi 3 image
#   ./rpi-image/build-image.sh pi4                # Pi 4/5 image
#   ./rpi-image/build-image.sh pi3 --skip-package # Pi 3, skip npm package (use existing app archive)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

CONFIG="masjidconnect-pi3.yaml"
SKIP_PACKAGE=false

for arg in "$@"; do
  case "$arg" in
    # Pi 4/5 image (including Raspberry Pi 5); uses masjidconnect.yaml
    pi4|pi5) CONFIG="masjidconnect.yaml" ;;
    pi3)     CONFIG="masjidconnect-pi3.yaml" ;;
    --skip-package) SKIP_PACKAGE=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

APP_ARCHIVE="${SCRIPT_DIR}/app/masjidconnect-display.tar.gz"
OUT_DIR="${SCRIPT_DIR}/out"
IMAGE_TAG="masjidconnect-rpi-image-gen"

echo "============================================"
echo "  MasjidConnect Display — Docker image build"
echo "  Config: $CONFIG"
echo "============================================"

# Build or reuse app archive (always rebuild when not --skip-package so image gets latest code)
if [ "$SKIP_PACKAGE" = true ]; then
  if [ ! -f "$APP_ARCHIVE" ]; then
    echo "ERROR: $APP_ARCHIVE not found. Run without --skip-package first."
    exit 1
  fi
  echo "Using existing app archive: $APP_ARCHIVE"
else
  echo "Building app archive (VITE_* from .env if present)..."
  if [ -f "${REPO_ROOT}/.env" ]; then
    set -a
    source "${REPO_ROOT}/.env"
    set +a
  fi
  npm run package
  mkdir -p "${SCRIPT_DIR}/app"
  # Copy exactly one archive (newest if multiple from prior builds) so cp never treats dest as a directory
  LATEST="$(ls -t masjidconnect-display-*.tar.gz 2>/dev/null | head -1)"
  if [ -z "$LATEST" ]; then
    echo "ERROR: no masjidconnect-display-*.tar.gz found after package"
    exit 1
  fi
  cp "$LATEST" "$APP_ARCHIVE"
  echo "  -> $APP_ARCHIVE"
fi

# Ensure deploy scripts used by the layer are present in rpi-image (archive may be from an older tree).
mkdir -p "${SCRIPT_DIR}/deploy-overlay"
for f in start-kiosk-x11.sh start-kiosk-now.sh xinitrc-kiosk wifi-setup-server.mjs update-from-github.sh install-release.sh; do
  if [ -f "${REPO_ROOT}/deploy/${f}" ]; then
    cp "${REPO_ROOT}/deploy/${f}" "${SCRIPT_DIR}/deploy-overlay/"
  fi
done

mkdir -p "$OUT_DIR"

echo "Building Docker image..."
docker build -f "${SCRIPT_DIR}/Dockerfile" -t "$IMAGE_TAG" .

echo "Running image build (this may take a while)..."
docker run --rm --privileged \
  -v "${SCRIPT_DIR}:/source:ro" \
  -v "${OUT_DIR}:/out" \
  "$IMAGE_TAG" \
  /source /out "$CONFIG"

echo ""
echo "Done. Image: ${OUT_DIR}/masjidconnect-display.img"
ls -la "${OUT_DIR}"/*.img 2>/dev/null || true
