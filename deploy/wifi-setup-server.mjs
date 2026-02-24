#!/usr/bin/env node
/**
 * WiFi setup server for MasjidConnect Display — runs before the kiosk when no
 * internet is detected. Serves a simple GUI to scan and connect to WiFi.
 * Must run as root (or with CAP_NET_ADMIN etc.) to run iw and write
 * /etc/wpa_supplicant. Typically started via sudo from xinitrc-kiosk.
 *
 * Usage: sudo node deploy/wifi-setup-server.mjs
 * Port: 3002 (WIFI_SETUP_PORT)
 */

import { createServer } from 'node:http';
import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.WIFI_SETUP_PORT || '3002', 10);
const HOST = '127.0.0.1';
const FLAG_FILE = '/tmp/masjidconnect-wifi-done';
const WPA_CONF = '/etc/wpa_supplicant/wpa_supplicant-wlan0.conf';

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...opts });
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

/** GET /api/scan — list SSIDs from iw wlan0 scan */
function handleScan() {
  try {
    const out = run('iw dev wlan0 scan 2>/dev/null', { allowFail: true });
    const ssids = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*SSID:\s*(.+)$/);
      if (m) {
        const ssid = m[1].trim();
        if (ssid) ssids.add(ssid);
      }
    }
    return { ssids: [...ssids].sort() };
  } catch (_) {
    return { ssids: [], error: 'Could not scan (is wlan0 present?)' };
  }
}

/** POST /api/connect — write wpa_supplicant and restart */
function handleConnect(body) {
  const { ssid, password = '', country = 'GB' } = body;
  if (!ssid || typeof ssid !== 'string' || !ssid.trim()) {
    return { ok: false, error: 'Please select a network' };
  }
  const pass = typeof password === 'string' ? password : String(password || '');
  try {
    const header = `ctrl_interface=/run/wpa_supplicant\nupdate_config=1\ncountry=${String(country).toUpperCase().slice(0, 2)}\n`;
    const pskOut = spawnSync('wpa_passphrase', [ssid.trim(), '-'], {
      input: pass,
      encoding: 'utf8',
      maxBuffer: 4096,
    });
    if (pskOut.status !== 0) {
      return { ok: false, error: (pskOut.stderr || pskOut.error?.message || 'wpa_passphrase failed').slice(0, 200) };
    }
    mkdirSync('/etc/wpa_supplicant', { recursive: true });
    writeFileSync(WPA_CONF, header + (pskOut.stdout || ''), { mode: 0o600 });
    run('systemctl restart wpa_supplicant@wlan0.service');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e.message || String(e)).slice(0, 200) };
  }
}

/** GET /api/status — do we have internet? */
function handleStatus() {
  try {
    execSync('curl -sf --connect-timeout 3 -o /dev/null https://portal.masjidconnect.co.uk 2>/dev/null', { stdio: 'ignore' });
    return { connected: true };
  } catch (_) {
    try {
      execSync('ping -c 1 -W 2 8.8.8.8 2>/dev/null', { stdio: 'ignore' });
      return { connected: true };
    } catch (_) {
      return { connected: false };
    }
  }
}

