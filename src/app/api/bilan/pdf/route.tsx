import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { BilanPDF, type BilanData } from '@/lib/pdf/bilan-pdf';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Bilan annuel en PDF — destiné à l'expert-comptable.
 *
 * GET /api/bilan/pdf?year=2026
 *
 * Calcule la même chose que la page /bilan mais rend en PDF A4 portrait
 * via @react-pdf/renderer. Le PDF contient :
 *   - Synthèse (recettes, dépenses, résultat, impayés)
 *   - Détail mensuel (12 lignes)
 *   - TVA estimée (collectée vs déductible)
 *   - Repères (meilleur mois, conversion devis)
 */

const QuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2099).optional(),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ year: url.searchParams.get('year') ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: 'Année invalide' }, { status: 400 });

  const year = parsed.data.year ?? new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [{ data: invoices }, { data: expenses }, { data: quotes }, { data: profile }] = await Promise.all([
    supabase
      .from('invoices')
      .select('issue_date, status, amount_ht, amount_ttc, amount_vat')
      .gte('issue_date', yearStart)
      .lte('issue_date', yearEnd),
    supabase
      .from('expenses')
      .select('expense_date, amount_ht, amount_ttc')
      .gte('expense_date', yearStart)
      .lte('expense_date', yearEnd),
    supabase
      .from('quotes')
      .select('issue_date, status')
      .gte('issue_date', yearStart)
      .lte('issue_date', yearEnd),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);

  const months: BilanData['months'] = Array.from({ length: 12 }, () => ({ recettes: 0, impaye: 0, depenses: 0 }));
  let totalRecettesTTC = 0;
  let totalRecettesHT = 0;
  let totalTVAcollectee = 0;
  let totalDepensesTTC = 0;
  let totalDepensesHT = 0;
  let totalImpaye = 0;
  let nbFacturesPayees = 0;
  let nbFacturesEnAttente = 0;

  for (const inv of invoices ?? []) {
    if (!inv.issue_date) continue;
    const m = parseInt(inv.issue_date.slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) continue;
    const ttc = Number(inv.amount_ttc) || 0;
    const ht = Number(inv.amount_ht) || 0;
    const vat = Number(inv.amount_vat) || 0;
    if (inv.status === 'payée') {
      months[m].recettes += ttc;
      totalRecettesTTC += ttc;
      totalRecettesHT += ht;
      totalTVAcollectee += vat;
      nbFacturesPayees++;
    } else if (inv.status === 'envoyée' || inv.status === 'en_retard') {
      months[m].impaye += ttc;
      totalImpaye += ttc;
      nbFacturesEnAttente++;
    }
  }

  for (const e of expenses ?? []) {
    if (!e.expense_date) continue;
    const m = parseInt(e.expense_date.slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) continue;
    const ttc = Number(e.amount_ttc) || 0;
    const ht = Number(e.amount_ht) || 0;
    months[m].depenses += ttc;
    totalDepensesTTC += ttc;
    totalDepensesHT += ht;
  }

  const nbDevis = (quotes ?? []).length;
  const nbDevisAcceptes = (quotes ?? []).filter((q) => q.status === 'accepté').length;
  const bestMonthIdx = months.reduce((iMax, m, i) => m.recettes > months[iMax].recettes ? i : iMax, 0);

  const data: BilanData = {
    year,
    totalRecettesTTC,
    totalRecettesHT,
    totalTVAcollectee,
    totalDepensesTTC,
    totalDepensesHT,
    totalImpaye,
    resultatNet: totalRecettesTTC - totalDepensesTTC,
    nbFacturesPayees,
    nbFacturesEnAttente,
    nbDevis,
    nbDevisAcceptes,
    bestMonth: { idx: bestMonthIdx, recettes: months[bestMonthIdx].recettes },
    months,
  };

  const buffer = await renderToBuffer(
    <BilanPDF data={data} profile={profile as Partial<Profile> | null} generatedAt={new Date()} />,
  );

  const filename = `bilan_${year}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
