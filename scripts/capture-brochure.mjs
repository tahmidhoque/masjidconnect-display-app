/**
 * Capture real DisplayScreen renders for the product brochure.
 *
 * Drives the system Chrome (via puppeteer-core) against the dev-server showcase
 * harness (showcase.html?s=<id>), waiting for the harness readiness flag, then
 * screenshots each scenario at native resolution (2× DPR) into brochure-assets/.
 *
 * Prereq: dev server running on BASE (default http://localhost:3001).
 * Run:    node scripts/capture-brochure.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'brochure-assets');
const BASE = process.env.SHOWCASE_BASE ?? 'http://localhost:3001';

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH,
].filter(Boolean);

const SCENARIOS = [
  'ls-stack-verse',
  'ls-sidebar-right',
  'ls-sidebar-left',
  'ls-split-top',
  'slide-verse',
  'slide-dua',
  'slide-asma',
  'slide-announcement',
  'slide-event',
  'slide-donation',
  'slide-eid',
  'slide-jumuah',
  'slide-video',
  'pt-full',
  'pt-prayer-focus',
  'ls-theme-emerald',
  'ls-theme-purple',
  'ls-theme-burgundy',
  'ls-ramadan',
  'realtime-alert',
];

const PORTRAIT = new Set(['pt-full', 'pt-prayer-focus']);

/** Optional CLI filter: `node scripts/capture-brochure.mjs emergency pt-full` */
const ONLY = process.argv.slice(2);

function sizeFor(id) {
  return PORTRAIT.has(id)
    ? { width: 720, height: 1280 }
    : { width: 1280, height: 720 };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const executablePath = CHROME_PATHS[0];
  console.log(`Using Chrome: ${executablePath}`);
  console.log(`Showcase base: ${BASE}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'],
  });

  const list = ONLY.length > 0 ? SCENARIOS.filter((s) => ONLY.includes(s)) : SCENARIOS;
  let ok = 0;
  for (const id of list) {
    const { width, height } = sizeFor(id);
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    const url = `${BASE}/showcase.html?s=${id}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Wait for the harness readiness flag (fonts + lazy slides settled).
      await page.waitForFunction('window.__SHOWCASE_READY === true', { timeout: 20000 });
      // Video slides need an extra moment for the first frame to decode.
      if (id === 'slide-video') await sleep(2000);
      // A small extra settle for any final layout/scaling pass.
      await sleep(400);
      const file = resolve(OUT_DIR, `${id}.png`);
      await page.screenshot({ path: file, type: 'png' });
      console.log(`  ✓ ${id}  (${width}×${height}@2)`);
      ok += 1;
    } catch (err) {
      console.error(`  ✗ ${id}  — ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nCaptured ${ok}/${list.length} → ${OUT_DIR}`);
  if (ok < list.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
