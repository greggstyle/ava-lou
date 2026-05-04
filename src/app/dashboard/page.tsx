import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, C, SERIF, SANS } from '@/components/ava';
import { formatPriceFR } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Trésorerie : sommes par statut
  const { data: invoices } = await supabase
    .from('invoices')
    .select('amount_ttc, status, due_date');

  let unpaid = 0;
  let overdue = 0;
  let paidThisMonth = 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const inv of invoices ?? []) {
    const ttc = Number(inv.amount_ttc);
    if (inv.status === 'envoyée' || inv.status === 'en_retard') unpaid += ttc;
    if (inv.status === 'en_retard') overdue += ttc;
  }

  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('amount_ttc, created_at')
    .eq('status', 'payée')
    .gte('created_at', monthStart.toISOString());
  for (const inv of paidInvoices ?? []) paidThisMonth += Number(inv.amount_ttc);

  const { count: clientCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });

  const { count: pendingQuotes } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .in('status', ['envoyé', 'brouillon']);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Tableau de bord" onBack={undefined} right={
        <Link href="/parametres" aria-label="Paramètres" style={{ color: C.ink, padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.6.94.97 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      } />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 28px/1.15 ${SERIF}`, color: C.ink, marginTop: 6 }}>
          Votre <em style={{ fontStyle: 'italic' }}>trésorerie</em>
        </h1>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <AvaCard padding={16}>
            <AvaLabel>À encaisser</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
              {formatPriceFR(unpaid)}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
              factures envoyées non payées
            </div>
          </AvaCard>

          <AvaCard padding={16}>
            <AvaLabel color={C.warn}>En retard</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: overdue > 0 ? C.warn : C.ink, marginTop: 6 }}>
              {formatPriceFR(overdue)}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
              dépassent l&apos;échéance
            </div>
          </AvaCard>

          <AvaCard padding={16}>
            <AvaLabel color={C.green}>Encaissé ce mois</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: C.green, marginTop: 6 }}>
              {formatPriceFR(paidThisMonth)}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
              factures payées
            </div>
          </AvaCard>

          <AvaCard padding={16}>
            <AvaLabel>Clients · Devis</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
              {clientCount ?? 0} <span style={{ color: C.muted, fontSize: 18 }}>·</span> {pendingQuotes ?? 0}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
              actifs · devis en attente
            </div>
          </AvaCard>
        </div>

        <div style={{ marginTop: 24 }}>
          <AvaLabel style={{ marginBottom: 10 }}>Raccourcis</AvaLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/factures" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>Toutes les factures</span>
                  <span style={{ color: C.muted }}>→</span>
                </div>
              </AvaCard>
            </Link>
            <Link href="/devis" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>Tous les devis</span>
                  <span style={{ color: C.muted }}>→</span>
                </div>
              </AvaCard>
            </Link>
            <Link href="/clients" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>Tous les clients</span>
                  <span style={{ color: C.muted }}>→</span>
                </div>
              </AvaCard>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
