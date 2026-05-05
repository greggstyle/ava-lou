/**
 * Server-side PDF generation for AVA invoices and quotes.
 *
 * Uses @react-pdf/renderer (pure JS, no Chromium binary, runs on Vercel
 * serverless without cold-start size penalty).
 *
 * Onde aesthetic preserved as much as possible:
 *   - Instrument Serif for amounts/titles (loaded as TTF or fallback to Times)
 *   - Inter Tight not available without remote font registration; fallback Helvetica
 *   - Warm bone background, navy text, green accent on totals
 *   - Hairline borders 1pt, no shadows, no decorative imagery
 *
 * Layout: A4 portrait, generous margins (18mm top/bottom, 16mm sides),
 * matches the printable /voir/... HTML page so artisans see the same document
 * when they print or download.
 */

import * as React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { formatPriceFR, formatDateFR } from '@/lib/format';
import type { Invoice, Quote, Client, LineItem, Profile } from '@/lib/types';

// Register Instrument Serif for amounts/titles. Fallback to Times if fetch fails
// at cold start. We register from Google Fonts; if offline it gracefully falls back.
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    Font.register({
      family: 'Instrument Serif',
      fonts: [
        {
          src: 'https://fonts.gstatic.com/s/instrumentserif/v9/jizDREVItHgc8qDIbSTKq4XKVjnFuOlnkw.ttf',
          fontStyle: 'normal',
          fontWeight: 400,
        },
        {
          src: 'https://fonts.gstatic.com/s/instrumentserif/v9/jizFREVItHgc8qDIbSTKq4XKVjnFuOlEhsg6Wg.ttf',
          fontStyle: 'italic',
          fontWeight: 400,
        },
      ],
    });
    fontsRegistered = true;
  } catch {
    // Best-effort. Fonts will fall back if registration fails.
  }
}

const C = {
  bone: '#F4F3EE',
  paper: '#FFFFFF',
  ink: '#0B1D33',
  ink2: '#23344B',
  muted: '#6B7480',
  line: '#E5E3DA',
  green: '#1F9D55',
  warn: '#C0552E',
  soft: '#F7F5EE',
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    padding: '18mm 16mm',
    fontFamily: 'Helvetica',
    color: C.ink,
    fontSize: 9,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    marginBottom: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: 11,
    fontWeight: 600,
    color: C.ink,
    letterSpacing: 0.5,
  },
  hero: {
    marginBottom: 18,
  },
  heroTitle: {
    fontFamily: 'Times-Roman',
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.4,
  },
  heroTitleAccent: {
    color: C.green,
    fontFamily: 'Times-Italic',
  },
  heroMeta: {
    fontSize: 9,
    color: C.muted,
    marginTop: 4,
  },
  heroTotal: {
    fontFamily: 'Times-Roman',
    fontSize: 18,
    color: C.ink,
    marginTop: 10,
  },
  identityRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  identityBlock: {
    flex: 1,
    paddingRight: 8,
  },
  identityLabel: {
    fontSize: 7,
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  identityName: {
    fontSize: 11,
    fontWeight: 600,
    color: C.ink,
    marginBottom: 3,
  },
  identityLine: {
    fontSize: 9,
    color: C.ink2,
    marginBottom: 1,
  },
  identityPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  identityPill: {
    backgroundColor: C.soft,
    borderWidth: 0.5,
    borderColor: C.line,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 7,
    color: C.ink2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.soft,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: C.line,
    fontSize: 7,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.25,
    borderBottomColor: C.line,
    fontSize: 9,
    color: C.ink,
  },
  colLabel: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnit: { flex: 1.5, textAlign: 'right' },
  colVat: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  totalsBlock: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    fontSize: 9,
    color: C.ink2,
    marginBottom: 2,
  },
  totalsLabel: {
    color: C.muted,
    fontSize: 9,
  },
  totalsValue: {
    color: C.ink,
    fontSize: 10,
    minWidth: 70,
    textAlign: 'right',
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
  },
  grandLabel: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  grandValue: {
    fontFamily: 'Times-Roman',
    fontSize: 18,
    color: C.ink,
  },
  notesBlock: {
    marginTop: 18,
    padding: 10,
    backgroundColor: C.soft,
    borderRadius: 4,
    fontSize: 9,
    color: C.ink2,
  },
  legalBlock: {
    marginTop: 16,
    fontSize: 7.5,
    color: C.ink2,
    lineHeight: 1.45,
  },
  legalParagraph: {
    marginBottom: 4,
  },
  signatureBox: {
    marginTop: 24,
    padding: 14,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: C.line,
    backgroundColor: C.soft,
    fontSize: 9,
    color: C.ink,
  },
  signatureLine: {
    height: 28,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    textAlign: 'center',
    fontSize: 7,
    color: C.muted,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
  },
});

