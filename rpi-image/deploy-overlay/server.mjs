#!/usr/bin/env node

/**
 * Lightweight static server for the MasjidConnect display app.
 *
 * Serves the Vite production build (dist/) with:
 *  - SPA fallback (all routes -> index.html)
 *  - Cache headers for hashed assets
 *  - Health check endpoint at /health
 *  - Internal (localhost-only) endpoints: POST /internal/trigger-update, GET /internal/update-status
 *
 * Usage:
 *   PORT=3001 node deploy/server.mjs
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const DIST_DIR = resolve(APP_DIR, 'dist');
const STATUS_FILE = join(APP_DIR, '.update-status.json');
const UPDATE_SCRIPT = join(__dirname, 'update-from-github.sh');
const WIFI_HOTSPOT_ACTIVE_MARKER = '/tmp/masjidconnect-hotspot-active';
const WIFI_HOTSPOT_SCAN_CACHE = '/tmp/masjidconnect-wifi-scan.json';
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

/** True if the request is from localhost (only these get internal routes). */
function isLocalhost(socket) {
  const addr = socket?.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

// MIME type map
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};

// =========================================================================
// WiFi management helpers (NetworkManager via nmcli)
// =========================================================================

const SYSTEM_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

function nmcli(args, opts = {}) {
  // server.mjs runs as the pi user (UID 1000). Bare nmcli is denied by polkit for
  // any operation that modifies network state. The sudoers rule grants pi NOPASSWD
  // access to /usr/bin/nmcli so we always call it via sudo with the full path.
  //
  // Timeout strategy:
  //   - Read-only queries (status, scan, list): 15 seconds
  //   - Connection activation (dev wifi connect, con up): 90 seconds
  //     WPA2 auth + DHCP can take 30-60s on a congested network; 15s causes
  //     ETIMEDOUT (spawnsync /bin/sh ETIMEDOUT) before the handshake completes.
  const isConnectOp = /\b(dev wifi connect|con(nection)? up)\b/.test(args);
  const timeout = opts.timeout ?? (isConnectOp ? 90_000 : 15_000);
  try {
    return execSync(`sudo /usr/bin/nmcli ${args}`, {
      encoding: 'utf8',
      timeout,
      env: { ...process.env, PATH: SYSTEM_PATH },
      ...opts,
    }).trim();
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

/**
 * Returns current WiFi connection status: state, SSID, signal, IP, frequency.
 */
function getWifiStatus() {
  const hotspotActive = existsSync(WIFI_HOTSPOT_ACTIVE_MARKER);

  // Get WiFi device state
  const devLine = nmcli('-t -f DEVICE,TYPE,STATE dev', { allowFail: true });
  let wifiDevice = '';
  let wifiState = 'unavailable';
  for (const line of devLine.split('\n')) {
    const [dev, type, state] = line.split(':');
    if (type === 'wifi') {
      wifiDevice = dev;
      wifiState = state || 'unavailable';
      break;
    }
  }

  if (!wifiDevice) {
    return { state: 'no-adapter', ssid: '', signal: 0, ip: '', frequency: '', security: '', hotspotActive };
  }

  // Get active WiFi connection details
  const active = nmcli(`-t -f NAME,TYPE,DEVICE con show --active`, { allowFail: true });
  let activeConName = '';
  for (const line of active.split('\n')) {
    const parts = line.split(':');
    if (parts[1] === '802-11-wireless' && parts[2] === wifiDevice) {
      activeConName = parts[0];
      break;
    }
  }

  if (!activeConName || wifiState !== 'connected') {
    return { state: wifiState, ssid: '', signal: 0, ip: '', frequency: '', security: '', hotspotActive };
  }

  // Get detailed info about the active connection
  const details = nmcli(`-t -f GENERAL.CONNECTION,WIFI.SSID,WIFI.SIGNAL,WIFI.FREQ,WIFI.SECURITY,IP4.ADDRESS dev show ${wifiDevice}`, { allowFail: true });
  const info = { state: 'connected', ssid: '', signal: 0, ip: '', frequency: '', security: '', hotspotActive };

  for (const line of details.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key === 'WIFI.SSID' || key === 'GENERAL.CONNECTION') info.ssid = info.ssid || val;
    if (key === 'WIFI.SIGNAL') info.signal = parseInt(val, 10) || 0;
    if (key === 'WIFI.FREQ') info.frequency = val;
    if (key === 'WIFI.SECURITY') info.security = val;
    if (key === 'IP4.ADDRESS') info.ip = info.ip || val.replace(/\/\d+$/, '');
  }

  return info;
}

/**
 * Parse raw `nmcli -t -f SSID,SIGNAL,SECURITY,FREQ dev wifi list` output into
 * a deduplicated array sorted by signal strength.
 */
function parseNmcliWifiList(raw) {
  const seen = new Set();
  const networks = [];
  // Private-use sentinel so SSID colons (escaped as \:) never collide with field separators.
  const NMCLI_COLON_SENTINEL = '\uFFFE';
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    // nmcli -t uses : as separator; SSIDs with colons are escaped with \\:
    const parts = line
      .replace(/\\:/g, NMCLI_COLON_SENTINEL)
      .split(':')
      .map(p => p.replaceAll(NMCLI_COLON_SENTINEL, ':'));
    const ssid = (parts[0] || '').trim();
    if (!ssid || seen.has(ssid)) continue;
    seen.add(ssid);
    networks.push({
      ssid,
      signal: parseInt(parts[1], 10) || 0,
      security: (parts[2] || '').trim(),
      frequency: (parts[3] || '').trim(),
    });
  }
  networks.sort((a, b) => b.signal - a.signal);
  return networks;
}

