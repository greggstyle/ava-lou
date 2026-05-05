import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const CATEGORIES = ['matériel', 'déplacement', 'sous-traitance', 'restauration', 'téléphonie', 'outillage', 'formation', 'autre'] as const;

const CreateSchema = z.object({
  label: z.string().min(1, 'Libellé requis'),
  vendor: z.string().nullable().optional().or(z.literal('')),
  amount_ttc: z.coerce.number().positive('Montant requis'),
  amount_ht: z.coerce.number().nullable().optional(),
  vat_rate: z.coerce.number().nullable().optional(),
  category: z.enum(CATEGORIES).default('autre'),
  expense_date: z.string().optional(),
  notes: z.string().nullable().optional().or(z.literal('')),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });
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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation' }, { status: 400 });

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      label: parsed.data.label.trim(),
      vendor: parsed.data.vendor || null,
      amount_ttc: parsed.data.amount_ttc,
      amount_ht: parsed.data.amount_ht ?? null,
      vat_rate: parsed.data.vat_rate ?? null,
      category: parsed.data.category,
      expense_date: parsed.data.expense_date ?? new Date().toISOString().slice(0, 10),
      notes: parsed.data.notes || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
