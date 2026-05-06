import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizeIban, validateIban } from '@/lib/iban';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Photo OCR pour un RIB / capture d'écran d'app banque → extrait IBAN +
 * BIC + nom de banque + titulaire. Mêmes garde-fous que /api/expense-from-photo
 * (auth requise, max 10 Mo, JSON validé via Zod, no storage).
 *
 * Validation supplémentaire : checksum IBAN mod-97. Si Vision sort un
 * IBAN qui ne checksum pas, on renvoie quand même les autres champs et on
 * laisse l'utilisateur corriger l'IBAN à la main.
 */

const ResponseSchema = z.object({
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  bank_name: z.string().nullable(),
  account_holder: z.string().nullable(),
  confidence: z.coerce.number().min(0).max(1),
});

const SYSTEM_PROMPT = `Tu reçois une photo d'un RIB (Relevé d'Identité Bancaire) français ou européen, ou une capture d'écran d'application bancaire montrant les coordonnées bancaires d'un compte. Tu extrais les informations sous forme JSON STRICT, sans préambule.

CHAMPS :
- iban : IBAN en MAJUSCULES, sans espaces (ex "FR7612345678901234567890123"). null si illisible.
- bic : BIC/SWIFT en MAJUSCULES (8 ou 11 caractères, ex "BNPAFRPPXXX"). null si pas visible.
- bank_name : nom commercial de la banque (ex "Crédit Agricole Réunion", "BNP Paribas", "Société Générale", "Crédit Mutuel"). null si pas trouvé.
- account_holder : nom du titulaire (Madame ou Monsieur ... / SARL ... etc.). null si pas visible.
- confidence : 0.0 à 1.0, ta confiance dans l'extraction. < 0.5 si flou ou si ce n'est pas un RIB.

RÈGLES STRICTES :
1. JAMAIS d'autre champ. Aucune explication. Aucun bloc markdown.
2. IBAN : retire TOUS les espaces, MAJUSCULES. Vérifie que ça commence par 2 lettres puis 2 chiffres.
3. Si la photo n'est PAS un RIB ni une capture bancaire, confidence = 0 et tous les autres champs null.
4. Format JSON exact : {"iban":...,"bic":...,"bank_name":...,"account_holder":...,"confidence":...}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OCR not configured' }, { status: 503 });

  const formData = await req.formData();
  const file = formData.get('photo');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'photo manquante' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo trop lourde (max 10 Mo)' }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || 'image/jpeg'};base64,${buf.toString('base64')}`;

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extrais les coordonnées bancaires de ce RIB :' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.1,
    }),
  });

  if (!upstream.ok) {
    const t = await upstream.text().catch(() => '');
    return NextResponse.json({ error: 'OCR failed', detail: t.slice(0, 200) }, { status: 502 });
  }

  const j = await upstream.json();
  const raw = j?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'OCR returned no content' }, { status: 502 });
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return NextResponse.json({ error: 'OCR JSON invalide', raw: raw.slice(0, 200) }, { status: 502 }); }

  const validated = ResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json({ error: 'OCR schema invalide', issues: validated.error.issues }, { status: 502 });
  }

  // Normalize + validate IBAN. If checksum fails, we still return the value
  // so the user can correct it — but we add an iban_warning flag.
  const out = { ...validated.data } as typeof validated.data & { iban_warning?: string };
  if (out.iban) {
    out.iban = normalizeIban(out.iban);
    const v = validateIban(out.iban);
    if (!v.valid) {
      out.iban_warning = `IBAN suspect (${v.reason}). Vérifiez à la main.`;
    }
  }
  if (out.bic) out.bic = out.bic.replace(/\s+/g, '').toUpperCase();

  return NextResponse.json(out);
}
