/**
 * AVA Conseillère — generates strategic insights from user data via Claude.
 * Run weekly by /api/cron/insights, surfaced on /insights page + home banner.
 *
 * Philosophy (CdC §1.2 niveau 3):
 *   AVA analyse et recommande. Elle anticipe.
 *   Ex: « Votre trésorerie sera négative dans 18 jours si les 3 factures
 *        impayées ne rentrent pas. Voulez-vous que je priorise les relances ? »
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type InsightKind =
  | 'cashflow'
  | 'client_behavior'
  | 'seasonality'
  | 'growth'
  | 'overdue_pattern'
  | 'tariff_drift'
  | 'quote_conversion'
  | 'expense_ratio'
  | 'custom';

export type InsightSeverity = 'info' | 'warn' | 'opportunity';

export interface Insight {
  kind: InsightKind;
  title: string;
  body: string;
  metric_label?: string | null;
  metric_value?: string | null;
  severity: InsightSeverity;
}

const INSIGHT_KINDS = [
  'cashflow', 'client_behavior', 'seasonality', 'growth',
  'overdue_pattern', 'tariff_drift', 'quote_conversion', 'expense_ratio', 'custom',
] as const;

const InsightSchema = z.object({
  kind: z.enum(INSIGHT_KINDS),
  title: z.string().min(3).max(120),
  body: z.string().min(20).max(800),
  metric_label: z.string().nullable().optional(),
  metric_value: z.string().nullable().optional(),
  severity: z.enum(['info', 'warn', 'opportunity']),
});

const InsightsResponseSchema = z.object({
  insights: z.array(InsightSchema).max(8),
});

const SYSTEM_PROMPT = `Tu es AVA, conseillère stratégique d'un artisan français (DROM).
Tu analyses ses données réelles (factures, devis, dépenses, clients) et tu génères
3 à 5 insights actionnables, courts, et utiles. Pas de blabla générique.

RÈGLES :
1. Insights basés UNIQUEMENT sur les données fournies. Ne JAMAIS inventer un nom, un montant, une date.
2. Chaque insight doit citer un nombre concret (montant en €, jours, %).
3. Voix sobre, vouvoiement, jamais d'emoji.
4. Format : title court (≤ 90 chars), body 1-3 phrases (≤ 300 chars), severity adaptée.
5. severity:
   - 'warn' = alerte (trésorerie tendue, retard récurrent client, marges en baisse)
   - 'opportunity' = action positive à prendre (relance facile, devis à transformer, client à upseller)
   - 'info' = simple constat utile
6. metric_label + metric_value : la stat clé en deux mots (ex: "Délai moyen", "32 jours")
7. PRIORITÉ : ce qui aide concrètement à augmenter la trésorerie ou réduire les risques.
8. Pas plus de 5 insights par run. Si rien d'intéressant à dire, retourne fewer.

KINDS reconnus :
- cashflow : prévisions trésorerie, alertes de découvert
- client_behavior : pattern de paiement par client (M. X paie à 35j en moyenne)
- seasonality : tendance temporelle (vendredi top jour, juin -20% vs mai)
- growth : variation revenus mois/mois
- overdue_pattern : récurrence de retards
- tariff_drift : variation de tarif moyen, prestation rentable/non-rentable
- quote_conversion : taux d'acceptation devis
- expense_ratio : poste de dépense croissant
- custom : autre chose pertinent

FORMAT DE RÉPONSE OBLIGATOIRE — JSON pur, zéro texte avant/après :
{"insights":[{"kind":"...","title":"...","body":"...","metric_label":"...","metric_value":"...","severity":"..."}]}`;

interface SnapshotInvoice {
  amount_ttc: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  client_name: string | null;
}

interface SnapshotQuote {
  amount_ttc: number;
  status: string;
  issue_date: string;
}

interface SnapshotExpense {
  amount_ttc: number;
  category: string;
  expense_date: string;
}

interface UserSnapshot {
  invoices: SnapshotInvoice[];
  quotes: SnapshotQuote[];
  expenses: SnapshotExpense[];
  generated_at: string;
}

/**
 * Build a compact data snapshot for Claude. Last 90 days only — keeps prompt small
 * and focuses on actionable horizon. Strips PII to noms only.
 */
