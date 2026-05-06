'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AvaButton, C, SANS } from '@/components/ava';

/**
 * Bouton dans /parametres qui réinitialise le wizard d'onboarding pour
 * l'utilisateur courant. Au refresh de la home, le wizard réapparaîtra
 * avec les valeurs actuelles du profil pré-remplies.
 *
 * Cas d'usage : montrer l'onboarding à un bêta-testeur, ou re-tester le
 * flow après modification.
 */
export function ResetOnboardingButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/profile/reset-onboarding', { method: 'POST' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur');
      }
      setMsg('Onboarding réinitialisé. Retournez à l\'accueil pour le revoir.');
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AvaButton kind="light" onClick={onClick} disabled={busy}>
        {busy ? 'Réinitialisation…' : 'Refaire l\'onboarding'}
      </AvaButton>
      {msg && (
        <div style={{ font: `500 12px/1.4 ${SANS}`, color: C.muted, padding: 6 }}>{msg}</div>
      )}
    </div>
  );
}
