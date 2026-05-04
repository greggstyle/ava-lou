import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { extractIntent } from '@/lib/claude';

export const runtime = 'nodejs';

const BodySchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  const { text } = parsed.data;

  // Build context: recent clients + profile
  const [{ data: clients }, { data: profile }] = await Promise.all([
    supabase
      .from('clients')
      .select('name, email')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('profiles')
      .select('vat_default, is_drom')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  try {
    const result = await extractIntent(text, {
      recent_clients: clients ?? [],
      vat_default: profile?.vat_default ?? undefined,
      is_drom: profile?.is_drom ?? undefined,
    });

    const { data: action, error: insertErr } = await supabase
      .from('ava_actions')
      .insert({
        user_id: user.id,
        input_raw: text,
        intent: result.intent,
        entities: result.entities,
        confidence: result.confidence,
        status: 'pending',
        ava_response: result.ava_response,
      })
      .select('id')
      .single();

    if (insertErr || !action) {
      console.error('[intent] insert error', insertErr);
      return NextResponse.json(
        { error: "Impossible d'enregistrer l'action." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      actionId: action.id,
      intent: result.intent,
      ava_response: result.ava_response,
      confidence: result.confidence,
    });
  } catch (err) {
    console.error('[intent] error', err);
    return NextResponse.json(
      { error: "AVA n'a pas pu analyser votre demande. Réessayez ?" },
      { status: 500 },
    );
  }
}
