import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nextDocumentNumber } from '@/lib/format';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });
  if (!quote) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Read profile for default payment terms
  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_terms_days')
    .eq('id', user.id)
    .maybeSingle();
  const termsDays = profile?.payment_terms_days ?? 30;

  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const dueDate = new Date(today.getTime() + termsDays * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const year = today.getFullYear();

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .like('number', `FAC-${year}-%`);

  const number = nextDocumentNumber('FAC', year, count ?? 0);

  const { data: invoice, error: insErr } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      client_id: quote.client_id,
      number,
      status: 'brouillon',
      issue_date: issueDate,
      due_date: dueDate,
      vat_rate: quote.vat_rate,
      amount_ht: quote.amount_ht,
      amount_vat: quote.amount_vat,
      amount_ttc: quote.amount_ttc,
      line_items: quote.line_items,
      notes: quote.notes,
    })
    .select()
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
  return NextResponse.json(invoice);
}
