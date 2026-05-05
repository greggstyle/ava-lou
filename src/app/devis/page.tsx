import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DevisListClient } from '@/components/devis-list-client';

export const dynamic = 'force-dynamic';

export default async function DevisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, number, amount_ttc, status, created_at, client_id, clients(name)')
    .order('created_at', { ascending: false })
    .limit(500);

  return <DevisListClient initialQuotes={(quotes ?? []) as never[]} />;
}
