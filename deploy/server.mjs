#!/usr/bin/env node

/**
 * Lightweight Express static server for the MasjidConnect display app.
 *
 * Serves the Vite production build (dist/) with:
 *  - gzip compression
 *  - SPA fallback (all routes -> index.html)
 *  - Cache headers for hashed assets
 *  - Health check endpoint at /health
 *
 * Usage:
 *   PORT=3001 node deploy/server.mjs
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'dist');
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

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
