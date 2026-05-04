import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  AvaTopBar,
  AvaCard,
  AvaDisclaimer,
  AvaLabel,
  C,
  SERIF,
  SANS,
  TNUM,
} from '@/components/ava';
import { formatPriceFR, computeTotals } from '@/lib/format';
import type { IntentEntities, LineItem } from '@/lib/types';
import {
  ConfirmActions,
  LowConfidenceActions,
  MarkPaidActions,
  ReminderActions,
  ReadOnlyActions,
} from '@/components/confirm-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConfirmPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: action } = await supabase
    .from('ava_actions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!action) notFound();

  const intent = action.intent as string;
  const entities = (action.entities ?? {}) as Partial<IntentEntities>;
  const confidence = Number(action.confidence ?? 0);
  const avaResponse =
    (action.ava_response as string | null) ??
    "Je n'ai pas tout compris. Pouvez-vous reformuler ?";

  const isUnknown = intent === 'unknown' || confidence < 0.5;
  const isInvoice = intent === 'create_invoice';
  const isQuote = intent === 'create_quote';
  const isDoc = isInvoice || isQuote;
  const isMarkPaid = intent === 'mark_paid';
  const isFinancialStatus = intent === 'get_financial_status';
  const isReminder = intent === 'send_reminder';
  const isInvoiceList = intent === 'get_invoice_list';

  type EnrichedEntities = Partial<IntentEntities> & {
    candidate_invoice_id?: string;
    candidate_invoice_number?: string;
    candidate_invoice_amount?: number;
    candidate_client_name?: string;
    summary?: {
      unpaid_total: number;
      unpaid_count: number;
      overdue_total: number;
      overdue_count: number;
      paid_this_month_total: number;
      paid_this_month_count: number;
      pending_quotes_count: number;
    };
    reminder_subject?: string;
    reminder_body?: string;
    reminder_to?: string;
    list_filter?: string;
  };
  const ent = entities as EnrichedEntities;

  // Wrap layout
  const Header = (
    <AvaTopBar title="Confirmation" />
  );

  // ─── mark_paid ─────────────────────────────────────────────
  if (isMarkPaid) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          <AvaLabel>AVA a compris :</AvaLabel>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          {ent.candidate_invoice_id ? (
            <AvaCard padding={16}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ font: `500 13px/1.3 ${SANS}`, color: C.muted }}>Facture</span>
                <span style={{ font: `600 22px/1.2 ${SERIF}`, color: C.ink }}>
                  {ent.candidate_invoice_number}
                </span>
                <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink2 }}>
                  {ent.candidate_client_name}
                </span>
                <span style={{ font: `600 32px/1 ${SERIF}`, color: C.green, marginTop: 8, ...TNUM }}>
                  {formatPriceFR(Number(ent.candidate_invoice_amount ?? 0))}
                </span>
              </div>
            </AvaCard>
          ) : null}
          <AvaDisclaimer />
          <div style={{ marginTop: 'auto' }}>
            {ent.candidate_invoice_id ? (
              <MarkPaidActions actionId={id} invoiceId={ent.candidate_invoice_id} />
            ) : (
              <LowConfidenceActions actionId={id} intent={intent} />
            )}
          </div>
        </div>
      </main>
    );
  }

  // ─── get_financial_status ──────────────────────────────────
  if (isFinancialStatus && ent.summary) {
    const s = ent.summary;
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <AvaLabel>AVA vous écoute :</AvaLabel>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <AvaCard padding={16}>
              <AvaLabel>À encaisser</AvaLabel>
              <div style={{ font: `600 24px/1.1 ${SERIF}`, color: C.ink, marginTop: 6, ...TNUM }}>
                {formatPriceFR(s.unpaid_total)}
              </div>
              <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                {s.unpaid_count} facture{s.unpaid_count > 1 ? 's' : ''}
              </div>
            </AvaCard>
            <AvaCard padding={16}>
              <AvaLabel color={C.warn}>En retard</AvaLabel>
              <div style={{ font: `600 24px/1.1 ${SERIF}`, color: s.overdue_total > 0 ? C.warn : C.ink, marginTop: 6, ...TNUM }}>
                {formatPriceFR(s.overdue_total)}
              </div>
              <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                {s.overdue_count} facture{s.overdue_count > 1 ? 's' : ''}
              </div>
            </AvaCard>
            <AvaCard padding={16}>
              <AvaLabel color={C.green}>Encaissé ce mois</AvaLabel>
              <div style={{ font: `600 24px/1.1 ${SERIF}`, color: C.green, marginTop: 6, ...TNUM }}>
                {formatPriceFR(s.paid_this_month_total)}
              </div>
              <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                {s.paid_this_month_count} facture{s.paid_this_month_count > 1 ? 's' : ''}
              </div>
            </AvaCard>
            <AvaCard padding={16}>
              <AvaLabel>Devis en attente</AvaLabel>
              <div style={{ font: `600 24px/1.1 ${SERIF}`, color: C.ink, marginTop: 6 }}>
                {s.pending_quotes_count}
              </div>
              <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                en attente de réponse
              </div>
            </AvaCard>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <ReadOnlyActions actionId={id} primaryHref="/dashboard" primaryLabel="Voir le tableau de bord" />
          </div>
        </div>
      </main>
    );
  }

  // ─── send_reminder ─────────────────────────────────────────
  if (isReminder) {
    const hasDraft = !!ent.reminder_body;
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <AvaLabel>AVA a préparé une relance :</AvaLabel>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          {hasDraft && (
            <AvaCard padding={16}>
              <div style={{ font: `600 13px/1.3 ${SANS}`, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Sujet
              </div>
              <div style={{ font: `500 15px/1.4 ${SANS}`, color: C.ink, marginBottom: 14 }}>
                {ent.reminder_subject}
              </div>
              <div style={{ font: `600 13px/1.3 ${SANS}`, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Message
              </div>
              <div style={{ font: `400 14px/1.55 ${SANS}`, color: C.ink2, whiteSpace: 'pre-wrap' }}>
                {ent.reminder_body}
              </div>
            </AvaCard>
          )}
          <AvaDisclaimer />
          <div style={{ marginTop: 'auto' }}>
            {hasDraft && ent.reminder_to ? (
              <ReminderActions
                actionId={id}
                to={ent.reminder_to}
                subject={ent.reminder_subject ?? ''}
                body={ent.reminder_body ?? ''}
              />
            ) : (
              <LowConfidenceActions actionId={id} intent={intent} />
            )}
          </div>
        </div>
      </main>
    );
  }

  // ─── get_invoice_list ──────────────────────────────────────
  if (isInvoiceList) {
    const filter = ent.list_filter ?? 'all';
    const href = filter === 'unpaid' ? '/factures?status=unpaid' : '/factures';
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          <AvaLabel>AVA a compris :</AvaLabel>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          <div style={{ marginTop: 'auto' }}>
            <ReadOnlyActions actionId={id} primaryHref={href} primaryLabel="Voir mes factures" />
          </div>
        </div>
      </main>
    );
  }

  if (isUnknown) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
          <AvaLabel>AVA a entendu</AvaLabel>
          {action.input_raw && (
            <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, fontStyle: 'italic' }}>
              « {action.input_raw} »
            </div>
          )}
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>
            {avaResponse}
          </div>
          <AvaDisclaimer />
          <div style={{ marginTop: 'auto' }}>
            <LowConfidenceActions actionId={id} intent={intent} />
          </div>
        </div>
      </main>
    );
  }

  // Document layout
  const lineItems: LineItem[] = Array.isArray(entities.line_items)
    ? (entities.line_items as LineItem[])
    : [];
  const validLines = lineItems.filter(
    (l) => l && typeof l.qty === 'number' && typeof l.unit_price === 'number',
  );
  const totals = validLines.length > 0 ? computeTotals(validLines) : null;
  const successType: 'facture' | 'devis' = isInvoice ? 'facture' : 'devis';

  return (
    <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
      {Header}
      <div style={{ padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AvaLabel>AVA a compris :</AvaLabel>

        <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>

        {isDoc && validLines.length > 0 && (
          <AvaCard padding={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {entities.client_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ font: `500 13px/1.3 ${SANS}`, color: C.muted }}>Client</span>
                  <span style={{ font: `600 14px/1.3 ${SANS}`, color: C.ink, textAlign: 'right' }}>
                    {entities.client_name}
                  </span>
                </div>
              )}
              <div style={{ height: 1, background: C.line }} />
              {validLines.map((l, i) => {
                const subtotal = l.qty * l.unit_price;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ font: `500 14px/1.35 ${SANS}`, color: C.ink, flex: 1 }}>
                        {l.label}
                      </div>
                      <div
                        style={{
                          font: `600 14px/1.35 ${SERIF}`,
                          color: C.ink,
                          whiteSpace: 'nowrap',
                          ...TNUM,
                        }}
                      >
                        {formatPriceFR(subtotal)}
                      </div>
                    </div>
                    <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, ...TNUM }}>
                      {l.qty} × {formatPriceFR(l.unit_price)} · TVA {l.vat_rate}%
                    </div>
                  </div>
                );
              })}
              {totals && (
                <>
                  <div style={{ height: 1, background: C.line }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ font: `500 13px/1.3 ${SANS}`, color: C.muted }}>HT</span>
                    <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink2, ...TNUM }}>
                      {formatPriceFR(totals.amount_ht)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ font: `500 13px/1.3 ${SANS}`, color: C.muted }}>TVA</span>
                    <span style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink2, ...TNUM }}>
                      {formatPriceFR(totals.amount_vat)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </AvaCard>
        )}

        {totals && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <AvaLabel>Total TTC</AvaLabel>
            <div
              style={{
                font: `400 56px/1 ${SERIF}`,
                color: C.ink,
                letterSpacing: '-0.02em',
                ...TNUM,
              }}
            >
              {formatPriceFR(totals.amount_ttc)}
            </div>
          </div>
        )}

        <AvaDisclaimer />

        <ConfirmActions actionId={id} successType={successType} />
      </div>
    </main>
  );
}
