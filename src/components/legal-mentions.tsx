'use client';

import * as React from 'react';
import { AvaCard, AvaLabel, AvaPill, C, SANS, SERIF, TNUM } from '@/components/ava';
import { formatPriceFR, formatDateFR } from '@/lib/format';
import type { Client, Invoice, LineItem, Profile, Quote } from '@/lib/types';

type Doc = Invoice | Quote;
type DocKind = 'facture' | 'devis';

interface VatGroup {
  vat_rate: number;
  ht: number;
  vat: number;
  ttc: number;
}

function groupByVat(lines: LineItem[]): VatGroup[] {
  const map = new Map<number, VatGroup>();
  for (const l of lines) {
    const key = l.vat_rate;
    const ht = l.qty * l.unit_price;
    const vat = ht * (l.vat_rate / 100);
    const existing = map.get(key);
    if (existing) {
      existing.ht += ht;
      existing.vat += vat;
      existing.ttc += ht + vat;
    } else {
      map.set(key, { vat_rate: key, ht, vat, ttc: ht + vat });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.vat_rate - a.vat_rate);
}

/** Pretty-print IBAN with a space every 4 chars (FR76 1234 5678…) */
function formatIban(iban: string): string {
  const compact = iban.replace(/\s+/g, '').toUpperCase();
  return compact.replace(/(.{4})/g, '$1 ').trim();
}

function isInvoice(doc: Doc): doc is Invoice {
  return 'due_date' in doc;
}

export function LegalMentions({
  profile,
  client,
  doc,
  kind,
}: {
  profile: Partial<Profile> | null;
  client: Partial<Client> | null;
  doc: Doc;
  kind: DocKind;
}) {
  const lines = (doc.line_items ?? []) as LineItem[];
  const vatGroups = groupByVat(lines);
  const isInv = isInvoice(doc);

  const vendorName = profile?.company_name?.trim() || profile?.full_name?.trim() || '—';
  const vendorAddress = [profile?.address, [profile?.postal_code, profile?.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const buyerName = client?.is_business
    ? client?.company_name?.trim() || client?.name?.trim() || '—'
    : client?.name?.trim() || '—';
  const buyerAddress = [client?.address, [client?.postal_code, client?.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  return (
    <AvaCard padding={20} style={{ marginTop: 16 }}>
      <AvaLabel style={{ marginBottom: 12 }}>Document — Mentions légales</AvaLabel>

      {/* Header: doc number + dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            {kind === 'facture' ? 'Facture' : 'Devis'} N°
          </div>
          <div style={{ font: `600 18px/1.2 ${SERIF}`, color: C.ink, marginTop: 2, ...TNUM }}>
            {doc.number ?? 'Brouillon'}
          </div>
        </div>
        <div>
          <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Émise le
          </div>
          <div style={{ font: `400 15px/1.2 ${SANS}`, color: C.ink, marginTop: 4 }}>
            {formatDateFR(doc.issue_date)}
          </div>
        </div>
      </div>

      {/* Vendor */}
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>
          Vendeur
        </div>
        <div style={{ font: `600 15px/1.4 ${SANS}`, color: C.ink }}>{vendorName}</div>
        {vendorAddress && (
          <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2, marginTop: 2 }}>{vendorAddress}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {profile?.siret && <AvaPill kind="neutral">SIRET {profile.siret}</AvaPill>}
          {profile?.naf_code && <AvaPill kind="neutral">NAF {profile.naf_code}</AvaPill>}
          {profile?.legal_form && <AvaPill kind="neutral">{profile.legal_form}</AvaPill>}
          {profile?.capital_social != null && profile.capital_social > 0 && (
            <AvaPill kind="neutral">Capital {formatPriceFR(Number(profile.capital_social))}</AvaPill>
          )}
          {profile?.rcs && <AvaPill kind="neutral">{profile.rcs}</AvaPill>}
          {profile?.vat_intra && <AvaPill kind="neutral">TVA {profile.vat_intra}</AvaPill>}
        </div>
      </div>

      {/* Buyer */}
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>
          Client
        </div>
        <div style={{ font: `600 15px/1.4 ${SANS}`, color: C.ink }}>{buyerName}</div>
        {buyerAddress && (
          <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2, marginTop: 2 }}>{buyerAddress}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {client?.email && <AvaPill kind="neutral">{client.email}</AvaPill>}
          {client?.is_business && client?.siret && <AvaPill kind="neutral">SIRET {client.siret}</AvaPill>}
          {client?.is_business && client?.vat_intra && <AvaPill kind="neutral">TVA {client.vat_intra}</AvaPill>}
        </div>
      </div>

      {/* Line items */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
          Détail
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
              <div style={{ flex: 1, font: `400 14px/1.4 ${SANS}`, color: C.ink }}>
                {l.label}
                <span style={{ color: C.muted, marginLeft: 6 }}>· {l.qty} × {formatPriceFR(l.unit_price)} (TVA {l.vat_rate}%)</span>
              </div>
              <div style={{ font: `600 14px/1.4 ${SERIF}`, color: C.ink, ...TNUM, whiteSpace: 'nowrap' }}>
                {formatPriceFR(l.qty * l.unit_price)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div style={{ marginBottom: 16, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        {vatGroups.map((g) => (
          <div key={g.vat_rate} style={{ display: 'flex', justifyContent: 'space-between', font: `400 13px/1.5 ${SANS}`, color: C.ink2 }}>
            <span>HT à {g.vat_rate}% · TVA {formatPriceFR(g.vat)}</span>
            <span style={{ ...TNUM }}>{formatPriceFR(g.ht)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
          <span style={{ font: `500 13px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Total TTC
          </span>
          <span style={{ font: `600 26px/1 ${SERIF}`, color: C.ink, ...TNUM }}>
            {formatPriceFR(Number(doc.amount_ttc))}
          </span>
        </div>
      </div>

      {/* Invoice-specific: payment & penalties */}
      {isInv && (
        <div style={{ font: `400 12px/1.55 ${SANS}`, color: C.ink2, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <div>
            <strong>Échéance</strong> : {doc.due_date ? formatDateFR(doc.due_date) : 'à réception de facture'}
          </div>
          {(profile?.iban || profile?.bic) && (
            <div style={{
              marginTop: 10, padding: 10, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 8,
              font: `400 12px/1.55 ${SANS}`, color: C.ink,
            }}>
              <strong>Règlement par virement</strong>
              {profile?.bank_name && <> — {profile.bank_name}</>}
              {profile?.iban && (
                <div style={{ marginTop: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.04em' }}>
                  IBAN : {formatIban(profile.iban)}
                </div>
              )}
              {profile?.bic && (
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.04em' }}>
                  BIC : {profile.bic}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <strong>Pénalités de retard</strong> : taux {profile?.late_penalty_rate ?? 10.5} % l&apos;an. Indemnité forfaitaire pour frais de recouvrement : {formatPriceFR(profile?.late_penalty_indemnity ?? 40)} (art. D441-5 du Code de commerce).
          </div>
          {profile?.tva_franchise && (
            <div style={{ marginTop: 6 }}>TVA non applicable, art. 293 B du CGI.</div>
          )}
          {profile?.b2c_mediator && !client?.is_business && (
            <div style={{ marginTop: 6 }}>
              <strong>Médiateur de la consommation</strong> : {profile.b2c_mediator}
            </div>
          )}
        </div>
      )}

      {/* Quote-specific: validity + acceptance space */}
      {!isInv && (
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2 }}>
            <strong>Validité</strong> : {doc.expiry_date ? `jusqu'au ${formatDateFR(doc.expiry_date)}` : '30 jours à compter de la date d\'émission'}
          </div>
          <div style={{ font: `400 12px/1.5 ${SANS}`, color: C.muted, marginTop: 6 }}>
            Devis gratuit. Sauf accord écrit, pas de frais d&apos;établissement.
          </div>
          <div style={{
            marginTop: 14, padding: '14px 14px',
            background: C.soft, border: `1px dashed ${C.line}`, borderRadius: 12,
            font: `400 13px/1.5 ${SANS}`, color: C.ink,
          }}>
            <strong>Bon pour accord</strong> — date et signature du client :
            <div style={{ marginTop: 14, height: 40, borderBottom: `1px solid ${C.line}` }} />
          </div>
        </div>
      )}
    </AvaCard>
  );
}
