import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, AvaPill, C, SERIF, SANS, TNUM } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface InvoiceRow {
  amount_ttc: number;
  status: string;
  due_date: string | null;
  created_at: string;
  client_id: string | null;
  clients: { name: string } | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch invoices once with client join, derive everything from this set
  const { data: invoicesData } = await supabase
    .from('invoices')
    .select('amount_ttc, status, due_date, created_at, client_id, clients(name)')
    .order('created_at', { ascending: false });
  const invoices = ((invoicesData ?? []) as unknown as InvoiceRow[]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = monthStart;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let unpaid = 0;
  let overdue = 0;
  let paidThisMonth = 0;
  let paidLastMonth = 0;
  let issuedThisWeek = 0;
  const overdueByClient = new Map<string, { name: string; amount: number; count: number }>();

  for (const inv of invoices) {
    const ttc = Number(inv.amount_ttc);
    const created = new Date(inv.created_at);
    if (inv.status === 'envoyée' || inv.status === 'en_retard') unpaid += ttc;
    if (inv.status === 'en_retard') {
      overdue += ttc;
      const key = inv.client_id ?? '_unknown';
      const name = inv.clients?.name ?? 'Sans client';
      const existing = overdueByClient.get(key);
      if (existing) {
        existing.amount += ttc;
        existing.count += 1;
      } else {
        overdueByClient.set(key, { name, amount: ttc, count: 1 });
      }
    }
    if (inv.status === 'payée') {
      if (created >= monthStart) paidThisMonth += ttc;
      else if (created >= lastMonthStart && created < lastMonthEnd) paidLastMonth += ttc;
    }
    if (created >= sevenDaysAgo) issuedThisWeek += 1;
  }

  const monthDelta = paidThisMonth - paidLastMonth;
  const monthDeltaPercent = paidLastMonth > 0
    ? Math.round(((paidThisMonth - paidLastMonth) / paidLastMonth) * 100)
    : null;

  const topOverdue = Array.from(overdueByClient.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const { count: clientCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: pendingQuotes } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['envoyé', 'brouillon']);

  // Expenses this month for net balance
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const { data: monthExpenses } = await supabase
    .from('expenses')
    .select('amount_ttc')
    .eq('user_id', user.id)
    .gte('expense_date', monthStartIso);
  const expensesThisMonth = (monthExpenses ?? []).reduce((s, e) => s + Number(e.amount_ttc), 0);
  const netThisMonth = paidThisMonth - expensesThisMonth;

  // Recent activity feed: last 5 ava_actions
  const { data: recentActions } = await supabase
    .from('ava_actions')
    .select('id, intent, ava_response, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Tableau de bord" right={
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

        {/* KPI grid */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <AvaCard padding={16}>
            <AvaLabel>À encaisser</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: C.ink, marginTop: 6, ...TNUM }}>
              {formatPriceFR(unpaid)}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
              factures envoyées non payées
            </div>
          </AvaCard>

          <AvaCard padding={16}>
            <AvaLabel color={C.warn}>En retard</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: overdue > 0 ? C.warn : C.ink, marginTop: 6, ...TNUM }}>
              {formatPriceFR(overdue)}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
              dépassent l&apos;échéance
            </div>
          </AvaCard>

          <AvaCard padding={16}>
            <AvaLabel color={C.green}>Encaissé ce mois</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: C.green, marginTop: 6, ...TNUM }}>
              {formatPriceFR(paidThisMonth)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {monthDeltaPercent !== null ? (
                <>
                  <span style={{ font: `500 12px/1.4 ${SANS}`, color: monthDelta >= 0 ? C.green : C.warn }}>
                    {monthDelta >= 0 ? '↑' : '↓'} {Math.abs(monthDeltaPercent)}%
                  </span>
                  <span style={{ font: `400 11px/1.4 ${SANS}`, color: C.muted }}>vs mois dernier</span>
                </>
              ) : (
                <span style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted }}>premier mois suivi</span>
              )}
            </div>
          </AvaCard>

          <AvaCard padding={16}>
            <AvaLabel>Cette semaine</AvaLabel>
            <div style={{ font: `600 28px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
              {issuedThisWeek}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
              document{issuedThisWeek > 1 ? 's' : ''} émis · {pendingQuotes ?? 0} devis ouverts
            </div>
          </AvaCard>
        </div>

        {/* Net balance this month */}
        <AvaCard padding={18} style={{ marginTop: 16 }}>
          <AvaLabel>Bilan ce mois</AvaLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
            <div>
              <div style={{ font: `400 11px/1.3 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Recettes</div>
              <div style={{ font: `600 20px/1.1 ${SERIF}`, color: C.green, marginTop: 4, ...TNUM }}>
                {formatPriceFR(paidThisMonth)}
              </div>
            </div>
            <div>
              <div style={{ font: `400 11px/1.3 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Dépenses</div>
              <div style={{ font: `600 20px/1.1 ${SERIF}`, color: C.warn, marginTop: 4, ...TNUM }}>
                − {formatPriceFR(expensesThisMonth)}
              </div>
            </div>
            <div style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 12 }}>
              <div style={{ font: `400 11px/1.3 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Net</div>
              <div style={{ font: `600 20px/1.1 ${SERIF}`, color: netThisMonth >= 0 ? C.ink : C.warn, marginTop: 4, ...TNUM }}>
                {netThisMonth >= 0 ? '' : '− '}{formatPriceFR(Math.abs(netThisMonth))}
              </div>
            </div>
          </div>
        </AvaCard>

        {/* Top overdue clients */}
        {topOverdue.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <AvaLabel style={{ marginBottom: 10 }}>Clients en retard à relancer</AvaLabel>
            <AvaCard padding={14}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {topOverdue.map((c, i) => (
                  <div
                    key={c.name + i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0',
                      borderTop: i === 0 ? 'none' : `1px solid ${C.line}`,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                      <span style={{ font: `600 14px/1.3 ${SANS}`, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                      <span style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted }}>
                        {c.count} facture{c.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ font: `600 16px/1 ${SERIF}`, color: C.warn, ...TNUM }}>
                      {formatPriceFR(c.amount)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, font: `400 12px/1.45 ${SANS}`, color: C.muted, fontStyle: 'italic' }}>
                Astuce vocale : « Relance {topOverdue[0]?.name} »
              </div>
            </AvaCard>
          </div>
        )}

        {/* Recent activity */}
        {recentActions && recentActions.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <AvaLabel>Activité récente</AvaLabel>
              <Link href="/historique" style={{ font: `500 12px/1 ${SANS}`, color: C.muted, textDecoration: 'none' }}>
                Tout voir →
              </Link>
            </div>
            <AvaCard padding={14}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {recentActions.map((a, i) => (
                  <div key={a.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${C.line}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ font: `400 14px/1.45 ${SERIF}`, color: C.ink, flex: 1, overflow: 'hidden' }}>
                        {a.ava_response ?? a.intent}
                      </span>
                      <AvaPill kind={a.status === 'executed' ? 'success' : a.status === 'cancelled' ? 'warn' : 'neutral'} style={{ padding: '2px 8px', fontSize: 10, marginLeft: 8 }}>
                        {a.status}
                      </AvaPill>
                    </div>
                    <span style={{ font: `400 11px/1.3 ${SANS}`, color: C.muted }}>
                      {formatDateRelativeFR(a.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </AvaCard>
          </div>
        )}

        {/* Shortcuts */}
        <div style={{ marginTop: 24 }}>
          <AvaLabel style={{ marginBottom: 10 }}>Raccourcis</AvaLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/factures" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>
                    Toutes les factures <span style={{ color: C.muted, fontWeight: 400 }}>· {invoices.length}</span>
                  </span>
                  <span style={{ color: C.muted }}>→</span>
                </div>
              </AvaCard>
            </Link>
            <Link href="/devis" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>
                    Tous les devis <span style={{ color: C.muted, fontWeight: 400 }}>· {pendingQuotes ?? 0} en attente</span>
                  </span>
                  <span style={{ color: C.muted }}>→</span>
                </div>
              </AvaCard>
            </Link>
            <Link href="/clients" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>
                    Tous les clients <span style={{ color: C.muted, fontWeight: 400 }}>· {clientCount ?? 0}</span>
                  </span>
                  <span style={{ color: C.muted }}>→</span>
                </div>
              </AvaCard>
            </Link>
            <Link href="/historique" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: `600 15px/1.2 ${SANS}`, color: C.ink }}>Historique des actions vocales</span>
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
