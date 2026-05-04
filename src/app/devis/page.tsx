import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaListRow, AvaButton, C, SANS } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DevisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, number, amount_ttc, status, created_at, client_id, clients(name)')
    .order('created_at', { ascending: false });

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar
        title="Devis"
        right={
          <Link href="/" aria-label="Accueil" style={{ color: C.muted, font: `500 13px/1 ${SANS}`, textDecoration: 'none' }}>
            Accueil
          </Link>
        }
      />

      <div style={{ padding: '8px 20px 120px', overflowY: 'auto', flex: 1 }}>
        {quotes && quotes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {quotes.map((q) => {
              const clientName = (q.clients as unknown as { name: string } | null)?.name ?? 'Sans client';
              return (
                <Link key={q.id} href={`/devis/${q.id}`} style={{ textDecoration: 'none' }}>
                  <AvaListRow
                    name={clientName}
                    sub={`${q.number ?? 'Brouillon'} · ${formatDateRelativeFR(q.created_at)}`}
                    amount={formatPriceFR(Number(q.amount_ttc))}
                    status={q.status === 'accepté' ? 'paid' : q.status === 'refusé' || q.status === 'expiré' ? 'overdue' : undefined}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <AvaCard padding={20}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucun devis pour l&apos;instant. Créez votre premier devis pour proposer une offre à un client.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link href="/devis/nouveau"><AvaButton kind="light">Nouveau devis</AvaButton></Link>
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
        <Link href="/devis/nouveau" style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Nouveau devis</AvaButton>
        </Link>
      </div>
    </main>
  );
}
