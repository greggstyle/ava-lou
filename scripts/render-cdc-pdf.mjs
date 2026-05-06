#!/usr/bin/env node
/**
 * Render docs/CDC-AVA-Lou.md → docs/CDC-AVA-Lou.pdf via Puppeteer.
 *
 * Style : Onde aesthetic — Instrument Serif titles, Inter Tight body, warm
 * bone background, navy ink, hairline rules. A4 portrait, page numbers,
 * footer with brand line.
 *
 * Markdown features supported (basic — no plugins) :
 *   - Headings #..######
 *   - Paragraphs
 *   - Bullet lists -
 *   - Numbered lists 1.
 *   - Tables | a | b |
 *   - Bold **x**, italic *x*
 *   - Inline code `x` and code blocks ```
 *   - Links [text](url)
 *   - Horizontal rules ---
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const MD_PATH = resolve(ROOT, 'docs/CDC-AVA-Lou.md');
const PDF_PATH = resolve(ROOT, 'docs/CDC-AVA-Lou.pdf');

// ─── Tiny markdown → HTML renderer ────────────────────────────────
// Built specifically for our CdC (no external dep). Order matters.
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(s) {
  // Process inline tokens. Code first (so bold/italic markers inside code
  // are preserved), then bold, then italic, then links.
  let out = s;
  // Inline code
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic — single asterisk, but not adjacent to a word char on both sides (avoids middle-of-word)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function render(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = null; // 'ul' | 'ol' | null
  let inTable = false;
  let inCode = false;
  let codeBuf = [];

  function closeList() {
    if (inList) {
      html += `</${inList}>\n`;
      inList = null;
    }
  }
  function closeTable() {
    if (inTable) {
      html += `</tbody></table>\n`;
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence
    if (line.startsWith('```')) {
      if (!inCode) {
        closeList(); closeTable();
        inCode = true;
        codeBuf = [];
      } else {
        html += `<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>\n`;
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      closeList(); closeTable();
      html += `<hr/>\n`;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      closeList(); closeTable();
      const lvl = h[1].length;
      // Strip anchor links from headings (they look like (#section))
      const text = inline(h[2].replace(/^#\s*/, ''));
      const id = h[2].toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      html += `<h${lvl} id="${id}">${text}</h${lvl}>\n`;
      continue;
    }

    // Table — header row
    if (line.startsWith('|') && lines[i + 1] && /^\|[\s|:-]+\|$/.test(lines[i + 1])) {
      closeList();
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      html += `<table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>\n`;
      inTable = true;
      i++; // Skip the separator row
      continue;
    }
    // Table body row
    if (inTable && line.startsWith('|')) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      html += `<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>\n`;
      continue;
    }
    if (inTable && !line.startsWith('|')) {
      closeTable();
    }

    // Bullet list
    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inList !== 'ul') { closeList(); html += '<ul>\n'; inList = 'ul'; }
      html += `<li>${inline(ul[1])}</li>\n`;
      continue;
    }
    // Numbered list
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inList !== 'ol') { closeList(); html += '<ol>\n'; inList = 'ol'; }
      html += `<li>${inline(ol[1])}</li>\n`;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      closeList();
      continue;
    }

    // Plain paragraph
    closeList();
    html += `<p>${inline(line)}</p>\n`;
  }

  closeList();
  closeTable();
  return html;
}

