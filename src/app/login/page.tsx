'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { AvaButton, AvaCard, AvaDisclaimer, AvaLabel, C, SANS, SERIF } from '@/components/ava';

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: '32px 20px 60px', display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100vh' }}>
      <div style={{ marginTop: 40 }}>
        <svg width="56" height="28" viewBox="0 0 56 28">
          <g fill={C.ink}>
            <rect x="0" y="11" width="3" height="6" rx="1.5" />
            <rect x="6" y="7" width="3" height="14" rx="1.5" />
            <rect x="12" y="3" width="3" height="22" rx="1.5" />
            <rect x="18" y="0" width="3" height="28" rx="1.5" />
            <rect x="24" y="5" width="3" height="18" rx="1.5" />
            <rect x="30" y="9" width="3" height="10" rx="1.5" />
            <rect x="36" y="12" width="3" height="4" rx="1.5" />
          </g>
        </svg>
      </div>

      <div>
        <h1 style={{ font: `400 36px/1.05 ${SERIF}`, color: C.ink, letterSpacing: '-0.01em' }}>
          Bienvenue sur <em style={{ fontStyle: 'italic', color: C.green }}>AVA</em>
        </h1>
        <p style={{ marginTop: 12, font: `400 15px/1.55 ${SANS}`, color: C.ink2 }}>
          L&apos;assistance vocale administrative pour artisans. Entrez votre email — un lien magique vous attendra dans votre boîte.
        </p>
      </div>

      {sent ? (
        <AvaCard padding={20}>
          <AvaLabel color={C.green} style={{ marginBottom: 8 }}>✓ Lien envoyé</AvaLabel>
          <div style={{ font: `400 16px/1.5 ${SERIF}`, color: C.ink }}>
            Un lien de connexion a été envoyé à <em>{email}</em>. Ouvrez votre boîte mail et cliquez pour entrer dans AVA.
          </div>
        </AvaCard>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AvaLabel>Adresse email</AvaLabel>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
              style={{ height: 50 }}
            />
          </label>
          {error && (
            <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>
          )}
          <AvaButton kind="primary" full type="submit" disabled={loading || !email}>
            {loading ? 'Envoi…' : 'Recevoir le lien'}
          </AvaButton>
        </form>
      )}

      <div style={{ marginTop: 'auto' }}>
        <AvaDisclaimer />
      </div>
    </main>
  );
}
