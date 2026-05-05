import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { insertWithNumbering } from '@/lib/numbering';
import type { Invoice } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Duplique une facture existante (souvent pour les clients récurrents qui
 * commandent la même prestation chaque mois sans pour autant être en mode
 * "récurrent" automatique).
 *
 * POST /api/factures/[id]/duplicate
 * → crée une nouvelle facture brouillon avec la même client, line_items,
 *   vat_rate, amount_*, mais issue_date = today, due_date = today + (terms),
 *   number = nouveau numéro atomique, status = 'brouillon', notes = ''.
 *
 * Returns { id, number } pour que le client puisse rediriger vers la nouvelle.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Fetch source via RLS (only owner can read it)
  const { data: source, error: srcErr } = await supabase
    .from('invoices')
    .select('client_id, vat_rate, amount_ht, amount_vat, amount_ttc, line_items')
    .eq('id', id)
    .maybeSingle();
  if (srcErr || !source) {
    return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_terms_days')
    .eq('id', user.id)
    .maybeSingle();
  const termsDays = Number(profile?.payment_terms_days ?? 30);

  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const dueDate = new Date(today.getTime() + termsDays * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const year = today.getFullYear();

  const { data: created, error: insErr } = await insertWithNumbering<Pick<Invoice, 'id' | 'number'>>({
    supabase,
    table: 'invoices',
    prefix: 'FAC',
    userId: user.id,
    year,
    payloadWithoutNumber: {
      user_id: user.id,
      client_id: source.client_id,
      status: 'brouillon',
      issue_date: issueDate,
      due_date: dueDate,
      vat_rate: source.vat_rate,
      amount_ht: source.amount_ht,
      amount_vat: source.amount_vat,
      amount_ttc: source.amount_ttc,
      line_items: source.line_items,
      notes: null,
    },
    selectColumns: 'id, number',
  });

  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? 'Duplication échouée' }, { status: 400 });
  }

  return NextResponse.json({ id: created.id, number: created.number });
}
