import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { LineItem } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * TVA mensuelle — pré-déclaration pour l'artisan ou son comptable.
 *
 * Calcule, pour le mois demandé (YYYY-MM) :
 *   - TVA collectée : somme des amount_vat des factures payées émises ce mois
 *     (Cas général : encaissements pour les services, débits pour les biens —
 *     on simplifie : factures payées = TVA exigible. L'artisan / compta peut
 *     ajuster.)
 *   - TVA déductible : approximation via dépenses ce mois
 *     (TTC - HT). Pas parfaite mais suffisante pour pré-remplir la CA3.
 *   - Solde TVA = collectée − déductible. Positif = à reverser.
 *
 * Retourne le détail par taux (8,5%, 20%, etc.) pour faciliter la saisie
 * dans le formulaire CA3 / CA12 français.
 */

const QuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
});

interface TaxBucket {
  vat_rate: number;
  ht: number;
  vat: number;
  ttc: number;
  count: number;
}

function lastDayOfMonth(year: number, monthIndex: number): string {
  // monthIndex 0..11
  const d = new Date(Date.UTC(year, monthIndex + 1, 0));
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ month: url.searchParams.get('month') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètre month invalide (YYYY-MM)' }, { status: 400 });
  }

  const [yearStr, monthStr] = parsed.data.month.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthStart = `${parsed.data.month}-01`;
  const monthEnd = lastDayOfMonth(year, monthIdx);

  // Pull paid invoices issued this month + all expenses this month (in parallel)
  const [{ data: invoices }, { data: expenses }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, number, issue_date, amount_ht, amount_vat, amount_ttc, vat_rate, line_items, status')
      .gte('issue_date', monthStart)
      .lte('issue_date', monthEnd)
      .eq('status', 'payée'),
    supabase
      .from('expenses')
      .select('id, expense_date, amount_ht, amount_ttc, vat_rate, label, vendor')
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd),
  ]);

  // Bucket by VAT rate from line_items (more precise than top-level vat_rate)
  const collectedBuckets = new Map<number, TaxBucket>();
  let totalCollectedHT = 0;
  let totalCollectedVAT = 0;
  let totalCollectedTTC = 0;

  for (const inv of invoices ?? []) {
    const lines = (inv.line_items ?? []) as LineItem[];
    if (lines.length > 0) {
      // Per-line breakdown
      for (const l of lines) {
        const ht = (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
        const vat = ht * ((Number(l.vat_rate) || 0) / 100);
        const ttc = ht + vat;
        const rate = Number(l.vat_rate) || 0;
        const b = collectedBuckets.get(rate) ?? { vat_rate: rate, ht: 0, vat: 0, ttc: 0, count: 0 };
        b.ht += ht;
        b.vat += vat;
        b.ttc += ttc;
        b.count += 1;
        collectedBuckets.set(rate, b);
        totalCollectedHT += ht;
        totalCollectedVAT += vat;
        totalCollectedTTC += ttc;
      }
    } else {
      // Fallback to top-level
      const rate = Number(inv.vat_rate) || 0;
      const ht = Number(inv.amount_ht) || 0;
      const vat = Number(inv.amount_vat) || 0;
      const ttc = Number(inv.amount_ttc) || 0;
      const b = collectedBuckets.get(rate) ?? { vat_rate: rate, ht: 0, vat: 0, ttc: 0, count: 0 };
      b.ht += ht;
      b.vat += vat;
      b.ttc += ttc;
      b.count += 1;
      collectedBuckets.set(rate, b);
      totalCollectedHT += ht;
      totalCollectedVAT += vat;
      totalCollectedTTC += ttc;
    }
  }

  const deductibleBuckets = new Map<number, TaxBucket>();
  let totalDeductibleHT = 0;
  let totalDeductibleVAT = 0;
  let totalDeductibleTTC = 0;

  for (const e of expenses ?? []) {
    const rate = Number(e.vat_rate ?? 0);
    const ttc = Number(e.amount_ttc) || 0;
    const ht = e.amount_ht != null ? Number(e.amount_ht) : (rate > 0 ? ttc / (1 + rate / 100) : ttc);
    const vat = Math.max(0, ttc - ht);
    const b = deductibleBuckets.get(rate) ?? { vat_rate: rate, ht: 0, vat: 0, ttc: 0, count: 0 };
    b.ht += ht;
    b.vat += vat;
    b.ttc += ttc;
    b.count += 1;
    deductibleBuckets.set(rate, b);
    totalDeductibleHT += ht;
    totalDeductibleVAT += vat;
    totalDeductibleTTC += ttc;
  }

  return NextResponse.json({
    month: parsed.data.month,
    range: { from: monthStart, to: monthEnd },
    collected: {
      total_ht: totalCollectedHT,
      total_vat: totalCollectedVAT,
      total_ttc: totalCollectedTTC,
      invoice_count: (invoices ?? []).length,
      by_rate: Array.from(collectedBuckets.values()).sort((a, b) => b.vat_rate - a.vat_rate),
    },
    deductible: {
      total_ht: totalDeductibleHT,
      total_vat: totalDeductibleVAT,
      total_ttc: totalDeductibleTTC,
      expense_count: (expenses ?? []).length,
      by_rate: Array.from(deductibleBuckets.values()).sort((a, b) => b.vat_rate - a.vat_rate),
    },
    balance: {
      vat_due: totalCollectedVAT - totalDeductibleVAT,
      direction: totalCollectedVAT > totalDeductibleVAT ? 'à reverser' : 'crédit de TVA',
    },
  });
}
