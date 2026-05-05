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
 * dead-ending in "Réessayer", always offer both forms (facture + devis)
 * with prefill via ?action= so the artisan can continue manually.
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
  // If the intent is a quote, lead with quote form; otherwise lead with invoice
  // (matches what the artisan most likely wanted)
  const primaryDest = isQuote
    ? `/devis/nouveau?action=${actionId}`
    : `/factures/nouvelle?action=${actionId}`;
  const primaryLabel = isQuote ? 'Continuer en devis' : 'Continuer en facture';
  const secondaryDest = isQuote
    ? `/factures/nouvelle?action=${actionId}`
    : `/devis/nouveau?action=${actionId}`;
  const secondaryLabel = isQuote ? 'Continuer en facture' : 'Continuer en devis';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AvaButton kind="primary" full onClick={() => router.push(primaryDest)}>
        {primaryLabel}
      </AvaButton>
      <AvaButton kind="light" full onClick={() => router.push(secondaryDest)}>
        {secondaryLabel}
      </AvaButton>
      <AvaButton kind="light" full onClick={() => router.push('/listen')}>
        Réessayer en vocal
      </AvaButton>
      <AvaButton kind="ghost" full onClick={() => router.push('/')}>
        Annuler
      </AvaButton>
    </div>
  );
}

/**
 * mark_paid: artisan dictates "M. X a payé". Server pre-identified the candidate
 * invoice. User confirms → POST /confirm → status updates to 'payée'.
 */
export function MarkPaidActions({
  actionId,
  invoiceId,
}: {
  actionId: string;
  invoiceId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/actions/${actionId}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Erreur.');
      }
      router.push(`/factures/${invoiceId}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur.');
      setBusy(false);
    }
  }

  async function onCancel() {
    try { await fetch(`/api/actions/${actionId}`, { method: 'DELETE' }); } catch {}
    router.push('/');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AvaButton kind="validate" full onClick={onConfirm} disabled={busy}>
        {busy ? 'Mise à jour…' : 'Confirmer le paiement'}
      </AvaButton>
      <AvaButton kind="ghost" full onClick={onCancel} disabled={busy}>
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

/**
 * Generic confirm action — for intents that just need to commit the
 * pre-built entities and route to a sensible "after" page (no resource ID
 * to embed in the URL). Used for create_expense_note + schedule_appointment
 * where MarkPaidActions previously misrouted to /factures/_expense (404).
 */
export function GenericConfirmActions({
  actionId,
  redirectTo,
  confirmLabel = 'Confirmer',
}: {
  actionId: string;
  redirectTo: string;
  confirmLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/actions/${actionId}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Erreur.');
      }
      router.push(redirectTo);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur.');
      setBusy(false);
    }
  }

  async function onCancel() {
    try { await fetch(`/api/actions/${actionId}`, { method: 'DELETE' }); } catch {}
    router.push('/');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AvaButton kind="validate" full onClick={onConfirm} disabled={busy}>
        {busy ? 'Enregistrement…' : confirmLabel}
      </AvaButton>
      <AvaButton kind="ghost" full onClick={onCancel} disabled={busy}>
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

/**
 * Send-payment-link: artisan dictates "envoie le lien de paiement à M. Payet".
 * Enrich pre-built a `payment_link` object with a mailto URL. We just need to
 * open it (which fires their mail client) and mark the action confirmed.
 */
export function PaymentLinkActions({
  actionId,
  mailto,
  publicUrl,
  hasEmail,
}: {
  actionId: string;
  mailto: string;
  publicUrl: string;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function markDone() {
    setBusy(true);
    try {
      await fetch(`/api/actions/${actionId}/confirm`, { method: 'POST' });
    } catch { /* swallow — UX matters more than action log */ }
    router.push('/');
    router.refresh();
  }

  function openMail() {
    if (typeof window !== 'undefined') {
      window.location.href = mailto;
    }
    void markDone();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copiez le lien :', publicUrl);
    }
  }

  async function onCancel() {
    try { await fetch(`/api/actions/${actionId}`, { method: 'DELETE' }); } catch {}
    router.push('/');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AvaButton kind="primary" full onClick={openMail} disabled={busy || !hasEmail}>
        {hasEmail ? 'Ouvrir l’email' : 'Email du client manquant'}
      </AvaButton>
      <AvaButton kind="light" full onClick={copyLink} disabled={busy}>
        {copied ? 'Lien copié ✓' : 'Copier le lien'}
      </AvaButton>
      <AvaButton kind="ghost" full onClick={onCancel} disabled={busy}>
        Annuler
      </AvaButton>
    </div>
  );
}

/**
 * send_reminder: artisan dictates "relance Mme Hoarau". Server drafted the email
 * body. User opens their mail client via mailto.
 */
export function ReminderActions({
  actionId,
  to,
  subject,
  body,
}: {
  actionId: string;
  to: string;
  subject: string;
  body: string;
}) {
  const router = useRouter();
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  function onSendClick() {
    // Mark action executed (best-effort, fire-and-forget)
    void fetch(`/api/actions/${actionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'executed' }),
    }).catch(() => {});
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <a
        href={mailto}
        onClick={onSendClick}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, height: 50, padding: '0 20px', background: C.green, color: '#FFFFFF',
          textDecoration: 'none', borderRadius: 14, font: `600 16px/1 ${SANS}`,
        }}
      >
        Ouvrir mon client mail
      </a>
      <AvaButton kind="ghost" full onClick={() => {
        void fetch(`/api/actions/${actionId}`, { method: 'DELETE' }).catch(() => {});
        router.push('/');
      }}>
        Annuler la relance
      </AvaButton>
    </div>
  );
}

/**
 * Read-only consultation result (financial status, list).
 * Just a "next" action and a back button.
 */
export function ReadOnlyActions({
  actionId,
  primaryHref,
  primaryLabel,
}: {
  actionId: string;
  primaryHref: string;
  primaryLabel: string;
}) {
  const router = useRouter();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AvaButton kind="primary" full onClick={() => {
        void fetch(`/api/actions/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'executed' }),
        }).catch(() => {});
        router.push(primaryHref);
      }}>
        {primaryLabel}
      </AvaButton>
      <AvaButton kind="ghost" full onClick={() => router.push('/')}>
        Retour à l&apos;accueil
      </AvaButton>
    </div>
  );
}
