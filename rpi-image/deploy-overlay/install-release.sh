#!/usr/bin/env bash
# =============================================================================
# MasjidConnect Display — Install or rollback to a specific release from SSH
#
# Lets you install a given release version (or list available ones) without
# using the admin-portal Force update. Useful for rollback and testing.
#
# Usage (on the Pi):
#   sudo /opt/masjidconnect/deploy/install-release.sh              # list releases
#   sudo /opt/masjidconnect/deploy/install-release.sh 1.0.1        # install v1.0.1
#   sudo /opt/masjidconnect/deploy/install-release.sh v1.0.2       # install v1.0.2
#   sudo /opt/masjidconnect/deploy/install-release.sh latest        # install latest (highest semver)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
GITHUB_OWNER="tahmidhoque"
GITHUB_REPO="masjidconnect-display-app"
API_BASE="https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}"
# Optional: set GITHUB_TOKEN for private repo or to avoid rate limits (e.g. export GITHUB_TOKEN=ghp_xxx)
CURL_AUTH=()
[ -n "${GITHUB_TOKEN:-}" ] && CURL_AUTH=(-H "Authorization: Bearer ${GITHUB_TOKEN}")

# Normalise version: 1.0.1 -> v1.0.1 for GitHub tag
normalise_tag() {
  local v="$1"
  v="${v#v}"
  echo "v${v}"
}

# List releases (with tarball), sorted by semver desc
list_releases() {
  local resp_file="$1"
  curl -sS -f -L -o "$resp_file" "${CURL_AUTH[@]}" "${API_BASE}/releases?per_page=30" 2>/dev/null || return 1
  [ -s "$resp_file" ] || return 1
  RESP_FILE="$resp_file" node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync(process.env.RESP_FILE, 'utf8'));
if (!Array.isArray(j) || j.length === 0) process.exit(1);
const withAsset = j.filter(r => {
  const tag = (r.tag_name || '').trim();
  if (!tag) return false;
  const a = (r.assets || []).find(x => x.name && x.name.startsWith('masjidconnect-display-') && x.name.endsWith('.tar.gz'));
  return !!a;
}).map(r => {
  const tag = (r.tag_name || '').replace(/^v/, '');
  const a = (r.assets || []).find(x => x.name && x.name.startsWith('masjidconnect-display-') && x.name.endsWith('.tar.gz'));
  return { tag: r.tag_name, version: tag, url: a ? a.browser_download_url : '' };
}).filter(x => x.url);

const semver = (v) => {
  const m = (v + '').match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
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
withAsset.forEach((r, i) => console.log((i+1) + '. ' + r.tag + '  ' + (r.url ? '(has tarball)' : '')));
" 2>/dev/null || return 1
}

# Get asset URL for a given tag (e.g. v1.0.1). Returns empty on failure or no tarball.
# Uses curl without -f so we get response body on 404 and can show a clear error.
get_release_asset_url() {
  local tag="$1"
  local resp_file="$2"
  local code
  code=$(curl -sS -L -o "$resp_file" -w "%{http_code}" "${CURL_AUTH[@]}" "${API_BASE}/releases/tags/${tag}" 2>/dev/null) || true
  if [ "$code" != "200" ] || [ ! -s "$resp_file" ]; then
    return 1
  fi
  node -e "
const fs = require('fs');
const path = process.argv[1];
if (!path) process.exit(1);
let j;
try { j = JSON.parse(fs.readFileSync(path, 'utf8')); } catch (e) { process.exit(1); }
if (j.message === 'Not Found') process.exit(1);
const assets = j.assets || [];
const a = assets.find(x => x.name && x.name.endsWith('.tar.gz') && !x.name.includes('sha256') && (x.name.includes('masjidconnect-display') || x.name.includes('masjidconnect')))
  || assets.find(x => x.name && x.name.endsWith('.tar.gz') && !x.name.includes('sha256'));
if (a && a.browser_download_url) console.log(a.browser_download_url);
" "$resp_file" 2>/dev/null
}

