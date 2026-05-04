import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ClientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
});

function emptyToNull<T extends string | null | undefined>(v: T): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('clients')
    .select('*')
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

  const parsed = ClientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation' }, { status: 400 });
  }

  const update: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name.trim();
  if (parsed.data.email !== undefined) update.email = emptyToNull(parsed.data.email ?? null);
  if (parsed.data.phone !== undefined) update.phone = emptyToNull(parsed.data.phone ?? null);
  if (parsed.data.address !== undefined) update.address = emptyToNull(parsed.data.address ?? null);
  if (parsed.data.notes !== undefined) update.notes = emptyToNull(parsed.data.notes ?? null);

  const { data, error } = await supabase
    .from('clients')
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
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
