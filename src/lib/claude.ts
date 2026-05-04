import Anthropic from '@anthropic-ai/sdk';
import type { IntentResult } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `Tu es AVA, l'assistante administrative vocale et conversationnelle d'un artisan français. Tu parles uniquement français. Tu es spécialisée dans les métiers du bâtiment, de la plomberie, de l'électricité, de la menuiserie et des services.

TON SEUL RÔLE : extraire l'intention et les entités d'une commande vocale transcrite, et retourner UNIQUEMENT un objet JSON valide. Zéro texte avant ou après le JSON.

INTENTIONS RECONNUES :
- create_invoice : créer + envoyer une facture
- create_quote : créer un devis
- send_reminder : relancer un client ou des devis
- get_financial_status : consulter impayés, trésorerie, devis en attente
- get_invoice_list : lister des factures avec filtres
- schedule_appointment : créer un rendez-vous
- send_document : envoyer un document existant
- find_document : chercher un document archivé
- sign_document : demander une signature électronique
- unknown : aucune des intentions ci-dessus

FORMAT DE RÉPONSE OBLIGATOIRE :
{"intent":"[une des intentions ci-dessus]","entities":{"client_name":null,"client_email":null,"amount_total":null,"line_items":[{"label":"","qty":1,"unit_price":null,"vat_rate":20}],"date":null,"due_date":null,"notes":null,"document_ref":null},"confidence":0.0,"ava_response":"[réponse courte en français naturel confirmant la compréhension ou demandant la précision manquante]"}

RÈGLES CRITIQUES :
1. Ne JAMAIS inventer un nom, un montant, ou une date non mentionnée → mettre null
2. Si une information essentielle manque → confidence < 0.75 + ava_response = question ciblée
3. main d'oeuvre / MO = qty × taux horaire → calculer si les deux sont donnés
4. TVA par défaut = 20% sauf si artisan dit "TVA 10%" ou "TVA 8,5 %" (DROM) ou "auto-entrepreneur" (TVA 0)
5. Reconnaître les abréviations artisan : MO, dépl, four, mat, RDV, chantier
6. Si client_name est dans le contexte mémoire fourni → récupérer son email et son id PA si disponibles
7. Ne JAMAIS sortir du format JSON — aucune explication, aucun préambule
8. ava_response doit reformuler ce qu'AVA a compris en une phrase naturelle complète, pas en bullets`;

export interface ClaudeContext {
  /** Recent client names for fuzzy matching by Claude. */
  recent_clients?: { name: string; email?: string | null }[];
  /** User's default VAT rate (20 metropole, 8.5 DROM). */
  vat_default?: number;
  /** Whether user is in DROM (suggests 8.5% default). */
  is_drom?: boolean;
}

export async function extractIntent(
  transcript: string,
  context: ClaudeContext = {},
): Promise<IntentResult> {
  const ctxLines: string[] = [];
  if (context.is_drom) ctxLines.push('Utilisateur basé en DROM (TVA défaut 8,5 %).');
  if (context.vat_default !== undefined) ctxLines.push(`TVA par défaut de l'utilisateur : ${context.vat_default} %.`);
  if (context.recent_clients?.length) {
    ctxLines.push('Clients récents :');
    for (const c of context.recent_clients.slice(0, 10)) {
      ctxLines.push(`- ${c.name}${c.email ? ` (${c.email})` : ''}`);
    }
  }
  const userMsg = ctxLines.length
    ? `CONTEXTE :\n${ctxLines.join('\n')}\n\nCOMMANDE VOCALE :\n${transcript}`
    : `COMMANDE VOCALE :\n${transcript}`;

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  });

  const block = resp.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('Réponse Claude vide');
  }
  // Strip any potential code fences just in case.
  const raw = block.text.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(raw) as IntentResult;
    return parsed;
  } catch (err) {
    throw new Error(`JSON Claude invalide : ${raw.slice(0, 200)}`);
  }
}