export async function buildSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSnapshot> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceIso = since.toISOString().slice(0, 10);

  const [invRes, quoteRes, expRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount_ttc, status, issue_date, due_date, clients(name)')
      .eq('user_id', userId)
      .gte('issue_date', sinceIso)
      .order('issue_date', { ascending: true }),
    supabase
      .from('quotes')
      .select('amount_ttc, status, issue_date')
      .eq('user_id', userId)
      .gte('issue_date', sinceIso)
      .order('issue_date', { ascending: true }),
    supabase
      .from('expenses')
      .select('amount_ttc, category, expense_date')
      .eq('user_id', userId)
      .gte('expense_date', sinceIso)
      .order('expense_date', { ascending: true }),
  ]);

  function pickName(c: unknown): string | null {
    if (!c) return null;
    if (Array.isArray(c)) return (c[0] as { name?: string } | undefined)?.name ?? null;
    return (c as { name?: string }).name ?? null;
  }

  const invoices: SnapshotInvoice[] = (invRes.data ?? []).map((i) => ({
    amount_ttc: Number(i.amount_ttc),
    status: i.status,
    issue_date: i.issue_date,
    due_date: i.due_date,
    client_name: pickName((i as { clients?: unknown }).clients),
  }));
  const quotes: SnapshotQuote[] = (quoteRes.data ?? []).map((q) => ({
    amount_ttc: Number(q.amount_ttc),
    status: q.status,
    issue_date: q.issue_date,
  }));
  const expenses: SnapshotExpense[] = (expRes.data ?? []).map((e) => ({
    amount_ttc: Number(e.amount_ttc),
    category: e.category,
    expense_date: e.expense_date,
  }));

  return {
    invoices,
    quotes,
    expenses,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Pre-aggregate snapshot stats so Claude has digestible context, not raw rows.
 */
export function summarizeSnapshot(snap: UserSnapshot): string {
  const lines: string[] = [];
  lines.push(`Période analysée : 90 derniers jours, généré ${snap.generated_at.slice(0, 10)}.`);

  // Invoices summary
  const paid = snap.invoices.filter((i) => i.status === 'payée');
  const paidTotal = paid.reduce((s, i) => s + i.amount_ttc, 0);
  const unpaid = snap.invoices.filter((i) => i.status === 'envoyée' || i.status === 'en_retard');
  const unpaidTotal = unpaid.reduce((s, i) => s + i.amount_ttc, 0);
  const overdue = snap.invoices.filter((i) => i.status === 'en_retard');
  lines.push(`Factures : ${snap.invoices.length} émises, ${paid.length} payées (${paidTotal.toFixed(2)} €), ${unpaid.length} en attente (${unpaidTotal.toFixed(2)} €), ${overdue.length} en retard.`);

  // Per-client behavior
  const byClient = new Map<string, { total: number; count: number; paid: number; overdue: number; daysToPay: number[] }>();
  for (const i of snap.invoices) {
    const key = i.client_name ?? '(sans client)';
    let stat = byClient.get(key);
    if (!stat) {
      stat = { total: 0, count: 0, paid: 0, overdue: 0, daysToPay: [] };
      byClient.set(key, stat);
    }
    stat.total += i.amount_ttc;
    stat.count += 1;
    if (i.status === 'payée') stat.paid += 1;
    if (i.status === 'en_retard') stat.overdue += 1;
    // crude delay estimate: if due_date past + status not paid → in retard X days
    if (i.status === 'en_retard' && i.due_date) {
      const due = new Date(i.due_date);
      const days = Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) stat.daysToPay.push(days);
    }
  }
  const sortedClients = Array.from(byClient.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);
  if (sortedClients.length > 0) {
    lines.push(`Top clients par CA :`);
    for (const [name, s] of sortedClients) {
      const avgDelay = s.daysToPay.length > 0
        ? Math.round(s.daysToPay.reduce((a, b) => a + b, 0) / s.daysToPay.length)
        : null;
      lines.push(`  - ${name} : ${s.total.toFixed(0)} € sur ${s.count} factures (${s.paid} payées, ${s.overdue} en retard${avgDelay !== null ? `, retard moyen ${avgDelay}j` : ''})`);
    }
  }

  // Quotes
  const acceptedQ = snap.quotes.filter((q) => q.status === 'accepté');
  const refusedQ = snap.quotes.filter((q) => q.status === 'refusé');
  const expiredQ = snap.quotes.filter((q) => q.status === 'expiré');
  lines.push(`Devis : ${snap.quotes.length} émis, ${acceptedQ.length} acceptés (${acceptedQ.reduce((s, q) => s + q.amount_ttc, 0).toFixed(2)} €), ${refusedQ.length} refusés, ${expiredQ.length} expirés.`);

  // Expenses by category
  const byCat = new Map<string, number>();
  for (const e of snap.expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount_ttc);
  const sortedCat = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
  const totalExp = snap.expenses.reduce((s, e) => s + e.amount_ttc, 0);
  lines.push(`Dépenses : ${snap.expenses.length} entrées, total ${totalExp.toFixed(2)} €`);
  if (sortedCat.length > 0) {
    lines.push(`Top catégories :`);
    for (const [cat, amt] of sortedCat.slice(0, 5)) {
      lines.push(`  - ${cat} : ${amt.toFixed(2)} €`);
    }
  }

  // Net
  lines.push(`Bilan période : recettes ${paidTotal.toFixed(2)} €, dépenses ${totalExp.toFixed(2)} €, net ${(paidTotal - totalExp).toFixed(2)} €`);

  // Day-of-week distribution for invoices.
  // ISO YYYY-MM-DD parses as UTC; we want the actual day of issue regardless
  // of the user's timezone (artisan-relative dates), so split + parseInt manually.
  const dow = [0, 0, 0, 0, 0, 0, 0];
  for (const i of snap.invoices) {
    const [y, m, d] = i.issue_date.split('-').map((s) => parseInt(s, 10));
    if (!y || !m || !d) continue;
    // Use UTC constructor so the day matches the date string exactly
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    dow[day] += 1;
  }
  const dowNames = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const dowSummary = dow.map((c, i) => `${dowNames[i]} ${c}`).join(', ');
  lines.push(`Répartition factures par jour de semaine : ${dowSummary}.`);

  return lines.join('\n');
}

