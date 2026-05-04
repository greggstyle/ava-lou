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

export default function NouveauClientPage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom est requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, address, notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur lors de la création');
      }
      router.push('/clients');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar title="Nouveau client" onBack={() => router.back()} />

      <form onSubmit={onSubmit} style={{ padding: '8px 20px 120px', flex: 1, overflowY: 'auto' }}>
        <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <AvaField label="Nom *">
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              placeholder="Marie Dupont"
            />
          </AvaField>
          <AvaField label="Email">
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marie@exemple.com"
            />
          </AvaField>
          <AvaField label="Téléphone">
            <input
              style={inputStyle}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0692 00 00 00"
            />
          </AvaField>
          <AvaField label="Adresse">
            <input
              style={inputStyle}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="12 rue des Filaos, Saint-Denis"
            />
          </AvaField>
          <AvaField label="Notes">
            <textarea
              style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations utiles, préférences…"
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
          <Link href="/clients" style={{ textDecoration: 'none', flex: 1 }}>
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
