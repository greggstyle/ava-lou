'use client';

import * as React from 'react';
import { C, SANS } from '@/components/ava';

const STORAGE_KEY = 'ava-tts-autoplay';

/**
 * Toggle "AVA parle automatiquement" sur /parametres. Stocké en localStorage
 * (préférence par appareil, pas par compte) — rapide, simple, pas de migration.
 *
 * Default = on. Off désactive uniquement les auto-play. Les boutons ▶ manuels
 * fonctionnent toujours.
 */
export function TtsPrefToggle() {
  const [enabled, setEnabled] = React.useState(true);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) !== 'off');
    } catch { /* ignore */ }
  }, []);

  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const on = e.target.checked;
    setEnabled(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch { /* ignore */ }
  }

  if (!hydrated) {
    // Avoid flash of unchecked while reading from localStorage
    return null;
  }

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        style={{ width: 18, height: 18 }}
      />
      <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink }}>
        AVA me lit ses réponses à voix haute automatiquement
      </span>
    </label>
  );
}