main() {
  local version="${1:-}"
  local tag=""
  local asset_url=""

  if [ -z "$version" ]; then
    echo "Available releases (install with: sudo $0 <version>):"
    echo ""
    tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" EXIT
    if ! list_releases "${tmp_dir}/releases.json"; then
      echo "Failed to fetch releases. Check network and repo ${GITHUB_OWNER}/${GITHUB_REPO}." >&2
      exit 1
    fi
    echo ""
    echo "Examples:  sudo $0 1.0.1   |   sudo $0 latest"
    exit 0
  fi

  tmp_dir=$(mktemp -d)
  trap "rm -rf '$tmp_dir'" EXIT
  resp_file="${tmp_dir}/release.json"

  if [ "$version" = "latest" ]; then
    echo "Fetching latest release..."
    curl -sS -f -L -o "${tmp_dir}/releases.json" "${API_BASE}/releases?per_page=30" 2>/dev/null || { echo "Failed to fetch releases." >&2; exit 1; }
    [ -s "${tmp_dir}/releases.json" ] || { echo "No releases." >&2; exit 1; }
    tag=$(RESP_FILE="${tmp_dir}/releases.json" node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync(process.env.RESP_FILE, 'utf8'));
const withAsset = j.filter(r => (r.tag_name || '').trim() && (r.assets || []).find(x => x.name && x.name.startsWith('masjidconnect-display-') && x.name.endsWith('.tar.gz')))
  .map(r => ({ tag: r.tag_name, v: (r.tag_name || '').replace(/^v/, '') }));
const semver = (v) => { const m = (v+'').match(/^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(.+))?$/); if (!m) return [0,0,0,0]; return [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10)]; };
withAsset.sort((a,b) => { const va = semver(a.v), vb = semver(b.v); for (let i=0;i<3;i++) if (va[i]!==vb[i]) return vb[i]-va[i]; return 0; });
if (withAsset[0]) console.log(withAsset[0].tag);
" 2>/dev/null)
    [ -n "$tag" ] || { echo "No release with tarball found." >&2; exit 1; }
  else
    tag=$(normalise_tag "$version")
  fi

  echo "Release: $tag"
  asset_url=$(get_release_asset_url "$tag" "$resp_file") || true
  if [ -z "$asset_url" ]; then
    echo "Release $tag not found or has no .tar.gz asset." >&2
    echo "Check: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${tag}" >&2
    if [ -s "$resp_file" ]; then
      echo "Response preview (first 400 chars):" >&2
      head -c 400 "$resp_file" | tr '\n' ' ' | head -c 400; echo "" >&2
      node -e "
const fs = require('fs');
const path = process.argv[1];
if (!path) { console.error('(no file path)'); process.exit(1); }
const s = fs.readFileSync(path, 'utf8');
try {
  const j = JSON.parse(s);
  const assets = j.assets || [];
  if (assets.length) {
    console.error('Assets on this release:');
    assets.forEach(a => console.error('  -', a.name || a.url));
  } else {
    console.error('(no assets array or empty)');
  }
} catch (e) {
  if (s.trim().startsWith('<')) console.error('(response is HTML – repo private, rate limit, or login required)');
  else console.error('(response was not valid JSON)');
  console.error('Tip: For private repo or rate limits, run: export GITHUB_TOKEN=ghp_xxx');
}
" "$resp_file" 2>&1
    fi
    exit 1
  fi

  echo "Downloading..."
  tar_path="${tmp_dir}/masjidconnect-display.tar.gz"
  curl -sS -f -L -o "$tar_path" "$asset_url" || { echo "Download failed." >&2; exit 1; }

  echo "Extracting..."
  extract_dir="${tmp_dir}/extract"
  mkdir -p "$extract_dir"
  tar -xzf "$tar_path" -C "$extract_dir"

  src_root="$extract_dir"
  [ -d "${extract_dir}/dist" ] || src_root=$(find "$extract_dir" -maxdepth 2 -type d -name dist 2>/dev/null | head -1 | xargs dirname)
  if [ -z "$src_root" ] || [ ! -d "${src_root}/dist" ]; then
    echo "Archive has no dist/." >&2
    exit 1
  fi

  echo "Installing to ${APP_DIR}..."
  cp -a "${APP_DIR}/dist" "${tmp_dir}/dist.bak" 2>/dev/null || true
  cp -a "${APP_DIR}/deploy" "${tmp_dir}/deploy.bak" 2>/dev/null || true
  rm -rf "${APP_DIR}/dist" "${APP_DIR}/deploy"
  cp -r "${src_root}/dist" "${src_root}/deploy" "${APP_DIR}/"
  [ -f "${src_root}/package.json" ] && cp "${src_root}/package.json" "${APP_DIR}/"
  chown -R "${SUDO_UID:-1000}:${SUDO_GID:-1000}" "${APP_DIR}/dist" "${APP_DIR}/deploy" "${APP_DIR}/package.json" 2>/dev/null || true
  chmod +x "${APP_DIR}/deploy/"*.sh "${APP_DIR}/deploy/xinitrc-kiosk" 2>/dev/null || true

  echo "Restarting masjidconnect-display..."
  systemctl restart masjidconnect-display.service 2>/dev/null || true

  echo "Done. Installed $tag. Reload the display in the browser or wait for kiosk to refresh."
}

main "$@"
