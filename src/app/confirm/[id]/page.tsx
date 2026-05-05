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
  GenericConfirmActions,
  PaymentLinkActions,
} from '@/components/confirm-actions';
import { TtsButton } from '@/components/tts-button';

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
  const isFind = intent === 'find_document';
  const isSendDoc = intent === 'send_document';
  const isAppointment = intent === 'schedule_appointment';
  const isExpense = intent === 'create_expense_note';
  const isInsights = intent === 'get_insights';
  const isPaymentLink = intent === 'send_payment_link';
  const isListRelances = intent === 'list_relances';
  const isWeeklySummary = intent === 'get_weekly_summary';

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
    candidate_client_email?: string;
    appointment?: {
      title: string;
      starts_at: string;
      ends_at: string | null;
      location: string | null;
      client_id: string | null;
      client_name: string | null;
    };
    expense?: {
      label: string;
      vendor: string | null;
      amount_ttc: number;
      category: string;
      expense_date: string;
    };
    search_results?: Array<{
      id: string;
      kind: 'facture' | 'devis';
      number: string | null;
      client_name: string | null;
      amount_ttc: number;
      issue_date: string;
      status: string;
    }>;
    payment_link?: {
      invoice_id: string;
      invoice_number: string | null;
      amount_ttc: number;
      public_url: string;
      mailto: string;
      subject: string;
      body: string;
      to: string;
    };
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a compris :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA vous écoute :</AvaLabel>
            <TtsButton text={avaResponse} label="" autoPlayOnce />
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a préparé une relance :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
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

  // ─── create_expense_note ───────────────────────────────────
  if (isExpense && ent.expense) {
    const exp = ent.expense;
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a compris :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          <AvaCard padding={18}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Dépense
            </div>
            <div style={{ font: `600 32px/1 ${SERIF}`, color: C.warn, marginTop: 8, ...TNUM }}>
              − {formatPriceFR(exp.amount_ttc)}
            </div>
            <div style={{ font: `500 14px/1.4 ${SANS}`, color: C.ink, marginTop: 8 }}>
              {exp.label}{exp.vendor ? ` · ${exp.vendor}` : ''}
            </div>
            <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 4 }}>
              Catégorie : {exp.category} · Date : {exp.expense_date}
            </div>
          </AvaCard>
          <AvaDisclaimer />
          <div style={{ marginTop: 'auto' }}>
            <GenericConfirmActions
              actionId={id}
              redirectTo="/historique"
              confirmLabel="Enregistrer la dépense"
            />
          </div>
        </div>
      </main>
    );
  }

  // ─── schedule_appointment ──────────────────────────────────
  if (isAppointment && ent.appointment) {
    const apt = ent.appointment;
    const start = new Date(apt.starts_at);
    const dateLabel = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeLabel = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a compris :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          <AvaCard padding={18}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Rendez-vous
            </div>
            <div style={{ font: `400 24px/1.2 ${SERIF}`, color: C.ink, marginTop: 6 }}>
              {apt.title}
            </div>
            <div style={{ font: `500 14px/1.4 ${SANS}`, color: C.ink2, marginTop: 8, textTransform: 'capitalize' }}>
              {dateLabel} · {timeLabel}
            </div>
            {apt.location && (
              <div style={{ font: `400 13px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
                📍 {apt.location}
              </div>
            )}
          </AvaCard>
          <AvaDisclaimer />
          <div style={{ marginTop: 'auto' }}>
            <GenericConfirmActions
              actionId={id}
              redirectTo="/"
              confirmLabel="Confirmer le rendez-vous"
            />
          </div>
        </div>
      </main>
    );
  }

  // ─── send_payment_link (V13) ───────────────────────────────
  if (isPaymentLink && ent.payment_link) {
    const pl = ent.payment_link;
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a préparé :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          <AvaCard padding={18}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Lien de paiement
            </div>
            <div style={{ font: `600 22px/1.1 ${SERIF}`, color: C.ink, marginTop: 8 }}>
              Facture {pl.invoice_number ?? ''} — {formatPriceFR(pl.amount_ttc)}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 8 }}>
              Destinataire : {pl.to || '— (email manquant)'}
            </div>
            <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4, wordBreak: 'break-all' }}>
              Lien : {pl.public_url}
            </div>
            <details style={{ marginTop: 12 }}>
              <summary style={{ font: `500 12px/1 ${SANS}`, color: C.ink2, cursor: 'pointer' }}>
                Voir le message
              </summary>
              <div style={{
                marginTop: 8, padding: 10, background: C.soft, borderRadius: 8,
                font: `400 12px/1.45 ${SANS}`, color: C.ink2, whiteSpace: 'pre-wrap',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{pl.subject}</div>
                {pl.body}
              </div>
            </details>
          </AvaCard>
          <AvaDisclaimer />
          <div style={{ marginTop: 'auto' }}>
            <PaymentLinkActions
              actionId={id}
              mailto={pl.mailto}
              publicUrl={pl.public_url}
              hasEmail={!!pl.to}
            />
          </div>
        </div>
      </main>
    );
  }

  // ─── send_document ─────────────────────────────────────────
  if (isSendDoc) {
    const r = ent.search_results?.[0];
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA prépare l&apos;envoi :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          {r && (
            <a
              href={`/${r.kind === 'facture' ? 'factures' : 'devis'}/${r.id}`}
              style={{
                display: 'block', textDecoration: 'none',
                background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 16px',
              }}
            >
              <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                {r.kind === 'facture' ? 'Facture' : 'Devis'}
              </div>
              <div style={{ font: `600 15px/1.3 ${SANS}`, color: C.ink, marginTop: 4 }}>
                {r.client_name ?? 'Sans client'} — {r.number ?? '(brouillon)'}
              </div>
              <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2, ...TNUM }}>
                {formatPriceFR(r.amount_ttc)} · émis {r.issue_date}
              </div>
            </a>
          )}
          <AvaDisclaimer />
          <div style={{ marginTop: 'auto' }}>
            {r && ent.candidate_client_email ? (
              <ReadOnlyActions
                actionId={id}
                primaryHref={`/${r.kind === 'facture' ? 'factures' : 'devis'}/${r.id}`}
                primaryLabel="Ouvrir et envoyer"
              />
            ) : r ? (
              <ReadOnlyActions
                actionId={id}
                primaryHref={`/${r.kind === 'facture' ? 'factures' : 'devis'}/${r.id}`}
                primaryLabel="Ouvrir le document"
              />
            ) : (
              <LowConfidenceActions actionId={id} intent={intent} />
            )}
          </div>
        </div>
      </main>
    );
  }

  // ─── find_document ─────────────────────────────────────────
  if (isFind) {
    const results = ent.search_results ?? [];
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a trouvé :</AvaLabel>
            <TtsButton text={avaResponse} label="" autoPlayOnce />
          </div>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          {results.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((r) => (
                <a
                  key={r.id}
                  href={`/${r.kind === 'facture' ? 'factures' : 'devis'}/${r.id}`}
                  style={{
                    display: 'block', textDecoration: 'none',
                    background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                        {r.kind === 'facture' ? 'Facture' : 'Devis'} · {r.status}
                      </div>
                      <div style={{ font: `600 15px/1.3 ${SANS}`, color: C.ink, marginTop: 4 }}>
                        {r.client_name ?? 'Sans client'}
                      </div>
                      <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted, marginTop: 2, ...TNUM }}>
                        {r.number ?? '(brouillon)'} · {r.issue_date}
                      </div>
                    </div>
                    <div style={{ font: `600 16px/1 ${SERIF}`, color: C.ink, ...TNUM, whiteSpace: 'nowrap' }}>
                      {formatPriceFR(r.amount_ttc)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : null}
          <div style={{ marginTop: 'auto' }}>
            <ReadOnlyActions actionId={id} primaryHref="/" primaryLabel="Retour à l'accueil" />
          </div>
        </div>
      </main>
    );
  }

  // ─── list_relances ─────────────────────────────────────────
  if (isListRelances) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a compris :</AvaLabel>
            <TtsButton text={avaResponse} label="" autoPlayOnce />
          </div>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          <div style={{ font: `400 14px/1.55 ${SANS}`, color: C.ink2 }}>
            La page Relances liste vos factures en retard et celles dont l&apos;échéance approche, avec un bouton pour préparer un email pré-rempli en 1 tap.
          </div>
          <div style={{ marginTop: 'auto' }}>
            <ReadOnlyActions actionId={id} primaryHref="/relances" primaryLabel="Voir mes relances" />
          </div>
        </div>
      </main>
    );
  }

  // ─── get_weekly_summary ────────────────────────────────────
  if (isWeeklySummary) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>Votre semaine :</AvaLabel>
            <TtsButton text={avaResponse} label="" autoPlayOnce />
          </div>
          <div style={{ font: `400 20px/1.45 ${SERIF}`, color: C.ink }}>{avaResponse}</div>
          <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted }}>
            Pour le détail mois par mois, ouvrez le bilan annuel.
          </div>
          <div style={{ marginTop: 'auto' }}>
            <ReadOnlyActions actionId={id} primaryHref="/bilan" primaryLabel="Voir mon bilan" />
          </div>
        </div>
      </main>
    );
  }

  // ─── get_insights ──────────────────────────────────────────
  if (isInsights) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone, display: 'flex', flexDirection: 'column' }}>
        {Header}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA vous conseille :</AvaLabel>
            <TtsButton text={avaResponse} label="" autoPlayOnce />
          </div>
          <div style={{ font: `400 22px/1.45 ${SERIF}`, color: C.ink }}>
            {avaResponse}
          </div>
          <div style={{ font: `400 14px/1.55 ${SANS}`, color: C.ink2 }}>
            Vos insights stratégiques se trouvent sur la page dédiée. AVA y analyse vos 90 derniers jours pour repérer ce qui mérite votre attention.
          </div>
          <div style={{ marginTop: 'auto' }}>
            <ReadOnlyActions actionId={id} primaryHref="/insights" primaryLabel="Voir mes insights" />
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a compris :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a entendu</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AvaLabel>AVA a compris :</AvaLabel>
            <TtsButton text={avaResponse} label="" />
          </div>

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
