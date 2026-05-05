import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, C, SANS, SERIF } from '@/components/ava';
import { ExportControls } from '@/components/export-controls';
import { formatPriceFR } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ComptabilitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Year-to-date stats so the artisan sees what's about to export
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: invoicesYTD }, { data: quotesYTD }, { data: expensesYTD }] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount_ttc, status')
      .gte('issue_date', yearStart)
      .lte('issue_date', today),
    supabase
      .from('quotes')
      .select('id')
      .gte('issue_date', yearStart)
      .lte('issue_date', today),
    supabase
      .from('expenses')
      .select('amount_ttc')
      .gte('expense_date', yearStart)
      .lte('expense_date', today),
  ]);

  const invCount = invoicesYTD?.length ?? 0;
  const invPaidTotal = (invoicesYTD ?? [])
    .filter((i) => i.status === 'payée')
    .reduce((s, i) => s + Number(i.amount_ttc), 0);
  const invPendingTotal = (invoicesYTD ?? [])
    .filter((i) => i.status === 'envoyée' || i.status === 'en_retard')
    .reduce((s, i) => s + Number(i.amount_ttc), 0);
  const quoteCount = quotesYTD?.length ?? 0;
  const expCount = expensesYTD?.length ?? 0;
  const expTotal = (expensesYTD ?? []).reduce((s, e) => s + Number(e.amount_ttc), 0);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Export comptable" />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.2 ${SERIF}`, color: C.ink, marginTop: 6, letterSpacing: '-0.01em' }}>
          Pour votre <em style={{ fontStyle: 'italic' }}>expert-comptable</em>
        </h1>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginTop: 6, marginBottom: 18 }}>
          Téléchargez factures, devis et dépenses au format CSV (séparateur point-virgule, UTF-8 BOM, montants en virgule décimale) — ouvrable directement dans Excel, importable dans Pennylane, Sellsy, EBP ou Quadra.
        </div>

        {/* YTD snapshot */}
        <AvaCard padding={16} style={{ marginBottom: 16 }}>
          <AvaLabel style={{ marginBottom: 10 }}>Aperçu de l&apos;année en cours</AvaLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, font: `400 14px/1.45 ${SANS}`, color: C.ink2 }}>
            <div>
              <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Factures
              </div>
              <div style={{ font: `600 22px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
                {invCount}
              </div>
              <div style={{ marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
                payées : {formatPriceFR(invPaidTotal)}
              </div>
              <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
                en attente : {formatPriceFR(invPendingTotal)}
              </div>
            </div>
            <div>
              <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Devis
              </div>
              <div style={{ font: `600 22px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
                {quoteCount}
              </div>
            </div>
            <div>
              <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Dépenses
              </div>
              <div style={{ font: `600 22px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
                {expCount}
              </div>
              <div style={{ marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
                total : {formatPriceFR(expTotal)}
              </div>
            </div>
            <div>
              <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Résultat
              </div>
              <div style={{ font: `600 22px/1.1 ${SERIF}`, color: invPaidTotal - expTotal >= 0 ? C.green : C.warn, marginTop: 6 }}>
                {formatPriceFR(invPaidTotal - expTotal)}
              </div>
              <div style={{ marginTop: 4, font: `400 12px/1.4 ${SANS}`, color: C.muted }}>
                recettes − dépenses
              </div>
            </div>
          </div>
        </AvaCard>

        <ExportControls />

        <AvaCard padding={16} style={{ marginTop: 18 }}>
          <AvaLabel style={{ marginBottom: 8 }}>Format CSV</AvaLabel>
          <div style={{ font: `400 13px/1.55 ${SANS}`, color: C.ink2 }}>
            Séparateur point-virgule. Encodage UTF-8 avec BOM (Excel détecte automatiquement les accents).
            Montants au format français : <code style={{ background: C.soft, padding: '1px 5px', borderRadius: 4 }}>1 234,56</code>.
            Dates au format <code style={{ background: C.soft, padding: '1px 5px', borderRadius: 4 }}>JJ/MM/AAAA</code>.
            Compatible Excel, LibreOffice, Numbers, et tous les SIG comptables français.
          </div>
        </AvaCard>
      </div>
    </main>
  );
}
