import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Réinitialise le wizard d'onboarding pour l'utilisateur courant.
 *
 * Met à null `onboarding_completed_at` et `onboarding_dismissed_at` sur le
 * profil — au prochain chargement de la home, le wizard réapparaît. Pratique
 * pour la démo (montrer l'onboarding à Lou) ou pour les tests.
 *
 * Auth requise via RLS (eq id = auth.uid).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed_at: null,
      onboarding_dismissed_at: null,
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
