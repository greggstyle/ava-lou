'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AvaCard, AvaButton, AvaLabel, C, SANS, SERIF } from '@/components/ava';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  created_at: string;
}

export function NotificationsBanner({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState<Notification[]>(initial);

  if (items.length === 0) return null;

  async function dismiss(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_dismissed: true }),
      });
    } catch {}
  }

  // Show only the top one
  const top = items[0];

  return (
    <div style={{ marginTop: 16 }}>
      <AvaLabel style={{ marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: C.orange }} />
          AVA vous suggère
        </span>
      </AvaLabel>
      <AvaCard padding={16} style={{ background: '#FFF8E5', borderColor: '#F0E6BD' }}>
        <div style={{ font: `400 18px/1.35 ${SERIF}`, color: C.ink, marginBottom: 4 }}>
          {top.title}
        </div>
        {top.body && (
          <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.ink2, marginBottom: 12 }}>
            {top.body}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {top.action_url && (
            <AvaButton kind="primary" onClick={() => {
              void dismiss(top.id);
              router.push(top.action_url!);
            }}>
              Examiner
            </AvaButton>
          )}
          <AvaButton kind="ghost" onClick={() => void dismiss(top.id)}>
            Plus tard
          </AvaButton>
        </div>
      </AvaCard>
    </div>
  );
}
