import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, AvaPill, C, SANS, SERIF, TNUM } from '@/components/ava';
import { formatDateRelativeFR } from '@/lib/format';
import { GenerateInsightsButton, DismissInsightButton } from '@/components/insights-actions';
import { TtsButton } from '@/components/tts-button';

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<string, string> = {
  cashflow: 'Trésorerie',
  client_behavior: 'Comportement client',
  seasonality: 'Saisonnalité',
  growth: 'Croissance',
  overdue_pattern: 'Retards',
  tariff_drift: 'Tarification',
  quote_conversion: 'Conversion devis',
  expense_ratio: 'Dépenses',
  custom: 'Insight',
};

const SEVERITY_STYLE: Record<string, { bg: string; border: string; pillKind: 'success' | 'warn' | 'ava' | 'neutral' }> = {
  warn: { bg: '#FFF8E5', border: '#F0E6BD', pillKind: 'warn' },
  opportunity: { bg: C.greenSoft, border: '#CAE8D4', pillKind: 'success' },
  info: { bg: C.paper, border: C.line, pillKind: 'neutral' },
};

interface InsightRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  metric_label: string | null;
  metric_value: string | null;
  severity: string;
  is_read: boolean;
  is_dismissed: boolean;
  generated_at: string;
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: insights } = await supabase
    .from('insights')
    .select('*')
    .eq('is_dismissed', false)
    .order('generated_at', { ascending: false })
    .limit(40);

  const list = (insights ?? []) as InsightRow[];

  // Group by week
  const grouped = new Map<string, InsightRow[]>();
  for (const i of list) {
    const period = i.generated_at.slice(0, 10);
    const arr = grouped.get(period) ?? [];
    arr.push(i);
    grouped.set(period, arr);
  }
  const periods = Array.from(grouped.keys()).sort().reverse();

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="AVA vous conseille" />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.2 ${SERIF}`, color: C.ink, marginTop: 6, letterSpacing: '-0.01em' }}>
          Vos <em style={{ fontStyle: 'italic' }}>insights</em>
        </h1>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginTop: 8, marginBottom: 16 }}>
          AVA analyse vos données chaque dimanche soir et vous remonte ce qui mérite votre attention.
          Pour générer un nouvel ensemble dès maintenant :
        </div>

        <GenerateInsightsButton />

        {list.length === 0 ? (
          <AvaCard padding={20} style={{ marginTop: 16 }}>
            <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
              Aucun insight pour l&apos;instant. AVA a besoin d&apos;au moins 3 factures sur les 90 derniers jours pour générer des analyses utiles. Essayez « Générer maintenant » une fois que vous aurez quelques factures.
            </div>
          </AvaCard>
        ) : (
          <div style={{ marginTop: 20 }}>
            {periods.map((p) => (
              <div key={p} style={{ marginBottom: 24 }}>
                <AvaLabel style={{ marginBottom: 10 }}>
                  Généré {formatDateRelativeFR(p)}
                </AvaLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(grouped.get(p) ?? []).map((insight) => {
                    const sev = SEVERITY_STYLE[insight.severity] ?? SEVERITY_STYLE.info;
                    return (
                      <AvaCard
                        key={insight.id}
                        padding={16}
                        style={{ background: sev.bg, borderColor: sev.border }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                              <AvaPill kind={sev.pillKind} style={{ padding: '2px 8px', fontSize: 10 }}>
                                {KIND_LABELS[insight.kind] ?? insight.kind}
                              </AvaPill>
                              {insight.severity === 'warn' && (
                                <AvaPill kind="warn" style={{ padding: '2px 8px', fontSize: 10 }}>Alerte</AvaPill>
                              )}
                              {insight.severity === 'opportunity' && (
                                <AvaPill kind="success" style={{ padding: '2px 8px', fontSize: 10 }}>Opportunité</AvaPill>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                              <div style={{ font: `500 17px/1.35 ${SERIF}`, color: C.ink, flex: 1 }}>
                                {insight.title}
                              </div>
                              <TtsButton text={`${insight.title}. ${insight.body}`} label="" />
                            </div>
                            <div style={{ font: `400 14px/1.55 ${SANS}`, color: C.ink2 }}>
                              {insight.body}
                            </div>
                            {insight.metric_label && insight.metric_value && (
                              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, display: 'inline-block' }}>
                                <span style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                                  {insight.metric_label}
                                </span>
                                <span style={{ font: `600 16px/1 ${SERIF}`, color: C.ink, marginLeft: 8, ...TNUM }}>
                                  {insight.metric_value}
                                </span>
                              </div>
                            )}
                          </div>
                          <DismissInsightButton id={insight.id} />
                        </div>
                      </AvaCard>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
