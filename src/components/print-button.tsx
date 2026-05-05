'use client';

import { AvaButton } from '@/components/ava';

interface PrintButtonProps {
  /** If provided, shows a "Télécharger PDF" button alongside print. */
  pdfHref?: string;
}

export function PrintButton({ pdfHref }: PrintButtonProps) {
  return (
    <span className="ava-print-hide" style={{ display: 'inline-flex', gap: 8 }}>
      {pdfHref && (
        <AvaButton kind="primary" onClick={() => window.open(pdfHref, '_blank')}>
          Télécharger PDF
        </AvaButton>
      )}
      <AvaButton kind="light" onClick={() => window.print()}>
        Imprimer
      </AvaButton>
    </span>
  );
}
