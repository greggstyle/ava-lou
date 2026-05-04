import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, AvaPill, C, SANS, SERIF } from '@/components/ava';
import { formatDateRelativeFR } from '@/lib/format';

export const dynamic = 'force-dynamic';

const INTENT_LABELS: Record<string, string> = {
  create_invoice: 'Création facture',
  create_quote: 'Création devis',
  send_reminder: 'Relance client',
  get_financial_status: 'Trésorerie',
  get_invoice_list: 'Lister factures',
  mark_paid: 'Marquer payée',
  schedule_appointment: 'RDV',
  send_document: 'Envoi document',
  find_document: 'Recherche document',
  sign_document: 'Signature',
  unknown: 'Non identifié',
};

export default async function HistoriquePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: actions } = await supabase
    .from('ava_actions')
    .select('id, intent, input_raw, ava_response, confidence, status, target_table, target_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Historique vocal" />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.15 ${SERIF}`, color: C.ink, marginTop: 6 }}>
          Vos <em style={{ fontStyle: 'italic' }}>commandes vocales</em>
        </h1>

        <div style={{ marginTop: 16, font: `400 13px/1.5 ${SANS}`, color: C.muted, marginBottom: 16 }}>
          Les 100 dernières actions, plus récentes en premier.
        </div>

        {!actions || actions.length === 0 ? (
          <AvaCard padding={20}>
            <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
              Aucune commande vocale pour l&apos;instant. Maintenez le micro et essayez : « Facture pour M. Payet, 3 heures à 55 € ».
            </div>
          </AvaCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.map((a) => {
              const target = a.target_table === 'invoices'
                ? `/factures/${a.target_id}`
                : a.target_table === 'quotes'
                  ? `/devis/${a.target_id}`
                  : a.target_table === 'clients'
                    ? `/clients/${a.target_id}`
                    : null;
              const intentLabel = INTENT_LABELS[a.intent ?? 'unknown'] ?? (a.intent ?? 'inconnu');
              return (
                <AvaCard key={a.id} padding={14}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                      {intentLabel}
                    </div>
                    <AvaPill
                      kind={a.status === 'executed' ? 'success' : a.status === 'cancelled' ? 'warn' : 'neutral'}
                      style={{ padding: '2px 8px', fontSize: 10 }}
                    >
                      {a.status === 'executed' ? 'OK' : a.status}
                    </AvaPill>
                  </div>
                  {a.input_raw && (
                    <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, fontStyle: 'italic', marginBottom: 6 }}>
                      « {a.input_raw} »
                    </div>
                  )}
                  {a.ava_response && (
                    <div style={{ font: `400 14px/1.45 ${SERIF}`, color: C.ink }}>
                      {a.ava_response}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ font: `400 11px/1.3 ${SANS}`, color: C.muted }}>
                      {formatDateRelativeFR(a.created_at)}
                    </span>
                    {target && (
                      <Link href={target} style={{ font: `500 12px/1 ${SANS}`, color: C.green, textDecoration: 'none' }}>
                        Voir →
                      </Link>
                    )}
                  </div>
                </AvaCard>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