/**
 * Scan for available WiFi networks. Returns array of { ssid, signal, security, frequency }.
 *
 * When the hotspot AP is active, wlan0 is in AP mode and cannot perform station-mode
 * scans. We return the pre-AP scan cache written by wifi-hotspot.sh (do_scan) instead.
 * When the AP is not active, we trigger up to two NM rescans with a short wait between
 * them so 2.4 GHz and 5 GHz networks both have time to appear in the NM cache.
 */
function getWifiScan() {
  // AP active: wlan0 is occupied in AP mode — fall back to the pre-AP scan cache
  // written by wifi-hotspot.sh before the AP was started.
  if (existsSync(WIFI_HOTSPOT_ACTIVE_MARKER) && existsSync(WIFI_HOTSPOT_SCAN_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(WIFI_HOTSPOT_SCAN_CACHE, 'utf8'));
      if (Array.isArray(cached.ssids) && cached.ssids.length > 0) {
        const networks = cached.ssids.map(n => ({
          ssid: n.ssid || '',
          signal: typeof n.signal === 'number' ? n.signal : 0,
          security: n.security || '',
          frequency: '',
        })).filter(n => n.ssid);
        networks.sort((a, b) => b.signal - a.signal);
        return { networks, source: 'cache' };
      }
    } catch {
      // Cache corrupt or unreadable — fall through to live scan attempt
    }
  }

  // Station mode: trigger a fresh NM scan. A single rescan often misses networks
  // (especially 2.4 GHz) on the first pass, so we rescan twice with a short gap.
  nmcli('dev wifi rescan', { allowFail: true });
  // Short synchronous wait — execSync blocks, so we use a small sleep command
  // rather than importing a sleep dependency.
  try { execSync('sleep 2', { timeout: 5_000 }); } catch { /* ignore */ }
  nmcli('dev wifi rescan', { allowFail: true });

  const raw = nmcli('-t -f SSID,SIGNAL,SECURITY,FREQ dev wifi list', { allowFail: true });
  const networks = parseNmcliWifiList(raw);
  return { networks, source: 'live' };
}

/**
 * Connect to a WiFi network using nmcli.
 */
function connectWifi(ssid, password) {
  if (!ssid || typeof ssid !== 'string') {
    return { success: false, error: 'SSID is required' };
  }

  try {
    // Delete any existing profile with this SSID to avoid duplicates
    const existing = nmcli('-t -f NAME,TYPE con show', { allowFail: true });
    for (const line of existing.split('\n')) {
      const [name, type] = line.split(':');
      if (type === '802-11-wireless' && name === ssid) {
        nmcli(`con delete "${name}"`, { allowFail: true });
      }
    }

    if (password && password.length > 0) {
      nmcli(`dev wifi connect "${ssid}" password "${password}" ifname wlan0`);
    } else {
      nmcli(`dev wifi connect "${ssid}" ifname wlan0`);
    }

    return { success: true, message: `Connected to ${ssid}` };
  } catch (e) {
    return { success: false, error: `Failed to connect: ${(e.message || String(e)).slice(0, 200)}` };
  }
}

/**
 * Forget (delete) a saved WiFi connection profile.
 */
