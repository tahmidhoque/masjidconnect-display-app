#!/usr/bin/env bash
# Entrypoint for Docker image: run rpi-image-gen build and copy .img to output dir.
# Usage: entrypoint.sh <source-dir> <out-dir> <config-name>
# Example: entrypoint.sh /source /out masjidconnect-pi3.yaml

set -euo pipefail

SOURCE_DIR="${1:?Usage: entrypoint.sh <source-dir> <out-dir> <config-name>}"
OUT_DIR="${2:?}"
CONFIG_NAME="${3:?}"

CONFIG_PATH="${SOURCE_DIR}/config/${CONFIG_NAME}"
if [ ! -f "$CONFIG_PATH" ]; then
  echo "Config not found: $CONFIG_PATH"
  exit 1
fi

# Ensure Debian keyring exists for chroot (mmdebstrap)
mkdir -p work/keys
if [ ! -f work/keys/debian-archive-keyring.gpg ] && [ -f /usr/share/keyrings/debian-archive-keyring.gpg ]; then
  cp /usr/share/keyrings/debian-archive-keyring.gpg work/keys/
fi

echo "Building image: -S $SOURCE_DIR -c $CONFIG_PATH"
# Disable SBOM generation to avoid syft/curl SSL errors in Docker build env (IGconf_sbom_enable=n).
./rpi-image-gen build -S "$SOURCE_DIR" -c "$CONFIG_PATH" -- IGconf_sbom_enable=n

IMG=$(find work -name "*.img" -type f | head -1)
if [ -z "$IMG" ]; then
  echo "No .img file found under work/"
  find work -type f 2>/dev/null || true
  exit 1
fi

mkdir -p "$OUT_DIR"
cp "$IMG" "$OUT_DIR/"
echo "Image copied to $OUT_DIR/$(basename "$IMG")"
