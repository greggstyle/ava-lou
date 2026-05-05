import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Photo OCR pour notes de frais — la fonctionnalité magique pour Lou.
 *
 * L'artisan prend une photo d'un ticket Point P / Leroy Merlin / restau, la
 * pousse ici, on la passe à GPT-4o (vision) qui extrait :
 *   - vendor (Point P)
 *   - amount_ttc (340.50)
 *   - amount_ht si visible
 *   - vat_rate si visible
 *   - expense_date (format ISO)
 *   - category (matériel / restauration / déplacement / etc.)
 *   - label court (1-3 mots décrivant l'achat)
 *
 * Pas de stockage côté serveur — l'image transite via l'API OpenAI puis est
 * jetée. La structuration JSON est validée par zod ; tout champ douteux passe
 * en null pour que l'artisan complète manuellement plutôt qu'une devinette.
 *
 * Auth requise.
 */

const ResponseSchema = z.object({
  vendor: z.string().nullable(),
  amount_ttc: z.coerce.number().nullable(),
  amount_ht: z.coerce.number().nullable(),
  vat_rate: z.coerce.number().nullable(),
  expense_date: z.string().nullable(),
  category: z.enum(['matériel', 'déplacement', 'sous-traitance', 'restauration', 'téléphonie', 'outillage', 'formation', 'autre']).nullable(),
  label: z.string().nullable(),
  confidence: z.coerce.number().min(0).max(1),
  notes: z.string().nullable(),
});

const SYSTEM_PROMPT = `Tu reçois une photo d'un ticket de caisse, d'une facture fournisseur, ou d'un reçu (en français). Tu extrais les informations comptables sous forme JSON STRICT, sans préambule.

CHAMPS :
- vendor : nom commercial du fournisseur (ex "Point P", "Leroy Merlin", "Total Énergies", "Carrefour"). null si illisible.
- amount_ttc : montant TOTAL TTC en euros (number, point décimal). C'est la ligne "Total TTC" ou "À payer" ou "Total". null si pas trouvable.
- amount_ht : montant HT si explicitement visible (sinon null, ne JAMAIS calculer).
- vat_rate : taux de TVA appliqué. Si plusieurs taux, prends le dominant. null si pas visible.
- expense_date : date au format YYYY-MM-DD. null si illisible.
- category : ESTIME parmi ['matériel','déplacement','sous-traitance','restauration','téléphonie','outillage','formation','autre']. Indices : Point P/BricoDépôt/Leroy Merlin → matériel ; péage/parking/essence → déplacement ; restau/café/sandwich → restauration ; ferraille/perceuse → outillage ; SFR/Orange → téléphonie. Si vraiment incertain → 'autre'.
- label : 1-3 mots décrivant l'achat (ex "Carrelage", "Essence", "Repas chantier"). Si vide, null.
- confidence : 0.0 à 1.0, ta confiance dans l'extraction. < 0.5 si la photo est floue/illisible/non-ticket.
- notes : si tu vois un numéro de facture, un projet/chantier, ou un détail utile en bas du ticket, mets-le ici. null sinon. Pas de phrase, juste les infos.

RÈGLES :
1. JAMAIS d'autre champ que ceux-ci. Aucune explication. Aucun bloc markdown.
2. Si tu vois plusieurs montants (HT, TVA, TTC), garde TTC pour amount_ttc.
3. Si la photo n'est PAS un ticket/facture/reçu (ex : selfie, paysage), confidence = 0 et tous les autres champs null.
4. Format JSON exact : {"vendor":...,"amount_ttc":...,"amount_ht":...,"vat_rate":...,"expense_date":...,"category":...,"label":...,"confidence":...,"notes":...}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OCR not configured' }, { status: 503 });

  // Multipart photo upload
  const formData = await req.formData();
  const file = formData.get('photo');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'photo manquante' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo trop lourde (max 10 Mo)' }, { status: 413 });
  }

  // Convert to base64 data URL for OpenAI Vision
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString('base64');
  const mime = file.type || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${base64}`;

  // Call OpenAI Chat Completions with vision
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extrais les infos de ce ticket :' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
      temperature: 0.1,
    }),
  });

  if (!upstream.ok) {
    const t = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: 'OCR failed', detail: t.slice(0, 200) },
      { status: 502 },
    );
  }

  const j = await upstream.json();
  const raw = j?.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'OCR returned no content' }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'OCR JSON invalide', raw: raw.slice(0, 200) }, { status: 502 });
  }

  const validated = ResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json({ error: 'OCR schema invalide', issues: validated.error.issues }, { status: 502 });
  }

  // If confidence too low, surface it but still return so user can verify
  return NextResponse.json(validated.data);
}
