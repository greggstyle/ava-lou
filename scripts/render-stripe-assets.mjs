#!/usr/bin/env node
/**
 * Generate Stripe branding assets — icon + logo en JPEG, fond bone Onde,
 * tailles requises par Stripe (≥128x128, ≤512KB, JPG ou PNG).
 *
 * Output:
 *   marketing/stripe/ava-icon-512.jpg   (carré 512x512 — déjà fait par sips)
 *   marketing/stripe/ava-logo-1200.jpg  (1200x400, wordmark + waveform)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function findChrome() {
  const cache = `${homedir()}/.cache/puppeteer/chrome`;
  if (existsSync(cache)) {
    const versions = readdirSync(cache).sort().reverse();
    for (const v of versions) {
      const candidates = [
        `${cache}/${v}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
        `${cache}/${v}/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    }
  }
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

const html = (svgContent, w, h) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  body { width: ${w}px; height: ${h}px; background: #F4F3EE; display: flex; align-items: center; justify-content: center; }
  .wrap { display: flex; align-items: center; gap: 28px; }
  .wave svg { display: block; height: 110px; width: auto; }
  .word { font-family: 'Times New Roman', serif; font-size: 110px; font-weight: 400; color: #0B1D33; letter-spacing: -0.04em; }
  .word em { font-style: italic; color: #1F9D55; }
</style></head>
<body>
  <div class="wrap">
    <div class="wave">${svgContent}</div>
    <div class="word">AV<em>A</em></div>
  </div>
</body></html>`;

const svg = readFileSync(resolve(ROOT, 'public/assets/mark-waveform.svg'), 'utf8');

const browser = await puppeteer.launch({ headless: 'new', executablePath: findChrome() });
const page = await browser.newPage();
const W = 1200, H = 400;
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
await page.setContent(html(svg, W, H), { waitUntil: 'networkidle0' });

const buf = await page.screenshot({ type: 'jpeg', quality: 92, fullPage: false });
writeFileSync(resolve(ROOT, 'marketing/stripe/ava-logo-1200.jpg'), buf);
await browser.close();

console.log('✓ ava-logo-1200.jpg');
