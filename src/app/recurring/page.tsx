import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaButton, AvaLabel, AvaPill, C, SANS, SERIF, TNUM } from '@/components/ava';
import { formatPriceFR, formatDateFR } from '@/lib/format';
import { CADENCE_LABELS, type Cadence } from '@/lib/recurring';

export const dynamic = 'force-dynamic';

interface RecurringRow {
  id: string;
  label: string;
  cadence: Cadence;
  custom_days: number | null;
  next_run_date: string;
  end_date: string | null;
  amount_ttc: number;
  is_paused: boolean;
  generated_count: number;
  clients: { name: string } | { name: string }[] | null;
}

function pickName(c: RecurringRow['clients']): string {
  if (!c) return 'Sans client';
  if (Array.isArray(c)) return c[0]?.name ?? 'Sans client';
  return c.name ?? 'Sans client';
}

export default async function RecurringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: items } = await supabase
    .from('recurring_invoices')
    .select('id, label, cadence, custom_days, next_run_date, end_date, amount_ttc, is_paused, generated_count, clients(name)')
    .order('next_run_date', { ascending: true });
  const list = ((items ?? []) as unknown as RecurringRow[]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Récurrents" />

      <div style={{ padding: '8px 20px 120px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.2 ${SERIF}`, color: C.ink, marginTop: 6, letterSpacing: '-0.01em' }}>
          Vos <em style={{ fontStyle: 'italic' }}>factures récurrentes</em>
        </h1>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginTop: 6, marginBottom: 18 }}>
          Loyer mensuel, contrat de maintenance, abonnement. AVA crée le brouillon le jour J, vous validez et envoyez.
        </div>

        {list.length === 0 ? (
          <AvaCard padding={20}>
            <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
              Aucune facture récurrente pour l&apos;instant. Créez-en une pour automatiser vos prestations régulières.
            </div>
            <div style={{ marginTop: 14 }}>
              <Link href="/recurring/nouveau" style={{ textDecoration: 'none' }}>
                <AvaButton kind="light">Nouveau récurrent</AvaButton>
              </Link>
            </div>
          </AvaCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((r) => {
              const isDue = !r.is_paused && r.next_run_date <= today;
              const cadenceLabel = r.cadence === 'custom_days' && r.custom_days
                ? `Tous les ${r.custom_days} jours`
                : CADENCE_LABELS[r.cadence] ?? r.cadence;
              return (
                <Link key={r.id} href={`/recurring/${r.id}`} style={{ textDecoration: 'none' }}>
                  <AvaCard padding={16} style={{
                    background: r.is_paused ? C.soft : C.paper,
                    opacity: r.is_paused ? 0.7 : 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                          <AvaPill kind="neutral" style={{ padding: '2px 8px', fontSize: 10 }}>
                            {cadenceLabel}
                          </AvaPill>
                          {r.is_paused && (
                            <AvaPill kind="warn" style={{ padding: '2px 8px', fontSize: 10 }}>En pause</AvaPill>
                          )}
                          {isDue && (
                            <AvaPill kind="success" style={{ padding: '2px 8px', fontSize: 10 }}>Échéance aujourd&apos;hui</AvaPill>
                          )}
                        </div>
                        <div style={{ font: `600 16px/1.3 ${SANS}`, color: C.ink }}>
                          {r.label}
                        </div>
                        <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.muted, marginTop: 2 }}>
                          {pickName(r.clients)} · prochain : {formatDateFR(r.next_run_date)}
                          {r.generated_count > 0 ? ` · ${r.generated_count} déjà émise${r.generated_count > 1 ? 's' : ''}` : ''}
                        </div>
                      </div>
                      <div style={{ font: `600 18px/1 ${SERIF}`, color: C.ink, ...TNUM, whiteSpace: 'nowrap' }}>
                        {formatPriceFR(Number(r.amount_ttc))}
                      </div>
                    </div>
                  </AvaCard>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '12px 20px 20px',
          background: `linear-gradient(to top, var(--bg-app) 70%, rgba(244,243,238,0))`,
        }}
      >
        <Link href="/recurring/nouveau" style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Nouvelle récurrence</AvaButton>
        </Link>
      </div>
    </main>
  );
}
