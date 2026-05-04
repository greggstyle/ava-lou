'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AvaMic, C, SANS } from '@/components/ava';

export function HomeMicDock() {
  const router = useRouter();

  function goToListen() {
    router.push('/listen');
  }

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        padding: '14px 20px 28px',
        background: `linear-gradient(180deg, rgba(244,243,238,0) 0%, ${C.bone} 30%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <AvaMic state="idle" size={88} onPointerDown={goToListen} />
      <div style={{ font: `500 12px/1.3 ${SANS}`, color: C.muted, textAlign: 'center' }}>
        Maintenez pour parler
      </div>
    </div>
  );
}
