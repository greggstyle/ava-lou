'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AvaButton, AvaWaveform, C, SERIF, SANS, TNUM } from '@/components/ava';

type Phase = 'init' | 'recording' | 'processing' | 'error';

const MAX_DURATION_MS = 30_000;

export function ListenUi() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPathRaw = searchParams.get('return');
  const [phase, setPhase] = React.useState<Phase>('init');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [level, setLevel] = React.useState(0);

  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const startedAtRef = React.useRef<number>(0);
  const autoStopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeRef = React.useRef<string>('audio/webm');
  const handlingStopRef = React.useRef(false);

  const cleanup = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStreamRef.current = null;
    try {
      audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const handleProcess = React.useCallback(
    async (blob: Blob) => {
      setPhase('processing');
      try {
        const fd = new FormData();
        const ext = mimeRef.current.includes('webm') ? 'webm' : 'mp4';
        fd.append('audio', blob, `recording.${ext}`);
        const txRes = await fetch('/api/transcribe', { method: 'POST', body: fd });
        if (!txRes.ok) {
          const j = await txRes.json().catch(() => ({}));
          throw new Error(j.error || "Je n'ai pas saisi — réessayez ?");
        }
        const tx = (await txRes.json()) as { text: string };
        if (!tx.text || tx.text.length < 2) {
          throw new Error("Je n'ai pas saisi — réessayez ?");
        }
        const intentRes = await fetch('/api/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: tx.text }),
        });
        if (!intentRes.ok) {
          const j = await intentRes.json().catch(() => ({}));
          throw new Error(j.error || 'Erreur côté AVA. Réessayez.');
        }
        const intent = (await intentRes.json()) as { actionId: string; intent?: string };
        if (returnPathRaw) {
          const returnPath = decodeURIComponent(returnPathRaw);
          const sep = returnPath.includes('?') ? '&' : '?';
          router.push(`${returnPath}${sep}action=${intent.actionId}`);
        } else {
          router.push(`/confirm/${intent.actionId}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Je n'ai pas saisi — réessayez ?";
        setErrorMsg(msg);
        setPhase('error');
      }
    },
    [router, returnPathRaw],
  );

  const stopRecording = React.useCallback(() => {
    if (handlingStopRef.current) return;
    handlingStopRef.current = true;
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {}
    }
  }, []);

  const startRecording = React.useCallback(async () => {
    setErrorMsg(null);
    setPhase('init');
    setElapsedMs(0);
    handlingStopRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Audio analysis for level
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Pick best mimeType
      let mime = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mime)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
        else mime = '';
      }
      mimeRef.current = mime || 'audio/webm';

      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || 'audio/webm',
        });
        cleanup();
        if (blob.size === 0) {
          setErrorMsg("Aucun audio capté — réessayez.");
          setPhase('error');
          return;
        }
        void handleProcess(blob);
      };

      recorder.start();
      startedAtRef.current = performance.now();
      setPhase('recording');

      // Level + timer loop
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const lvl = Math.max(0, Math.min(1, rms * 2.5));
        setLevel(lvl);
        setElapsedMs(performance.now() - startedAtRef.current);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      // Auto-stop at 30s
      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_DURATION_MS);
    } catch (err: unknown) {
      const isPermission =
        err instanceof Error && /denied|permission/i.test(err.message + (err.name || ''));
      setErrorMsg(
        isPermission
          ? "Accès au micro refusé. Activez le micro dans les réglages du navigateur, puis réessayez."
          : "Le micro n'est pas disponible. Vérifiez votre appareil et réessayez.",
      );
      setPhase('error');
      cleanup();
    }
  }, [cleanup, handleProcess, stopRecording]);

  React.useEffect(() => {
    void startRecording();
    return () => {
      cleanup();
      try {
        recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seconds = Math.floor(elapsedMs / 1000);
  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  let statusLabel = 'AVA écoute…';
  if (phase === 'processing') statusLabel = 'AVA traite…';
  if (phase === 'init') statusLabel = 'Initialisation…';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.ink,
        color: C.paper,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.paper,
            cursor: 'pointer',
            font: `500 14px/1 ${SANS}`,
            opacity: 0.85,
            padding: '6px 4px',
          }}
        >
          ← Annuler
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        {phase === 'error' ? (
          <>
            <div
              style={{
                font: `400 22px/1.4 ${SERIF}`,
                color: C.paper,
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              {errorMsg ?? "Je n'ai pas saisi — réessayez ?"}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <AvaButton kind="validate" onClick={() => void startRecording()}>
                Réessayer
              </AvaButton>
              <AvaButton kind="ghost" onClick={() => router.push('/')} style={{ color: C.paper }}>
                Annuler
              </AvaButton>
            </div>
          </>
        ) : (
          <>
            <AvaWaveform kind="full" animate={phase === 'recording'} level={level} />
            <div
              style={{
                font: `400 38px/1 ${SERIF}`,
                color: C.paper,
                ...TNUM,
              }}
            >
              {timer}
            </div>
            <div
              style={{
                font: `500 14px/1 ${SANS}`,
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: 0.2,
              }}
            >
              {statusLabel}
            </div>
          </>
        )}
      </div>

      {phase !== 'error' && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
          <AvaButton
            kind="validate"
            onClick={stopRecording}
            disabled={phase !== 'recording'}
            style={{ minWidth: 240 }}
          >
            {phase === 'processing' ? 'Traitement…' : 'Stop & traiter'}
          </AvaButton>
        </div>
      )}
    </main>
  );
}
