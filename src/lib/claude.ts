import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { IntentEntities, IntentResult } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 20_000,
  maxRetries: 1,
});

const SYSTEM_PROMPT = `Tu es AVA, l'assistante administrative vocale et conversationnelle d'un artisan français. Tu parles uniquement français. Tu es spécialisée dans les métiers du bâtiment, de la plomberie, de l'électricité, de la menuiserie et des services.

TON SEUL RÔLE : extraire l'intention et les entités d'une commande vocale transcrite, et retourner UNIQUEMENT un objet JSON valide. Zéro texte avant ou après le JSON.

INTENTIONS RECONNUES :
- create_invoice : créer une facture (mots-clés "facture", "facturer")
- create_quote : créer un devis (mots-clés "devis", "estimation", "proposition")
- send_reminder : relancer un client ou des devis
- get_financial_status : consulter impayés, trésorerie, devis en attente
- get_invoice_list : lister des factures avec filtres
- mark_paid : marquer une facture comme payée ("M. Payet a payé", "réglé par Mme Hoarau")
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
6. TVA par défaut prioritaire : si is_drom=true dans le contexte → TVA 8,5%. Sinon TVA 20%. Sauf si artisan dit explicitement "TVA 10%" / "TVA 5,5%" / "auto-entrepreneur" (TVA 0) — auquel cas suivre.
7. Reconnaître les abréviations artisan : MO, dépl, four, mat, RDV, chantier, m² (mètres carrés), ml (mètre linéaire), forfait.
8. Si client_name est dans le contexte mémoire → utilise-le tel quel SANS modifier (les noms inventés sont l'erreur la pire). Préfère un nom du contexte si phonétiquement proche.
9. Ne mets confidence < 0.5 QUE si la phrase est totalement ambigüe ou ne contient aucun mot-clé d'intent reconnu. Sinon ≥ 0.65.
10. Ne JAMAIS sortir du format JSON — aucune explication, aucun préambule, aucun bloc de code markdown.
11. ava_response = reformulation naturelle de ce qu'AVA a compris ("Facture pour M. Payet, 3 heures à 55 € — total 178,73 € TTC."), pas une question. Si une info manque, mentionne-la dans la reformulation ("Facture de 500 € pour M. Payet — précisez la prestation si besoin.") plutôt que de bloquer.
12. Pour mark_paid : extraire le client_name dans entities, laisser line_items vide []. Mots-clés : "a payé", "réglé", "encaissé", "viré", "versé".
13. Pour send_reminder : extraire client_name dans entities (qui relancer), laisser le reste vide. Mots-clés : "relance", "rappel", "relancer".
14. Pour find_document / send_document : extraire client_name + (optionnellement) une période ou un numéro dans notes. Mots-clés find : "trouve", "cherche", "retrouve". Mots-clés send : "envoie", "envoyer".
15. Reconnais "vendredi/lundi/mardi prochain" → calculer la date ISO si possible, sinon mettre la mention en notes.

EXEMPLES (tu retournes UNIQUEMENT le JSON, ces exemples sont pour la calibration) :

Phrase : "Facture pour Monsieur Payet, 3 heures de plomberie à 55 euros TVA 8,5 pourcent"
{"intent":"create_invoice","entities":{"client_name":"M. Payet","client_email":null,"amount_total":null,"line_items":[{"label":"Plomberie","qty":3,"unit_price":55,"vat_rate":8.5}],"date":null,"due_date":null,"notes":null,"document_ref":null},"confidence":0.92,"ava_response":"Facture pour M. Payet, 3 heures de plomberie à 55 € — TVA 8,5% DROM, total 178,73 € TTC."}

Phrase : "Devis Madame Hoarau pour pose carrelage salon 25 mètres carrés à 45 euros"
{"intent":"create_quote","entities":{"client_name":"Mme Hoarau","client_email":null,"amount_total":null,"line_items":[{"label":"Pose carrelage","qty":25,"unit_price":45,"vat_rate":8.5}],"date":null,"due_date":null,"notes":"salon","document_ref":null},"confidence":0.9,"ava_response":"Devis pour Mme Hoarau, pose carrelage salon 25 m² à 45 € — total 1219,69 € TTC."}

Phrase : "Monsieur Payet a réglé la facture"
{"intent":"mark_paid","entities":{"client_name":"M. Payet","client_email":null,"amount_total":null,"line_items":[],"date":null,"due_date":null,"notes":null,"document_ref":null},"confidence":0.88,"ava_response":"Marquer la facture de M. Payet comme payée ?"}

Phrase : "Relance Madame Hoarau"
{"intent":"send_reminder","entities":{"client_name":"Mme Hoarau","client_email":null,"amount_total":null,"line_items":[],"date":null,"due_date":null,"notes":null,"document_ref":null},"confidence":0.88,"ava_response":"Préparer une relance pour Mme Hoarau ?"}

Phrase : "Qu'est-ce qui rentre cette semaine"
{"intent":"get_financial_status","entities":{"client_name":null,"client_email":null,"amount_total":null,"line_items":[],"date":null,"due_date":null,"notes":null,"document_ref":null},"confidence":0.85,"ava_response":"Voici votre trésorerie."}

Phrase : "Trouve la facture de Monsieur Técher du mois dernier"
{"intent":"find_document","entities":{"client_name":"M. Técher","client_email":null,"amount_total":null,"line_items":[],"date":null,"due_date":null,"notes":"mois dernier","document_ref":null},"confidence":0.85,"ava_response":"Recherche en cours pour M. Técher."}

Phrase : "Facture forfait 1500 euros pour Madame Grondin"
{"intent":"create_invoice","entities":{"client_name":"Mme Grondin","client_email":null,"amount_total":1500,"line_items":[{"label":"Forfait","qty":1,"unit_price":1500,"vat_rate":8.5}],"date":null,"due_date":null,"notes":null,"document_ref":null},"confidence":0.85,"ava_response":"Facture forfait 1500 € pour Mme Grondin — total 1627,50 € TTC."}`;

