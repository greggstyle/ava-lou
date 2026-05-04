/**
 * French number formatting — comma decimal, thin space thousands, € after the
 * number with a thin no-break space. Always tabular numerals upstream.
 */
export function formatPriceFR(value: number, opts: { withCurrency?: boolean } = {}): string {
  const { withCurrency = true } = opts;
  const fixed = value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withCurrency ? `${fixed} €` : fixed;
}

export function formatDateFR(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateRelativeFR(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return formatDateFR(date);
}

/** Compute HT / TVA / TTC from a list of line items. */
export interface LineItem {
  label: string;
  qty: number;
  unit_price: number;
  vat_rate: number;
}

export function computeTotals(lines: LineItem[]) {
  let ht = 0;
  let vat = 0;
  for (const l of lines) {
    const lineHt = l.qty * l.unit_price;
    ht += lineHt;
    vat += lineHt * (l.vat_rate / 100);
  }
  return {
    amount_ht: round2(ht),
    amount_vat: round2(vat),
    amount_ttc: round2(ht + vat),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Generates "FAC-2026-014" style numbering. Year-based, zero-padded suffix. */
export function nextDocumentNumber(prefix: 'FAC' | 'DEV', year: number, count: number): string {
  return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`;
}
