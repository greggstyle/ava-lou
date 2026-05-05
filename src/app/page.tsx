import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HomeMicDock } from '@/components/home-mic-dock';
import { AvaTopBar, AvaCard, AvaLabel, AvaListRow, AvaButton, C, SERIF, SANS } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';
import { NotificationsBanner } from '@/components/notifications-banner';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { SmartGreeting } from '@/components/smart-greeting';
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
    .select('full_name, is_drom, vat_default, siret, company_name, iban, bic, onboarding_completed_at, onboarding_dismissed_at')
    .eq('id', user.id)
    .maybeSingle();

  const greeting = profile?.full_name?.split(' ')[0] || process.env.NEXT_PUBLIC_DEFAULT_GREETING || 'Lou';

  // Onboarding completeness — SIRET + company name are the absolute minimum
  // for legal mentions on factures. Without them, the PDF is non-conforme.
  const profileIncomplete = !profile?.siret || !profile?.company_name;

  // Show wizard on first visit when profile incomplete and never dismissed
  const showWizard = profileIncomplete
    && !profile?.onboarding_completed_at
    && !profile?.onboarding_dismissed_at;

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

  // Smart greeting context: aggregate counters for the contextual line
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekStartDate = new Date();
  weekStartDate.setDate(weekStartDate.getDate() - 7);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  const [{ data: pendingInvoices }, { data: overdueInvoices }, { data: paidInvoices }, { data: pendingQuotesData }] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount_ttc')
      .eq('status', 'envoyée')
      .lte('issue_date', todayIso),
    supabase
      .from('invoices')
      .select('amount_ttc')
      .eq('status', 'en_retard'),
    supabase
      .from('invoices')
      .select('amount_ttc')
      .eq('status', 'payée')
      .gte('issue_date', weekStart),
    supabase
      .from('quotes')
      .select('id')
      .eq('status', 'envoyé'),
  ]);

  const sumTtc = (rows: Array<{ amount_ttc: number | string }> | null): number =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount_ttc), 0);

  const greetingCtx = {
    invoicesPending: { count: (pendingInvoices ?? []).length, total: sumTtc(pendingInvoices) },
    invoicesOverdue: { count: (overdueInvoices ?? []).length, total: sumTtc(overdueInvoices) },
    paidThisWeek: { count: (paidInvoices ?? []).length, total: sumTtc(paidInvoices) },
    pendingQuotes: (pendingQuotesData ?? []).length,
  };

  // Top unread/undismissed insight (V7 — AVA Conseillère)
  const { data: topInsight } = await supabase
    .from('insights')
    .select('id, kind, title, body, severity, generated_at')
    .eq('is_dismissed', false)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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

        <SmartGreeting
          greeting={greeting}
          invoicesPending={greetingCtx.invoicesPending}
          invoicesOverdue={greetingCtx.invoicesOverdue}
          paidThisWeek={greetingCtx.paidThisWeek}
          pendingQuotes={greetingCtx.pendingQuotes}
          upcomingAppointmentsToday={(upcomingAppointments ?? []).filter((a) => {
            const d = new Date(a.starts_at);
            return d.toDateString() === new Date().toDateString();
          }).length}
        />

        {profileIncomplete && (
          <Link href="/parametres" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{
              marginTop: 14,
              background: C.warmYellow,
              border: `1px solid ${C.line}`,
              cursor: 'pointer',
            }}>
              <div style={{ font: `600 14px/1.3 ${SANS}`, color: C.ink }}>
                Complétez votre profil pour facturer
              </div>
              <div style={{ font: `400 13px/1.45 ${SANS}`, color: C.ink2, marginTop: 4 }}>
                Sans SIRET et raison sociale, vos factures ne sont pas conformes (mentions L441-9). Cela prend deux minutes.
              </div>
              <div style={{ font: `500 12px/1 ${SANS}`, color: C.ink, marginTop: 8, textDecoration: 'underline' }}>
                Aller aux paramètres →
              </div>
            </AvaCard>
          </Link>
        )}

        {notifications && notifications.length > 0 && (
          <NotificationsBanner initial={notifications} />
        )}

        {topInsight && (
          <div style={{ marginTop: 16 }}>
            <AvaLabel style={{ marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 3,
                  background: topInsight.severity === 'warn' ? C.warn : topInsight.severity === 'opportunity' ? C.green : C.muted,
                }} />
                AVA vous conseille
              </span>
            </AvaLabel>
            <Link href="/insights" style={{ textDecoration: 'none' }}>
              <AvaCard padding={16} style={{
                background: topInsight.severity === 'warn' ? '#FFF8E5'
                  : topInsight.severity === 'opportunity' ? C.greenSoft
                  : C.paper,
                borderColor: topInsight.severity === 'warn' ? '#F0E6BD'
                  : topInsight.severity === 'opportunity' ? '#CAE8D4'
                  : C.line,
              }}>
                <div style={{ font: `500 16px/1.35 ${SERIF}`, color: C.ink, marginBottom: 6 }}>
                  {topInsight.title}
                </div>
                <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2 }}>
                  {topInsight.body.length > 140 ? topInsight.body.slice(0, 140) + '…' : topInsight.body}
                </div>
                <div style={{ font: `500 12px/1 ${SANS}`, color: C.muted, marginTop: 10 }}>
                  Voir tous mes insights →
                </div>
              </AvaCard>
            </Link>
          </div>
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
          <Link href="/depenses" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Dépenses</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Frais</div>
            </AvaCard>
          </Link>
          <Link href="/historique" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Historique</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Vocal</div>
            </AvaCard>
          </Link>
          <Link href="/insights" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Insights</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Conseils</div>
            </AvaCard>
          </Link>
          <Link href="/recurring" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Récurrents</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Auto</div>
            </AvaCard>
          </Link>
          <Link href="/comptabilite" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Comptabilité</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>CSV</div>
            </AvaCard>
          </Link>
          <Link href="/bilan" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{ cursor: 'pointer' }}>
              <AvaLabel>Bilan</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>Annuel</div>
            </AvaCard>
          </Link>
          <Link href="/relances" style={{ textDecoration: 'none' }}>
            <AvaCard padding={14} style={{
              cursor: 'pointer',
              background: greetingCtx.invoicesOverdue.count > 0 ? '#FFF8E5' : C.paper,
              borderColor: greetingCtx.invoicesOverdue.count > 0 ? '#F0E6BD' : C.line,
            }}>
              <AvaLabel color={greetingCtx.invoicesOverdue.count > 0 ? C.warn : undefined}>Relances</AvaLabel>
              <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 4 }}>
                {greetingCtx.invoicesOverdue.count > 0 ? `${greetingCtx.invoicesOverdue.count} en retard` : 'À jour'}
              </div>
            </AvaCard>
          </Link>
        </div>

        <div style={{ height: 200 }} />
      </div>

      <HomeMicDock />

      {showWizard && (
        <OnboardingWizard
          initialFullName={profile?.full_name ?? ''}
          initialCompanyName={profile?.company_name ?? ''}
          initialSiret={profile?.siret ?? ''}
          initialIban={profile?.iban ?? ''}
          initialBic={profile?.bic ?? ''}
          initialIsDrom={profile?.is_drom ?? false}
          email={user.email ?? ''}
        />
      )}
    </main>
  );
}