function forgetWifi(name) {
  if (!name) return { success: false, error: 'Connection name is required' };
  try {
    nmcli(`con delete "${name}"`);
    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to forget: ${(e.message || String(e)).slice(0, 200)}` };
  }
}

/**
 * List saved WiFi connection profiles.
 */
function getSavedWifi() {
  const raw = nmcli('-t -f NAME,TYPE,AUTOCONNECT con show', { allowFail: true });
  const profiles = [];
  for (const line of raw.split('\n')) {
    const [name, type, autoconnect] = line.split(':');
    if (type === '802-11-wireless') {
      profiles.push({ name, autoconnect: autoconnect === 'yes' });
    }
  }
  return { profiles };
}

/** Serve a static file from dist/ */
function serveFile(res, filePath) {
  if (!existsSync(filePath)) return false;

  const ext = extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  const body = readFileSync(filePath);

  const headers = { 'Content-Type': contentType };

  // Cache hashed assets for 1 year; everything else for 5 minutes
  if (filePath.includes('/assets/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache';
  } else {
    headers['Cache-Control'] = 'public, max-age=300';
  }

  res.writeHead(200, headers);
  res.end(body);
  return true;
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // Internal routes (localhost-only) for self-update
  if (isLocalhost(req.socket)) {
    if (pathname === '/internal/trigger-update' && req.method === 'POST') {
      if (!existsSync(UPDATE_SCRIPT)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Update script not found' }));
        return;
      }
      try {
        // Write "checking" immediately so the first poll never sees a stale "no_update" from a previous run
        writeFileSync(STATUS_FILE, JSON.stringify({ phase: 'checking', message: 'Checking for update…' }), 'utf8');
        // Run with bash explicitly so the script runs even if execute bit is missing after tarball extract
        const child = spawn('sudo', ['bash', UPDATE_SCRIPT], {
          detached: true,
          stdio: 'ignore',
          cwd: APP_DIR,
        });
        child.unref();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(err.message) }));
        return;
      }
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Update started' }));
      return;
    }
    if (pathname === '/internal/wifi-recovery-status' && req.method === 'GET') {
      const hotspotActive = existsSync(WIFI_HOTSPOT_ACTIVE_MARKER);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hotspotActive }));
      return;
    }
    if (pathname === '/internal/update-status' && req.method === 'GET') {
      if (!existsSync(STATUS_FILE)) {
        res.writeHead(204);
        res.end();
        return;
      }
      try {
        const raw = readFileSync(STATUS_FILE, 'utf8');
        const data = JSON.parse(raw);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch {
        res.writeHead(204);
        res.end();
      }
      return;
    }
    // =========================================================================
    // WiFi management endpoints (NetworkManager via nmcli)
    // =========================================================================

    if (pathname === '/internal/wifi/status' && req.method === 'GET') {
      try {
        const result = getWifiStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (pathname === '/internal/wifi/scan' && req.method === 'GET') {
      try {
        const networks = getWifiScan();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(networks));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, networks: [] }));
      }
      return;
    }

    if (pathname === '/internal/wifi/connect' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { ssid, password } = JSON.parse(body || '{}');
          const result = connectWifi(ssid, password);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === '/internal/wifi/forget' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { name } = JSON.parse(body || '{}');
          const result = forgetWifi(name);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (pathname === '/internal/wifi/saved' && req.method === 'GET') {
      try {
        const profiles = getSavedWifi();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(profiles));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, profiles: [] }));
      }
      return;
    }

    // Debug page: open in same origin (e.g. from Pi) to see last JS error from localStorage
    if (pathname === '/internal/debug' && req.method === 'GET') {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Display debug</title></head><body style="margin:0;padding:1rem;font-family:monospace;background:#0A2647;color:#eee;white-space:pre-wrap;word-break:break-all;">Loading...</body><script>
try {
  var msg = localStorage.getItem('masjid_last_error');
  document.body.textContent = msg || 'No last error stored. Open the app first; after a crash, reload and visit this page again.';
} catch (e) {
  document.body.textContent = 'Error reading storage: ' + e.message;
}
</script></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
  }

  // Try to serve the exact file
  const filePath = join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
  if (serveFile(res, filePath)) return;

  // SPA fallback: serve index.html for non-file routes
  const indexPath = join(DIST_DIR, 'index.html');
  if (serveFile(res, indexPath)) return;

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`[MasjidConnect] Display server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
