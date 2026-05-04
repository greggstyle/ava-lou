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
import { ConfirmActions, LowConfidenceActions } from '@/components/confirm-actions';

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

  // Wrap layout
  const Header = (
    <AvaTopBar title="Confirmation" />
  );

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
