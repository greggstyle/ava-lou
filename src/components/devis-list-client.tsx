'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AvaTopBar, AvaCard, AvaListRow, AvaButton, C, SANS } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';
import { ListSearch } from '@/components/list-search';

interface QuoteRow {
  id: string;
  number: string | null;
  amount_ttc: number;
  status: string;
  created_at: string;
  client_id: string | null;
  clients: { name: string } | { name: string }[] | null;
}

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'envoyé', label: 'Envoyés' },
  { key: 'accepté', label: 'Acceptés' },
  { key: 'refusé', label: 'Refusés' },
  { key: 'expiré', label: 'Expirés' },
];

function pickName(c: QuoteRow['clients']): string {
  if (!c) return 'Sans client';
  if (Array.isArray(c)) return c[0]?.name ?? 'Sans client';
  return c.name ?? 'Sans client';
}

export function DevisListClient({ initialQuotes }: { initialQuotes: QuoteRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<string>('all');

  const filtered = React.useMemo(() => {
    let list = initialQuotes;
    if (filter !== 'all') list = list.filter((q) => q.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (item) =>
          (item.number && item.number.toLowerCase().includes(q)) ||
          pickName(item.clients).toLowerCase().includes(q),
      );
    }
    return list;
  }, [initialQuotes, query, filter]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar
        title="Devis"
        right={
          <Link href="/" aria-label="Accueil" style={{ color: C.muted, font: `500 13px/1 ${SANS}`, textDecoration: 'none' }}>
            Accueil
          </Link>
        }
      />

      <div style={{ padding: '8px 20px 120px', overflowY: 'auto', flex: 1 }}>
        {initialQuotes.length > 0 && (
          <>
            <ListSearch
              placeholder="Rechercher par numéro, client…"
              onChange={setQuery}
              count={filtered.length}
              totalCount={initialQuotes.length}
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

        {initialQuotes.length > 0 ? (
          filtered.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {filtered.map((q) => (
                <div key={q.id} onClick={() => router.push(`/devis/${q.id}`)} style={{ cursor: 'pointer' }}>
                  <AvaListRow
                    name={pickName(q.clients)}
                    sub={`${q.number ?? 'Brouillon'} · ${formatDateRelativeFR(q.created_at)}`}
                    amount={formatPriceFR(Number(q.amount_ttc))}
                    status={q.status === 'accepté' ? 'paid' : q.status === 'refusé' || q.status === 'expiré' ? 'overdue' : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <AvaCard padding={20} style={{ marginTop: 12 }}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucun devis ne correspond à ces critères.
              </div>
            </AvaCard>
          )
        ) : (
          <div style={{ marginTop: 24 }}>
            <AvaCard padding={20}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucun devis pour l&apos;instant. Créez votre premier devis pour proposer une offre à un client.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link href="/devis/nouveau"><AvaButton kind="light">Nouveau devis</AvaButton></Link>
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
        <Link href="/devis/nouveau" style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Nouveau devis</AvaButton>
        </Link>
      </div>
    </main>
  );
}
