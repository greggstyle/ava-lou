import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transcribeAudio } from '@/lib/whisper';

export const runtime = 'nodejs';

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

  // Convert Blob to a File the OpenAI SDK accepts.
  const filename = (audio as File).name || 'recording.webm';
  const type = audio.type || 'audio/webm';
  const file = new File([audio], filename, { type });

  try {
    const { text, durationMs } = await transcribeAudio(file);
    return NextResponse.json({ text, durationMs });
  } catch (err) {
    console.error('[transcribe] error', err);
    return NextResponse.json(
      { error: "Je n'ai pas pu transcrire l'audio. Réessayez ?" },
      { status: 500 },
    );
  }
}
