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
DEBUG_LOG="/tmp/masjidconnect-update-debug.log"
GITHUB_OWNER="tahmidhoque"
GITHUB_REPO="masjidconnect-display-app"
COUNTDOWN_SECONDS=30

debug() { echo "$(date -Iseconds) $*" >> "$DEBUG_LOG" 2>/dev/null || true; }

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

# Fetch releases and pick the one with highest semver (so v1.0.2 is used over v1.0.1).
# /releases/latest only returns the most recently **published** full release and excludes pre-releases.
write_status "checking" "Checking for update…"

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
resp_file="${tmp_dir}/releases.json"
curl -sS -f -L -o "$resp_file" "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=30" 2>/dev/null || {
  write_status "no_update" "Up to date"
  exit 0
}
[ -s "$resp_file" ] || {
  write_status "no_update" "Up to date"
  exit 0
}

# Parse releases: find those with tarball asset, sort by semver desc, output first tag + asset URL
parsed=$(RESP_FILE="$resp_file" node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync(process.env.RESP_FILE, 'utf8'));
if (!Array.isArray(j) || j.length === 0) process.exit(0);
const withAsset = j.filter(r => {
  const tag = (r.tag_name || '').trim();
  if (!tag) return false;
  const a = (r.assets || []).find(x => x.name && x.name.startsWith('masjidconnect-display-') && x.name.endsWith('.tar.gz'));
  return !!a;
}).map(r => {
  const tag = (r.tag_name || '').replace(/^v/, '');
  const a = (r.assets || []).find(x => x.name && x.name.startsWith('masjidconnect-display-') && x.name.endsWith('.tar.gz'));
  return { tag, version: tag, url: a ? a.browser_download_url : '' };
}).filter(x => x.url);

const semver = (v) => {
  const m = (v + '').match(/^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(.+))?$/);
  if (!m) return [0,0,0,0];
  return [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10), (m[4] || '').localeCompare('')];
};
withAsset.sort((a, b) => {
  const va = semver(a.version), vb = semver(b.version);
  for (let i = 0; i < 4; i++) {
    if (va[i] !== vb[i]) return (typeof vb[i] === 'number' ? vb[i] - va[i] : va[i] - vb[i]);
  }
  return 0;
});
const best = withAsset[0];
if (best) {
  console.log(best.tag);
  console.log(best.url);
}
" 2>/dev/null) || true
latest_tag=$(echo "$parsed" | sed -n '1p')
asset_url=$(echo "$parsed" | sed -n '2p')

if [ -z "$latest_tag" ] || [ -z "$asset_url" ]; then
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
# Tarball may not have +x on deploy scripts; set so kiosk and xinit can run them
chmod +x "${APP_DIR}/deploy/"*.sh "${APP_DIR}/deploy/xinitrc-kiosk" 2>/dev/null || true

# No server restart: the Node process serves from disk, so after replacing dist/ the next
# request (the frontend reload at countdown 0) gets the new app. Restarting caused a double
# reload (connection drop + intentional reload) and the first load sometimes showed old version.
restart_at=$(($(date +%s) * 1000 + COUNTDOWN_SECONDS * 1000))
write_status "countdown" "Restarting in ${COUNTDOWN_SECONDS}s" "$restart_at"

sleep "$COUNTDOWN_SECONDS"

write_status "done" ""
rm -f "$STATUS_FILE"
exit 0
