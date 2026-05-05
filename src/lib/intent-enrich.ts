/**
 * Intent enrichment: after Claude extracts the intent, server-side queries
 * supplement the entities so the confirm screen can render rich UI without
 * extra round-trips.
 *
 * - mark_paid → finds candidate unpaid invoices for the named client
 * - get_financial_status → aggregates totals
 * - send_reminder → finds unpaid/overdue invoices + drafts polite email body
 * - get_invoice_list → resolves the filter
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatPriceFR, formatDateFR } from './format';
import type { IntentEntities, IntentResult } from './types';

export type EnrichedEntities = IntentEntities & {
  candidate_invoice_id?: string;
  candidate_invoice_number?: string;
  candidate_invoice_amount?: number;
  candidate_client_name?: string;
  candidate_client_email?: string;
  payment_link?: {
    invoice_id: string;
    invoice_number: string | null;
    amount_ttc: number;
    public_url: string;
    mailto: string;
    subject: string;
    body: string;
    to: string;
  };
  summary?: {
    unpaid_total: number;
    unpaid_count: number;
    overdue_total: number;
    overdue_count: number;
    paid_this_month_total: number;
    paid_this_month_count: number;
    pending_quotes_count: number;
  };
  reminder_subject?: string;
  reminder_body?: string;
  reminder_to?: string;
  candidate_invoices?: Array<{ number: string | null; amount_ttc: number; due_date: string | null }>;
  list_filter?: string;
  search_results?: Array<{
    id: string;
    kind: 'facture' | 'devis';
    number: string | null;
    client_name: string | null;
    amount_ttc: number;
    issue_date: string;
    status: string;
  }>;
  appointment?: {
    title: string;
    starts_at: string;
    ends_at: string | null;
    location: string | null;
    client_id: string | null;
    client_name: string | null;
    duration_min?: number;
  };
  expense?: {
    label: string;
    vendor: string | null;
    amount_ttc: number;
    category: string;
    expense_date: string;
  };
};

interface EnrichResult {
  entities: EnrichedEntities;
  ava_response: string;
}

interface CandidateInvoice {
  id: string;
  number: string | null;
  amount_ttc: number;
  due_date: string | null;
  issue_date: string;
  status: string;
}

interface CandidateClient {
  id: string;
  name: string;
  email: string | null;
}

async function findClientByName(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<CandidateClient | null> {
  const trimmed = name.trim();
  // Try exact then fuzzy
  const { data: exact } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle();
  if (exact) return exact as CandidateClient;

  const { data: fuzzy } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('user_id', userId)
    .ilike('name', `%${trimmed}%`)
    .limit(5);
  if (fuzzy && fuzzy.length > 0) {
    return (fuzzy.sort((a, b) => a.name.length - b.name.length)[0]) as CandidateClient;
  }

  // Reverse substring: client name in DB might be a substring of dictation
  const { data: rev } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('user_id', userId);
  if (rev) {
    const matched = rev.find((c) =>
      c.name && trimmed.toLowerCase().includes(c.name.toLowerCase()),
    );
    if (matched) return matched as CandidateClient;
  }
  return null;
}

export async function enrichForMarkPaid(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };
  if (!entities.client_name) {
    return {
      entities,
      ava_response: "Quel client a payé ? Précisez son nom.",
    };
  }
  const client = await findClientByName(supabase, userId, entities.client_name);
  if (!client) {
    return {
      entities,
      ava_response: `Je ne trouve pas de client correspondant à « ${entities.client_name} ». Précisez ou créez la fiche client d'abord.`,
    };
  }
  // Find the most recent unpaid invoice for this client
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, number, amount_ttc, due_date, issue_date, status')
    .eq('user_id', userId)
    .eq('client_id', client.id)
    .in('status', ['envoyée', 'en_retard', 'brouillon'])
    .order('created_at', { ascending: false })
    .limit(1);
  const candidate = invoices?.[0] as CandidateInvoice | undefined;
  if (!candidate) {
    return {
      entities: { ...entities, candidate_client_name: client.name },
      ava_response: `${client.name} n'a pas de facture en attente. Voulez-vous en créer une ?`,
    };
  }
  entities.candidate_invoice_id = candidate.id;
  entities.candidate_invoice_number = candidate.number ?? '(brouillon)';
  entities.candidate_invoice_amount = Number(candidate.amount_ttc);
  entities.candidate_client_name = client.name;
  return {
    entities,
    ava_response: `${client.name} a payé la facture ${candidate.number ?? 'brouillon'} de ${formatPriceFR(Number(candidate.amount_ttc))} ?`,
  };
}

export async function enrichForFinancialStatus(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };

  const { data: invoices } = await supabase
    .from('invoices')
    .select('amount_ttc, status, created_at')
    .eq('user_id', userId);

  let unpaidTotal = 0;
  let unpaidCount = 0;
  let overdueTotal = 0;
  let overdueCount = 0;
  let paidMonthTotal = 0;
  let paidMonthCount = 0;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const inv of invoices ?? []) {
    const ttc = Number(inv.amount_ttc);
    if (inv.status === 'envoyée' || inv.status === 'en_retard') {
      unpaidTotal += ttc;
      unpaidCount += 1;
    }
    if (inv.status === 'en_retard') {
      overdueTotal += ttc;
      overdueCount += 1;
    }
    if (inv.status === 'payée' && new Date(inv.created_at) >= monthStart) {
      paidMonthTotal += ttc;
      paidMonthCount += 1;
    }
  }

  const { count: pendingQuotes } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['envoyé', 'brouillon']);

  entities.summary = {
    unpaid_total: unpaidTotal,
    unpaid_count: unpaidCount,
    overdue_total: overdueTotal,
    overdue_count: overdueCount,
    paid_this_month_total: paidMonthTotal,
    paid_this_month_count: paidMonthCount,
    pending_quotes_count: pendingQuotes ?? 0,
  };

  const parts: string[] = [];
  if (unpaidTotal > 0) {
    parts.push(`${formatPriceFR(unpaidTotal)} à encaisser sur ${unpaidCount} facture${unpaidCount > 1 ? 's' : ''}`);
  } else {
    parts.push('Aucune facture en attente de paiement');
  }
  if (overdueTotal > 0) {
    parts.push(`dont ${formatPriceFR(overdueTotal)} en retard sur ${overdueCount} facture${overdueCount > 1 ? 's' : ''}`);
  }
  if (paidMonthTotal > 0) {
    parts.push(`${formatPriceFR(paidMonthTotal)} encaissés ce mois`);
  }
  if ((pendingQuotes ?? 0) > 0) {
    parts.push(`${pendingQuotes} devis en attente de réponse`);
  }
  const ava_response = parts.join('. ') + '.';
  return { entities, ava_response };
}

export async function enrichForSendReminder(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };

  if (!entities.client_name) {
    // No specific client — find all overdue, draft a generic listing
    const { data: overdue } = await supabase
      .from('invoices')
      .select('number, amount_ttc, due_date, clients(name, email)')
      .eq('user_id', userId)
      .eq('status', 'en_retard')
      .order('due_date', { ascending: true })
      .limit(20);
    if (!overdue || overdue.length === 0) {
      return {
        entities,
        ava_response: "Aucune facture en retard. Voulez-vous lister les factures non payées plutôt ?",
      };
    }
    return {
      entities,
      ava_response: `${overdue.length} facture${overdue.length > 1 ? 's' : ''} en retard. Précisez quel client relancer en priorité (ex: "relance M. Payet").`,
    };
  }

  const client = await findClientByName(supabase, userId, entities.client_name);
  if (!client) {
    return {
      entities,
      ava_response: `Je ne trouve pas « ${entities.client_name} » dans vos clients.`,
    };
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('number, amount_ttc, due_date, issue_date, status')
    .eq('user_id', userId)
    .eq('client_id', client.id)
    .in('status', ['envoyée', 'en_retard'])
    .order('due_date', { ascending: true });

  const candidates = (invoices ?? []) as CandidateInvoice[];
  if (candidates.length === 0) {
    return {
      entities: { ...entities, candidate_client_name: client.name },
      ava_response: `${client.name} n'a aucune facture en attente. Rien à relancer.`,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', userId)
    .maybeSingle();
  const sender = profile?.company_name || profile?.full_name || 'votre prestataire';

  const today = new Date();
  const today_iso = formatDateFR(today);
  const total = candidates.reduce((s, c) => s + Number(c.amount_ttc), 0);

  const detailLines = candidates
    .map((c) => `- Facture ${c.number ?? 'brouillon'} : ${formatPriceFR(Number(c.amount_ttc))}${c.due_date ? ` (échue le ${formatDateFR(c.due_date)})` : ''}`)
    .join('\n');

  const subject = `Relance amicale — facture${candidates.length > 1 ? 's' : ''} en attente`;
  const body = [
    `Bonjour ${client.name},`,
    '',
    `J'espère que vous allez bien. Je me permets de revenir vers vous concernant ${candidates.length > 1 ? 'les factures suivantes restant' : 'la facture suivante restant'} en attente de règlement :`,
    '',
    detailLines,
    '',
    `Total dû : ${formatPriceFR(total)}.`,
    '',
    'Pourriez-vous m\'indiquer la date de paiement prévue ? Si le règlement a déjà été effectué, merci de m\'en faire part pour mise à jour de mes registres.',
    '',
    'Bien cordialement,',
    sender,
    '',
    '—',
    `Envoyé via AVA le ${today_iso}`,
  ].join('\n');

  entities.reminder_subject = subject;
  entities.reminder_body = body;
  entities.reminder_to = client.email ?? '';
  entities.candidate_client_name = client.name;
  entities.candidate_invoices = candidates.map((c) => ({
    number: c.number,
    amount_ttc: Number(c.amount_ttc),
    due_date: c.due_date,
  }));

  const ava_text = client.email
    ? `Relance prête pour ${client.name} (${formatPriceFR(total)} sur ${candidates.length} facture${candidates.length > 1 ? 's' : ''}). Vérifiez le message et envoyez.`
    : `Relance préparée pour ${client.name}, mais l'email du client manque. Ajoutez-le dans la fiche client puis renvoyez.`;
  return { entities, ava_response: ava_text };
}

/**
 * Parse French natural-language date references into a Date.
 * Returns null if nothing recognized.
 */
