'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AvaButton, C, SANS } from '@/components/ava';

export function GenerateInsightsButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/insights/generate', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error ?? 'Erreur lors de la génération.');
      }
      if (j.skipped_reason) {
        if (j.skipped_reason === 'too_few_invoices') {
          setError('AVA a besoin d\'au moins 3 factures pour générer des insights utiles.');
        } else if (j.skipped_reason === 'claude_returned_none') {
          setError('AVA n\'a rien d\'utile à dire avec les données actuelles. Réessayez quand vous aurez plus d\'historique.');
        } else {
          setError('Aucun insight généré cette fois.');
        }
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AvaButton kind="primary" onClick={generate} disabled={busy}>
        {busy ? 'Analyse en cours…' : 'Générer maintenant'}
      </AvaButton>
      {error && (
        <div style={{ marginTop: 8, font: `500 13px/1.4 ${SANS}`, color: C.warn }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function DismissInsightButton({ id }: { id: string }) {
  const router = useRouter();
  const [hidden, setHidden] = React.useState(false);

  async function dismiss() {
    setHidden(true);
    try {
      await fetch(`/api/insights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_dismissed: true }),
      });
      router.refresh();
    } catch {
      setHidden(false);
    }
  }

  if (hidden) return null;

  return (
    <button
      onClick={dismiss}
      aria-label="Masquer cet insight"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: C.muted,
        font: `400 18px/1 ${SANS}`,
        padding: 6,
        marginRight: -6,
        marginTop: -4,
      }}
    >
      ×
    </button>
  );
}
