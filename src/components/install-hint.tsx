'use client';

import * as React from 'react';
import { AvaCard, C, SANS, SERIF } from '@/components/ava';

const STORAGE_KEY = 'ava-install-hint-dismissed-v1';

export function InstallHint() {
  const [show, setShow] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;

    // Already standalone (installed) — don't show
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Capacitor-wrapped (native shell) — don't show
    if ((window as Window & { Capacitor?: unknown }).Capacitor) return;

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);
    setShow(true);
  }, []);

  function dismiss() {
    setShow(false);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    }
  }

  if (!show) return null;

  return (
    <AvaCard padding={14} style={{ background: C.soft, borderColor: C.line, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `400 16px/1.4 ${SERIF}`, color: C.ink }}>
            Ajoutez AVA sur <em style={{ fontStyle: 'italic' }}>l&apos;écran d&apos;accueil</em>
          </div>
          <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2, marginTop: 6 }}>
            {isIOS ? (
              <>Touchez l&apos;icône Partage <span style={{ fontFamily: 'system-ui', fontSize: 16 }}>⎙</span> en bas de Safari, puis &laquo;&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;&raquo;.</>
            ) : (
              <>Dans le menu de votre navigateur, choisissez « Installer l&apos;application » ou « Ajouter à l&apos;écran d&apos;accueil ».</>
            )}
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fermer"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.muted, font: `400 18px/1 ${SANS}`, padding: 4,
          }}
        >
          ×
        </button>
      </div>
    </AvaCard>
  );
}
