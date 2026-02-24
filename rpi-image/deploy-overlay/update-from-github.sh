#!/usr/bin/env bash
# =============================================================================
# MasjidConnect Display — Self-update from GitHub release
#
# Downloads the latest release tarball from GitHub, extracts dist/ and deploy/,
# then restarts the app. Writes status to .update-status.json for the UI.
# Phases: checking -> no_update | downloading -> installing -> countdown -> done
# Run with sudo so systemctl restart works. Invoked by Node server on FORCE_UPDATE.
#
# Usage: sudo /opt/masjidconnect/deploy/update-from-github.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATUS_FILE="${APP_DIR}/.update-status.json"
GITHUB_OWNER="masjidSolutions"
GITHUB_REPO="masjidconnect-display-app"
COUNTDOWN_SECONDS=30

write_status() {
  local phase="$1"
  local message="${2:-}"
  local restart_at="${3:-}"
  local payload
  if [ -n "$restart_at" ]; then
    payload=$(printf '{"phase":"%s","message":"%s","restartAt":%s}' "$phase" "$message" "$restart_at")
  else
    payload=$(printf '{"phase":"%s","message":"%s"}' "$phase" "$message")
  fi
  echo "$payload" > "$STATUS_FILE"
  chown "${SUDO_UID:-1000}:${SUDO_GID:-1000}" "$STATUS_FILE" 2>/dev/null || true
}

# Get current version from dist/version.json or package.json
get_current_version() {
  local v=""
  if [ -f "${APP_DIR}/dist/version.json" ]; then
    v=$(node -p "try { require('${APP_DIR}/dist/version.json').version } catch(e) { '' }" 2>/dev/null) || true
  fi
  if [ -z "$v" ] && [ -f "${APP_DIR}/package.json" ]; then
    v=$(node -p "require('${APP_DIR}/package.json').version" 2>/dev/null) || true
  fi
  echo "$v"
}

# Compare two semver strings: true if $2 > $1
version_newer() {
  local current="$1"
  local latest="$2"
  current="${current#v}"
  latest="${latest#v}"
  [ "$current" = "$latest" ] && return 1
  [ "$(printf '%s\n%s' "$current" "$latest" | sort -V | tail -1)" = "$latest" ]
}

write_status "checking" "Checking for update…"

current_version=$(get_current_version)
if [ -z "$current_version" ]; then
  write_status "no_update" "Up to date"
  exit 0
fi

# Fetch latest release from GitHub API
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
resp_file="${tmp_dir}/release.json"
curl -sS -f -L -o "$resp_file" "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest" 2>/dev/null || {
  write_status "no_update" "Up to date"
  exit 0
}
[ -s "$resp_file" ] || {
  write_status "no_update" "Up to date"
  exit 0
}

# Parse tag_name and tarball asset URL
parsed=$(RESP_FILE="$resp_file" node -e "
const j = JSON.parse(require('fs').readFileSync(process.env.RESP_FILE, 'utf8'));
console.log(j.tag_name || '');
const a = (j.assets || []).find(x => x.name && x.name.startsWith('masjidconnect-display-') && x.name.endsWith('.tar.gz'));
if (a) console.log(a.browser_download_url);
" 2>/dev/null) || true
latest_tag=$(echo "$parsed" | sed -n '1p')
asset_url=$(echo "$parsed" | sed -n '2p')
latest_version="${latest_tag#v}"

if [ -z "$latest_tag" ] || ! version_newer "$current_version" "$latest_version"; then
  write_status "no_update" "Up to date"
  exit 0
fi

if [ -z "$asset_url" ]; then
  write_status "no_update" "Up to date"
  exit 0
fi

write_status "downloading" "Downloading update…"

tar_path="${tmp_dir}/masjidconnect-display.tar.gz"

curl -sS -f -L -o "$tar_path" "$asset_url" 2>/dev/null || {
  write_status "no_update" "Up to date"
  exit 0
}

write_status "installing" "Installing…"

extract_dir="${tmp_dir}/extract"
mkdir -p "$extract_dir"
tar -xzf "$tar_path" -C "$extract_dir"

# Tarball has dist/, deploy/, package.json at top level
src_root="$extract_dir"
[ -d "${extract_dir}/dist" ] || src_root=$(find "$extract_dir" -maxdepth 2 -type d -name dist 2>/dev/null | head -1 | xargs dirname)
if [ -z "$src_root" ] || [ ! -d "${src_root}/dist" ]; then
  write_status "no_update" "Up to date"
  exit 0
fi

# Replace dist/ and deploy/ (and package.json)
cp -a "${APP_DIR}/dist" "${tmp_dir}/dist.bak" 2>/dev/null || true
cp -a "${APP_DIR}/deploy" "${tmp_dir}/deploy.bak" 2>/dev/null || true
rm -rf "${APP_DIR}/dist" "${APP_DIR}/deploy"
cp -r "${src_root}/dist" "${src_root}/deploy" "${APP_DIR}/"
if [ -f "${src_root}/package.json" ]; then
  cp "${src_root}/package.json" "${APP_DIR}/"
fi
chown -R "${SUDO_UID:-1000}:${SUDO_GID:-1000}" "${APP_DIR}/dist" "${APP_DIR}/deploy" "${APP_DIR}/package.json" 2>/dev/null || true

restart_at=$(($(date +%s) * 1000 + COUNTDOWN_SECONDS * 1000))
write_status "countdown" "Restarting in ${COUNTDOWN_SECONDS}s" "$restart_at"

sleep "$COUNTDOWN_SECONDS"

systemctl restart masjidconnect-display.service 2>/dev/null || true
write_status "done" ""

rm -f "$STATUS_FILE"
exit 0
