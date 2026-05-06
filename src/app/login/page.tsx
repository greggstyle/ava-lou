'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { AvaButton, AvaCard, AvaDisclaimer, AvaLabel, C, SANS, SERIF } from '@/components/ava';

/**
 * Page de connexion — mode bêta avec sign-in anonyme par défaut.
 *
 * La promesse "voice-first" se casse quand l'utilisateur doit sortir de l'app
 * pour ouvrir un mail puis cliquer un lien magique (qui repart sur Safari, pas
 * dans TestFlight). Pour la phase bêta, on lance directement une session
 * anonyme Supabase : un compte UUID-only, sans email ni mot de passe, qui
 * permet de tester immédiatement.
 *
 * L'email reste disponible (lien "J'ai déjà un compte" en bas) pour ceux qui
 * reviennent sur leur compte existant.
 */
export default function LoginPage() {
  const [showEmail, setShowEmail] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [betaLoading, setBetaLoading] = React.useState(false);

  async function handleAnonymous() {
    setBetaLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      // Hard refresh to /, server side picks up the session cookie
      window.location.href = '/';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      // Helpful message if anonymous sign-in is disabled in Supabase
      if (msg.toLowerCase().includes('anonymous')) {
        setError("Le mode bêta n'est pas encore activé. Activez 'Anonymous sign-ins' dans Supabase → Authentication → Providers, puis réessayez.");
      } else {
        setError(msg);
      }
      setBetaLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
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
          L&apos;assistance vocale administrative pour artisans.
        </p>
      </div>

      {sent ? (
        <AvaCard padding={20}>
          <AvaLabel color={C.green} style={{ marginBottom: 8 }}>✓ Lien envoyé</AvaLabel>
          <div style={{ font: `400 16px/1.5 ${SERIF}`, color: C.ink }}>
            Un lien de connexion a été envoyé à <em>{email}</em>. Ouvrez votre boîte mail et cliquez pour entrer dans AVA.
          </div>
        </AvaCard>
      ) : !showEmail ? (
        <>
          {/* Beta launch: instant anonymous session */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AvaButton kind="primary" full onClick={handleAnonymous} disabled={betaLoading}>
              {betaLoading ? 'Préparation…' : 'Commencer maintenant'}
            </AvaButton>
            <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, textAlign: 'center' }}>
              Sans email, sans mot de passe. Pour la phase bêta, vous pouvez tester AVA immédiatement et ajouter votre email plus tard pour sauvegarder vos données entre appareils.
            </div>
            {error && (
              <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn, padding: 10, background: C.soft, borderRadius: 8 }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
            <div style={{ flex: 1, height: 1, background: C.line }} />
            <span style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>ou</span>
            <div style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          <button
            type="button"
            onClick={() => setShowEmail(true)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              font: `500 14px/1.4 ${SANS}`, color: C.ink2, textDecoration: 'underline',
              padding: 8,
            }}
          >
            J&apos;ai déjà un compte (connexion par email)
          </button>
        </>
      ) : (
        <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <p style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted, marginTop: -4 }}>
            Un lien magique vous attendra dans votre boîte mail.
          </p>
          {error && (
            <div style={{ font: `500 13px/1.4 ${SANS}`, color: C.warn }}>{error}</div>
          )}
          <AvaButton kind="primary" full type="submit" disabled={loading || !email}>
            {loading ? 'Envoi…' : 'Recevoir le lien'}
          </AvaButton>
          <button
            type="button"
            onClick={() => setShowEmail(false)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              font: `500 14px/1.4 ${SANS}`, color: C.muted, padding: 8,
            }}
          >
            ← Retour
          </button>
        </form>
      )}

      <div style={{ marginTop: 'auto' }}>
        <AvaDisclaimer />
      </div>
    </main>
  );
}