export interface ClaudeContext {
  recent_clients?: { name: string; email?: string | null }[];
  vat_default?: number;
  is_drom?: boolean;
}

const LineItemSchema = z.object({
  label: z.string().default(''),
  qty: z.coerce.number().default(1),
  unit_price: z.coerce.number().nullable().default(null),
  vat_rate: z.coerce.number().default(20),
});

const IntentEntitiesSchema = z.object({
  client_name: z.string().nullable().default(null),
  client_email: z.string().nullable().default(null),
  amount_total: z.coerce.number().nullable().default(null),
  line_items: z.array(LineItemSchema).default([]),
  date: z.string().nullable().default(null),
  due_date: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  document_ref: z.string().nullable().default(null),
});

const VALID_INTENTS = [
  'create_invoice', 'create_quote', 'send_reminder', 'get_financial_status',
  'get_invoice_list', 'mark_paid', 'schedule_appointment', 'send_document',
  'find_document', 'sign_document', 'unknown',
] as const;

const IntentResultSchema = z.object({
  intent: z.enum(VALID_INTENTS).default('unknown'),
  entities: IntentEntitiesSchema.default({} as never),
  confidence: z.coerce.number().min(0).max(1).default(0),
  ava_response: z.string().default("Je n'ai pas saisi — pouvez-vous reformuler ?"),
});

function gracefulFallback(transcript: string): IntentResult {
  return {
    intent: 'unknown',
    entities: {
      client_name: null,
      client_email: null,
      amount_total: null,
      line_items: [],
      date: null,
      due_date: null,
      notes: null,
      document_ref: null,
    } as IntentEntities,
    confidence: 0,
    ava_response: `J'ai entendu « ${transcript.slice(0, 80)}${transcript.length > 80 ? '…' : ''} » mais je n'ai pas réussi à structurer la demande. Voulez-vous continuer en formulaire ?`,
  };
}

export async function extractIntent(
  transcript: string,
  context: ClaudeContext = {},
): Promise<IntentResult> {
  const ctxLines: string[] = [];
  if (context.is_drom) ctxLines.push('Utilisateur basé en DROM (TVA défaut 8,5 %, à appliquer sauf mention contraire).');
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

  let raw = '';
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });

    const block = resp.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      console.warn('[claude] empty response');
      return gracefulFallback(transcript);
    }
    raw = block.text.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  } catch (err) {
    console.warn('[claude] API error:', err instanceof Error ? err.message : err);
    return gracefulFallback(transcript);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    console.warn('[claude] invalid JSON:', raw.slice(0, 200));
    return gracefulFallback(transcript);
  }

  const validated = IntentResultSchema.safeParse(parsedJson);
  if (!validated.success) {
    console.warn('[claude] schema validation failed:', validated.error.issues);
    return gracefulFallback(transcript);
  }

  return validated.data as IntentResult;
}
