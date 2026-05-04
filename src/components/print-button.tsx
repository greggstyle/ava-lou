'use client';

import { AvaButton } from '@/components/ava';

export function PrintButton() {
  return (
    <span className="ava-print-hide">
      <AvaButton kind="primary" onClick={() => window.print()}>
        Imprimer / PDF
      </AvaButton>
    </span>
  );
}