/**
 * Send the snapshot summary to Claude and parse N insights back.
 * Returns empty array on any failure (insights are best-effort).
 */
export async function generateInsights(snap: UserSnapshot): Promise<Insight[]> {
  // Skip if no data to analyze
  if (snap.invoices.length === 0 && snap.quotes.length === 0 && snap.expenses.length === 0) {
    return [];
  }

  const summary = summarizeSnapshot(snap);
  const userMsg = `Données réelles à analyser :\n\n${summary}\n\nGénère 3 à 5 insights stratégiques au format JSON spécifié.`;

  let resp;
  try {
    // 25s timeout — long enough for thinking, short enough to not stall the cron
    resp = await anthropic.messages.create(
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      },
      { timeout: 25_000 },
    );
  } catch (err) {
    console.warn('[insights] Claude error:', err);
    return [];
  }

  const block = resp.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return [];
  const raw = block.text.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(raw);
    const validated = InsightsResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn('[insights] zod validation failed:', validated.error);
      return [];
    }
    return validated.data.insights;
  } catch (err) {
    console.warn('[insights] JSON parse failed:', raw.slice(0, 200));
    return [];
  }
}

/**
 * Generate insights for a user and persist them. Caller is responsible for
 * dedup logic (e.g. cron checks if a recent run already exists).
 */
export async function generateAndPersistInsights(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ generated: number; skipped_reason?: string }> {
  const snap = await buildSnapshot(supabase, userId);
  if (snap.invoices.length < 3) {
    return { generated: 0, skipped_reason: 'too_few_invoices' };
  }
  const insights = await generateInsights(snap);
  if (insights.length === 0) return { generated: 0, skipped_reason: 'claude_returned_none' };

  const now = new Date();
  const period = `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`;

  const rows = insights.map((i) => ({
    user_id: userId,
    kind: i.kind,
    title: i.title,
    body: i.body,
    metric_label: i.metric_label ?? null,
    metric_value: i.metric_value ?? null,
    severity: i.severity,
    generated_for_period: period,
  }));

  const { error } = await supabase.from('insights').insert(rows);
  if (error) {
    console.error('[insights] insert error:', error);
    return { generated: 0, skipped_reason: 'db_insert_failed' };
  }
  return { generated: insights.length };
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
