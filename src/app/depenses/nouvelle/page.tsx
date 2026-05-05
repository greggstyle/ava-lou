'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AvaTopBar, AvaCard, AvaField, AvaButton, AvaDisclaimer, C, SANS } from '@/components/ava';

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

const CATEGORIES = ['matériel', 'déplacement', 'sous-traitance', 'restauration', 'téléphonie', 'outillage', 'formation', 'autre'];

export default function NouvelleDepensePage() {
  const router = useRouter();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [label, setLabel] = React.useState('');
  const [vendor, setVendor] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [category, setCategory] = React.useState('matériel');
  const [date, setDate] = React.useState(todayISO);
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !amount) {
      setError('Libellé et montant requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          vendor: vendor || null,
          amount_ttc: Number(amount.replace(',', '.')),
          category,
          expense_date: date,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur');
      }
      router.push('/depenses');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar title="Nouvelle dépense" onBack={() => router.back()} />

      <form onSubmit={onSubmit} style={{ padding: '8px 20px 60px', flex: 1 }}>
        <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          <AvaField label="Libellé *">
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="Achat carrelage" autoFocus />
          </AvaField>
          <AvaField label="Fournisseur">
            <input style={inputStyle} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Point P, Leroy Merlin…" />
          </AvaField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <AvaField label="Montant TTC *">
              <input style={inputStyle} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="340" />
            </AvaField>
            <AvaField label="Catégorie">
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </AvaField>
          </div>
          <AvaField label="Date">
            <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </AvaField>
          <AvaField label="Notes">
            <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </AvaField>
        </AvaCard>

        {error && <div style={{ marginTop: 12, font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>}

        <div style={{ marginTop: 16 }}>
          <AvaDisclaimer />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link href="/depenses" style={{ textDecoration: 'none', flex: 1 }}>
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
