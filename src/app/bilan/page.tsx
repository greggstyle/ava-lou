import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, C, SANS, SERIF } from '@/components/ava';
import { formatPriceFR } from '@/lib/format';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

type MonthRow = { recettes: number; depenses: number; ttc: number; impayé: number };

export default async function BilanPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { year: yearParam } = await searchParams;
  const today = new Date();
  const year = yearParam ? Math.max(2020, Math.min(2099, parseInt(yearParam, 10))) : today.getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Pull invoices and expenses for the requested year
  const [{ data: invoices }, { data: expenses }, { data: quotes }] = await Promise.all([
    supabase
      .from('invoices')
      .select('issue_date, status, amount_ht, amount_ttc, amount_vat')
      .gte('issue_date', yearStart)
      .lte('issue_date', yearEnd),
    supabase
      .from('expenses')
      .select('expense_date, amount_ht, amount_ttc')
      .gte('expense_date', yearStart)
      .lte('expense_date', yearEnd),
    supabase
      .from('quotes')
      .select('issue_date, status, amount_ttc')
      .gte('issue_date', yearStart)
      .lte('issue_date', yearEnd),
  ]);

  // Bucket per month
  const months: MonthRow[] = Array.from({ length: 12 }, () => ({ recettes: 0, depenses: 0, ttc: 0, impayé: 0 }));
  let totalRecettesTTC = 0;
  let totalRecettesHT = 0;
  let totalTVAcollectée = 0;
  let totalDepensesTTC = 0;
  let totalDepensesHT = 0;
  let totalImpayé = 0;
  let nbFacturesPayées = 0;
  let nbFacturesEnAttente = 0;

  for (const inv of invoices ?? []) {
    if (!inv.issue_date) continue;
    const m = parseInt(inv.issue_date.slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) continue;
    const ttc = Number(inv.amount_ttc) || 0;
    const ht = Number(inv.amount_ht) || 0;
    const vat = Number(inv.amount_vat) || 0;
    months[m].ttc += ttc;
    if (inv.status === 'payée') {
      months[m].recettes += ttc;
      totalRecettesTTC += ttc;
      totalRecettesHT += ht;
      totalTVAcollectée += vat;
      nbFacturesPayées++;
    } else if (inv.status === 'envoyée' || inv.status === 'en_retard') {
      months[m].impayé += ttc;
      totalImpayé += ttc;
      nbFacturesEnAttente++;
    }
  }

  for (const e of expenses ?? []) {
    if (!e.expense_date) continue;
    const m = parseInt(e.expense_date.slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) continue;
    const ttc = Number(e.amount_ttc) || 0;
    const ht = Number(e.amount_ht) || 0;
    months[m].depenses += ttc;
    totalDepensesTTC += ttc;
    totalDepensesHT += ht;
  }

  const nbDevis = (quotes ?? []).length;
  const nbDevisAcceptés = (quotes ?? []).filter((q) => q.status === 'accepté').length;
  const tauxConversion = nbDevis > 0 ? Math.round((nbDevisAcceptés / nbDevis) * 100) : 0;

  const resultatNet = totalRecettesTTC - totalDepensesTTC;

  // Bar chart scale: max value across recettes + dépenses to size bars
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.recettes, m.depenses, m.impayé)));
  const BAR_HEIGHT = 80;

  // Best month + average
  const monthsWithRecettes = months.filter((m) => m.recettes > 0);
  const avgMonthRecettes = monthsWithRecettes.length > 0
    ? totalRecettesTTC / monthsWithRecettes.length
    : 0;
  const bestMonthIdx = months.reduce((iMax, m, i) => m.recettes > months[iMax].recettes ? i : iMax, 0);

  const yearOptions = [year - 2, year - 1, year, year + 1].filter((y) => y >= 2024 && y <= today.getFullYear() + 1);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Bilan annuel" />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.2 ${SERIF}`, color: C.ink, marginTop: 6, letterSpacing: '-0.01em' }}>
          Bilan <em style={{ fontStyle: 'italic' }}>{year}</em>
        </h1>
        <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, marginTop: 4, marginBottom: 14 }}>
          Vue d&apos;ensemble — recettes encaissées, dépenses, résultat net.
        </div>

        {/* Year picker */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {yearOptions.map((y) => (
            <a
              key={y}
              href={`/bilan?year=${y}`}
              style={{
                textDecoration: 'none',
                font: `500 13px/1 ${SANS}`,
                color: y === year ? C.paper : C.ink,
                background: y === year ? C.ink : C.paper,
                border: `1px solid ${C.line}`,
                borderRadius: 999,
                padding: '8px 14px',
              }}
            >
              {y}
            </a>
          ))}
        </div>

        {/* Headline cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          <AvaCard padding={14}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Recettes
            </div>
            <div style={{ font: `600 22px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
              {formatPriceFR(totalRecettesTTC)}
            </div>
            <div style={{ marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
              {nbFacturesPayées} facture{nbFacturesPayées > 1 ? 's' : ''} payée{nbFacturesPayées > 1 ? 's' : ''}
            </div>
          </AvaCard>

          <AvaCard padding={14}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Dépenses
            </div>
            <div style={{ font: `600 22px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
              {formatPriceFR(totalDepensesTTC)}
            </div>
            <div style={{ marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
              {(expenses ?? []).length} note{(expenses ?? []).length > 1 ? 's' : ''} de frais
            </div>
          </AvaCard>

          <AvaCard padding={14}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Résultat net
            </div>
            <div style={{ font: `600 22px/1.1 ${SERIF}`, color: resultatNet >= 0 ? C.green : C.warn, marginTop: 6 }}>
              {formatPriceFR(resultatNet)}
            </div>
            <div style={{ marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
              recettes − dépenses
            </div>
          </AvaCard>

          <AvaCard padding={14}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Impayés
            </div>
            <div style={{ font: `600 22px/1.1 ${SERIF}`, color: totalImpayé > 0 ? C.warn : C.ink, marginTop: 6 }}>
              {formatPriceFR(totalImpayé)}
            </div>
            <div style={{ marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
              {nbFacturesEnAttente} facture{nbFacturesEnAttente > 1 ? 's' : ''} en attente
            </div>
          </AvaCard>
        </div>

        {/* Monthly bars */}
        <AvaCard padding={16} style={{ marginBottom: 16 }}>
          <AvaLabel style={{ marginBottom: 12 }}>Par mois</AvaLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: BAR_HEIGHT + 30 }}>
            {months.map((m, i) => {
              const recH = Math.round((m.recettes / maxBar) * BAR_HEIGHT);
              const depH = Math.round((m.depenses / maxBar) * BAR_HEIGHT);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: BAR_HEIGHT }}>
                    <div
                      title={`Recettes : ${formatPriceFR(m.recettes)}`}
                      style={{
                        width: 8,
                        height: Math.max(recH, m.recettes > 0 ? 2 : 0),
                        background: C.green,
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                    <div
                      title={`Dépenses : ${formatPriceFR(m.depenses)}`}
                      style={{
                        width: 8,
                        height: Math.max(depH, m.depenses > 0 ? 2 : 0),
                        background: C.warn,
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  </div>
                  <div style={{ font: `500 10px/1 ${SANS}`, color: C.muted }}>{MONTHS[i]}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, font: `400 11px/1.4 ${SANS}`, color: C.muted }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: C.green, borderRadius: 2, display: 'inline-block' }} />
              Recettes
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: C.warn, borderRadius: 2, display: 'inline-block' }} />
              Dépenses
            </span>
          </div>
        </AvaCard>

        {/* TVA breakdown */}
        <AvaCard padding={16} style={{ marginBottom: 16 }}>
          <AvaLabel style={{ marginBottom: 10 }}>TVA collectée vs déductible</AvaLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                TVA collectée
              </div>
              <div style={{ font: `600 18px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
                {formatPriceFR(totalTVAcollectée)}
              </div>
              <div style={{ marginTop: 4, font: `400 11px/1.4 ${SANS}`, color: C.muted }}>
                Recettes HT : {formatPriceFR(totalRecettesHT)}
              </div>
            </div>
            <div>
              <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                TVA déductible (estim.)
              </div>
              <div style={{ font: `600 18px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
                {formatPriceFR(Math.max(0, totalDepensesTTC - totalDepensesHT))}
              </div>
              <div style={{ marginTop: 4, font: `400 11px/1.4 ${SANS}`, color: C.muted }}>
                Dépenses HT : {formatPriceFR(totalDepensesHT)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 10, background: C.soft, borderRadius: 8, font: `400 12px/1.45 ${SANS}`, color: C.ink2 }}>
            Solde TVA estimé : <strong>{formatPriceFR(totalTVAcollectée - Math.max(0, totalDepensesTTC - totalDepensesHT))}</strong>
            {' '}(à reverser à l&apos;administration). Estimation basée sur les montants HT/TTC saisis — votre comptable affinera selon le régime.
          </div>
        </AvaCard>

        {/* Highlights */}
        <AvaCard padding={16} style={{ marginBottom: 16 }}>
          <AvaLabel style={{ marginBottom: 10 }}>Repères</AvaLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, font: `400 13px/1.5 ${SANS}`, color: C.ink2 }}>
            <div>
              <strong>Meilleur mois</strong> : {MONTHS[bestMonthIdx]} avec {formatPriceFR(months[bestMonthIdx].recettes)}
            </div>
            <div>
              <strong>Recettes moyennes</strong> : {formatPriceFR(avgMonthRecettes)} par mois actif
            </div>
            <div>
              <strong>Conversion devis</strong> : {nbDevisAcceptés}/{nbDevis} devis acceptés ({tauxConversion}%)
            </div>
          </div>
        </AvaCard>

        <div style={{ font: `400 11px/1.45 ${SANS}`, color: C.muted, padding: '0 4px' }}>
          Ces chiffres ne remplacent pas votre liasse fiscale. Pour la déclaration officielle,
          téléchargez l&apos;export CSV sur <a href="/comptabilite" style={{ color: C.ink2 }}>/comptabilite</a>
          {' '}et transmettez-le à votre expert-comptable.
        </div>
      </div>
    </main>
  );
}
