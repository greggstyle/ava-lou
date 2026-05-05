'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AvaTopBar, AvaCard, AvaField, AvaButton, AvaDisclaimer, C, SANS } from '@/components/ava';
import type { Cadence } from '@/lib/recurring';

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

export default function NouvelleRecurrencePage() {
  const router = useRouter();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [clients, setClients] = React.useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [cadence, setCadence] = React.useState<Cadence>('monthly');
  const [customDays, setCustomDays] = React.useState('30');
  const [nextRunDate, setNextRunDate] = React.useState(todayIso);
  const [endDate, setEndDate] = React.useState('');
  const [amountTtc, setAmountTtc] = React.useState('');
  const [vatRate, setVatRate] = React.useState(20);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Libellé requis');
      return;
    }
    const amount = Number(amountTtc.replace(',', '.'));
    if (!amount || amount <= 0) {
      setError('Montant TTC requis');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId || null,
          label,
          cadence,
          custom_days: cadence === 'custom_days' ? Number(customDays) : null,
          next_run_date: nextRunDate,
          end_date: endDate || null,
          amount_ttc: amount,
          vat_rate: vatRate,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur');
      }
      router.push('/recurring');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar title="Nouvelle récurrence" onBack={() => router.back()} />

      <form onSubmit={onSubmit} style={{ padding: '8px 20px 60px', flex: 1, overflowY: 'auto' }}>
        <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          <AvaField label="Libellé *" hint="Ex: « Loyer atelier », « Contrat maintenance Mme Hoarau »">
            <input
              style={inputStyle}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              required
              placeholder="Loyer atelier"
            />
          </AvaField>

          <AvaField label="Client">
            <select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Sans client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </AvaField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AvaField label="Montant TTC *">
              <input
                style={inputStyle}
                inputMode="decimal"
                value={amountTtc}
                onChange={(e) => setAmountTtc(e.target.value.replace(',', '.'))}
                placeholder="800,00"
                required
              />
            </AvaField>
            <AvaField label="TVA">
              <select
                style={inputStyle}
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
              >
                <option value={20}>20 %</option>
                <option value={10}>10 %</option>
                <option value={8.5}>8,5 % (DROM)</option>
                <option value={5.5}>5,5 %</option>
                <option value={0}>0 %</option>
              </select>
            </AvaField>
          </div>

          <AvaField label="Cadence">
            <select style={inputStyle} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
              <option value="monthly">Mensuel</option>
              <option value="bimonthly">Tous les 2 mois</option>
              <option value="quarterly">Trimestriel</option>
              <option value="semiannual">Semestriel</option>
              <option value="annual">Annuel</option>
              <option value="custom_days">Personnalisé (en jours)</option>
            </select>
          </AvaField>

          {cadence === 'custom_days' && (
            <AvaField label="Tous les N jours" hint="Ex: 15 pour bimensuel, 90 pour trimestriel atypique">
              <input
                style={inputStyle}
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                required
              />
            </AvaField>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AvaField label="Première émission" hint="Date à partir de laquelle AVA commence">
              <input
                style={inputStyle}
                type="date"
                value={nextRunDate}
                onChange={(e) => setNextRunDate(e.target.value)}
                required
              />
            </AvaField>
            <AvaField label="Fin (optionnel)" hint="AVA s'arrête après cette date">
              <input
                style={inputStyle}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={nextRunDate}
              />
            </AvaField>
          </div>

          <AvaField label="Notes (optionnel)" hint="Repris dans chaque facture générée">
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mentions, références contractuelles…"
            />
          </AvaField>
        </AvaCard>

        {error && (
          <div style={{ marginTop: 12, font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>
        )}

        <div style={{ marginTop: 16 }}>
          <AvaDisclaimer />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link href="/recurring" style={{ textDecoration: 'none', flex: 1 }}>
            <AvaButton kind="light" full>Annuler</AvaButton>
          </Link>
          <div style={{ flex: 1 }}>
            <AvaButton kind="primary" full type="submit" disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Programmer'}
            </AvaButton>
          </div>
        </div>
      </form>
    </main>
  );
}
