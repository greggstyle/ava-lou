#!/usr/bin/env node
/**
 * Render marketing/screenshots/*.html as PNG at App Store iPhone 6.7" size.
 * Output: marketing/screenshots/png/*.png (1290 × 2796).
 */
import puppeteer from 'puppeteer';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../');
const SRC = join(ROOT, 'marketing/screenshots');
const OUT = join(SRC, 'png');

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
  .sort();

if (files.length === 0) {
  console.error('No HTML found in', SRC);
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: 'shell',
  defaultViewport: { width: 1290, height: 2796, deviceScaleFactor: 1 },
});

for (const file of files) {
  const url = pathToFileURL(join(SRC, file)).href;
  const out = join(OUT, basename(file, extname(file)) + '.png');
  console.log(`→ ${file} → ${out}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1290, height: 2796, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
  // Wait for fonts to load (Google Fonts arrive async)
  await page.evaluateHandle('document.fonts.ready');
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: out, type: 'png', fullPage: false, omitBackground: false });
  await page.close();
}

await browser.close();
console.log(`✓ ${files.length} screenshots rendered into ${OUT}`);
