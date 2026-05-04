import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaListRow, AvaButton, C, SANS } from '@/components/ava';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone')
    .order('created_at', { ascending: false });

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar
        title="Clients"
        right={
          <Link href="/" aria-label="Accueil" style={{ color: C.muted, font: `500 13px/1 ${SANS}`, textDecoration: 'none' }}>
            Accueil
          </Link>
        }
      />

      <div style={{ padding: '8px 20px 120px', overflowY: 'auto', flex: 1 }}>
        {clients && clients.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {clients.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`} style={{ textDecoration: 'none' }}>
                <AvaListRow name={c.name} sub={c.email ?? c.phone ?? undefined} />
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <AvaCard padding={20}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucun client pour l&apos;instant. Ajoutez votre premier client pour commencer à émettre des factures et des devis.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link href="/clients/nouveau"><AvaButton kind="light">Nouveau client</AvaButton></Link>
              </div>
            </AvaCard>
          </div>
        )}
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '12px 20px 20px',
          background: `linear-gradient(to top, ${C.bone} 70%, rgba(244,243,238,0))`,
        }}
      >
        <Link href="/clients/nouveau" style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Nouveau client</AvaButton>
        </Link>
      </div>
    </main>
  );
}