function parseFrenchDate(input: string, baseDate: Date = new Date()): Date | null {
  const t = input.toLowerCase().trim();
  if (!t) return null;

  // Try ISO date first (YYYY-MM-DD or full ISO)
  const iso = new Date(input);
  if (!isNaN(iso.getTime()) && /\d{4}-\d{2}-\d{2}/.test(input)) {
    return iso;
  }

  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);
  const result = new Date(today);

  // "aujourd'hui"
  if (/\b(aujourd['']?hui|ce\s+matin|cet\s+après-midi|ce\s+soir)\b/.test(t)) {
    return result;
  }
  // "demain"
  if (/\bdemain\b/.test(t)) {
    result.setDate(result.getDate() + 1);
    return result;
  }
  // "après-demain"
  if (/\bapr[èe]s[\s-]?demain\b/.test(t)) {
    result.setDate(result.getDate() + 2);
    return result;
  }

  // "lundi", "mardi"... (next occurrence — within 7 days)
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  for (let i = 0; i < 7; i++) {
    const day = DAYS[i];
    const dayRegex = new RegExp(`\\b${day}\\b`);
    if (dayRegex.test(t)) {
      const currentDay = today.getDay();
      let delta = i - currentDay;
      if (delta <= 0) delta += 7;
      // "lundi prochain" still means next occurrence; "lundi en huit" means +14 (skip for now)
      if (/\ben\s+huit\b/.test(t)) delta += 7;
      result.setDate(result.getDate() + delta);
      return result;
    }
  }

  // "dans N jours"
  const daysFromNow = t.match(/dans\s+(\d+)\s+jour/);
  if (daysFromNow) {
    const n = parseInt(daysFromNow[1], 10);
    if (!isNaN(n)) {
      result.setDate(result.getDate() + n);
      return result;
    }
  }

  // "dans une semaine"
  if (/\bdans\s+une\s+semaine\b/.test(t)) {
    result.setDate(result.getDate() + 7);
    return result;
  }

  return null;
}

