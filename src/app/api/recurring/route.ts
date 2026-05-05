import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const CADENCES = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom_days'] as const;

const LineItemSchema = z.object({
  label: z.string().min(1),
  qty: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100),
});

const CreateSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  label: z.string().min(1, 'Libellé requis'),
  cadence: z.enum(CADENCES),
  custom_days: z.coerce.number().int().positive().nullable().optional(),
  next_run_date: z.string().min(10),
  end_date: z.string().nullable().optional(),
  amount_ttc: z.coerce.number().positive(),
  amount_ht: z.coerce.number().nullable().optional(),
  vat_rate: z.coerce.number().min(0).max(100).default(20),
  line_items: z.array(LineItemSchema).optional().default([]),
  notes: z.string().nullable().optional().or(z.literal('')),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('recurring_invoices')
    .select('*, clients(name)')
    .order('next_run_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation' }, { status: 400 });
  }
  if (parsed.data.cadence === 'custom_days' && !parsed.data.custom_days) {
    return NextResponse.json({ error: 'custom_days requis pour cette cadence' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recurring_invoices')
    .insert({
      user_id: user.id,
      client_id: parsed.data.client_id ?? null,
      label: parsed.data.label.trim(),
      cadence: parsed.data.cadence,
      custom_days: parsed.data.custom_days ?? null,
      next_run_date: parsed.data.next_run_date,
      end_date: parsed.data.end_date || null,
      amount_ttc: parsed.data.amount_ttc,
      amount_ht: parsed.data.amount_ht ?? null,
      vat_rate: parsed.data.vat_rate,
      line_items: parsed.data.line_items ?? [],
      notes: parsed.data.notes || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
