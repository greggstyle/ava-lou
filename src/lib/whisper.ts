import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * Transcribe a French audio file via OpenAI Whisper.
 * Used in /api/transcribe — receives a Blob from MediaRecorder.
 */
export async function transcribeAudio(file: File): Promise<{ text: string; durationMs: number }> {
  const start = Date.now();
  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'fr',
    response_format: 'json',
    temperature: 0,
  });
  return { text: result.text.trim(), durationMs: Date.now() - start };
}
