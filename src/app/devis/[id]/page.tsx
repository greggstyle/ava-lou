'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AvaTopBar, AvaCard, AvaField, AvaButton, AvaDisclaimer, AvaLabel, AvaPill, C, SANS, SERIF, TNUM } from '@/components/ava';
import { computeTotals, formatPriceFR, formatDateFR } from '@/lib/format';
import type { Quote, QuoteStatus, LineItem } from '@/lib/types';

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

const STATUSES: QuoteStatus[] = ['brouillon', 'envoyé', 'accepté', 'refusé', 'expiré'];

interface QuoteWithClient extends Quote {
  clients: { name: string; email: string | null } | null;
}

interface LineRow {
  label: string;
  qty: string;
  unit_price: string;
}

export default function DevisDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [quote, setQuote] = React.useState<QuoteWithClient | null>(null);
  const [clients, setClients] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [converting, setConverting] = React.useState(false);

  const [clientId, setClientId] = React.useState('');
  const [issueDate, setIssueDate] = React.useState('');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [vatRate, setVatRate] = React.useState(20);
  const [lines, setLines] = React.useState<LineRow[]>([]);
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [{ data }, { data: cs }] = await Promise.all([
        supabase.from('quotes').select('*, clients(name, email)').eq('id', id).maybeSingle(),
        supabase.from('clients').select('id, name').order('name'),
      ]);
      if (cancelled) return;
      if (data) {
        const q = data as QuoteWithClient;
        setQuote(q);
        setClientId(q.client_id ?? '');
        setIssueDate(q.issue_date ?? '');
        setExpiryDate(q.expiry_date ?? '');
        setVatRate(Number(q.vat_rate));
        const li = (q.line_items ?? []) as LineItem[];
        setLines(li.length ? li.map((l) => ({ label: l.label, qty: String(l.qty), unit_price: String(l.unit_price) })) : [{ label: '', qty: '1', unit_price: '' }]);
        setNotes(q.notes ?? '');
      }
      if (cs) setClients(cs);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

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

  async function reload() {
    const supabase = createClient();
    const { data } = await supabase.from('quotes').select('*, clients(name, email)').eq('id', id).maybeSingle();
    if (data) setQuote(data as QuoteWithClient);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const validLines = numericLines.filter((l) => l.label.trim() !== '');
    if (validLines.length === 0) {
      setError('Ajoutez au moins une ligne avec un libellé.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/devis/${id}`, {
        method: 'PATCH',
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
        throw new Error(j.error ?? 'Erreur');
      }
      await reload();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: QuoteStatus) {
    const res = await fetch(`/api/devis/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await reload();
  }

  async function onDelete() {
    if (!confirm('Supprimer ce devis ? Cette action est irréversible.')) return;
    const res = await fetch(`/api/devis/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Erreur lors de la suppression');
      return;
    }
    router.push('/devis');
    router.refresh();
  }

  function buildMailto(q: QuoteWithClient): string | null {
    const client = q.clients;
    if (!client?.email) return null;
    const subject = `Devis ${q.number ?? ''} — ${formatDateFR(q.issue_date)}`;
    const lines = (q.line_items ?? []) as LineItem[];
    const detail = lines
      .map((l) => `- ${l.label} : ${l.qty} × ${formatPriceFR(l.unit_price)} = ${formatPriceFR(l.qty * l.unit_price)}`)
      .join('\n');
    const body = [
      `Bonjour ${client.name},`,
      '',
      `Vous trouverez ci-dessous le détail de votre devis ${q.number ?? ''} émis le ${formatDateFR(q.issue_date)}.`,
      '',
      'DÉTAIL',
      detail || '- (à préciser)',
      '',
      `TOTAL HT : ${formatPriceFR(Number(q.amount_ht))}`,
      `TVA (${q.vat_rate} %) : ${formatPriceFR(Number(q.amount_vat))}`,
      `TOTAL TTC : ${formatPriceFR(Number(q.amount_ttc))}`,
      '',
      `Validité jusqu'au : ${q.expiry_date ? formatDateFR(q.expiry_date) : '30 jours'}`,
      '',
      q.notes ? `Notes : ${q.notes}` : '',
      '',
      'Cordialement,',
      '',
      '—',
      'Envoyé via AVA — Assistance Vocale Administrative',
    ]
      .filter((l) => l !== null && l !== undefined)
      .join('\n');
    return `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function onSendEmail() {
    if (!quote || quote.status !== 'brouillon') return;
    void fetch(`/api/devis/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'envoyé' }),
    }).catch(() => {});
  }

  async function onConvert() {
    if (!confirm('Convertir ce devis en facture ?')) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/devis/${id}/convert`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Erreur');
      }
      const inv = await res.json();
      router.push(`/factures/${inv.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone }}>
        <AvaTopBar title="Devis" onBack={() => router.back()} />
        <div style={{ padding: 20, color: C.muted, font: `400 14px/1.4 ${SANS}` }}>Chargement…</div>
      </main>
    );
  }
  if (!quote) {
    return (
      <main style={{ minHeight: '100vh', background: C.bone }}>
        <AvaTopBar title="Devis" onBack={() => router.back()} />
        <div style={{ padding: 20, color: C.muted, font: `400 14px/1.4 ${SANS}` }}>Devis introuvable.</div>
      </main>
    );
  }

  const lineItems = (quote.line_items ?? []) as LineItem[];
  const statusPill: React.ReactNode = quote.status === 'accepté'
    ? <AvaPill kind="success">Accepté</AvaPill>
    : quote.status === 'refusé'
      ? <AvaPill kind="warn">Refusé</AvaPill>
      : quote.status === 'expiré'
        ? <AvaPill kind="warn">Expiré</AvaPill>
        : quote.status === 'envoyé'
          ? <AvaPill kind="ava">Envoyé</AvaPill>
          : <AvaPill kind="neutral">Brouillon</AvaPill>;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar
        title={quote.number ?? 'Devis'}
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
          <>
            <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <AvaLabel>Client</AvaLabel>
                  <div style={{ font: `500 16px/1.3 ${SANS}`, color: C.ink, marginTop: 4 }}>
                    {quote.clients?.name ?? 'Sans client'}
                  </div>
                </div>
                {statusPill}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <AvaLabel>Émis le</AvaLabel>
                  <div style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink2, marginTop: 4 }}>
                    {formatDateFR(quote.issue_date)}
                  </div>
                </div>
                {quote.expiry_date && (
                  <div>
                    <AvaLabel>Validité</AvaLabel>
                    <div style={{ font: `500 14px/1.3 ${SANS}`, color: C.ink2, marginTop: 4 }}>
                      {formatDateFR(quote.expiry_date)}
                    </div>
                  </div>
                )}
              </div>
            </AvaCard>

            <AvaCard padding={18} style={{ marginTop: 12 }}>
              <AvaLabel style={{ marginBottom: 10 }}>Lignes</AvaLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lineItems.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ font: `500 14px/1.4 ${SANS}`, color: C.ink, flex: 1 }}>
                      {l.label}
                      <div style={{ font: `400 12px/1.3 ${SANS}`, color: C.muted }}>
                        {l.qty} × {formatPriceFR(Number(l.unit_price))}
                      </div>
                    </div>
                    <div style={{ font: `500 14px/1 ${SERIF}`, color: C.ink, ...TNUM }}>
                      {formatPriceFR(Number(l.qty) * Number(l.unit_price))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: C.line, margin: '14px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 13px/1 ${SANS}`, color: C.muted }}>
                <span>Total HT</span><span style={TNUM}>{formatPriceFR(Number(quote.amount_ht))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: `500 13px/1 ${SANS}`, color: C.muted }}>
                <span>TVA</span><span style={TNUM}>{formatPriceFR(Number(quote.amount_vat))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'baseline' }}>
                <span style={{ font: `600 13px/1 ${SANS}`, color: C.ink2, textTransform: 'uppercase', letterSpacing: 1.4 }}>Total TTC</span>
                <span style={{ font: `600 24px/1 ${SERIF}`, color: C.ink, ...TNUM }}>
                  {formatPriceFR(Number(quote.amount_ttc))}
                </span>
              </div>
            </AvaCard>

            {quote.notes && (
              <AvaCard padding={18} style={{ marginTop: 12 }}>
                <AvaLabel>Notes</AvaLabel>
                <div style={{ font: `400 14px/1.45 ${SANS}`, color: C.ink2, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  {quote.notes}
                </div>
              </AvaCard>
            )}

            <div style={{ marginTop: 18 }}>
              <AvaLabel style={{ marginBottom: 8 }}>Statut</AvaLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STATUSES.map((s) => (
                  <AvaButton
                    key={s}
                    kind={quote.status === s ? 'primary' : 'light'}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </AvaButton>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <AvaLabel style={{ marginBottom: 8 }}>Envoyer au client</AvaLabel>
              {(() => {
                const mailto = buildMailto(quote);
                if (mailto) {
                  return (
                    <a
                      href={mailto}
                      onClick={onSendEmail}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        height: 50,
                        padding: '0 20px',
                        background: C.green,
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        borderRadius: 14,
                        font: `600 16px/1 ${SANS}`,
                        cursor: 'pointer',
                      }}
                    >
                      Envoyer par email
                    </a>
                  );
                }
                return (
                  <AvaCard padding={14} style={{ background: C.soft }}>
                    <div style={{ font: `400 13px/1.45 ${SANS}`, color: C.ink2 }}>
                      Ajoutez l&apos;email du client pour pouvoir l&apos;envoyer.
                    </div>
                  </AvaCard>
                );
              })()}
            </div>

            <div style={{ marginTop: 18 }}>
              <AvaButton kind="validate" full onClick={onConvert} disabled={converting}>
                {converting ? 'Conversion…' : 'Convertir en facture'}
              </AvaButton>
            </div>

            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
              <AvaButton kind="danger" onClick={onDelete}>Supprimer ce devis</AvaButton>
            </div>
          </>
        ) : (
          <form onSubmit={onSave}>
            <AvaCard padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <AvaField label="Client">
                <select style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">— Sans client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </AvaField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <AvaField label="Date d'émission">
                  <input style={inputStyle} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
                </AvaField>
                <AvaField label="Validité">
                  <input style={inputStyle} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </AvaField>
              </div>
              <AvaField label="TVA">
                <select style={inputStyle} value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))}>
                  {[0, 8.5, 10, 20].map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
              </AvaField>
            </AvaCard>

            <div style={{ marginTop: 14 }}>
              <AvaLabel style={{ marginBottom: 8 }}>Lignes</AvaLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lines.map((l, idx) => (
                  <AvaCard key={idx} padding={14}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input style={inputStyle} placeholder="Libellé" value={l.label} onChange={(e) => updateLine(idx, { label: e.target.value })} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                        <input style={inputStyle} type="number" min="0" step="0.01" placeholder="Qté" value={l.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
                        <input style={inputStyle} inputMode="decimal" placeholder="Prix unitaire" value={l.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          aria-label="Supprimer la ligne"
                          style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, cursor: 'pointer', color: C.muted, opacity: lines.length === 1 ? 0.4 : 1 }}
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
                <AvaButton kind="light" onClick={addLine} icon={<Plus size={16} strokeWidth={1.5} />}>Ajouter une ligne</AvaButton>
              </div>
            </div>

            <AvaCard padding={18} style={{ marginTop: 14 }}>
              <AvaField label="Notes">
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </AvaField>
            </AvaCard>

            <AvaCard padding={18} style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ font: `600 13px/1 ${SANS}`, color: C.ink2, textTransform: 'uppercase', letterSpacing: 1.4 }}>Total TTC</span>
                <span style={{ font: `600 28px/1 ${SERIF}`, color: C.ink, ...TNUM }}>
                  {formatPriceFR(totals.amount_ttc)}
                </span>
              </div>
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
      </div>
    </main>
  );
}
