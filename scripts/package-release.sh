#!/usr/bin/env bash
# =============================================================================
# MasjidConnect Display — Package Release
#
# Builds the Vite production bundle and packages it into a tar.gz archive
# ready for deployment to Raspberry Pi.
#
# Usage:
#   bash scripts/package-release.sh          # build + package
#   bash scripts/package-release.sh --skip-build  # package only (dist/ must exist)
#
# Output:
#   masjidconnect-display-<version>.tar.gz in the project root
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

VERSION=$(node -p "require('./package.json').version")
ARCHIVE_NAME="masjidconnect-display-${VERSION}.tar.gz"
SKIP_BUILD=false

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

echo "============================================"
echo "  MasjidConnect Display — Package Release"
echo "  Version: ${VERSION}"
echo "============================================"
echo ""

# --- Build -------------------------------------------------------------------

if [ "$SKIP_BUILD" = false ]; then
  echo "[1/3] Building production bundle..."
  npm run build
  echo ""
else
  echo "[1/3] Skipping build (--skip-build)"
  if [ ! -d "dist" ]; then
    echo "ERROR: dist/ directory not found. Run 'npm run build' first."
    exit 1
  fi
  echo ""
fi

# --- Version metadata --------------------------------------------------------

echo "[2/3] Writing version metadata..."

GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NODE_VERSION=$(node -v)
# Capture build-time env so CI and humans can verify what was baked in (Vite replaces import.meta.env at build time)
BAKED_API_URL="${VITE_API_URL:-}"
BAKED_REALTIME_URL="${VITE_REALTIME_URL:-}"

cat > dist/version.json << EOF
{
  "version": "${VERSION}",
  "gitHash": "${GIT_HASH}",
  "gitBranch": "${GIT_BRANCH}",
  "buildTime": "${BUILD_TIME}",
  "nodeVersion": "${NODE_VERSION}",
  "buildEnv": {
    "apiUrl": "${BAKED_API_URL}",
    "realtimeUrl": "${BAKED_REALTIME_URL}"
  }
}
EOF

echo "  version.json written to dist/"
echo ""

# --- Package -----------------------------------------------------------------

echo "[3/3] Creating archive: ${ARCHIVE_NAME}"

tar -czf "${ARCHIVE_NAME}" \
  dist/ \
  deploy/ \
  scripts/optimize-raspberry-pi.sh \
  scripts/install-fonts.sh \
  package.json

ARCHIVE_SIZE=$(wc -c < "${ARCHIVE_NAME}" | tr -d ' ')
ARCHIVE_SIZE_MB=$(echo "scale=2; ${ARCHIVE_SIZE} / 1048576" | bc 2>/dev/null || echo "?")

echo ""
echo "============================================"
echo "  Package complete!"
echo "============================================"
echo ""
echo "  Archive:  ${ARCHIVE_NAME}"
echo "  Size:     ${ARCHIVE_SIZE_MB} MB"
echo "  Version:  ${VERSION}"
echo "  Commit:   ${GIT_HASH}"
echo ""
echo "  Deploy to Raspberry Pi:"
echo "    scp ${ARCHIVE_NAME} pi@<rpi-ip>:~/"
echo "    ssh pi@<rpi-ip>"
echo "    sudo mkdir -p /opt/masjidconnect"
echo "    sudo tar -xzf ${ARCHIVE_NAME} -C /opt/masjidconnect"
echo "    sudo /opt/masjidconnect/deploy/install.sh"
echo ""
