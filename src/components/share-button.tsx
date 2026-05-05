'use client';

import { AvaButton, C, SANS } from '@/components/ava';
import * as React from 'react';

interface ShareButtonProps {
  publicUrl: string;
  documentNumber: string | null;
  amount: number;
  kind: 'facture' | 'devis';
  clientName?: string | null;
  clientPhone?: string | null;
}

/**
 * Share dock for the public document view (facture / devis).
 *
 * The artisan opens /voir/facture/[id] on their phone, taps "Partager", and
 * AVA opens either:
 *   1) WhatsApp Web/app with a pre-filled message + URL — heavy default in DROM
 *   2) Native Web Share (iOS / Android) for SMS / Mail / AirDrop / etc.
 *   3) Copy-to-clipboard fallback
 *
 * No backend round-trip — the URL is already the public, unguessable UUID.
 */
export function ShareButton({ publicUrl, documentNumber, amount, kind, clientName, clientPhone }: ShareButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);

  const greeting = clientName ? `Bonjour ${clientName}, ` : 'Bonjour, ';
  const noun = kind === 'facture' ? 'la facture' : 'le devis';
  const refLabel = documentNumber ? ` ${documentNumber}` : '';
  const message =
    `${greeting}voici ${noun}${refLabel} d'un montant de ${formattedAmount}. ` +
    `Vous pouvez la consulter ici : ${publicUrl}`;

  // WhatsApp link — wa.me prefers no leading +, just country code + number
  const phoneClean = (clientPhone ?? '').replace(/[^\d]/g, '');
  const whatsappBase = phoneClean ? `https://wa.me/${phoneClean}` : 'https://wa.me/';
  const whatsappUrl = `${whatsappBase}?text=${encodeURIComponent(message)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // older browsers — manual fallback
      window.prompt('Copiez le lien :', publicUrl);
    }
  }

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `${kind === 'facture' ? 'Facture' : 'Devis'}${refLabel}`,
          text: message,
          url: publicUrl,
        });
        setOpen(false);
        return;
      } catch {
        // user cancelled or unsupported — fall through to menu
      }
    }
    setOpen(true);
  }

  return (
    <>
      <span className="ava-print-hide" style={{ display: 'inline-flex', gap: 8 }}>
        <AvaButton kind="whatsapp" onClick={nativeShare}>
          Partager
        </AvaButton>
      </span>

      {open && (
        <div
          className="ava-print-hide"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(11, 29, 51, 0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              background: C.paper, borderRadius: '14px 14px 0 0',
              width: '100%', maxWidth: 480, padding: 18,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ font: `600 16px/1.2 ${SANS}`, color: C.ink, marginBottom: 4 }}>
              Partager {noun}{refLabel}
            </div>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <AvaButton kind="whatsapp" full>WhatsApp</AvaButton>
            </a>
            <AvaButton kind="light" full onClick={copyLink}>
              {copied ? 'Lien copié ✓' : 'Copier le lien'}
            </AvaButton>
            <AvaButton kind="light" full onClick={() => setOpen(false)}>
              Annuler
            </AvaButton>
          </div>
        </div>
      )}
    </>
  );
}
