import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 25_000, // 25s — fail fast on flaky 4G rather than hanging until function timeout
  maxRetries: 1,   // Single retry on 5xx / network blip
});

export class WhisperEmptyError extends Error {
  constructor() {
    super("L'enregistrement est trop court ou silencieux. Parlez plus longtemps et réessayez.");
    this.name = 'WhisperEmptyError';
  }
}

export class WhisperRateLimitError extends Error {
  constructor() {
    super('AVA est très demandée pour le moment. Patientez 30 secondes et réessayez.');
    this.name = 'WhisperRateLimitError';
  }
}

/**
 * Transcribe a French audio file via OpenAI Whisper.
 * Used in /api/transcribe — receives a Blob from MediaRecorder.
 */
export async function transcribeAudio(file: File): Promise<{ text: string; durationMs: number }> {
  const start = Date.now();
  try {
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'fr',
      response_format: 'json',
      temperature: 0,
    });
    const text = result.text.trim();
    if (!text || text.length < 2) throw new WhisperEmptyError();
    return { text, durationMs: Date.now() - start };
  } catch (err) {
    if (err instanceof WhisperEmptyError) throw err;
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) throw new WhisperRateLimitError();
      if (err.status === 400 && /audio|too short|silent/i.test(err.message)) {
        throw new WhisperEmptyError();
      }
    }
    throw err;
  }
}
