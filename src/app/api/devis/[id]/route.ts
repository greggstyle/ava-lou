import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { computeTotals } from '@/lib/format';

const LineItemSchema = z.object({
  label: z.string().min(1),
  qty: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100),
});

const QuoteUpdateSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  status: z.enum(['brouillon', 'envoyé', 'accepté', 'refusé', 'expiré']).optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().nullable().optional().or(z.literal('')),
  vat_rate: z.coerce.number().min(0).max(100).optional(),
  line_items: z.array(LineItemSchema).optional(),
  notes: z.string().nullable().optional().or(z.literal('')),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('quotes')
    .select('*, clients(name, email)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = QuoteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.client_id !== undefined) update.client_id = parsed.data.client_id;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.issue_date !== undefined) update.issue_date = parsed.data.issue_date;
  if (parsed.data.expiry_date !== undefined) {
    update.expiry_date = parsed.data.expiry_date && parsed.data.expiry_date !== '' ? parsed.data.expiry_date : null;
  }
  if (parsed.data.vat_rate !== undefined) update.vat_rate = parsed.data.vat_rate;
  if (parsed.data.notes !== undefined) {
    update.notes = parsed.data.notes && parsed.data.notes !== '' ? parsed.data.notes : null;
  }
  if (parsed.data.line_items !== undefined) {
    const totals = computeTotals(parsed.data.line_items);
    update.line_items = parsed.data.line_items;
    update.amount_ht = totals.amount_ht;
    update.amount_vat = totals.amount_vat;
    update.amount_ttc = totals.amount_ttc;
  }

  const { data, error } = await supabase
    .from('quotes')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
