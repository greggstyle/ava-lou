'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { AvaButton, AvaCard, AvaLabel, C, SANS, SERIF } from '@/components/ava';

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

/**
 * Affiché à la place de la carte « Compte » classique quand
 * `user.is_anonymous === true`.
 *
 * UX :
 *   1. Carte warm-yellow expliquant le mode bêta sans email
 *   2. Champ email + bouton « Ajouter mon email »
 *   3. Au submit : `supabase.auth.updateUser({ email })` → Supabase envoie
 *      un mail de confirmation → l'utilisateur clique le lien dans son
 *      mail → /auth/callback exchange → user devient permanent (même
 *      `user.id`, données conservées via RLS)
 *   4. Pendant la transition (mail envoyé, pas encore cliqué) : message
 *      vert « ✓ Email envoyé. Cliquez le lien dans votre boîte. »
 */
export function AnonymousEmailLinkForm() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const trimmed = email.trim();
      if (!trimmed) throw new Error('Email manquant');
      const { error: upErr } = await supabase.auth.updateUser({ email: trimmed });
      if (upErr) throw upErr;
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      // Friendly French rewording for the most common Supabase errors
      if (/already.*registered|email.*used|already.*exist/i.test(msg)) {
        setError("Cet email est déjà utilisé par un autre compte AVA. Choisissez un autre email ou connectez-vous depuis l'écran de connexion.");
      } else if (/invalid.*email|email.*invalid/i.test(msg)) {
        setError('Cet email semble invalide. Vérifiez la saisie.');
      } else if (/rate.*limit|too.*many/i.test(msg)) {
        setError('Trop de tentatives récentes. Patientez quelques minutes avant de réessayer.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AvaCard padding={16} style={{ background: C.greenSoft, border: `1px solid ${C.line}` }}>
        <AvaLabel color={C.green} style={{ marginBottom: 6 }}>✓ Email envoyé</AvaLabel>
        <div style={{ font: `400 15px/1.5 ${SERIF}`, color: C.ink }}>
          Un lien de confirmation a été envoyé à <em>{email}</em>. Ouvrez votre boîte mail et cliquez pour finaliser.
        </div>
        <div style={{ font: `400 12px/1.45 ${SANS}`, color: C.ink2, marginTop: 8 }}>
          Pas d&apos;inquiétude : <strong>vos données restent intactes</strong>. Le clic transforme votre compte bêta en compte permanent, sans rien perdre.
        </div>
      </AvaCard>
    );
  }

  return (
    <AvaCard padding={16} style={{ background: C.warmYellow, border: `1px solid ${C.line}` }}>
      <AvaLabel style={{ marginBottom: 6 }}>Compte bêta — sans email</AvaLabel>
      <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2, marginBottom: 12 }}>
        Vos données sont sauvegardées <strong>uniquement sur cet appareil</strong>. Ajoutez votre email pour les retrouver sur votre ordinateur ou un autre téléphone — vos factures, clients, IBAN restent intacts.
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          style={inputStyle}
        />
        {error && (
          <div style={{ font: `500 13px/1.45 ${SANS}`, color: C.warn, padding: 8, background: C.paper, borderRadius: 8 }}>
            {error}
          </div>
        )}
        <AvaButton kind="primary" full type="submit" disabled={loading || !email.trim()}>
          {loading ? 'Envoi…' : 'Ajouter mon email'}
        </AvaButton>
      </form>
    </AvaCard>
  );
}
