'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AvaButton kind="validate" full onClick={onConfirm} disabled={busy !== null}>
        {busy === 'confirm' ? 'Création…' : 'Confirmer et créer'}
      </AvaButton>
      <AvaButton kind="ghost" full onClick={onCancel} disabled={busy !== null}>
        Annuler
      </AvaButton>
      <Link
        href="/factures/nouvelle"
        style={{
          textAlign: 'center',
          font: `500 14px/1 ${SANS}`,
          color: C.muted,
          textDecoration: 'underline',
          padding: '4px 0',
        }}
      >
        Modifier
      </Link>
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
      Réessayer
    </AvaButton>
  );
}