/**
 * create_expense_note: parse vendor + amount + category from the dictation.
 * "J'ai acheté du matériel chez Point P pour 340 €" →
 *   { vendor: 'Point P', amount: 340, category: 'matériel', label: 'matériel' }
 */
export async function enrichForExpense(
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };
  const e = result.entities;

  // Try to read amount from amount_total or first line_item unit_price
  let amount = e.amount_total ?? null;
  if (!amount && Array.isArray(e.line_items) && e.line_items[0]?.unit_price) {
    amount = e.line_items[0].unit_price;
  }
  // Fallback: regex through notes
  if (!amount && e.notes) {
    const m = e.notes.match(/(\d+(?:[.,]\d+)?)\s*€?/);
    if (m) amount = parseFloat(m[1].replace(',', '.'));
  }

  // Vendor: client_name field (Claude likely puts it there) or notes "chez X"
  let vendor: string | null = e.client_name;
  if (!vendor && e.notes) {
    const v = e.notes.match(/chez\s+([A-Z][\w\s.\-&]{1,40})/);
    if (v) vendor = v[1].trim();
  }

  // Category from line_item label or notes keywords
  const txt = `${(e.line_items?.[0]?.label ?? '')} ${e.notes ?? ''}`.toLowerCase();
  let category = 'autre';
  if (/mat[ée]riel|fourniture|consommable|piece/.test(txt)) category = 'matériel';
  else if (/d[ée]placement|essence|carburant|p[ée]age|train|avion|taxi|uber/.test(txt)) category = 'déplacement';
  else if (/sous[\s-]traitance|prestataire/.test(txt)) category = 'sous-traitance';
  else if (/repas|restaurant|d[ée]jeuner|d[ée]ner/.test(txt)) category = 'restauration';
  else if (/t[ée]l[ée]phone|abonnement\s+t[ée]l|forfait\s+mobile/.test(txt)) category = 'téléphonie';
  else if (/outil|outillage|machine/.test(txt)) category = 'outillage';
  else if (/formation|stage|s[ée]minaire/.test(txt)) category = 'formation';

  const label = e.line_items?.[0]?.label?.trim() || category.charAt(0).toUpperCase() + category.slice(1);

  // Date
  const today = new Date();
  let expenseDate = today.toISOString().slice(0, 10);
  const parsed = parseFrenchDate(e.notes ?? '') ?? parseFrenchDate(e.date ?? '');
  if (parsed) expenseDate = parsed.toISOString().slice(0, 10);

  if (!amount) {
    return {
      entities,
      ava_response: 'Quel montant pour cette dépense ?',
    };
  }

  entities.expense = {
    label,
    vendor,
    amount_ttc: amount,
    category,
    expense_date: expenseDate,
  };

  const ava_response = vendor
    ? `Dépense ${formatPriceFR(amount)} chez ${vendor} (${category}) ?`
    : `Dépense ${formatPriceFR(amount)} en ${category} ?`;

  return { entities, ava_response };
}

