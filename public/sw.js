/**
 * AVA service worker — minimal offline shell.
 *
 * Strategy:
 *   - Static assets (/icons/*, /fonts/*, /assets/*, /_next/static/*) → cache-first
 *   - Navigation requests (HTML) → network-only with /offline fallback
 *     (NEVER cache authenticated HTML pages — see security note below)
 *   - API routes (/api/*) → never cached, never intercepted (always live network)
 *   - Voice POSTs and form submits → bypassed entirely
 *
 * SECURITY (audit P1-6): we previously cached authenticated HTML pages by URL.
 * If user A logged out and user B logged in on the same device, B could see A's
 * cached pages briefly. Now navigation requests are always network-only — we
 * lose the "see last-loaded pages while offline" niceness, but we keep the
 * per-user data boundary correct. Offline now means: friendly /offline screen.
 */

const VERSION = 'ava-v2';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline';

const PRECACHE = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  OFFLINE_URL,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json' ||
    /\.(?:woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // Never intercept API routes — keep them strictly live
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  // Navigation: network-only with offline fallback. NEVER cache HTML — pages
  // can contain user-specific data (client lists, invoices) that must not
  // leak across login sessions on the same device.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
});

// Allow page to ask the SW to skip waiting (after deploy)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
