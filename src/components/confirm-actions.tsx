'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AvaButton, C, SANS } from '@/components/ava';

export function ConfirmActions({
  actionId,
  successType,
}: {
  actionId: string;
  successType: 'facture' | 'devis';
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<'confirm' | 'cancel' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onConfirm() {
    setBusy('confirm');
    setError(null);
    try {
      const res = await fetch(`/api/actions/${actionId}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Erreur lors de la création.');
      }
      const j = (await res.json()) as { target_table: string; target_id: string };
      router.push(`/success/${j.target_id}?type=${successType}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création.');
      setBusy(null);
    }
  }

  async function onCancel() {
    setBusy('cancel');
    setError(null);
    try {
      await fetch(`/api/actions/${actionId}`, { method: 'DELETE' });
    } catch {}
    router.push('/');
  }

  function onEdit() {
    const dest = successType === 'devis' ? `/devis/nouveau?action=${actionId}` : `/factures/nouvelle?action=${actionId}`;
    router.push(dest);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AvaButton kind="validate" full onClick={onConfirm} disabled={busy !== null}>
        {busy === 'confirm' ? 'Création…' : 'Confirmer et créer'}
      </AvaButton>
      <AvaButton kind="light" full onClick={onEdit} disabled={busy !== null}>
        Modifier en formulaire
      </AvaButton>
      <AvaButton kind="ghost" full onClick={onCancel} disabled={busy !== null}>
        Annuler
      </AvaButton>
      {error && (
        <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function RetryButton() {
  const router = useRouter();
  return (
    <AvaButton kind="validate" full onClick={() => router.push('/listen')}>
      Réessayer en vocal
    </AvaButton>
  );
}

/**
 * Low-confidence escape hatch: AVA didn't have enough info, but instead of
 * dead-ending in "Réessayer", offer to continue manually with whatever was
 * extracted, prefilling the form via ?action= query param.
 */
export function LowConfidenceActions({
  actionId,
  intent,
}: {
  actionId: string;
  intent: string;
}) {
  const router = useRouter();
  const isQuote = intent === 'create_quote';
  const isInvoice = intent === 'create_invoice';
  const showFormButton = isQuote || isInvoice;
  const formDest = isQuote ? `/devis/nouveau?action=${actionId}` : `/factures/nouvelle?action=${actionId}`;
  const formLabel = isQuote ? 'Continuer en formulaire (devis)' : 'Continuer en formulaire (facture)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showFormButton && (
        <AvaButton kind="primary" full onClick={() => router.push(formDest)}>
          {formLabel}
        </AvaButton>
      )}
      <AvaButton kind="light" full onClick={() => router.push('/listen')}>
        Réessayer en vocal
      </AvaButton>
      <AvaButton kind="ghost" full onClick={() => router.push('/')}>
        Annuler
      </AvaButton>
    </div>
  );
}