/**
 * schedule_appointment: parse date/time + client from the dictation.
 * Claude returns entities.date (target date), entities.notes (location/title hints).
 * We try to derive a starts_at ISO timestamp with reasonable fallbacks.
 */
export async function enrichForScheduleAppointment(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };
  const e = result.entities;

  // Parse date from entities.date (Claude may return ISO YYYY-MM-DD) OR
  // from notes text using French natural language parser
  let startsAt: Date | null = null;
  if (e.date) {
    startsAt = parseFrenchDate(e.date);
  }
  if (!startsAt && e.notes) {
    startsAt = parseFrenchDate(e.notes);
  }

  // Hour parsing: "14h", "14:00", "14h30", "8 heures"
  const notesText = e.notes ?? '';
  const dateText = e.date ?? '';
  const combinedText = `${dateText} ${notesText}`;
  const hourMatch =
    combinedText.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/) ??
    combinedText.match(/(\d{1,2})\s*heures?(?:\s+(?:et\s+)?(\d{1,2}))?/i);
  if (startsAt && hourMatch) {
    const h = parseInt(hourMatch[1], 10);
    const m = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
    if (h >= 0 && h < 24) {
      startsAt.setHours(h, m, 0, 0);
    }
  }

  // If still no date, default to next day at 9h
  if (!startsAt) {
    startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + 1);
    startsAt.setHours(9, 0, 0, 0);
  } else if (startsAt.getHours() === 0 && startsAt.getMinutes() === 0) {
    // No specific time given → default to 9h
    startsAt.setHours(9, 0, 0, 0);
  }

  // Try to match client
  let clientId: string | null = null;
  let clientName: string | null = e.client_name;
  if (e.client_name) {
    const c = await findClientByName(supabase, userId, e.client_name);
    if (c) {
      clientId = c.id;
      clientName = c.name;
    }
  }

  const title = clientName ? `RDV ${clientName}` : 'Rendez-vous';
  const location = notesText.match(/(?:chez|à|au)\s+([^,.]{3,60})/i)?.[1]?.trim() ?? null;

  entities.appointment = {
    title,
    starts_at: startsAt.toISOString(),
    ends_at: null,
    location,
    client_id: clientId,
    client_name: clientName,
  };

  const dateStr = startsAt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = startsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const ava_response = clientName
    ? `RDV avec ${clientName} ${dateStr} à ${timeStr}${location ? ` (${location})` : ''} ?`
    : `RDV ${dateStr} à ${timeStr} ?`;

  return { entities, ava_response };
}

