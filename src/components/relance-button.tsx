'use client';

import * as React from 'react';
import { AvaButton, C, SANS } from '@/components/ava';

interface RelanceButtonProps {
  invoiceId: string;
  invoiceNumber: string | null;
  amount: number;
  dueDate: string | null;
  clientName: string;
  clientEmail: string | null;
  sender: string;
  /** "overdue" → ton plus ferme. "reminder" → ton anticipateur, J-3. */
  tone: 'overdue' | 'reminder';
}

function formatDateFR(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPriceFR(value: number): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/**
 * Bouton "Relancer" sur la page /relances qui :
 * 1. Récupère un signed token pour /voir/facture/[id]
 * 2. Construit un mailto avec sujet + body adapté (ferme/anticipateur)
 * 3. window.location.href = mailto
 *
 * Si le client n'a pas d'email, désactivé avec message inline.
 */
export function RelanceButton({
  invoiceId, invoiceNumber, amount, dueDate, clientName, clientEmail, sender, tone,
}: RelanceButtonProps) {
  const [busy, setBusy] = React.useState(false);

  if (!clientEmail) {
    return (
      <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, padding: 8, background: C.soft, borderRadius: 6 }}>
        Email du client manquant — ajoutez-le pour relancer en 1 tap.
      </div>
    );
  }

  async function handleClick() {
    setBusy(true);
    try {
      // Get signed public URL token so the lien works correctly even after V17 strict mode
      let token = '';
      try {
        const r = await fetch(`/api/public-url/facture/${invoiceId}`);
        if (r.ok) token = (await r.json()).token ?? '';
      } catch { /* noop */ }
      const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ava-lou.vercel.app';
      const viewUrl = `${siteUrl}/voir/facture/${invoiceId}${token ? `?t=${token}` : ''}`;

      const subject = tone === 'overdue'
        ? `Relance — facture ${invoiceNumber ?? ''}`
        : `Rappel — facture ${invoiceNumber ?? ''} arrive à échéance`;

      const body = tone === 'overdue'
        ? [
            `Bonjour ${clientName},`,
            '',
            `Je me permets de revenir vers vous concernant la facture ${invoiceNumber ?? ''} d'un montant de ${formatPriceFR(amount)}${dueDate ? `, échue le ${formatDateFR(dueDate)}` : ''}.`,
            '',
            `Vous pouvez la consulter ici : ${viewUrl}`,
            '',
            'Pourriez-vous m\'indiquer la date de paiement prévue ? Si le règlement a déjà été effectué, merci de m\'en faire part pour mise à jour.',
            '',
            'Bien cordialement,',
            sender,
            '',
            '—',
            'Envoyé via AVA',
          ].join('\n')
        : [
            `Bonjour ${clientName},`,
            '',
            `Petit rappel : la facture ${invoiceNumber ?? ''} d'un montant de ${formatPriceFR(amount)}${dueDate ? ` arrive à échéance le ${formatDateFR(dueDate)}` : ''}.`,
            '',
            `Vous pouvez la consulter ici : ${viewUrl}`,
            '',
            'N\'hésitez pas si vous avez la moindre question.',
            '',
            'Bien cordialement,',
            sender,
            '',
            '—',
            'Envoyé via AVA',
          ].join('\n');

      const mailto = `mailto:${encodeURIComponent(clientEmail ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
    } finally {
      setBusy(false);
    }
  }

  return (
    <AvaButton
      kind={tone === 'overdue' ? 'primary' : 'light'}
      full
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? 'Préparation…' : tone === 'overdue' ? 'Relancer' : 'Envoyer un rappel'}
    </AvaButton>
  );
}
