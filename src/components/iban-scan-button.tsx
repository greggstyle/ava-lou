'use client';

import * as React from 'react';
import { C, SANS } from '@/components/ava';

interface IbanScanResult {
  iban?: string | null;
  bic?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;
  confidence: number;
  iban_warning?: string;
}

interface IbanScanButtonProps {
  onResult: (r: IbanScanResult) => void;
  /** Tone "primary" inside dark wizard, "soft" inside settings card */
  tone?: 'primary' | 'soft';
}

/**
 * Bouton pour photographier un RIB (ou capture d'écran d'app banque).
 * Réutilisable dans le wizard onboarding et dans /parametres.
 *
 * UX :
 *  - Tap → ouvre la caméra (capture="environment") ou la photothèque
 *  - Pendant l'OCR → label "Lecture du RIB…"
 *  - Au retour : appelle onResult avec les champs extraits
 *  - Si l'IBAN ne checksum pas, message inline pour vérifier à la main
 */
export function IbanScanButton({ onResult, tone = 'soft' }: IbanScanButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const ref = React.useRef<HTMLInputElement | null>(null);
  const inputId = React.useId();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const r = await fetch('/api/iban-from-photo', { method: 'POST', body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? 'OCR échoué');
      }
      const j = (await r.json()) as IbanScanResult;
      onResult(j);
      const conf = Math.round((j.confidence ?? 0) * 100);
      if (j.iban_warning) {
        setMsg({ kind: 'warn', text: j.iban_warning });
      } else if (j.iban) {
        setMsg({ kind: 'ok', text: `IBAN détecté (${conf}% de confiance). Vérifiez puis enregistrez.` });
      } else {
        setMsg({ kind: 'warn', text: 'Aucun IBAN trouvé sur la photo. Réessayez ou saisissez à la main.' });
      }
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erreur' });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  const isDark = tone === 'primary';
  const bg = isDark ? C.ink : C.paper;
  const fg = isDark ? C.paper : C.ink;
  const border = isDark ? C.ink : C.line;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        style={{ display: 'none' }}
        id={inputId}
      />
      <label htmlFor={inputId}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: 44, borderRadius: 12, padding: '0 16px',
          background: bg, color: fg, border: `1px solid ${border}`,
          font: `600 14px/1 ${SANS}`,
          cursor: busy ? 'progress' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'Lecture du RIB…' : '📷 Scanner mon RIB'}
        </span>
      </label>
      {msg && (
        <div style={{
          font: `500 12px/1.4 ${SANS}`,
          color: msg.kind === 'ok' ? C.green : msg.kind === 'warn' ? C.warn : C.warn,
          padding: 6,
          background: msg.kind === 'ok' ? C.greenSoft : C.soft,
          borderRadius: 6,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
