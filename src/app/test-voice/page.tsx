'use client';

/**
 * Voice debug page — paste any French text and see Claude's structured
 * extraction in real time. Useful for tuning the system prompt without
 * having to record audio every time.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  AvaTopBar, AvaCard, AvaButton, AvaField, AvaLabel, C, SANS, SERIF, TNUM,
} from '@/components/ava';

const inputStyle: React.CSSProperties = {
  background: C.paper,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: '12px 14px',
  font: `400 14px/1.5 ${SANS}`,
  color: C.ink,
  width: '100%',
  outline: 'none',
};

const SAMPLES = [
  'Facture pour M. Payet, 3 heures de plomberie à 55 € TVA 8,5 %',
  'Devis Madame Hoarau, pose carrelage salon 25 m² à 45 €',
  'M. Payet a payé',
  'Mme Hoarau a réglé la facture',
  'Relance M. Técher',
  "Qu'est-ce qui rentre cette semaine ?",
  'Mes factures impayées',
  'Trouve la facture de M. Payet du mois dernier',
  'Envoie le devis à Mme Hoarau',
  'Facture forfait 1500 € pour Madame Grondin',
  'Fais-moi un truc',
];

interface Result {
  actionId?: string;
  intent?: string;
  ava_response?: string;
  confidence?: number;
  error?: string;
  durationMs?: number;
  raw?: unknown;
}

export default function TestVoicePage() {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);

  async function run() {
    if (!text.trim()) return;
    setBusy(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const j = await res.json();
      const elapsed = Math.round(performance.now() - t0);
      if (!res.ok) {
        setResult({ error: j.error ?? 'Erreur', durationMs: elapsed });
      } else {
        setResult({ ...j, durationMs: elapsed, raw: j });
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Debug vocal" />

      <div style={{ padding: '8px 20px 60px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ font: `600 24px/1.2 ${SERIF}`, color: C.ink, marginTop: 6 }}>
          Tester <em style={{ fontStyle: 'italic' }}>l&apos;extraction</em> AVA
        </h1>
        <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.muted }}>
          Tapez (ou collez) une phrase et lancez. Vous voyez exactement ce que Claude extrait — sans avoir à enregistrer.
          Outil de tuning interne, pas exposé aux artisans en prod.
        </div>

        <AvaCard padding={16}>
          <AvaField label="Phrase à tester">
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Facture pour Mme Hoarau, 4 heures à 60 €…"
            />
          </AvaField>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AvaButton kind="primary" onClick={run} disabled={busy || !text.trim()}>
              {busy ? 'Analyse…' : 'Analyser'}
            </AvaButton>
            <AvaButton kind="ghost" onClick={() => { setText(''); setResult(null); }}>
              Effacer
            </AvaButton>
          </div>
        </AvaCard>

        <div>
          <AvaLabel style={{ marginBottom: 8 }}>Exemples (cliquez pour pré-remplir)</AvaLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SAMPLES.map((s) => (
              <button
                key={s}
                onClick={() => setText(s)}
                style={{
                  background: C.paper, border: `1px solid ${C.line}`,
                  borderRadius: 12, padding: '8px 12px',
                  font: `500 12px/1.3 ${SANS}`, color: C.ink2,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {s.slice(0, 50)}{s.length > 50 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <AvaCard padding={16}>
            <AvaLabel style={{ marginBottom: 8 }}>Résultat</AvaLabel>
            {result.error ? (
              <div style={{ color: C.warn, font: `500 14px/1.5 ${SANS}` }}>{result.error}</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>Intent</div>
                    <div style={{ font: `600 16px/1.2 ${SANS}`, color: C.ink, marginTop: 2 }}>{result.intent}</div>
                  </div>
                  <div>
                    <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>Confidence</div>
                    <div style={{
                      font: `600 16px/1.2 ${SANS}`,
                      color: (result.confidence ?? 0) >= 0.65 ? C.green : (result.confidence ?? 0) >= 0.5 ? C.orange : C.warn,
                      marginTop: 2, ...TNUM,
                    }}>
                      {((result.confidence ?? 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>Latence</div>
                    <div style={{ font: `600 16px/1.2 ${SANS}`, color: C.ink2, marginTop: 2, ...TNUM }}>
                      {result.durationMs} ms
                    </div>
                  </div>
                </div>
                <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>
                  AVA répond
                </div>
                <div style={{ font: `400 16px/1.45 ${SERIF}`, color: C.ink, marginBottom: 12 }}>
                  {result.ava_response}
                </div>
                {result.actionId && (
                  <Link href={`/confirm/${result.actionId}`} style={{ font: `500 13px/1 ${SANS}`, color: C.green }}>
                    Voir l&apos;écran de confirmation →
                  </Link>
                )}
                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: 'pointer', font: `500 12px/1.3 ${SANS}`, color: C.muted }}>
                    JSON brut
                  </summary>
                  <pre style={{
                    marginTop: 8, padding: 12, background: C.soft, borderRadius: 8,
                    font: '11px/1.4 ui-monospace, monospace', color: C.ink2,
                    overflow: 'auto', maxHeight: 400,
                  }}>
                    {JSON.stringify(result.raw, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </AvaCard>
        )}
      </div>
    </main>
  );
}
