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
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const DIST_DIR = resolve(APP_DIR, 'dist');
const STATUS_FILE = join(APP_DIR, '.update-status.json');
const UPDATE_SCRIPT = join(__dirname, 'update-from-github.sh');
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
        const child = spawn('sudo', [UPDATE_SCRIPT], {
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