export async function enrichForSendDocument(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };
  if (!entities.client_name) {
    return {
      entities,
      ava_response: "Quel client doit recevoir le document ? Précisez son nom.",
    };
  }
  const client = await findClientByName(supabase, userId, entities.client_name);
  if (!client) {
    return {
      entities,
      ava_response: `Je ne trouve pas « ${entities.client_name} ».`,
    };
  }

  // Find the most recent finalized invoice or quote for this client
  const [{ data: invs }, { data: qs }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, number, amount_ttc, issue_date, status')
      .eq('user_id', userId)
      .eq('client_id', client.id)
      .order('issue_date', { ascending: false })
      .limit(1),
    supabase
      .from('quotes')
      .select('id, number, amount_ttc, issue_date, status')
      .eq('user_id', userId)
      .eq('client_id', client.id)
      .order('issue_date', { ascending: false })
      .limit(1),
  ]);

  const inv = invs?.[0];
  const q = qs?.[0];
  // Prefer most recent issue_date
  const candidate = inv && q
    ? (inv.issue_date >= q.issue_date ? { ...inv, kind: 'facture' as const } : { ...q, kind: 'devis' as const })
    : inv
      ? { ...inv, kind: 'facture' as const }
      : q
        ? { ...q, kind: 'devis' as const }
        : null;

  if (!candidate) {
    return {
      entities: { ...entities, candidate_client_name: client.name },
      ava_response: `${client.name} n'a aucun document à envoyer. Créez d'abord une facture ou un devis.`,
    };
  }

  entities.candidate_client_name = client.name;
  entities.candidate_client_email = client.email ?? undefined;
  entities.search_results = [{
    id: candidate.id,
    kind: candidate.kind,
    number: candidate.number,
    client_name: client.name,
    amount_ttc: Number(candidate.amount_ttc),
    issue_date: candidate.issue_date,
    status: candidate.status,
  }];

  const docLabel = candidate.kind === 'facture' ? 'facture' : 'devis';
  const ava_response = client.email
    ? `J'envoie la ${docLabel} ${candidate.number ?? '(brouillon)'} à ${client.name} (${client.email}) ?`
    : `${docLabel} ${candidate.number ?? '(brouillon)'} prête, mais ${client.name} n'a pas d'email — ajoutez-en un dans la fiche client.`;

  return { entities, ava_response };
}

