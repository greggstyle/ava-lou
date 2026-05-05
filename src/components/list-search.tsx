'use client';

import * as React from 'react';
import { C, SANS } from '@/components/ava';

interface ListSearchProps {
  placeholder?: string;
  onChange: (query: string) => void;
  count?: number;
  totalCount?: number;
}

/**
 * Reusable search input for list pages — purely client-side filter.
 * Parent passes an `onChange(query)` callback and renders the filtered list.
 */
export function ListSearch({ placeholder, onChange, count, totalCount }: ListSearchProps) {
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    onChange(query);
  }, [query, onChange]);

  return (
    <div style={{ position: 'relative', marginTop: 12 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Rechercher…'}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          width: '100%',
          background: C.paper,
          border: `1px solid ${C.line}`,
          borderRadius: 14,
          padding: '12px 14px 12px 40px',
          font: `400 15px/1.3 ${SANS}`,
          color: C.ink,
          outline: 'none',
        }}
      />
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke={C.muted}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: 'absolute', left: 14, top: 14 }}
        aria-hidden
      >
        <circle cx={11} cy={11} r={7} />
        <path d="m21 21-4.3-4.3" />
      </svg>
      {query && totalCount !== undefined && (
        <div style={{ marginTop: 6, font: `400 12px/1.3 ${SANS}`, color: C.muted }}>
          {count ?? 0} sur {totalCount} {totalCount > 1 ? 'résultats' : 'résultat'}
        </div>
      )}
    </div>
  );
}
