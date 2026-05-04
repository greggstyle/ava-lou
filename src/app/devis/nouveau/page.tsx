'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AvaTopBar, AvaCard, AvaField, AvaButton, AvaDisclaimer, AvaLabel, C, SERIF, SANS, TNUM } from '@/components/ava';
import { computeTotals, formatPriceFR } from '@/lib/format';

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

const VAT_OPTIONS = [0, 8.5, 10, 20];

interface LineRow {
  label: string;
  qty: string;
  unit_price: string;
}

export default function NouveauDevisPage() {
  const router = useRouter();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [clients, setClients] = React.useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = React.useState<string>('');
  const [issueDate, setIssueDate] = React.useState(todayISO);
  const [expiryDate, setExpiryDate] = React.useState('');
  const [vatRate, setVatRate] = React.useState<number>(20);
  const [lines, setLines] = React.useState<LineRow[]>([{ label: '', qty: '1', unit_price: '' }]);
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setClients(data);
      });
  }, []);

  const numericLines = lines.map((l) => ({
    label: l.label,
    qty: Number(l.qty) || 0,
    unit_price: Number(l.unit_price.replace(',', '.')) || 0,
    vat_rate: vatRate,
  }));
  const totals = computeTotals(numericLines);

  function updateLine(idx: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { label: '', qty: '1', unit_price: '' }]);
  }
  function removeLine(idx: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validLines = numericLines.filter((l) => l.label.trim() !== '');
    if (validLines.length === 0) {
      setError('Ajoutez au moins une ligne avec un libellé.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId || null,
          issue_date: issueDate,
          expiry_date: expiryDate || null,
          vat_rate: vatRate,
          line_items: validLines,
          notes,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur lors de la création');
      }
      const created = await res.json();
      router.push(`/devis/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar title="Nouveau devis" onBack={() => router.back()} />

      <form onSubmit={onSubmit} style={{ padding: '8px 20px 120px', flex: 1, overflowY: 'auto' }}>
        <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <AvaField label="Client">
            <select
              style={inputStyle}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— Sans client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </AvaField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AvaField label="Date d'émission">
              <input
                style={inputStyle}
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </AvaField>
            <AvaField label="Validité jusqu'au">
              <input
                style={inputStyle}
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </AvaField>
          </div>

          <AvaField label="TVA">
            <select
              style={inputStyle}
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
            >
              {VAT_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}%</option>
              ))}
            </select>
          </AvaField>
        </AvaCard>

        <div style={{ marginTop: 18 }}>
          <AvaLabel style={{ marginBottom: 10 }}>Lignes</AvaLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map((l, idx) => (
              <AvaCard key={idx} padding={14}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    style={inputStyle}
                    placeholder="Libellé (ex. Pose carrelage)"
                    value={l.label}
                    onChange={(e) => updateLine(idx, { label: e.target.value })}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Qté"
                      value={l.qty}
                      onChange={(e) => updateLine(idx, { qty: e.target.value })}
                    />
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      placeholder="Prix unitaire"
                      value={l.unit_price}
                      onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      aria-label="Supprimer la ligne"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.line}`,
                        borderRadius: 12,
                        padding: 10,
                        cursor: 'pointer',
                        color: C.muted,
                        opacity: lines.length === 1 ? 0.4 : 1,
                      }}
                      disabled={lines.length === 1}
                    >
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </AvaCard>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <AvaButton kind="light" onClick={addLine} icon={<Plus size={16} strokeWidth={1.5} />}>
              Ajouter une ligne
            </AvaButton>
          </div>
        </div>

        <AvaCard padding={18} style={{ marginTop: 18 }}>
          <AvaField label="Notes (optionnel)">
            <textarea
              style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions, mentions…"
            />
          </AvaField>
        </AvaCard>

        <AvaCard padding={18} style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 14px/1 ${SANS}`, color: C.muted }}>
            <span>Total HT</span>
            <span style={TNUM}>{formatPriceFR(totals.amount_ht)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, font: `500 14px/1 ${SANS}`, color: C.muted }}>
            <span>TVA</span>
            <span style={TNUM}>{formatPriceFR(totals.amount_vat)}</span>
          </div>
          <div style={{ height: 1, background: C.line, margin: '14px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: `600 13px/1 ${SANS}`, color: C.ink2, textTransform: 'uppercase', letterSpacing: 1.4 }}>Total TTC</span>
            <span style={{ font: `600 28px/1 ${SERIF}`, color: C.ink, ...TNUM }}>
              {formatPriceFR(totals.amount_ttc)}
            </span>
          </div>
        </AvaCard>

        {error && (
          <div style={{ marginTop: 12, font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>
        )}

        <div style={{ marginTop: 16 }}>
          <AvaDisclaimer />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link href="/devis" style={{ textDecoration: 'none', flex: 1 }}>
            <AvaButton kind="light" full>Annuler</AvaButton>
          </Link>
          <div style={{ flex: 1 }}>
            <AvaButton kind="primary" full type="submit" disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </AvaButton>
          </div>
        </div>
      </form>
    </main>
  );
}