interface DocPDFProps {
  doc: Invoice | Quote;
  client: Partial<Client> | null;
  profile: Partial<Profile> | null;
  kind: 'facture' | 'devis';
}

interface VatGroup {
  vat_rate: number;
  ht: number;
  vat: number;
}

function groupByVat(lines: LineItem[]): VatGroup[] {
  const map = new Map<number, VatGroup>();
  for (const l of lines) {
    const ht = l.qty * l.unit_price;
    const vat = ht * (l.vat_rate / 100);
    const existing = map.get(l.vat_rate);
    if (existing) {
      existing.ht += ht;
      existing.vat += vat;
    } else {
      map.set(l.vat_rate, { vat_rate: l.vat_rate, ht, vat });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.vat_rate - a.vat_rate);
}

function isInvoice(d: Invoice | Quote): d is Invoice {
  return 'due_date' in d;
}

export function InvoicePDF({ doc, client, profile, kind }: DocPDFProps) {
  ensureFonts();

  const lines = (doc.line_items ?? []) as LineItem[];
  const vatGroups = groupByVat(lines);
  const inv = isInvoice(doc);

  const vendorName = profile?.company_name?.trim() || profile?.full_name?.trim() || '—';
  const vendorAddr = [profile?.address, [profile?.postal_code, profile?.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const buyerName = client?.is_business
    ? (client?.company_name?.trim() || client?.name?.trim() || '—')
    : (client?.name?.trim() || '—');
  const buyerAddr = [client?.address, [client?.postal_code, client?.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const docNumber = doc.number ?? 'Brouillon';
  const docKindLabel = kind === 'facture' ? 'Facture' : 'Devis';
  const dateLabel = kind === 'facture' ? 'Émise le' : 'Émis le';

  return (
    <Document
      title={`${docKindLabel} ${docNumber}`}
      author={vendorName}
      subject={`${docKindLabel} pour ${buyerName}`}
      creator="AVA — Assistance Vocale Administrative"
      producer="AVA"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <Text style={styles.brandText}>AVA · {vendorName}</Text>
          </View>
          <Text style={{ fontSize: 8, color: C.muted }}>{docKindLabel} {docNumber}</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {docKindLabel}{' '}
            <Text style={styles.heroTitleAccent}>{docNumber}</Text>
          </Text>
          <Text style={styles.heroMeta}>
            {dateLabel} {formatDateFR(doc.issue_date)}
            {inv && doc.due_date ? `  ·  Échéance ${formatDateFR(doc.due_date)}` : ''}
            {!inv && (doc as Quote).expiry_date ? `  ·  Validité jusqu'au ${formatDateFR((doc as Quote).expiry_date!)}` : ''}
          </Text>
          <Text style={styles.heroTotal}>
            Total TTC : {formatPriceFR(Number(doc.amount_ttc))}
          </Text>
        </View>

        {/* Identities */}
        <View style={styles.identityRow}>
          <View style={styles.identityBlock}>
            <Text style={styles.identityLabel}>Vendeur</Text>
            <Text style={styles.identityName}>{vendorName}</Text>
            {vendorAddr ? <Text style={styles.identityLine}>{vendorAddr}</Text> : null}
            <View style={styles.identityPills}>
              {profile?.siret ? <Text style={styles.identityPill}>SIRET {profile.siret}</Text> : null}
              {profile?.naf_code ? <Text style={styles.identityPill}>NAF {profile.naf_code}</Text> : null}
              {profile?.legal_form ? <Text style={styles.identityPill}>{profile.legal_form}</Text> : null}
              {profile?.capital_social != null && Number(profile.capital_social) > 0 ? (
                <Text style={styles.identityPill}>Capital {formatPriceFR(Number(profile.capital_social))}</Text>
              ) : null}
              {profile?.rcs ? <Text style={styles.identityPill}>{profile.rcs}</Text> : null}
              {profile?.vat_intra ? <Text style={styles.identityPill}>TVA {profile.vat_intra}</Text> : null}
            </View>
          </View>

          <View style={styles.identityBlock}>
            <Text style={styles.identityLabel}>Client</Text>
            <Text style={styles.identityName}>{buyerName}</Text>
            {buyerAddr ? <Text style={styles.identityLine}>{buyerAddr}</Text> : null}
            <View style={styles.identityPills}>
              {client?.is_business && client?.siret ? (
                <Text style={styles.identityPill}>SIRET {client.siret}</Text>
              ) : null}
              {client?.is_business && client?.vat_intra ? (
                <Text style={styles.identityPill}>TVA {client.vat_intra}</Text>
              ) : null}
              {client?.email ? <Text style={styles.identityPill}>{client.email}</Text> : null}
            </View>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.tableHeader}>
          <Text style={styles.colLabel}>Désignation</Text>
          <Text style={styles.colQty}>Qté</Text>
          <Text style={styles.colUnit}>PU HT</Text>
          <Text style={styles.colVat}>TVA</Text>
          <Text style={styles.colTotal}>Total HT</Text>
        </View>
        {lines.map((l, i) => {
          const lineHt = l.qty * l.unit_price;
          return (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colLabel}>{l.label}</Text>
              <Text style={styles.colQty}>{l.qty}</Text>
              <Text style={styles.colUnit}>{formatPriceFR(l.unit_price)}</Text>
              <Text style={styles.colVat}>{l.vat_rate}%</Text>
              <Text style={styles.colTotal}>{formatPriceFR(lineHt)}</Text>
            </View>
          );
        })}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          {vatGroups.map((g) => (
            <View key={g.vat_rate} style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>HT à {g.vat_rate}%</Text>
              <Text style={styles.totalsValue}>{formatPriceFR(g.ht)}</Text>
            </View>
          ))}
          {vatGroups.map((g) => (
            <View key={`vat-${g.vat_rate}`} style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>TVA {g.vat_rate}%</Text>
              <Text style={styles.totalsValue}>{formatPriceFR(g.vat)}</Text>
            </View>
          ))}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total HT</Text>
            <Text style={styles.totalsValue}>{formatPriceFR(Number(doc.amount_ht))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total TVA</Text>
            <Text style={styles.totalsValue}>{formatPriceFR(Number(doc.amount_vat))}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total TTC</Text>
            <Text style={styles.grandValue}>{formatPriceFR(Number(doc.amount_ttc))}</Text>
          </View>
        </View>

        {/* Notes */}
        {doc.notes ? (
          <View style={styles.notesBlock}>
            <Text style={[styles.identityLabel, { marginBottom: 4 }]}>Notes</Text>
            <Text>{doc.notes}</Text>
          </View>
        ) : null}

        {/* Legal block */}
        <View style={styles.legalBlock}>
          {inv ? (
            <>
              <Text style={styles.legalParagraph}>
                <Text style={{ fontWeight: 600 }}>Échéance : </Text>
                {(doc as Invoice).due_date ? formatDateFR((doc as Invoice).due_date!) : 'à réception de facture'}
              </Text>
              <Text style={styles.legalParagraph}>
                <Text style={{ fontWeight: 600 }}>Pénalités de retard : </Text>
                taux {profile?.late_penalty_rate ?? 10.5} % l&apos;an. Indemnité forfaitaire pour frais de
                recouvrement : {formatPriceFR(Number(profile?.late_penalty_indemnity ?? 40))} (art. D441-5
                du Code de commerce).
              </Text>
              {profile?.tva_franchise ? (
                <Text style={styles.legalParagraph}>TVA non applicable, art. 293 B du CGI.</Text>
              ) : null}
              {profile?.b2c_mediator && !client?.is_business ? (
                <Text style={styles.legalParagraph}>
                  <Text style={{ fontWeight: 600 }}>Médiateur de la consommation : </Text>
                  {profile.b2c_mediator}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.legalParagraph}>
                <Text style={{ fontWeight: 600 }}>Validité : </Text>
                {(doc as Quote).expiry_date
                  ? `jusqu'au ${formatDateFR((doc as Quote).expiry_date!)}`
                  : '30 jours à compter de la date d\'émission'}
              </Text>
              <Text style={styles.legalParagraph}>
                Devis gratuit. Sauf accord écrit, pas de frais d&apos;établissement.
              </Text>
            </>
          )}
        </View>

        {/* Devis: Bon pour accord box */}
        {!inv ? (
          <View style={styles.signatureBox}>
            <Text style={{ fontWeight: 600 }}>Bon pour accord</Text>
            <Text style={{ marginTop: 4, color: C.muted }}>Date et signature du client :</Text>
            <View style={styles.signatureLine} />
          </View>
        ) : null}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          {docKindLabel} {docNumber} · Document généré via AVA · ava-lou.vercel.app
        </Text>
      </Page>
    </Document>
  );
}
