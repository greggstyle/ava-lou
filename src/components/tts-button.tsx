'use client';

import * as React from 'react';
import { C, SANS } from '@/components/ava';

interface TtsButtonProps {
  text: string;
  /** Petit label sous le bouton ("Écouter AVA") */
  label?: string;
  /** Auto-play on mount (only when not yet played in this session) */
  autoPlayOnce?: boolean;
}

/**
 * Petit bouton circulaire qui joue le texte via /api/tts.
 *
 * UX :
 *   - Tap "▷" → loading spin → play → "■" pause → tap pour stop
 *   - Si la réponse échoue, on affiche un toast inline rouge.
 *   - autoPlayOnce : sur la page /confirm, on auto-play 1 seule fois par
 *     action_id (mémorisé via sessionStorage) — l'utilisateur entend AVA
 *     reformuler sans cliquer.
 */
export function TtsButton({ text, label = 'Écouter AVA', autoPlayOnce = false }: TtsButtonProps) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = React.useRef<string | null>(null);
  const triggeredAutoPlay = React.useRef(false);

  const cleanup = React.useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  React.useEffect(() => () => cleanup(), [cleanup]);

  const play = React.useCallback(async () => {
    setState('loading');
    setErrorMsg(null);
    try {
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      cleanup();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState('idle');
      audio.onerror = () => { setState('error'); setErrorMsg('Lecture audio échouée'); };
      try {
        await audio.play();
        setState('playing');
      } catch (playErr) {
        // iOS may block autoplay if not from user gesture
        const msg = playErr instanceof Error ? playErr.message : 'autoplay refusé';
        setState('error');
        setErrorMsg(msg.includes('user') || msg.includes('gesture') ? 'Tapez le bouton pour écouter' : msg);
      }
    } catch (e) {
      setState('error');
      setErrorMsg(e instanceof Error ? e.message : 'Erreur TTS');
    }
  }, [text, cleanup]);

  const stop = React.useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setState('idle');
  }, []);

  // Auto-play once per session, if requested. Hashing text approximates
  // "have we heard this exact line before" without persisting full text.
  // Skipped entirely if user has disabled TTS via the settings preference.
  React.useEffect(() => {
    if (!autoPlayOnce || triggeredAutoPlay.current) return;
    triggeredAutoPlay.current = true;
    if (typeof sessionStorage === 'undefined') return;
    // Respect user pref (set in /parametres)
    try {
      if (localStorage.getItem('ava-tts-autoplay') === 'off') return;
    } catch { /* ignore */ }
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
    const key = `tts-played-${hash}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void play();
  }, [autoPlayOnce, text, play]);

  function onClick() {
    if (state === 'playing') stop();
    else void play();
  }

  return (
    <span className="ava-print-hide" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        aria-label={state === 'playing' ? 'Arrêter' : label}
        onClick={onClick}
        disabled={state === 'loading'}
        style={{
          width: 36, height: 36, borderRadius: 18,
          border: `1px solid ${C.line}`,
          background: state === 'playing' ? C.ink : C.paper,
          color: state === 'playing' ? C.paper : C.ink,
          font: `500 14px/1 ${SANS}`,
          cursor: state === 'loading' ? 'progress' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
      >
        {state === 'loading' ? '…' : state === 'playing' ? '■' : '▶'}
      </button>
      {label && state !== 'error' && (
        <span style={{ font: `500 12px/1.2 ${SANS}`, color: C.muted }}>{label}</span>
      )}
      {state === 'error' && errorMsg && (
        <span style={{ font: `500 12px/1.2 ${SANS}`, color: C.warn }}>{errorMsg}</span>
      )}
    </span>
  );
}