export async function enrichForFindDocument(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };
  const queryParts: string[] = [];

  // Build query: client_name + month/period from raw text
  let clientId: string | null = null;
  if (entities.client_name) {
    const c = await findClientByName(supabase, userId, entities.client_name);
    if (c) {
      clientId = c.id;
      queryParts.push(c.name);
    }
  }

  // Search both invoices and quotes
  let invoicesQ = supabase
    .from('invoices')
    .select('id, number, amount_ttc, issue_date, status, clients(name)')
    .eq('user_id', userId)
    .order('issue_date', { ascending: false })
    .limit(10);
  let quotesQ = supabase
    .from('quotes')
    .select('id, number, amount_ttc, issue_date, status, clients(name)')
    .eq('user_id', userId)
    .order('issue_date', { ascending: false })
    .limit(10);

  if (clientId) {
    invoicesQ = invoicesQ.eq('client_id', clientId);
    quotesQ = quotesQ.eq('client_id', clientId);
  }

  const [{ data: invs }, { data: qs }] = await Promise.all([invoicesQ, quotesQ]);

  type WithClient = { id: string; number: string | null; amount_ttc: number; issue_date: string; status: string; clients: { name: string } | { name: string }[] | null };
  const pickName = (c: WithClient['clients']): string | null => {
    if (!c) return null;
    if (Array.isArray(c)) return c[0]?.name ?? null;
    return c.name ?? null;
  };

  const results: NonNullable<EnrichedEntities['search_results']> = [];
  for (const i of (invs ?? []) as WithClient[]) {
    results.push({
      id: i.id,
      kind: 'facture',
      number: i.number,
      client_name: pickName(i.clients),
      amount_ttc: Number(i.amount_ttc),
      issue_date: i.issue_date,
      status: i.status,
    });
  }
  for (const q of (qs ?? []) as WithClient[]) {
    results.push({
      id: q.id,
      kind: 'devis',
      number: q.number,
      client_name: pickName(q.clients),
      amount_ttc: Number(q.amount_ttc),
      issue_date: q.issue_date,
      status: q.status,
    });
  }
  results.sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  entities.search_results = results.slice(0, 12);

  let ava_response = '';
  if (results.length === 0) {
    ava_response = queryParts.length > 0
      ? `Aucun document trouvé pour ${queryParts.join(', ')}.`
      : "Aucun document à montrer pour cette recherche.";
  } else {
    const filterDesc = queryParts.length > 0 ? ` pour ${queryParts.join(', ')}` : '';
    ava_response = `${results.length} document${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}${filterDesc}.`;
  }

  return { entities, ava_response };
}

export async function enrichForInvoiceList(
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };
  // Detect intent of filter from notes/raw
  const text = (result.ava_response + ' ' + (result.entities.notes ?? '')).toLowerCase();
  let filter: string = 'all';
  let label = 'toutes vos factures';
  if (/impay|en attente|non pay|en retard/.test(text)) {
    filter = 'unpaid';
    label = 'vos factures impayées';
  } else if (/payée|paye|encaiss/.test(text)) {
    filter = 'paid';
    label = 'vos factures payées';
  } else if (/brouillon/.test(text)) {
    filter = 'draft';
    label = 'vos brouillons de factures';
  }
  entities.list_filter = filter;
  return {
    entities,
    ava_response: `J'ouvre ${label}.`,
  };
}

/**
 * Send-payment-link enrichment: finds the most recent unpaid invoice for the
 * named client and drafts a mailto with the public invoice URL framed as a
 * one-click payment link. The artisan reviews the draft, then taps "Ouvrir
 * l'email" — their mail client takes over.
 *
 * V13.1+ will swap public_url for a real Stripe payment link once Stripe Connect
 * is wired (CdC §3.5 V2). For now the public /voir/facture/[id] URL doubles as
 * a "voir + payer plus tard" landing — the client at least sees the amount, the
 * IBAN, and the conditions de règlement.
 */
