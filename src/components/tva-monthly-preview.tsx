'use client';

import * as React from 'react';
import { AvaCard, AvaButton, AvaLabel, C, SANS, SERIF, TNUM } from '@/components/ava';
import { formatPriceFR } from '@/lib/format';

interface Bucket {
  vat_rate: number;
  ht: number;
  vat: number;
  ttc: number;
  count: number;
}

interface TvaResponse {
  month: string;
  range: { from: string; to: string };
  collected: { total_ht: number; total_vat: number; total_ttc: number; invoice_count: number; by_rate: Bucket[] };
  deductible: { total_ht: number; total_vat: number; total_ttc: number; expense_count: number; by_rate: Bucket[] };
  balance: { vat_due: number; direction: 'à reverser' | 'crédit de TVA' };
}

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function defaultMonth(): string {
  // Default to previous month — that's what artisans declare on the 15th
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const inputStyle: React.CSSProperties = {
  background: C.paper,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: '12px 14px',
  font: `500 15px/1.3 ${SANS}`,
  color: C.ink,
  width: '100%',
  outline: 'none',
};

export function TvaMonthlyPreview() {
  const [month, setMonth] = React.useState(defaultMonth());
  const [data, setData] = React.useState<TvaResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function load(m: string) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tva-monthly?month=${encodeURIComponent(m)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur de calcul');
      }
      const j = (await res.json()) as TvaResponse;
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load default month on mount
  React.useEffect(() => { void load(month); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const [yearStr, monthStr] = month.split('-');
  const monthLabel = MONTH_LABELS[parseInt(monthStr, 10) - 1];

  return (
    <AvaCard padding={16}>
      <AvaLabel style={{ marginBottom: 10 }}>Pré-déclaration TVA mensuelle</AvaLabel>
      <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, marginBottom: 12 }}>
        Aperçu pour pré-remplir votre formulaire CA3. Encaissements = TVA collectée.
        Dépenses = TVA déductible. À valider par votre comptable selon votre régime.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <input
            type="month"
            style={inputStyle}
            value={month}
            onChange={(e) => { setMonth(e.target.value); void load(e.target.value); }}
          />
        </div>
        <AvaButton kind="light" onClick={() => void load(month)} disabled={loading}>
          {loading ? '...' : 'Recalculer'}
        </AvaButton>
      </div>

      {err && (
        <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn, padding: 10, background: C.soft, borderRadius: 8 }}>
          {err}
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginBottom: -4 }}>
            {monthLabel} {yearStr}
          </div>

          {/* Collected section */}
          <div>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              TVA collectée — encaissements
            </div>
            {data.collected.invoice_count === 0 ? (
              <div style={{ font: `400 13px/1.4 ${SANS}`, color: C.muted, padding: 8, background: C.soft, borderRadius: 6 }}>
                Aucune facture encaissée ce mois-ci.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.collected.by_rate.map((b) => (
                  <div key={`c-${b.vat_rate}`} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 8, font: `400 13px/1.4 ${SANS}`, color: C.ink2, ...TNUM }}>
                    <span style={{ fontWeight: 600 }}>{b.vat_rate}%</span>
                    <span>HT {formatPriceFR(b.ht)}</span>
                    <span style={{ textAlign: 'right' }}>TVA {formatPriceFR(b.vat)}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: C.line, marginTop: 4 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 14px/1.3 ${SANS}`, color: C.ink, ...TNUM }}>
                  <span>Total TVA collectée</span>
                  <span>{formatPriceFR(data.collected.total_vat)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Deductible section */}
          <div>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
              TVA déductible — dépenses
            </div>
            {data.deductible.expense_count === 0 ? (
              <div style={{ font: `400 13px/1.4 ${SANS}`, color: C.muted, padding: 8, background: C.soft, borderRadius: 6 }}>
                Aucune dépense ce mois-ci.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.deductible.by_rate.map((b) => (
                  <div key={`d-${b.vat_rate}`} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 8, font: `400 13px/1.4 ${SANS}`, color: C.ink2, ...TNUM }}>
                    <span style={{ fontWeight: 600 }}>{b.vat_rate}%</span>
                    <span>HT {formatPriceFR(b.ht)}</span>
                    <span style={{ textAlign: 'right' }}>TVA {formatPriceFR(b.vat)}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: C.line, marginTop: 4 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 14px/1.3 ${SANS}`, color: C.ink, ...TNUM }}>
                  <span>Total TVA déductible</span>
                  <span>{formatPriceFR(data.deductible.total_vat)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Balance */}
          <div style={{
            padding: 14, background: data.balance.vat_due >= 0 ? C.warmYellow : C.greenSoft,
            borderRadius: 10, border: `1px solid ${C.line}`,
          }}>
            <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Solde TVA estimé — {data.balance.direction}
            </div>
            <div style={{ font: `600 26px/1.1 ${SERIF}`, color: data.balance.vat_due >= 0 ? C.warn : C.green, marginTop: 6, ...TNUM }}>
              {formatPriceFR(Math.abs(data.balance.vat_due))}
            </div>
            <div style={{ font: `400 12px/1.45 ${SANS}`, color: C.ink2, marginTop: 4 }}>
              Estimation indicative. Votre comptable affinera selon votre régime
              (réel simplifié, normal, débits, encaissements).
            </div>
          </div>
        </div>
      )}
    </AvaCard>
  );
}
