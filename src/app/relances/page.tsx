import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, C, SANS, SERIF, TNUM } from '@/components/ava';
import { formatPriceFR, formatDateFR } from '@/lib/format';
import { RelanceButton } from '@/components/relance-button';

export const dynamic = 'force-dynamic';

/**
 * Page Relances — toutes les factures qui attendent un coup de pouce.
 *
 * Liste : factures `en_retard` (échéance dépassée, statut auto-mis-à-jour
 * par le cron quotidien) + factures `envoyée` dont l'échéance approche
 * (J-3 à J0). Pour chaque ligne, un bouton "Relancer" qui prépare un
 * mailto avec un message poli pré-rempli (réutilise la logique
 * enrichForSendReminder).
 */
export default async function RelancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const todayIso = new Date().toISOString().slice(0, 10);
  const in3DaysIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Overdue first
  const { data: overdue } = await supabase
    .from('invoices')
    .select('id, number, amount_ttc, due_date, issue_date, status, client_id, clients(id, name, email)')
    .eq('status', 'en_retard')
    .order('due_date', { ascending: true });

  // Coming due in next 3 days (status envoyée)
  const { data: dueSoon } = await supabase
    .from('invoices')
    .select('id, number, amount_ttc, due_date, issue_date, status, client_id, clients(id, name, email)')
    .eq('status', 'envoyée')
    .gte('due_date', todayIso)
    .lte('due_date', in3DaysIso)
    .order('due_date', { ascending: true });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle();
  const sender = profile?.company_name || profile?.full_name || 'Votre prestataire';

  const totalOverdue = (overdue ?? []).reduce((s, i) => s + Number(i.amount_ttc), 0);
  const totalDueSoon = (dueSoon ?? []).reduce((s, i) => s + Number(i.amount_ttc), 0);

  type Row = {
    id: string;
    number: string | null;
    amount_ttc: number;
    due_date: string | null;
    client: { id: string; name: string; email: string | null } | null;
  };

  function shape(rows: typeof overdue): Row[] {
    return (rows ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      amount_ttc: Number(r.amount_ttc),
      due_date: r.due_date,
      client: (Array.isArray(r.clients) ? r.clients[0] : r.clients) as Row['client'],
    }));
  }

  const overdueRows = shape(overdue);
  const dueSoonRows = shape(dueSoon);

  function daysOverdue(due: string | null): number {
    if (!due) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(due).getTime()) / (24 * 60 * 60 * 1000)));
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Relances" />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.2 ${SERIF}`, color: C.ink, marginTop: 6, letterSpacing: '-0.01em' }}>
          Vos <em style={{ fontStyle: 'italic' }}>relances</em>
        </h1>
        <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, marginTop: 6, marginBottom: 16 }}>
          AVA prépare un message poli pré-rempli. Vous l&apos;ouvrez dans votre app email, vérifiez, envoyez.
        </div>

        {overdueRows.length === 0 && dueSoonRows.length === 0 && (
          <AvaCard padding={16} style={{ background: C.greenSoft, borderColor: '#CAE8D4' }}>
            <div style={{ font: `500 16px/1.4 ${SERIF}`, color: C.ink }}>
              Tout est à jour 🎯
            </div>
            <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2, marginTop: 6 }}>
              Aucune facture en retard ni proche de l&apos;échéance.
              {' '}<Link href="/factures" style={{ color: C.ink, textDecoration: 'underline' }}>Voir toutes les factures</Link>
            </div>
          </AvaCard>
        )}

        {overdueRows.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <AvaLabel color={C.warn}>En retard ({overdueRows.length})</AvaLabel>
              <span style={{ font: `500 13px/1 ${SANS}`, color: C.warn, ...TNUM }}>
                {formatPriceFR(totalOverdue)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {overdueRows.map((r) => (
                <AvaCard key={r.id} padding={14}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/factures/${r.id}`} style={{ font: `500 15px/1.3 ${SANS}`, color: C.ink, textDecoration: 'none' }}>
                        {r.client?.name || 'Client inconnu'}
                      </Link>
                      <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 2 }}>
                        {r.number ?? '(brouillon)'} · {r.due_date ? `échéance ${formatDateFR(r.due_date)}` : 'sans date'}
                        {' · '}<span style={{ color: C.warn }}>+{daysOverdue(r.due_date)} j</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ font: `600 16px/1 ${SERIF}`, color: C.ink, ...TNUM }}>
                        {formatPriceFR(r.amount_ttc)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <RelanceButton
                      invoiceId={r.id}
                      invoiceNumber={r.number}
                      amount={r.amount_ttc}
                      dueDate={r.due_date}
                      clientName={r.client?.name ?? 'Client'}
                      clientEmail={r.client?.email ?? null}
                      sender={sender}
                      tone="overdue"
                    />
                  </div>
                </AvaCard>
              ))}
            </div>
          </div>
        )}

        {dueSoonRows.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <AvaLabel>Échéance proche ({dueSoonRows.length})</AvaLabel>
              <span style={{ font: `500 13px/1 ${SANS}`, color: C.muted, ...TNUM }}>
                {formatPriceFR(totalDueSoon)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dueSoonRows.map((r) => (
                <AvaCard key={r.id} padding={14}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/factures/${r.id}`} style={{ font: `500 15px/1.3 ${SANS}`, color: C.ink, textDecoration: 'none' }}>
                        {r.client?.name || 'Client inconnu'}
                      </Link>
                      <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 2 }}>
                        {r.number ?? '(brouillon)'} · échéance {r.due_date ? formatDateFR(r.due_date) : 'sans date'}
                      </div>
                    </div>
                    <div style={{ font: `600 16px/1 ${SERIF}`, color: C.ink, ...TNUM }}>
                      {formatPriceFR(r.amount_ttc)}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <RelanceButton
                      invoiceId={r.id}
                      invoiceNumber={r.number}
                      amount={r.amount_ttc}
                      dueDate={r.due_date}
                      clientName={r.client?.name ?? 'Client'}
                      clientEmail={r.client?.email ?? null}
                      sender={sender}
                      tone="reminder"
                    />
                  </div>
                </AvaCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