export async function enrichForPaymentLink(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };

  if (!entities.client_name) {
    return {
      entities,
      ava_response: "Précisez à quel client envoyer le lien (ex: \"envoie le lien de paiement à M. Payet\").",
    };
  }

  const client = await findClientByName(supabase, userId, entities.client_name);
  if (!client) {
    return {
      entities,
      ava_response: `Je ne trouve pas « ${entities.client_name} » dans vos clients.`,
    };
  }

  // Most recent unpaid invoice (sent or overdue) for this client
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, number, amount_ttc, due_date, issue_date, status')
    .eq('user_id', userId)
    .eq('client_id', client.id)
    .in('status', ['envoyée', 'en_retard'])
    .order('issue_date', { ascending: false })
    .limit(1);

  const inv = (invoices ?? [])[0] as CandidateInvoice | undefined;
  if (!inv) {
    return {
      entities: { ...entities, candidate_client_name: client.name },
      ava_response: `${client.name} n'a aucune facture en attente. Rien à envoyer.`,
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name, payment_link_url, payment_link_provider')
    .eq('id', userId)
    .maybeSingle();
  const sender = profile?.company_name || profile?.full_name || 'votre prestataire';
  const stripeLikeUrl = profile?.payment_link_url ?? null;
  const stripeLikeProvider = profile?.payment_link_provider ?? null;

  // Public URL — read from env at request time (Vercel sets NEXT_PUBLIC_SITE_URL)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ava-lou.vercel.app';
  const { buildPublicUrl } = await import('./public-url');
  const publicUrl = buildPublicUrl(baseUrl, 'facture', inv.id);

  const subject = `Lien de paiement — facture ${inv.number ?? ''}`.trim();
  const bodyLines = [
    `Bonjour ${client.name},`,
    '',
    `Pour vous simplifier le règlement de la facture ${inv.number ?? ''} d'un montant de ${formatPriceFR(Number(inv.amount_ttc))}, voici les options :`,
    '',
  ];

  if (stripeLikeUrl) {
    bodyLines.push(`💳 Régler par carte (${stripeLikeProvider || 'paiement en ligne'}) :`);
    bodyLines.push(stripeLikeUrl);
    bodyLines.push('');
    bodyLines.push(`📄 Voir la facture en ligne (avec IBAN si vous préférez le virement) :`);
    bodyLines.push(publicUrl);
  } else {
    bodyLines.push('Voici le lien direct vers la facture (IBAN inclus pour virement) :');
    bodyLines.push(publicUrl);
  }

  bodyLines.push('');
  if (inv.due_date) bodyLines.push(`Échéance : ${formatDateFR(inv.due_date)}.`);
  bodyLines.push('');
  bodyLines.push('Pour toute question, n\'hésitez pas à me répondre directement à cet email.');
  bodyLines.push('');
  bodyLines.push('Bien cordialement,');
  bodyLines.push(sender);
  bodyLines.push('');
  bodyLines.push('—');
  bodyLines.push(`Envoyé via AVA le ${formatDateFR(new Date())}`);

  const body = bodyLines.filter(Boolean).join('\n');

  const to = client.email ?? '';
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  entities.payment_link = {
    invoice_id: inv.id,
    invoice_number: inv.number ?? null,
    amount_ttc: Number(inv.amount_ttc),
    public_url: publicUrl,
    mailto,
    subject,
    body,
    to,
  };
  entities.candidate_client_name = client.name;
  entities.candidate_client_email = client.email ?? undefined;
  entities.candidate_invoice_id = inv.id;
  entities.candidate_invoice_number = inv.number ?? undefined;
  entities.candidate_invoice_amount = Number(inv.amount_ttc);

  const ava_text = client.email
    ? `Lien de paiement prêt pour ${client.name} (facture ${inv.number ?? ''} — ${formatPriceFR(Number(inv.amount_ttc))}). Vérifiez puis envoyez.`
    : `Lien de paiement préparé pour ${client.name} (facture ${inv.number ?? ''} — ${formatPriceFR(Number(inv.amount_ttc))}), mais l'email du client manque. Ajoutez-le dans la fiche client.`;

  return { entities, ava_response: ava_text };
}

/**
 * Weekly summary — "Résume ma semaine" / "Bilan de la semaine".
 * Computes the last 7 days of activity into a natural-language sentence
 * AVA can read aloud via TTS.
 */
export async function enrichForWeeklySummary(
  supabase: SupabaseClient,
  userId: string,
  result: IntentResult,
): Promise<EnrichResult> {
  const entities: EnrichedEntities = { ...result.entities };

  const today = new Date();
  const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  const [{ data: paidInv }, { data: emittedInv }, { data: expenses }, { data: quotes }, { data: appointments }] = await Promise.all([
    supabase.from('invoices').select('amount_ttc').eq('user_id', userId).eq('status', 'payée').gte('issue_date', weekStartIso).lte('issue_date', todayIso),
    supabase.from('invoices').select('amount_ttc').eq('user_id', userId).gte('issue_date', weekStartIso).lte('issue_date', todayIso),
    supabase.from('expenses').select('amount_ttc').eq('user_id', userId).gte('expense_date', weekStartIso).lte('expense_date', todayIso),
    supabase.from('quotes').select('status').eq('user_id', userId).gte('issue_date', weekStartIso).lte('issue_date', todayIso),
    supabase.from('appointments').select('id').eq('user_id', userId).gte('starts_at', `${weekStartIso}T00:00:00Z`).lte('starts_at', `${todayIso}T23:59:59Z`).neq('status', 'annulé'),
  ]);

  const sumTtc = (rows: Array<{ amount_ttc: number | string }> | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount_ttc), 0);

  const paidTotal = sumTtc(paidInv);
  const paidCount = (paidInv ?? []).length;
  const emittedCount = (emittedInv ?? []).length;
  const expensesTotal = sumTtc(expenses);
  const expensesCount = (expenses ?? []).length;
  const quotesEmitted = (quotes ?? []).length;
  const quotesAccepted = (quotes ?? []).filter((q) => q.status === 'accepté').length;
  const rdvCount = (appointments ?? []).length;

  // Build natural French sentence — short enough that TTS lecture < 12s
  const parts: string[] = [];
  if (paidCount > 0) {
    parts.push(`${formatPriceFR(paidTotal)} encaissé${paidCount > 1 ? 's' : ''} sur ${paidCount} facture${paidCount > 1 ? 's' : ''}`);
  } else {
    parts.push('aucune facture payée');
  }
  if (emittedCount > paidCount) {
    parts.push(`${emittedCount} facture${emittedCount > 1 ? 's' : ''} émise${emittedCount > 1 ? 's' : ''}`);
  }
  if (quotesEmitted > 0) {
    parts.push(`${quotesEmitted} devis envoyé${quotesEmitted > 1 ? 's' : ''}${quotesAccepted > 0 ? ` (${quotesAccepted} accepté${quotesAccepted > 1 ? 's' : ''})` : ''}`);
  }
  if (expensesCount > 0) {
    parts.push(`${formatPriceFR(expensesTotal)} de dépenses sur ${expensesCount} ticket${expensesCount > 1 ? 's' : ''}`);
  }
  if (rdvCount > 0) {
    parts.push(`${rdvCount} rendez-vous`);
  }

  const sentence = parts.length === 0
    ? 'Cette semaine, aucune activité enregistrée. Vous étiez en pause ?'
    : `Cette semaine : ${parts.join(', ')}.`;

  const balance = paidTotal - expensesTotal;
  const balanceLine = balance >= 0
    ? ` Solde net positif : ${formatPriceFR(balance)}.`
    : ` Solde net négatif : ${formatPriceFR(Math.abs(balance))}.`;

  return {
    entities: {
      ...entities,
      summary: {
        unpaid_total: 0,
        unpaid_count: 0,
        overdue_total: 0,
        overdue_count: 0,
        paid_this_month_total: paidTotal,
        paid_this_month_count: paidCount,
        pending_quotes_count: quotesEmitted,
      },
    },
    ava_response: sentence + balanceLine,
  };
}
