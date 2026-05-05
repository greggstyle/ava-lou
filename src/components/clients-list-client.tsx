'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AvaTopBar, AvaCard, AvaListRow, AvaButton, C, SANS } from '@/components/ava';
import { ListSearch } from '@/components/list-search';

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function ClientsListClient({ initialClients }: { initialClients: ClientRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!query.trim()) return initialClients;
    const q = query.toLowerCase().trim();
    return initialClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(query.trim())),
    );
  }, [initialClients, query]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bone }}>
      <AvaTopBar
        title="Clients"
        right={
          <Link href="/" aria-label="Accueil" style={{ color: C.muted, font: `500 13px/1 ${SANS}`, textDecoration: 'none' }}>
            Accueil
          </Link>
        }
      />

      <div style={{ padding: '8px 20px 120px', overflowY: 'auto', flex: 1 }}>
        {initialClients.length > 0 && (
          <ListSearch
            placeholder="Rechercher un client par nom, email…"
            onChange={setQuery}
            count={filtered.length}
            totalCount={initialClients.length}
          />
        )}

        {initialClients.length > 0 ? (
          filtered.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {filtered.map((c) => (
                <div key={c.id} onClick={() => router.push(`/clients/${c.id}`)} style={{ cursor: 'pointer' }}>
                  <AvaListRow name={c.name} sub={c.email ?? c.phone ?? undefined} />
                </div>
              ))}
            </div>
          ) : (
            <AvaCard padding={20} style={{ marginTop: 12 }}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucun client ne correspond à « {query} ».
              </div>
            </AvaCard>
          )
        ) : (
          <div style={{ marginTop: 24 }}>
            <AvaCard padding={20}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
                Aucun client pour l&apos;instant. Ajoutez votre premier client pour commencer à émettre des factures et des devis.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link href="/clients/nouveau"><AvaButton kind="light">Nouveau client</AvaButton></Link>
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
        <Link href="/clients/nouveau" style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary" full>Nouveau client</AvaButton>
        </Link>
      </div>
    </main>
  );
}
