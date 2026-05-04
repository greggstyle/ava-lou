import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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
