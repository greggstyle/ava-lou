import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HomeMicDock } from '@/components/home-mic-dock';
import { AvaTopBar, AvaCard, AvaLabel, AvaListRow, AvaButton, C, SERIF, SANS } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';
import { NotificationsBanner } from '@/components/notifications-banner';
import { InstallHint } from '@/components/install-hint';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // One-time demo seed: if user has zero clients/invoices/quotes, create 3 sample clients.
  // Safe to re-run if user later deletes everything (idempotent on truly empty state).
  try {
    const [clientsCount, invoicesCount, quotesCount] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);
    if ((clientsCount.count ?? 0) === 0 && (invoicesCount.count ?? 0) === 0 && (quotesCount.count ?? 0) === 0) {
      await supabase.from('clients').insert([
        { user_id: user.id, name: 'M. Payet', email: 'payet.demo@example.fr', phone: '06 12 34 56 78', address: '12 rue des Lilas, Saint-Denis' },
        { user_id: user.id, name: 'Mme Hoarau', email: 'hoarau.demo@example.fr', phone: '06 23 45 67 89', address: '5 chemin de la Source, Saint-Pierre' },
        { user_id: user.id, name: 'M. Técher', email: 'techer.demo@example.fr', phone: '06 34 56 78 90', address: '8 boulevard du Front de Mer, Saint-Paul' },
      ]);
    }
  } catch {
    // Silent — seeding is non-critical, the app still works without it.
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_drom, vat_default')
    .eq('id', user.id)
    .maybeSingle();

  const greeting = profile?.full_name?.split(' ')[0] || process.env.NEXT_PUBLIC_DEFAULT_GREETING || 'Lou';

  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('id, number, amount_ttc, status, created_at, client_id, clients(name)')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: openSuggestion } = await supabase
    .from('quotes')
    .select('id, number, client_id, clients(name), created_at')
    .eq('status', 'envoyé')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Unread proactive notifications (cron weekly recap, etc.)
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, action_url, created_at')
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(5);

  // Today's appointments + next 24h
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(todayStart.getTime() + 48 * 60 * 60 * 1000);
  const { data: upcomingAppointments } = await supabase
    .from('appointments')
    .select('id, title, starts_at, location, status, clients(name)')
    .gte('starts_at', todayStart.toISOString())
    .lt('starts_at', tomorrowEnd.toISOString())
    .neq('status', 'annulé')
    .order('starts_at', { ascending: true })
    .limit(5);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar
        title={`Bonjour ${greeting}`}
        right={
          <Link href="/dashboard" aria-label="Tableau de bord" style={{ color: C.ink, padding: 4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </Link>
        }
      />

      <div style={{ padding: '8px 20px 0', overflowY: 'auto', flex: 1 }}>
        <h1
          style={{
            font: `600 30px/1.15 ${SERIF}`,
            color: C.ink,
            letterSpacing: '-0.01em',
            marginTop: 6,
          }}
        >
          Qu&apos;est-ce qu&apos;on règle <em style={{ fontStyle: 'italic' }}>aujourd&apos;hui</em> ?
        </h1>

        {notifications && notifications.length > 0 && (
          <NotificationsBanner initial={notifications} />
        )}

        <InstallHint />

        {upcomingAppointments && upcomingAppointments.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <AvaLabel>Vos prochains RDV</AvaLabel>
              <Link href="/agenda" style={{ font: `500 12px/1 ${SANS}`, color: C.muted, textDecoration: 'none' }}>
                Tout voir →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingAppointments.map((apt) => {
                const start = new Date(apt.starts_at);
                const isToday = start.toDateString() === new Date().toDateString();
                const dayLabel = isToday ? "Aujourd'hui" : start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                const timeLabel = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const clientName = (apt.clients as unknown as { name: string } | null)?.name;
                return (
                  <AvaCard key={apt.id} padding={14}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ font: `500 11px/1 ${SANS}`, color: isToday ? C.green : C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                          {dayLabel} · {timeLabel}
                        </div>
                        <div style={{ font: `500 15px/1.3 ${SANS}`, color: C.ink, marginTop: 4 }}>
                          {apt.title}
                        </div>
                        {clientName && apt.title.indexOf(clientName) === -1 && (
                          <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                            {clientName}
                          </div>
                        )}
                        {apt.location && (
                          <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                            {apt.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </AvaCard>
                );
              })}
            </div>
          </div>
        )}

        {openSuggestion && (
          <div style={{ marginTop: 24 }}>
            <AvaLabel style={{ marginBottom: 10 }}>Suggestion d&apos;AVA</AvaLabel>
            <AvaCard padding={16}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: C.orange, marginTop: 8, flex: 'none' }} />
                <div>
                  <div style={{ font: `400 16px/1.45 ${SERIF}`, color: C.ink }}>
                    {(openSuggestion.clients as unknown as { name: string } | null)?.name ?? 'Un client'} attend une <em>réponse</em> sur le devis {openSuggestion.number}.
                  </div>
                </div>
              </div>
            </AvaCard>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <AvaLabel>Récents</AvaLabel>
            <Link href="/factures" style={{ font: `500 12px/1 ${SANS}`, color: C.muted, textDecoration: 'none' }}>
              Tout voir →
            </Link>
          </div>
          {recentInvoices && recentInvoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentInvoices.map((inv) => (
                <Link key={inv.id} href={`/factures/${inv.id}`} style={{ textDecoration: 'none' }}>
                  <AvaListRow
                    name={(inv.clients as unknown as { name: string } | null)?.name ?? 'Sans client'}
                    sub={`${inv.number ?? 'Brouillon'} · ${formatDateRelativeFR(inv.created_at)}`}
                    amount={formatPriceFR(Number(inv.amount_ttc))}
                    status={inv.status === 'payée' ? 'paid' : inv.status === 'en_retard' ? 'overdue' : undefined}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <AvaCard padding={20}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucune facture pour l&apos;instant. Maintenez le micro et dictez votre première facture, ou créez-en une à la main.
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Link href="/factures/nouvelle"><AvaButton kind="light">Saisir à la main</AvaButton></Link>
                <Link href="/clients/nouveau"><AvaButton kind="ghost">Ajouter un client</AvaButton></Link>
              </div>
            </AvaCard>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <Link href="/factures" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Factures</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Voir tout</div>
            </AvaCard>
          </Link>
          <Link href="/devis" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Devis</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Voir tout</div>
            </AvaCard>
          </Link>
          <Link href="/clients" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Clients</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Voir tout</div>
            </AvaCard>
          </Link>
          <Link href="/agenda" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Agenda</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>RDV</div>
            </AvaCard>
          </Link>
        </div>

        <div style={{ height: 200 }} />
      </div>

      <HomeMicDock />
    </main>
  );
}