// ─── Page template (Onde aesthetic) ───────────────────────────────
const STYLES = `
@page {
  size: A4;
  margin: 22mm 18mm 24mm;
}

@font-face {
  font-family: 'InstrumentSerif';
  src: url(https://fonts.gstatic.com/s/instrumentserif/v9/jizDREVItHgc8qDIbSTKq4XKVjnFuOlnkw.ttf) format('truetype');
  font-style: normal;
  font-weight: 400;
}
@font-face {
  font-family: 'InstrumentSerif';
  src: url(https://fonts.gstatic.com/s/instrumentserif/v9/jizFREVItHgc8qDIbSTKq4XKVjnFuOlEhsg6Wg.ttf) format('truetype');
  font-style: italic;
  font-weight: 400;
}
@font-face {
  font-family: 'InterTight';
  src: url(https://fonts.gstatic.com/s/intertight/v7/NGS6v5_NC0k9P9I7L8a2pBzlx5W1k_dgU2Cw.woff2) format('woff2');
  font-style: normal;
  font-weight: 400;
}

:root {
  --bone: #F4F3EE;
  --paper: #FFFFFF;
  --ink: #0B1D33;
  --ink2: #23344B;
  --muted: #6B7480;
  --line: #E5E3DA;
  --green: #1F9D55;
  --orange: #E87B3A;
  --soft: #F7F5EE;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: 'InterTight', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  font-size: 10pt;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

/* Cover page */
.cover {
  page-break-after: always;
  height: 252mm; /* roughly the A4 inner area */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-top: 40mm;
}
.cover .brand {
  font-size: 9pt;
  letter-spacing: 1.4pt;
  text-transform: uppercase;
  color: var(--muted);
}
.cover h1 {
  font-family: 'InstrumentSerif', 'Times New Roman', serif;
  font-size: 56pt;
  line-height: 0.95;
  letter-spacing: -0.02em;
  margin: 16mm 0 0;
  font-weight: 400;
}
.cover h1 em {
  font-style: italic;
  color: var(--green);
}
.cover .tagline {
  margin-top: 14mm;
  font-size: 14pt;
  line-height: 1.4;
  color: var(--ink2);
  max-width: 110mm;
  font-style: italic;
  font-family: 'InstrumentSerif', serif;
}
.cover .meta {
  font-size: 9pt;
  color: var(--muted);
  border-top: 0.5pt solid var(--line);
  padding-top: 6mm;
  margin-top: auto;
}

/* TOC */
nav.toc {
  page-break-after: always;
}

/* Headings */
h1, h2, h3, h4 {
  font-family: 'InstrumentSerif', 'Times New Roman', serif;
  color: var(--ink);
  font-weight: 400;
  letter-spacing: -0.01em;
}
h1 {
  font-size: 24pt;
  line-height: 1.1;
  margin: 18mm 0 6mm;
  border-top: 0.5pt solid var(--line);
  padding-top: 8mm;
  page-break-before: always;
}
h1:first-of-type {
  page-break-before: auto;
  border-top: none;
  padding-top: 0;
}
h2 {
  font-size: 16pt;
  margin: 10mm 0 3mm;
}
h3 {
  font-size: 13pt;
  margin: 7mm 0 2mm;
}
h4 {
  font-size: 11pt;
  font-family: 'InterTight', sans-serif;
  font-weight: 600;
  margin: 5mm 0 1mm;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

p {
  margin: 0 0 3mm;
  orphans: 3;
  widows: 3;
}

ul, ol {
  margin: 0 0 4mm;
  padding-left: 6mm;
}
li {
  margin-bottom: 1.2mm;
}

strong { color: var(--ink); font-weight: 600; }
em { font-style: italic; }

a {
  color: var(--ink2);
  text-decoration: underline;
  text-decoration-color: var(--line);
  text-underline-offset: 1.5pt;
}

code {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 8.5pt;
  background: var(--soft);
  padding: 0.5pt 3pt;
  border-radius: 2pt;
  color: var(--ink2);
}
pre {
  background: var(--soft);
  border: 0.5pt solid var(--line);
  border-radius: 3pt;
  padding: 4mm 5mm;
  overflow-x: auto;
  font-size: 8pt;
  line-height: 1.45;
  page-break-inside: avoid;
}
pre code {
  background: none;
  padding: 0;
  font-size: 8pt;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 3mm 0 5mm;
  font-size: 9pt;
  page-break-inside: avoid;
}
th {
  text-align: left;
  background: var(--bone);
  border-bottom: 0.5pt solid var(--line);
  padding: 2mm 3mm;
  font-weight: 600;
  color: var(--ink);
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
td {
  padding: 2mm 3mm;
  border-bottom: 0.5pt solid var(--line);
  color: var(--ink2);
  vertical-align: top;
}
tbody tr:last-child td { border-bottom: none; }

hr {
  border: none;
  border-top: 0.5pt solid var(--line);
  margin: 6mm 0;
}

blockquote {
  border-left: 2pt solid var(--green);
  padding: 1mm 0 1mm 5mm;
  font-family: 'InstrumentSerif', serif;
  font-style: italic;
  color: var(--ink2);
  margin: 4mm 0;
}
`;

function buildHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Cahier des charges — AVA-Lou</title>
<style>${STYLES}</style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="brand">AVA · Cahier des charges</div>
      <h1>L'OS administratif des <em>indépendants</em>.</h1>
      <p class="tagline">Voice-first invoicing pour artisans des DROM.<br/>
        Comprendre, parler, agir — par la voix.</p>
    </div>
    <div class="meta">
      Greg Hanffou · Gonnected · 6 mai 2026<br/>
      Document de référence — version v0.38<br/>
      ava-lou.vercel.app · github.com/greggstyle/ava-lou
    </div>
  </section>
  ${bodyHtml}
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────
const md = readFileSync(MD_PATH, 'utf8');

// Drop the first H1 + sommaire (we replace with a custom cover) and start
// rendering from the first numbered section.
const rendered = render(md);

const html = buildHtml(rendered);

// Save HTML preview alongside (handy for debugging)
writeFileSync(resolve(ROOT, 'docs/CDC-AVA-Lou.html'), html);

console.log('Rendering PDF via Puppeteer…');
// Resolve a Chrome binary — Puppeteer 24 sometimes can't find one on its own.
// We try, in order: Puppeteer cache (any installed version), system Chrome.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';

function findChrome() {
  const cache = `${homedir()}/.cache/puppeteer/chrome`;
  if (existsSync(cache)) {
    const versions = readdirSync(cache).filter((d) => d.startsWith('mac_arm-') || d.startsWith('mac_x64-') || d.startsWith('linux-')).sort().reverse();
    for (const v of versions) {
      const candidates = [
        `${cache}/${v}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
        `${cache}/${v}/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
        `${cache}/${v}/chrome-linux64/chrome`,
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    }
  }
  // Fallback to system Chrome on macOS
  const sys = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(sys)) return sys;
  return undefined;
}

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: findChrome(),
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.pdf({
  path: PDF_PATH,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="font-family:-apple-system,sans-serif;font-size:7pt;color:#6B7480;width:100%;padding:0 18mm;display:flex;justify-content:space-between;">
      <span>AVA · Cahier des charges</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '22mm', bottom: '24mm', left: '18mm', right: '18mm' },
});
await browser.close();
console.log(`✓ PDF généré : ${PDF_PATH}`);
