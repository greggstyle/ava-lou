import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ClientCreateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  postal_code: z.string().optional().nullable().or(z.literal('')),
  city: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
  is_business: z.boolean().optional(),
  company_name: z.string().optional().nullable().or(z.literal('')),
  siret: z.string().optional().nullable().or(z.literal('')),
  vat_intra: z.string().optional().nullable().or(z.literal('')),
});

function emptyToNull<T extends string | null | undefined>(v: T): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('clients')
    .select('*')
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

  const parsed = ClientCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation' }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    name: parsed.data.name.trim(),
    email: emptyToNull(parsed.data.email ?? null),
    phone: emptyToNull(parsed.data.phone ?? null),
    address: emptyToNull(parsed.data.address ?? null),
    postal_code: emptyToNull(parsed.data.postal_code ?? null),
    city: emptyToNull(parsed.data.city ?? null),
    notes: emptyToNull(parsed.data.notes ?? null),
    is_business: parsed.data.is_business ?? false,
    company_name: emptyToNull(parsed.data.company_name ?? null),
    siret: emptyToNull(parsed.data.siret ?? null),
    vat_intra: emptyToNull(parsed.data.vat_intra ?? null),
  };

  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
