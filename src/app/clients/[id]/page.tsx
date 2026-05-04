'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AvaTopBar, AvaCard, AvaField, AvaButton, AvaDisclaimer, AvaLabel, AvaListRow, C, SANS, SERIF } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';
import type { Client, Invoice } from '@/lib/types';

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

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [client, setClient] = React.useState<Client | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [{ data: c }, { data: invs }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).maybeSingle(),
        supabase.from('invoices').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (cancelled) return;
      if (c) {
        setClient(c as Client);
        setName(c.name ?? '');
        setEmail(c.email ?? '');
        setPhone(c.phone ?? '');
        setAddress(c.address ?? '');
        setNotes(c.notes ?? '');
      }
      if (invs) setInvoices(invs as Invoice[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, address, notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur');
      }
      const updated = await res.json();
      setClient(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm('Supprimer ce client ? Cette action est irréversible.')) return;
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Erreur lors de la suppression');
      return;
    }
    router.push('/clients');
    router.refresh();
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone }}>
        <AvaTopBar title="Client" onBack={() => router.back()} />
        <div style={{ padding: 20, color: C.muted, font: `400 14px/1.4 ${SANS}` }}>Chargement…</div>
      </main>
    );
  }
  if (!client) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone }}>
        <AvaTopBar title="Client" onBack={() => router.back()} />
        <div style={{ padding: 20, color: C.muted, font: `400 14px/1.4 ${SANS}` }}>Client introuvable.</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar
        title={client.name}
        onBack={() => router.back()}
        right={
          !editing ? (
            <button
              onClick={() => setEditing(true)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.ink2, font: `500 14px/1 ${SANS}` }}
            >
              Modifier
            </button>
          ) : null
        }
      />

      <div style={{ padding: '12px 20px 120px', flex: 1, overflowY: 'auto' }}>
        {!editing ? (
          <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <AvaLabel>Nom</AvaLabel>
              <div style={{ font: `500 16px/1.3 ${SANS}`, color: C.ink, marginTop: 4 }}>{client.name}</div>
            </div>
            {client.email && (
              <div>
                <AvaLabel>Email</AvaLabel>
                <div style={{ font: `500 15px/1.3 ${SANS}`, color: C.ink2, marginTop: 4 }}>{client.email}</div>
              </div>
            )}
            {client.phone && (
              <div>
                <AvaLabel>Téléphone</AvaLabel>
                <div style={{ font: `500 15px/1.3 ${SANS}`, color: C.ink2, marginTop: 4 }}>{client.phone}</div>
              </div>
            )}
            {client.address && (
              <div>
                <AvaLabel>Adresse</AvaLabel>
                <div style={{ font: `500 15px/1.3 ${SANS}`, color: C.ink2, marginTop: 4 }}>{client.address}</div>
              </div>
            )}
            {client.notes && (
              <div>
                <AvaLabel>Notes</AvaLabel>
                <div style={{ font: `400 14px/1.45 ${SANS}`, color: C.ink2, marginTop: 4, whiteSpace: 'pre-wrap' }}>{client.notes}</div>
              </div>
            )}
          </AvaCard>
        ) : (
          <form onSubmit={onSave}>
            <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <AvaField label="Nom *">
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
              </AvaField>
              <AvaField label="Email">
                <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </AvaField>
              <AvaField label="Téléphone">
                <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </AvaField>
              <AvaField label="Adresse">
                <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
              </AvaField>
              <AvaField label="Notes">
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </AvaField>
            </AvaCard>

            {error && <div style={{ marginTop: 10, font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>}

            <div style={{ marginTop: 14 }}>
              <AvaDisclaimer />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <AvaButton kind="light" full onClick={() => setEditing(false)}>Annuler</AvaButton>
              </div>
              <div style={{ flex: 1 }}>
                <AvaButton kind="primary" full type="submit" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </AvaButton>
              </div>
            </div>
          </form>
        )}

        <div style={{ marginTop: 24 }}>
          <AvaLabel style={{ marginBottom: 10 }}>Factures récentes</AvaLabel>
          {invoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invoices.map((inv) => (
                <Link key={inv.id} href={`/factures/${inv.id}`} style={{ textDecoration: 'none' }}>
                  <AvaListRow
                    name={inv.number ?? 'Brouillon'}
                    sub={formatDateRelativeFR(inv.created_at)}
                    amount={formatPriceFR(Number(inv.amount_ttc))}
                    status={inv.status === 'payée' ? 'paid' : inv.status === 'en_retard' ? 'overdue' : undefined}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <AvaCard padding={16}>
              <div style={{ font: `400 14px/1.45 ${SANS}`, color: C.muted }}>
                Aucune facture pour ce client.
              </div>
            </AvaCard>
          )}
        </div>

        {!editing && (
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
            <AvaButton kind="danger" onClick={onDelete}>Supprimer ce client</AvaButton>
          </div>
        )}

        {/* Spacer */}
        <div style={{ height: 40 }} />
        <div style={{ font: `400 11px/1 ${SERIF}`, color: 'transparent' }}>.</div>
      </div>
    </main>
  );
}
