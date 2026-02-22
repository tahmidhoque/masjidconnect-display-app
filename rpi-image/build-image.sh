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

# Ensure app archive exists
if [ ! -f "$APP_ARCHIVE" ]; then
  if [ "$SKIP_PACKAGE" = true ]; then
    echo "ERROR: $APP_ARCHIVE not found. Run without --skip-package first."
    exit 1
  fi
  echo "Building app archive..."
  npm run package
  mkdir -p "${SCRIPT_DIR}/app"
  cp masjidconnect-display-*.tar.gz "$APP_ARCHIVE"
  echo "  -> $APP_ARCHIVE"
else
  echo "Using existing app archive: $APP_ARCHIVE"
fi

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
