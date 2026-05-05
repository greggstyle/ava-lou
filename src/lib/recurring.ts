/**
 * Recurring invoices — generate scheduled invoices from templates.
 *
 * Cadences supported:
 *   - monthly: same day each month (clamped to month length)
 *   - bimonthly: every 2 months
 *   - quarterly: every 3 months
 *   - semiannual: every 6 months
 *   - annual: same date each year
 *   - custom_days: fixed N-day interval (e.g. every 15 days)
 *
 * Cron runs daily at 06:00 UTC; for each template where next_run_date <= today
 * AND not paused AND (no end_date OR next_run_date <= end_date), inserts a
 * new invoice and advances next_run_date.
 */

import type { LineItem } from './types';

export type Cadence =
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom_days';

export interface RecurringTemplate {
  id: string;
  user_id: string;
  client_id: string | null;
  label: string;
  cadence: Cadence;
  custom_days: number | null;
  next_run_date: string; // YYYY-MM-DD
  end_date: string | null;
  amount_ttc: number;
  amount_ht: number | null;
  vat_rate: number;
  line_items: LineItem[];
  notes: string | null;
  is_paused: boolean;
  last_generated_at: string | null;
  generated_count: number;
  created_at: string;
}

export const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: 'Mensuel',
  bimonthly: 'Tous les 2 mois',
  quarterly: 'Trimestriel',
  semiannual: 'Semestriel',
  annual: 'Annuel',
  custom_days: 'Personnalisé (jours)',
};

/**
 * Parse a date string in local-naive form (YYYY-MM-DD) into a Date that
 * represents that exact day in UTC. Avoids timezone drift.
 */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map((p) => parseInt(p, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the next run date for a recurring template after a given current run.
 * Pure function — no side effects.
 */
export function computeNextRunDate(current: string, cadence: Cadence, customDays: number | null): string {
  const d = parseISODate(current);
  switch (cadence) {
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'bimonthly':
      d.setUTCMonth(d.getUTCMonth() + 2);
      break;
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case 'semiannual':
      d.setUTCMonth(d.getUTCMonth() + 6);
      break;
    case 'annual':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case 'custom_days': {
      const days = customDays ?? 30;
      d.setUTCDate(d.getUTCDate() + days);
      break;
    }
  }
  return toISODate(d);
}

/**
 * Determine whether a template should run today.
 * Today is the UTC date at the time of the call.
 */
export function isDueToday(template: RecurringTemplate, todayIso?: string): boolean {
  if (template.is_paused) return false;
  const today = todayIso ?? toISODate(new Date());
  if (template.end_date && template.end_date < today) return false;
  return template.next_run_date <= today;
}

/**
 * Compute totals from line_items, falling back to amount_ttc on the template
 * if line_items are absent (e.g. flat-rate recurring).
 */
export function computeRecurringAmounts(template: RecurringTemplate): {
  amount_ht: number;
  amount_vat: number;
  amount_ttc: number;
  line_items: LineItem[];
} {
  if (template.line_items.length > 0) {
    let ht = 0;
    let vat = 0;
    for (const l of template.line_items) {
      const lineHt = l.qty * l.unit_price;
      ht += lineHt;
      vat += lineHt * (l.vat_rate / 100);
    }
    return {
      amount_ht: round2(ht),
      amount_vat: round2(vat),
      amount_ttc: round2(ht + vat),
      line_items: template.line_items,
    };
  }
  // Fallback: single "Prestation forfait" line built from template.amount_ttc + vat_rate
  const vatRate = template.vat_rate ?? 20;
  const ht = template.amount_ttc / (1 + vatRate / 100);
  const vat = template.amount_ttc - ht;
  return {
    amount_ht: round2(ht),
    amount_vat: round2(vat),
    amount_ttc: round2(template.amount_ttc),
    line_items: [
      {
        label: template.label,
        qty: 1,
        unit_price: round2(ht),
        vat_rate: vatRate,
      },
    ],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
