import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const PatchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'executing', 'executed', 'cancelled']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
  }
  const { error: upErr } = await supabase
    .from('ava_actions')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('user_id', user.id);
  if (upErr) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: action, error: loadErr } = await supabase
    .from('ava_actions')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (loadErr || !action) {
    return NextResponse.json({ error: 'Action introuvable.' }, { status: 404 });
  }
  if (action.status !== 'pending') {
    return NextResponse.json(
      { error: 'Cette action ne peut plus être annulée.' },
      { status: 400 },
    );
  }

  const { error: updErr } = await supabase
    .from('ava_actions')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updErr) {
    return NextResponse.json({ error: "Erreur lors de l'annulation." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
