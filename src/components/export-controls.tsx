'use client';

import * as React from 'react';
import { AvaCard, AvaButton, AvaField, AvaLabel, C, SANS } from '@/components/ava';

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

const PRESETS = [
  { key: 'ytd', label: 'Année en cours' },
  { key: 'last_year', label: 'Année précédente' },
  { key: 'last_quarter', label: 'Trimestre précédent' },
  { key: 'last_month', label: 'Mois précédent' },
  { key: 'custom', label: 'Période personnalisée' },
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoYearStart(year?: number): string {
  return `${year ?? new Date().getFullYear()}-01-01`;
}
function isoYearEnd(year?: number): string {
  return `${year ?? new Date().getFullYear()}-12-31`;
}
function isoLastMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function isoLastMonthEnd(): string {
  const d = new Date();
  d.setDate(0); // last day of previous month
  return d.toISOString().slice(0, 10);
}
function isoLastQuarterStart(): string {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3); // 0..3
  const startMonth = (currentQ - 1) * 3;
  const year = startMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = (startMonth + 12) % 12;
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}
function isoLastQuarterEnd(): string {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3);
  const endMonth = currentQ * 3; // first day of current quarter = end of last day of last quarter
  const year = endMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = endMonth === 0 ? 11 : endMonth - 1;
  // Last day of that month
  return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
}

export function ExportControls() {
  const [preset, setPreset] = React.useState<string>('ytd');
  const [from, setFrom] = React.useState(isoYearStart());
  const [to, setTo] = React.useState(isoToday());

  React.useEffect(() => {
    if (preset === 'ytd') {
      setFrom(isoYearStart());
      setTo(isoToday());
    } else if (preset === 'last_year') {
      const y = new Date().getFullYear() - 1;
      setFrom(isoYearStart(y));
      setTo(isoYearEnd(y));
    } else if (preset === 'last_quarter') {
      setFrom(isoLastQuarterStart());
      setTo(isoLastQuarterEnd());
    } else if (preset === 'last_month') {
      setFrom(isoLastMonthStart());
      setTo(isoLastMonthEnd());
    }
    // custom = no auto-update; user picks dates
  }, [preset]);

  function downloadUrl(dataset: 'invoices' | 'quotes' | 'expenses'): string {
    const params = new URLSearchParams({ dataset, from, to });
    return `/api/export?${params.toString()}`;
  }

  return (
    <AvaCard padding={16}>
      <AvaLabel style={{ marginBottom: 10 }}>Période à exporter</AvaLabel>

      <AvaField label="Plage rapide">
        <select style={inputStyle} value={preset} onChange={(e) => setPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </AvaField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <AvaField label="Du">
          <input
            style={inputStyle}
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }}
          />
        </AvaField>
        <AvaField label="Au">
          <input
            style={inputStyle}
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPreset('custom'); }}
            min={from}
          />
        </AvaField>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href={downloadUrl('invoices')} download style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Télécharger factures (.csv)</AvaButton>
        </a>
        <a href={downloadUrl('quotes')} download style={{ textDecoration: 'none' }}>
          <AvaButton kind="light" full>Télécharger devis (.csv)</AvaButton>
        </a>
        <a href={downloadUrl('expenses')} download style={{ textDecoration: 'none' }}>
          <AvaButton kind="light" full>Télécharger dépenses (.csv)</AvaButton>
        </a>
      </div>
    </AvaCard>
  );
}
