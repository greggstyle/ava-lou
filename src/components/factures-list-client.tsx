'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AvaTopBar, AvaCard, AvaListRow, AvaButton, AvaPill, C, SANS, SERIF } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';
import { ListSearch } from '@/components/list-search';

interface InvoiceRow {
  id: string;
  number: string | null;
  amount_ttc: number;
  status: string;
  created_at: string;
  client_id: string | null;
  clients: { name: string } | { name: string }[] | null;
}

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'envoyée', label: 'Envoyées' },
  { key: 'payée', label: 'Payées' },
  { key: 'en_retard', label: 'En retard' },
];

function pickName(c: InvoiceRow['clients']): string {
  if (!c) return 'Sans client';
  if (Array.isArray(c)) return c[0]?.name ?? 'Sans client';
  return c.name ?? 'Sans client';
}

export function FacturesListClient({ initialInvoices }: { initialInvoices: InvoiceRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<string>('all');

  const filtered = React.useMemo(() => {
    let list = initialInvoices;
    if (filter !== 'all') list = list.filter((inv) => inv.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (inv) =>
          (inv.number && inv.number.toLowerCase().includes(q)) ||
          pickName(inv.clients).toLowerCase().includes(q),
      );
    }
    return list;
  }, [initialInvoices, query, filter]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar
        title="Factures"
        right={
          <Link href="/" aria-label="Accueil" style={{ color: C.muted, font: `500 13px/1 ${SANS}`, textDecoration: 'none' }}>
            Accueil
          </Link>
        }
      />

      <div style={{ padding: '8px 20px 120px', overflowY: 'auto', flex: 1 }}>
        {initialInvoices.length > 0 && (
          <>
            <ListSearch
              placeholder="Rechercher par numéro, client…"
              onChange={setQuery}
              count={filtered.length}
              totalCount={initialInvoices.length}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    background: filter === f.key ? C.ink : C.paper,
                    color: filter === f.key ? C.paper : C.ink2,
                    border: `1px solid ${filter === f.key ? C.ink : C.line}`,
                    borderRadius: 12,
                    padding: '6px 12px',
                    font: `500 12px/1 ${SANS}`,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}

        {initialInvoices.length > 0 ? (
          filtered.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {filtered.map((inv) => (
                <div key={inv.id} onClick={() => router.push(`/factures/${inv.id}`)} style={{ cursor: 'pointer' }}>
                  <AvaListRow
                    name={pickName(inv.clients)}
                    sub={`${inv.number ?? 'Brouillon'} · ${formatDateRelativeFR(inv.created_at)}`}
                    amount={formatPriceFR(Number(inv.amount_ttc))}
                    status={inv.status === 'payée' ? 'paid' : inv.status === 'en_retard' ? 'overdue' : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <AvaCard padding={20} style={{ marginTop: 12 }}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucune facture ne correspond à ces critères.
              </div>
            </AvaCard>
          )
        ) : (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AvaCard padding={20}>
              <div style={{ font: `500 18px/1.3 ${SERIF}`, color: C.ink, marginBottom: 8 }}>
                Aucune facture pour l&apos;instant.
              </div>
              <div style={{ font: `400 14px/1.55 ${SANS}`, color: C.ink2, marginBottom: 14 }}>
                Tap le micro et dites simplement <em style={{ fontFamily: SERIF, fontStyle: 'italic' }}>« Facture pour Monsieur Payet, 3 heures à 55 € »</em> — AVA prépare le brouillon pour vous.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href="/listen"><AvaButton kind="primary">Dicter à AVA</AvaButton></Link>
                <Link href="/factures/nouvelle"><AvaButton kind="light">Saisir manuellement</AvaButton></Link>
              </div>
            </AvaCard>
          </div>
        )}
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '12px 20px 20px',
          background: `linear-gradient(to top, ${C.bone} 70%, rgba(244,243,238,0))`,
        }}
      >
        <Link href="/factures/nouvelle" style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Nouvelle facture</AvaButton>
        </Link>
      </div>
    </main>
  );
}
