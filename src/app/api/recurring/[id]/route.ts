import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const PatchSchema = z.object({
  label: z.string().min(1).optional(),
  cadence: z.enum(['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'custom_days']).optional(),
  custom_days: z.coerce.number().int().positive().nullable().optional(),
  next_run_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
  amount_ttc: z.coerce.number().positive().optional(),
  vat_rate: z.coerce.number().min(0).max(100).optional(),
  is_paused: z.boolean().optional(),
  notes: z.string().nullable().optional().or(z.literal('')),
  client_id: z.string().uuid().nullable().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('recurring_invoices')
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
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation' }, { status: 400 });

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[k] = v === '' ? null : v;
  }

  const { data, error } = await supabase
    .from('recurring_invoices')
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
    .from('recurring_invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
