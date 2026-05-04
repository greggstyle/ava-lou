'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { C } from '@/components/ava';

const DEFAULT_HIDE_PREFIXES = ['/listen', '/confirm', '/login', '/auth'];

export function MicFab({ hideOn }: { hideOn?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();

  // Hide on home (which has its own dock) and on listen/confirm/login/auth
  const skip = hideOn ?? DEFAULT_HIDE_PREFIXES;
  const isHome = pathname === '/';
  const isSkipped = skip.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isHome || isSkipped) return null;

  const onClick = () => {
    const ret = encodeURIComponent(pathname);
    router.push(`/listen?return=${ret}`);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Activer la voix AVA"
      style={{
        position: 'fixed',
        bottom: 'calc(20px + env(safe-area-inset-bottom))',
        right: 20,
        zIndex: 50,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: C.green,
        color: '#FFFFFF',
        border: 'none',
        boxShadow: '0 8px 24px rgba(31,157,85,0.36)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3.5a3.5 3.5 0 0 0-3.5 3.5v6a3.5 3.5 0 0 0 7 0V7A3.5 3.5 0 0 0 12 3.5Z" />
        <path d="M5.5 11a.75.75 0 0 1 .75.75V13a5.75 5.75 0 0 0 11.5 0v-1.25a.75.75 0 0 1 1.5 0V13a7.25 7.25 0 0 1-6.5 7.21V22a.75.75 0 0 1-1.5 0v-1.79A7.25 7.25 0 0 1 4.75 13v-1.25A.75.75 0 0 1 5.5 11Z" />
      </svg>
    </button>
  );
}
