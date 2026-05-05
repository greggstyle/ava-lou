import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAndPersistInsights } from '@/lib/insights';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Manual trigger: artisan clicks "Générer maintenant" on /insights.
 * Generates a fresh batch immediately. Same logic as the cron, scoped to one user.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Rate-limit: max 1 manual run per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { count } = await supabase
    .from('insights')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('generated_at', oneHourAgo.toISOString());
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Un nouvel ensemble d\'insights a déjà été généré dans la dernière heure. Réessayez plus tard.' },
      { status: 429 },
    );
  }

  const result = await generateAndPersistInsights(supabase, user.id);
  return NextResponse.json(result);
}
