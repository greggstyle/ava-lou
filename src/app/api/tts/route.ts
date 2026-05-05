import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Text-to-speech via OpenAI TTS-1.
 *
 * POST { text: string, voice?: 'shimmer' | 'nova' | 'alloy' }
 * → audio/mpeg stream
 *
 * Auth required (don't burn the OpenAI quota for randos).
 *
 * Voice : "shimmer" (par défaut, douce, féminine, pro) — adapté Onde / AVA.
 * Pas de SSML pour rester sur tts-1 standard. Pour les longs textes (insights),
 * on tronque à 4096 chars (limite API).
 */

const BodySchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid input' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'TTS not configured' }, { status: 503 });

  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: parsed.data.voice ?? 'shimmer',
      input: parsed.data.text.slice(0, 4096),
      response_format: 'mp3',
      // Légèrement plus lent pour la clarté du français + accent DROM
      speed: 0.95,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: `TTS failed: ${upstream.status}`, detail: text.slice(0, 200) },
      { status: 502 },
    );
  }

  const arrayBuf = await upstream.arrayBuffer();
  return new NextResponse(arrayBuf, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=300', // small TTL since same text might replay
    },
  });
}
