'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AvaButton, C, SANS } from '@/components/ava';

/**
 * Mode démo & test — deux actions :
 *   1. Charger des données fictives (5 clients, 8 factures, 3 devis,
 *      6 dépenses, 2 RDV) pour permettre à un nouveau bêta-testeur
 *      d'explorer l'app sans saisir 30 minutes de contenu.
 *   2. Tout effacer — supprime les données utilisateur (clients, factures,
 *      devis, dépenses, RDV, ava_actions, insights, notifications,
 *      factures récurrentes), conserve le profil.
 *
 * Le bouton « Tout effacer » est protégé par un prompt() qui exige
 * de taper le mot "EFFACER" en majuscules. C'est volontairement frictionnel.
 */
export function DemoModeButtons() {
  const router = useRouter();
  const [busySeed, setBusySeed] = React.useState(false);
  const [busyWipe, setBusyWipe] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSeed() {
    setBusySeed(true);
    setMsg(null);
    try {
      const r = await fetch('/api/demo-mode/seed', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j.error ?? 'Erreur de chargement');
      }
      const c = j.created;
      setMsg({
        kind: 'ok',
        text: `Données démo chargées : ${c.clients} clients, ${c.invoices} factures, ${c.quotes} devis, ${c.expenses} dépenses, ${c.appointments} RDV.`,
      });
      router.refresh();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setBusySeed(false);
    }
  }

  async function onWipe() {
    // Double-confirmation : prompt() qui demande le mot "EFFACER"
    // en majuscules, pour éviter le clic réflexe.
    const word = window.prompt(
      'Cette action supprime TOUTES vos données (clients, factures, devis, dépenses, rendez-vous). Action irréversible. Tapez EFFACER en majuscules pour confirmer :',
    );
    if (word !== 'EFFACER') {
      setMsg({ kind: 'err', text: 'Suppression annulée — il fallait taper EFFACER en majuscules.' });
      return;
    }

    setBusyWipe(true);
    setMsg(null);
    try {
      const r = await fetch('/api/demo-mode/wipe', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j.error ?? 'Erreur de suppression');
      }
      const d = j.deleted ?? {};
      const total = Object.values(d).reduce(
        (acc: number, n) => acc + (typeof n === 'number' ? n : 0),
        0,
      );
      setMsg({
        kind: 'ok',
        text: `Données effacées (${total} enregistrements). Le profil est conservé.`,
      });
      router.refresh();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setBusyWipe(false);
    }
  }

  const busy = busySeed || busyWipe;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AvaButton kind="light" onClick={onSeed} disabled={busy}>
        {busySeed ? 'Chargement…' : 'Charger des données de démo'}
      </AvaButton>
      <AvaButton kind="danger" onClick={onWipe} disabled={busy}>
        {busyWipe ? 'Suppression…' : 'Tout effacer'}
      </AvaButton>
      {msg && (
        <div
          style={{
            font: `500 12px/1.4 ${SANS}`,
            color: msg.kind === 'ok' ? C.green : C.warn,
            padding: 6,
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
