import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const CreateSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  starts_at: z.string().min(1),
  ends_at: z.string().nullable().optional(),
  location: z.string().nullable().optional().or(z.literal('')),
  notes: z.string().nullable().optional().or(z.literal('')),
  client_id: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('appointments')
    .select('*, clients(name)')
    .order('starts_at', { ascending: true });

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

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      user_id: user.id,
      title: parsed.data.title.trim(),
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at || null,
      location: parsed.data.location || null,
      notes: parsed.data.notes || null,
      client_id: parsed.data.client_id || null,
      status: 'planifié',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
