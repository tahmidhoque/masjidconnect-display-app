/**
 * Generate masjid-specific brochure media (poster PNG + display showreel MP4).
 *
 * Run: node scripts/generate-brochure-media.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public', 'brochure');
const LOGO = resolve(ROOT, 'brochure-assets', 'lye-ghausia-jamia-masjid.webp');
const DISPLAY_1 = resolve(ROOT, 'brochure-assets', 'real-display-1.webp');
const DISPLAY_2 = resolve(ROOT, 'brochure-assets', 'real-display-2.webp');
const POSTER_OUT = resolve(OUT_DIR, 'lye-eid-ul-adha-poster.png');
const VIDEO_OUT = resolve(OUT_DIR, 'lye-display-showreel.mp4');

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH,
].filter(Boolean);

function posterHtml(logoUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1920px; height: 1080px;
      font-family: system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: linear-gradient(145deg, #0b2e1a 0%, #145c32 42%, #1a7a3f 100%);
      color: #fff;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 72px 96px;
      position: relative; overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(197,165,90,0.18), transparent 70%);
      pointer-events: none;
    }
    .frame {
      position: relative; z-index: 1;
      width: 100%; max-width: 1560px;
      border: 3px solid rgba(197,165,90,0.55);
      border-radius: 24px;
      background: rgba(0,0,0,0.22);
      padding: 64px 80px 72px;
      text-align: center;
      box-shadow: 0 24px 80px rgba(0,0,0,0.35);
    }
    .logo { height: 120px; width: auto; margin-bottom: 36px; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.35)); }
    .eyebrow {
      font-size: 28px; font-weight: 600; letter-spacing: 0.28em;
      text-transform: uppercase; color: #c5a55a; margin-bottom: 16px;
    }
    h1 {
      font-size: 108px; font-weight: 700; line-height: 1.05;
      letter-spacing: 0.04em; margin-bottom: 12px;
      text-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    .hijri { font-size: 36px; font-weight: 400; color: rgba(255,255,255,0.82); margin-bottom: 48px; }
    .times {
      display: inline-flex; flex-direction: column; gap: 20px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(197,165,90,0.35);
      border-radius: 16px;
      padding: 36px 72px;
      margin-bottom: 40px;
    }
    .times .main { font-size: 64px; font-weight: 700; color: #c5a55a; }
    .times .sub { font-size: 32px; font-weight: 400; color: rgba(255,255,255,0.9); }
    .notes {
      font-size: 30px; line-height: 1.55; color: rgba(255,255,255,0.88);
      max-width: 1100px; margin: 0 auto;
    }
    .notes strong { color: #c5a55a; font-weight: 600; }
    .arabic {
      margin-top: 40px; font-size: 34px; color: rgba(255,255,255,0.75);
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="frame">
    <img class="logo" src="${logoUrl}" alt="" />
    <div class="eyebrow">Lye Ghausia Jamia Masjid</div>
    <h1>EID UL ADHA</h1>
    <p class="hijri">1447 AH · Sunday 7 June 2026</p>
    <div class="times">
      <div class="main">Eid Jamaat · 9:30am</div>
      <div class="sub">One jamaat only — please arrive early</div>
    </div>
    <p class="notes">
      <strong>No parking on Bath Street.</strong> Please use nearby car parks and allow extra time for walking.
      Takbīrat from 9:15am in the main prayer hall.
    </p>
    <p class="arabic">تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ</p>
  </div>
</body>
</html>`;
}

async function generatePoster() {
  const logoB64 = readFileSync(LOGO).toString('base64');
  const logoUrl = `data:image/webp;base64,${logoB64}`;
  const executablePath = CHROME_PATHS[0];
  if (!executablePath || !existsSync(executablePath)) {
    throw new Error('Chrome not found — set CHROME_PATH for poster generation');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(posterHtml(logoUrl), { waitUntil: 'load', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: POSTER_OUT, type: 'png' });
    console.log(`  ✓ poster → ${POSTER_OUT}`);
  } finally {
    await browser.close();
  }
}

function generateVideo() {
  if (!existsSync(DISPLAY_1) || !existsSync(DISPLAY_2)) {
    throw new Error('Missing real-display webp assets in brochure-assets/');
  }

  const filter = [
    '[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=25[v0]',
    '[1:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=25[v1]',
    '[v0][v1]xfade=transition=fade:duration=1:offset=3,format=yuv420p[v]',
  ].join(';');

  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loop', '1', '-t', '4', '-i', DISPLAY_1,
      '-loop', '1', '-t', '4', '-i', DISPLAY_2,
      '-filter_complex', filter,
      '-map', '[v]',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      VIDEO_OUT,
    ],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    throw new Error('ffmpeg failed to build showreel video');
  }
  console.log(`  ✓ video → ${VIDEO_OUT}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('Generating masjid-specific brochure media…');
  await generatePoster();
  generateVideo();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
