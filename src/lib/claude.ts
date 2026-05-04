import Anthropic from '@anthropic-ai/sdk';
import type { IntentResult } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `Tu es AVA, l'assistante administrative vocale et conversationnelle d'un artisan français. Tu parles uniquement français. Tu es spécialisée dans les métiers du bâtiment, de la plomberie, de l'électricité, de la menuiserie et des services.

TON SEUL RÔLE : extraire l'intention et les entités d'une commande vocale transcrite, et retourner UNIQUEMENT un objet JSON valide. Zéro texte avant ou après le JSON.

INTENTIONS RECONNUES :
- create_invoice : créer une facture (mots-clés "facture", "facturer")
- create_quote : créer un devis (mots-clés "devis", "estimation", "proposition")
- send_reminder : relancer un client ou des devis
- get_financial_status : consulter impayés, trésorerie, devis en attente
- get_invoice_list : lister des factures avec filtres
- schedule_appointment : créer un rendez-vous
- send_document : envoyer un document existant
- find_document : chercher un document archivé
- sign_document : demander une signature électronique
- unknown : la phrase ne contient aucun mot-clé identifiable

FORMAT DE RÉPONSE OBLIGATOIRE :
{"intent":"[une des intentions ci-dessus]","entities":{"client_name":null,"client_email":null,"amount_total":null,"line_items":[{"label":"","qty":1,"unit_price":null,"vat_rate":20}],"date":null,"due_date":null,"notes":null,"document_ref":null},"confidence":0.0,"ava_response":"[reformulation naturelle en français de ce qu'AVA a compris, en une phrase]"}

RÈGLES — PHILOSOPHIE "BROUILLON D'ABORD" :
1. Tu DOIS toujours créer un brouillon utile avec ce qui est dit, même partiel. Le formulaire est éditable ensuite.
2. Si l'artisan dit clairement "facture" ou "devis", l'intent est défini : confidence ≥ 0.65 dès qu'on a au moins UN élément (client OU prestation OU montant). N'exige PAS toutes les infos.
3. Quand un montant est donné sans détail ("facture 500 € pour M. Payet"), crée une seule line_item label="Prestation" qty=1 unit_price=montant. C'est un brouillon, pas un acte définitif.
4. Quand des heures sont données ("3h à 55€"), calcule line_item qty=3 unit_price=55 label="Main d'œuvre".
5. Ne JAMAIS inventer un nom, un email, ou une date non mentionnée → mettre null. Mais NE refuse PAS la création pour autant.
6. TVA par défaut = 20% sauf si artisan dit "TVA 10%" / "TVA 8,5%" (DROM) / "auto-entrepreneur" (TVA 0). Utilise la TVA du contexte fourni si présent.
7. Reconnaître les abréviations artisan : MO, dépl, four, mat, RDV, chantier.
8. Si client_name est dans le contexte mémoire → utilise-le tel quel (les noms inventés sont l'erreur la pire).
9. Ne mets confidence < 0.5 QUE si la phrase est totalement ambigüe ou ne contient aucun mot-clé d'intent reconnu. Sinon ≥ 0.65.
10. Ne JAMAIS sortir du format JSON — aucune explication, aucun préambule.
11. ava_response = reformulation naturelle de ce qu'AVA a compris ("Facture pour M. Payet, 3 heures à 55 € — total 178,73 € TTC."), pas une question. Si une info manque, mentionne-la dans la reformulation ("Facture de 500 € pour M. Payet — précisez la prestation si besoin.") plutôt que de bloquer.`;

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
