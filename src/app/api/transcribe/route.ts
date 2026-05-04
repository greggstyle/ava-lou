import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transcribeAudio, WhisperEmptyError, WhisperRateLimitError } from '@/lib/whisper';

export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel function max — slightly above 25s Whisper timeout

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper's hard limit

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const audio = formData.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Aucun audio reçu." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Enregistrement trop long (>25 Mo). Découpez en plusieurs commandes." },
      { status: 413 },
    );
  }

  const filename = (audio as File).name || 'recording.webm';
  const type = audio.type || 'audio/webm';
  const file = new File([audio], filename, { type });

  try {
    const { text, durationMs } = await transcribeAudio(file);
    return NextResponse.json({ text, durationMs });
  } catch (err) {
    if (err instanceof WhisperEmptyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof WhisperRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error('[transcribe] error', err);
    return NextResponse.json(
      { error: "Je n'ai pas pu transcrire l'audio. Réessayez ?" },
      { status: 500 },
    );
  }
}
