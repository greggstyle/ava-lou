import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Wipe — supprime TOUTES les données de l'utilisateur courant (sauf le profil).
 *
 * Tables nettoyées (ordre choisi pour respecter les FK quand elles existent) :
 *   ava_actions, insights, notifications, recurring_invoices,
 *   appointments, expenses, invoices, quotes, clients.
 *
 * Le profil (table `profiles`) est conservé : il porte les coordonnées légales,
 * l'IBAN, etc. Recréer ces données est plus pénible que de recréer 5 clients.
 *
 * Côté UI le bouton est gardé par un double prompt() qui demande de taper
 * "EFFACER" en majuscules. Pas de confirmation token côté serveur — RLS
 * suffit (on ne peut effacer QUE ses propres lignes), et l'opération est
 * idempotente : effacer un compte vide n'échoue pas.
 */

// Tables à vider, par ordre de suppression (filles avant parents).
// Toutes possèdent une colonne user_id et une RLS basée dessus, donc le
// `eq('user_id', user.id)` est défensif (RLS l'aurait fait quand même)
// mais explicite l'intention.
const TABLES = [
  'ava_actions',
  'insights',
  'notifications',
  'recurring_invoices',
  'appointments',
  'expenses',
  'invoices',
  'quotes',
  'clients',
] as const;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const deleted: Record<string, number> = {};

  for (const table of TABLES) {
    // On compte avant pour pouvoir reporter, puis on supprime.
    // Si une table n'existe pas (cas non prévu — toutes sont déclarées en
    // migration), on encaisse l'erreur en la rapportant et on continue.
    const { count: before } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: `delete ${table} failed: ${error.message}`, partial: deleted },
        { status: 400 },
      );
    }
    deleted[table] = before ?? 0;
  }

  return NextResponse.json({ ok: true, deleted });
}
