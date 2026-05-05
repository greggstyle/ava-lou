/**
 * Bilan annuel PDF — résumé de l'année pour l'expert-comptable.
 *
 * Format A4 portrait, deux pages max :
 *   1. Synthèse (recettes, dépenses, résultat, TVA, repères)
 *   2. Détail mensuel (12 lignes : recettes payées, en attente, dépenses, solde)
 *
 * Reuses the Onde aesthetic from invoice-pdf.tsx (warm bone, navy ink,
 * Instrument Serif via Times fallback). Generated server-side via
 * @react-pdf/renderer like the invoice PDF — runs on Vercel serverless
 * without Chromium.
 */

import * as React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { formatPriceFR } from '@/lib/format';
import type { Profile } from '@/lib/types';

const C = {
  bone: '#F4F3EE',
  paper: '#FFFFFF',
  ink: '#0B1D33',
  ink2: '#23344B',
  muted: '#6B7480',
  line: '#E5E3DA',
  green: '#1F9D55',
  greenSoft: '#E6F6EC',
  warn: '#C0552E',
  warmYellow: '#FFF5CC',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
    marginBottom: 18,
  },
  brand: { fontSize: 10, fontWeight: 600, color: C.ink, letterSpacing: 0.5 },
  meta: { fontSize: 8, color: C.muted },
  title: {
    fontFamily: 'Times-Roman',
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  titleAccent: { fontFamily: 'Times-Italic', color: C.green },
  subtitle: { fontSize: 10, color: C.muted, marginBottom: 18 },

  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  card: {
    width: '48%',
    borderWidth: 0.5,
    borderColor: C.line,
    borderRadius: 6,
    padding: 12,
    backgroundColor: C.paper,
  },
  cardLabel: { fontSize: 7, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  cardValue: { fontFamily: 'Times-Roman', fontSize: 18, color: C.ink, marginBottom: 2 },
  cardValueGreen: { color: C.green },
  cardValueWarn: { color: C.warn },
  cardSub: { fontSize: 8, color: C.muted },

  sectionLabel: {
    fontSize: 8,
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 14,
  },
  table: {
    borderWidth: 0.5,
    borderColor: C.line,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.soft,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  tableHeaderCell: { fontSize: 7, color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableCell: { fontSize: 9, color: C.ink2 },
  colMonth: { width: '20%' },
  colNum: { width: '20%', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: C.bone,
  },
  totalLabel: { fontSize: 9, fontWeight: 600, color: C.ink },
  totalValue: { fontSize: 10, fontWeight: 600, color: C.ink, fontFamily: 'Times-Roman' },

  vatBox: {
    backgroundColor: C.warmYellow,
    borderWidth: 0.5,
    borderColor: C.line,
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
  },
  vatLabel: { fontSize: 7, color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  vatValue: { fontFamily: 'Times-Roman', fontSize: 16, color: C.ink },
  vatNote: { fontSize: 8, color: C.ink2, marginTop: 4 },

  footer: {
    position: 'absolute',
    bottom: 12,
    left: '16mm',
    right: '16mm',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: C.muted,
  },
});

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export interface BilanData {
  year: number;
  totalRecettesTTC: number;
  totalRecettesHT: number;
  totalTVAcollectee: number;
  totalDepensesTTC: number;
  totalDepensesHT: number;
  totalImpaye: number;
  resultatNet: number;
  nbFacturesPayees: number;
  nbFacturesEnAttente: number;
  nbDevis: number;
  nbDevisAcceptes: number;
  bestMonth: { idx: number; recettes: number };
  months: Array<{
    recettes: number;
    impaye: number;
    depenses: number;
  }>;
}

interface BilanPDFProps {
  data: BilanData;
  profile: Partial<Profile> | null;
  generatedAt: Date;
}

export function BilanPDF({ data, profile, generatedAt }: BilanPDFProps) {
  const tvaSolde = data.totalTVAcollectee - Math.max(0, data.totalDepensesTTC - data.totalDepensesHT);
  const tvaDeductibleEst = Math.max(0, data.totalDepensesTTC - data.totalDepensesHT);

  return (
    <Document
      title={`Bilan ${data.year} — ${profile?.company_name || profile?.full_name || 'AVA'}`}
      author={profile?.company_name || profile?.full_name || 'AVA'}
      subject={`Bilan annuel ${data.year}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
              AVA · {profile?.company_name || profile?.full_name || 'Document'}
            </Text>
            {profile?.siret && <Text style={styles.meta}>SIRET {profile.siret}</Text>}
          </View>
          <View>
            <Text style={styles.meta}>
              Généré le {generatedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.meta}>Pour votre expert-comptable</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Bilan <Text style={styles.titleAccent}>{data.year}</Text>
        </Text>
        <Text style={styles.subtitle}>
          Vue d&apos;ensemble — recettes encaissées, dépenses, résultat net, TVA estimée.
        </Text>

        {/* Headline cards */}
        <View style={styles.cardsGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Recettes encaissées</Text>
            <Text style={styles.cardValue}>{formatPriceFR(data.totalRecettesTTC)}</Text>
            <Text style={styles.cardSub}>{data.nbFacturesPayees} facture{data.nbFacturesPayees > 1 ? 's' : ''} payée{data.nbFacturesPayees > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Dépenses</Text>
            <Text style={styles.cardValue}>{formatPriceFR(data.totalDepensesTTC)}</Text>
            <Text style={styles.cardSub}>HT {formatPriceFR(data.totalDepensesHT)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Résultat net</Text>
            <Text style={data.resultatNet >= 0 ? [styles.cardValue, styles.cardValueGreen] : [styles.cardValue, styles.cardValueWarn]}>
              {formatPriceFR(data.resultatNet)}
            </Text>
            <Text style={styles.cardSub}>recettes − dépenses</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Impayés</Text>
            <Text style={data.totalImpaye > 0 ? [styles.cardValue, styles.cardValueWarn] : styles.cardValue}>
              {formatPriceFR(data.totalImpaye)}
            </Text>
            <Text style={styles.cardSub}>{data.nbFacturesEnAttente} facture{data.nbFacturesEnAttente > 1 ? 's' : ''} en attente</Text>
          </View>
        </View>

        {/* Monthly breakdown table */}
        <Text style={styles.sectionLabel}>Détail mensuel</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colMonth]}>Mois</Text>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>Recettes</Text>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>En attente</Text>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>Dépenses</Text>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>Solde mois</Text>
          </View>
          {data.months.map((m, i) => {
            const solde = m.recettes - m.depenses;
            const isLast = i === 11;
            return (
              <View key={i} style={isLast ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}>
                <Text style={[styles.tableCell, styles.colMonth]}>{MONTHS[i]}</Text>
                <Text style={[styles.tableCell, styles.colNum]}>{formatPriceFR(m.recettes)}</Text>
                <Text style={m.impaye > 0 ? [styles.tableCell, styles.colNum, { color: C.warn }] : [styles.tableCell, styles.colNum]}>
                  {formatPriceFR(m.impaye)}
                </Text>
                <Text style={[styles.tableCell, styles.colNum]}>{formatPriceFR(m.depenses)}</Text>
                <Text style={solde >= 0 ? [styles.tableCell, styles.colNum, { color: C.green }] : [styles.tableCell, styles.colNum, { color: C.warn }]}>
                  {formatPriceFR(solde)}
                </Text>
              </View>
            );
          })}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.colMonth]}>Total {data.year}</Text>
            <Text style={[styles.totalValue, styles.colNum]}>{formatPriceFR(data.totalRecettesTTC)}</Text>
            <Text style={[styles.totalValue, styles.colNum]}>{formatPriceFR(data.totalImpaye)}</Text>
            <Text style={[styles.totalValue, styles.colNum]}>{formatPriceFR(data.totalDepensesTTC)}</Text>
            <Text style={data.resultatNet >= 0 ? [styles.totalValue, styles.colNum, { color: C.green }] : [styles.totalValue, styles.colNum, { color: C.warn }]}>
              {formatPriceFR(data.resultatNet)}
            </Text>
          </View>
        </View>

        {/* TVA box */}
        <View style={styles.vatBox}>
          <Text style={styles.vatLabel}>TVA estimée — {tvaSolde >= 0 ? 'à reverser' : 'crédit'}</Text>
          <Text style={styles.vatValue}>{formatPriceFR(Math.abs(tvaSolde))}</Text>
          <Text style={styles.vatNote}>
            Collectée : {formatPriceFR(data.totalTVAcollectee)} (sur recettes HT {formatPriceFR(data.totalRecettesHT)}).
            Déductible estimée : {formatPriceFR(tvaDeductibleEst)}.
            À valider par votre comptable selon votre régime (réel simplifié, normal, débits, encaissements).
          </Text>
        </View>

        {/* Repères */}
        <Text style={styles.sectionLabel}>Repères</Text>
        <View>
          <Text style={{ fontSize: 9, color: C.ink2, marginBottom: 4 }}>
            <Text style={{ fontWeight: 600 }}>Meilleur mois : </Text>
            {MONTHS[data.bestMonth.idx]} avec {formatPriceFR(data.bestMonth.recettes)}
          </Text>
          <Text style={{ fontSize: 9, color: C.ink2, marginBottom: 4 }}>
            <Text style={{ fontWeight: 600 }}>Conversion devis : </Text>
            {data.nbDevisAcceptes}/{data.nbDevis} devis acceptés
            {data.nbDevis > 0 ? ` (${Math.round((data.nbDevisAcceptes / data.nbDevis) * 100)}%)` : ''}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Bilan {data.year} · {profile?.company_name || 'AVA'}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
