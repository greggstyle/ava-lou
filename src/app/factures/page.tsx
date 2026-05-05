import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FacturesListClient } from '@/components/factures-list-client';

export const dynamic = 'force-dynamic';

export default async function FacturesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, number, amount_ttc, status, created_at, client_id, clients(name)')
    .order('created_at', { ascending: false })
    .limit(500);

  return <FacturesListClient initialInvoices={(invoices ?? []) as never[]} />;
}
