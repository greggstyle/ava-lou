import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { computeTotals, nextDocumentNumber } from '@/lib/format';

const LineItemSchema = z.object({
  label: z.string().min(1),
  qty: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100),
});

const InvoiceCreateSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  issue_date: z.string().min(1),
  due_date: z.string().nullable().optional().or(z.literal('')),
  vat_rate: z.coerce.number().min(0).max(100).default(20),
  line_items: z.array(LineItemSchema).min(1, 'Au moins une ligne'),
  notes: z.string().nullable().optional().or(z.literal('')),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(name)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = InvoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation' }, { status: 400 });
  }

  const lineItems = parsed.data.line_items.map((l) => ({
    ...l,
    vat_rate: l.vat_rate ?? parsed.data.vat_rate,
  }));
  const totals = computeTotals(lineItems);

  const year = new Date(parsed.data.issue_date).getFullYear() || new Date().getFullYear();
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .like('number', `FAC-${year}-%`);

  const number = nextDocumentNumber('FAC', year, count ?? 0);

  const insertPayload = {
    user_id: user.id,
    client_id: parsed.data.client_id ?? null,
    number,
    status: 'brouillon' as const,
    issue_date: parsed.data.issue_date,
    due_date: parsed.data.due_date && parsed.data.due_date !== '' ? parsed.data.due_date : null,
    vat_rate: parsed.data.vat_rate,
    amount_ht: totals.amount_ht,
    amount_vat: totals.amount_vat,
    amount_ttc: totals.amount_ttc,
    line_items: lineItems,
    notes: parsed.data.notes && parsed.data.notes !== '' ? parsed.data.notes : null,
  };

  const { data, error } = await supabase
    .from('invoices')
    .insert(insertPayload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