/** POST /api/start-display — set flag so xinitrc continues to kiosk */
function handleStartDisplay() {
  try {
    writeFileSync(FLAG_FILE, '1');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MasjidConnect — WiFi setup</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #1a1a2e; color: #eee; padding: 1rem; }
    .card { background: #16213e; border-radius: 12px; padding: 2rem; max-width: 420px; width: 100%; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { margin: 0 0 1.25rem; color: #aaa; font-size: 0.95rem; }
    label { display: block; margin-bottom: 0.35rem; font-size: 0.9rem; }
    select, input[type="password"], input[type="text"] { width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #333; background: #0f0f1a; color: #eee; font-size: 1rem; margin-bottom: 1rem; }
    button { width: 100%; padding: 0.75rem; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
    .primary { background: #4361ee; color: white; }
    .primary:hover { background: #3651d4; }
    .secondary { background: #333; color: #ccc; margin-top: 0.5rem; }
    .secondary:hover { background: #444; }
    .msg { margin-top: 1rem; padding: 0.6rem; border-radius: 8px; font-size: 0.9rem; display: none; }
    .msg.error { background: #5a1a1a; color: #faa; display: block; }
    .msg.success { background: #1a3a2a; color: #afa; display: block; }
    .msg.info { background: #1a2a3a; color: #aaf; display: block; }
    #status { margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connect to WiFi</h1>
    <p id="status">No internet detected. Choose your network to connect.</p>
    <div id="msg" class="msg"></div>
    <label for="ssid">Network name</label>
    <select id="ssid">
      <option value="">— Scan for networks —</option>
    </select>
    <label for="password">Password</label>
    <input type="password" id="password" placeholder="WiFi password" autocomplete="off">
    <label for="country">Country code</label>
    <input type="text" id="country" value="GB" placeholder="e.g. GB" maxlength="2" style="text-transform: uppercase;">
    <button type="button" class="primary" id="scan">Scan networks</button>
    <button type="button" class="primary" id="connect">Connect</button>
    <button type="button" class="secondary" id="skip">Skip — start display anyway</button>
  </div>
  <script>
    const msg = document.getElementById('msg');
    const ssidEl = document.getElementById('ssid');
    const passwordEl = document.getElementById('password');
    const countryEl = document.getElementById('country');
    function showMsg(text, type) { msg.textContent = text; msg.className = 'msg ' + (type || 'info'); msg.style.display = 'block'; }
    function clearMsg() { msg.className = 'msg'; msg.style.display = 'none'; }
    document.getElementById('scan').onclick = async () => {
      clearMsg();
      try {
        const r = await fetch('/api/scan');
        const d = await r.json();
        ssidEl.innerHTML = '<option value="">— Select network —</option>' + (d.ssids || []).map(s => '<option value="' + s.replace(/"/g, '&quot;') + '">' + s.replace(/</g, '&lt;') + '</option>').join('');
        showMsg(d.ssids && d.ssids.length ? 'Found ' + d.ssids.length + ' network(s).' : (d.error || 'No networks found.'), d.error ? 'error' : 'success');
      } catch (e) { showMsg('Scan failed: ' + e.message, 'error'); }
    };
    document.getElementById('connect').onclick = async () => {
      const ssid = ssidEl.value.trim();
      const password = passwordEl.value;
      const country = (countryEl.value || 'GB').toUpperCase().slice(0, 2);
      if (!ssid) { showMsg('Please select a network (or scan first).', 'error'); return; }
      clearMsg();
      showMsg('Connecting…', 'info');
      try {
        const r = await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssid, password, country }) });
        const d = await r.json();
        if (d.ok) {
          showMsg('Connecting… Checking for internet.', 'info');
          for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const s = await fetch('/api/status').then(r => r.json());
            if (s.connected) { showMsg('Connected! Click "Start display" below.', 'success'); return; }
          }
          showMsg('Connection may still be in progress. Click "Start display" to continue.', 'info');
        } else { showMsg(d.error || 'Connection failed.', 'error'); }
      } catch (e) { showMsg('Request failed: ' + e.message, 'error'); }
    };
    document.getElementById('skip').onclick = async () => {
      try {
        await fetch('/api/start-display', { method: 'POST' });
        window.close();
        document.getElementById('msg').textContent = 'Starting display… If nothing happens, press Alt+F4 to close this window.';
      } catch (e) {
        showMsg('Could not continue: ' + e.message, 'error');
      }
    };
    async function tryStartDisplay() {
      const s = await fetch('/api/status').then(r => r.json());
      if (s.connected) {
        document.getElementById('status').textContent = 'Internet detected. You can start the display.';
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = 'Start display';
        btn.onclick = async () => { await fetch('/api/start-display', { method: 'POST' }); window.close(); showMsg('If the display does not start, press Alt+F4 to close this window.', 'info'); };
        document.querySelector('.card').appendChild(btn);
      }
    }
    tryStartDisplay();
    document.getElementById('scan').click();
  </script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '/index.html') {
    send(res, 200, HTML, 'text/html; charset=utf-8');
    return;
  }

  if (pathname === '/api/scan' && req.method === 'GET') {
    send(res, 200, handleScan());
    return;
  }

  if (pathname === '/api/connect' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      send(res, 200, handleConnect(body));
    } catch (e) {
      send(res, 400, { ok: false, error: 'Invalid JSON' });
    }
    return;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    send(res, 200, handleStatus());
    return;
  }

  if (pathname === '/api/start-display' && (req.method === 'GET' || req.method === 'POST')) {
    send(res, 200, handleStartDisplay());
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  process.stderr.write(`[MasjidConnect] WiFi setup server at http://${HOST}:${PORT}\n`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
