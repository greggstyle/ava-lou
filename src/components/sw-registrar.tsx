'use client';

import * as React from 'react';

/**
 * Registers the AVA service worker on first paint.
 * Silent on failure — service worker is progressive enhancement, never blocking.
 *
 * In dev (NODE_ENV !== 'production') we actively unregister any stale SW so
 * the artisan never sees a cached old build during preview deploys.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const isProd = process.env.NODE_ENV === 'production';

    if (!isProd) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => { /* noop */ });
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // If a new SW is waiting after an update, prompt it to take over
          if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
          reg.addEventListener('updatefound', () => {
            const next = reg.installing;
            if (!next) return;
            next.addEventListener('statechange', () => {
              if (next.state === 'installed' && navigator.serviceWorker.controller) {
                next.postMessage('SKIP_WAITING');
              }
            });
          });
        })
        .catch(() => { /* noop */ });
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);

    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
