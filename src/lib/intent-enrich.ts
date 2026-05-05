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
