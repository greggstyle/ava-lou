'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

export default function NouveauRdvPage() {
  const router = useRouter();
  const todayISO = new Date().toISOString().slice(0, 10);
  const nowHHMM = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ':');

  const [clients, setClients] = React.useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = React.useState<string>('');
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(todayISO);
  const [time, setTime] = React.useState(nowHHMM);
  const [location, setLocation] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !time) {
      setError('Titre, date et heure requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          starts_at: startsAt,
          location: location || null,
          notes: notes || null,
          client_id: clientId || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur');
      }
      router.push('/agenda');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar title="Nouveau RDV" onBack={() => router.back()} />

      <form onSubmit={onSubmit} style={{ padding: '8px 20px 60px', flex: 1 }}>
        <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          <AvaField label="Titre *">
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Chantier salle de bain" autoFocus />
          </AvaField>
          <AvaField label="Client (optionnel)">
            <select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— Sans client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </AvaField>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <AvaField label="Date">
              <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </AvaField>
            <AvaField label="Heure">
              <input style={inputStyle} type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </AvaField>
          </div>
          <AvaField label="Lieu">
            <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="4 rue des Lilas, Saint-Denis" />
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
          <Link href="/agenda" style={{ textDecoration: 'none', flex: 1 }}>
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
