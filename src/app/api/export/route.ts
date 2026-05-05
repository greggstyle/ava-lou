import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { LineItem } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Comptable export — CSV with French formatting suitable for direct import
 * into Pennylane, Sellsy, EBP, Quadra, Sage, or your accountant's tooling.
 *
 * Three datasets selectable via ?dataset=:
 *   - invoices  : factures (full client + line items, FR-formatted amounts)
 *   - quotes    : devis
 *   - expenses  : notes de frais
 *
 * Filters:
 *   - from=YYYY-MM-DD  (defaults to start of current year)
 *   - to=YYYY-MM-DD    (defaults to today)
 *
 * Format: CSV with semicolon separator (French Excel default), UTF-8 with BOM
 * (so Excel detects encoding correctly), French amount format (1 234,56),
 * dates DD/MM/YYYY.
 */

const QuerySchema = z.object({
  dataset: z.enum(['invoices', 'quotes', 'expenses']),
  from: z.string().optional(),
  to: z.string().optional(),
});

// CSV escape: wrap in double-quotes if value contains separator, newline, or quote.
// Double existing quotes per RFC 4180.
//
// Defense against formula injection (OWASP CSV injection): when the *first*
// character of a cell is one of `=`, `+`, `-`, `@`, `\t`, `\r`, Excel /
// LibreOffice / Numbers will treat it as a formula. An attacker who controls
// any user-input field (client name, notes, SIRET, etc.) could pop a remote
// link or run a HYPERLINK() in the accountant's spreadsheet. We neutralize by
// prefixing a single quote — invisible to humans, harmless to formula engine.
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'string' ? v : String(v);
  // Formula injection guard — prefix BEFORE the quoting check so the prefix
  // gets quoted along with the rest if needed.
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function fr(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function frDate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
}

function buildCsv(rows: string[][]): string {
  // BOM for Excel UTF-8 detection
  return '﻿' + rows.map((r) => r.map(csvEscape).join(';')).join('\r\n') + '\r\n';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    dataset: url.searchParams.get('dataset'),
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const todayIso = today.toISOString().slice(0, 10);
  const from = parsed.data.from ?? yearStart;
  const to = parsed.data.to ?? todayIso;
  const dataset = parsed.data.dataset;

  let csv: string;
  let filename: string;

  if (dataset === 'invoices') {
    const { data, error } = await supabase
      .from('invoices')
      .select('number, status, issue_date, due_date, vat_rate, amount_ht, amount_vat, amount_ttc, line_items, notes, clients(name, email, siret, vat_intra, address, postal_code, city, is_business)')
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const headers = [
      'Numéro',
      'Date émission',
      'Date échéance',
      'Statut',
      'Client',
      'Email client',
      'SIRET client',
      'TVA intra client',
      'Adresse client',
      'Désignation',
      'Montant HT',
      'Taux TVA',
      'Montant TVA',
      'Montant TTC',
      'Notes',
    ];

    const rows: string[][] = [headers];
    for (const inv of data ?? []) {
      const c = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
      const lines = (inv.line_items ?? []) as LineItem[];
      const designation = lines.length > 0
        ? lines.map((l) => `${l.label} (${l.qty} × ${fr(l.unit_price)} €)`).join(' · ')
        : '';
      const fullAddr = [c?.address, [c?.postal_code, c?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      rows.push([
        inv.number ?? '(brouillon)',
        frDate(inv.issue_date),
        frDate(inv.due_date),
        inv.status,
        (c?.is_business ? c?.name : c?.name) ?? '',
        c?.email ?? '',
        c?.siret ?? '',
        c?.vat_intra ?? '',
        fullAddr,
        designation,
        fr(Number(inv.amount_ht)),
        `${inv.vat_rate}%`,
        fr(Number(inv.amount_vat)),
        fr(Number(inv.amount_ttc)),
        inv.notes ?? '',
      ]);
    }
    csv = buildCsv(rows);
    filename = `factures_${from}_${to}.csv`;
  } else if (dataset === 'quotes') {
    const { data, error } = await supabase
      .from('quotes')
      .select('number, status, issue_date, expiry_date, vat_rate, amount_ht, amount_vat, amount_ttc, line_items, notes, clients(name, email, siret, vat_intra)')
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const headers = [
      'Numéro',
      'Date émission',
      'Date validité',
      'Statut',
      'Client',
      'Email client',
      'SIRET client',
      'TVA intra client',
      'Désignation',
      'Montant HT',
      'Taux TVA',
      'Montant TVA',
      'Montant TTC',
      'Notes',
    ];

    const rows: string[][] = [headers];
    for (const q of data ?? []) {
      const c = Array.isArray(q.clients) ? q.clients[0] : q.clients;
      const lines = (q.line_items ?? []) as LineItem[];
      const designation = lines.length > 0
        ? lines.map((l) => `${l.label} (${l.qty} × ${fr(l.unit_price)} €)`).join(' · ')
        : '';
      rows.push([
        q.number ?? '(brouillon)',
        frDate(q.issue_date),
        frDate(q.expiry_date),
        q.status,
        c?.name ?? '',
        c?.email ?? '',
        c?.siret ?? '',
        c?.vat_intra ?? '',
        designation,
        fr(Number(q.amount_ht)),
        `${q.vat_rate}%`,
        fr(Number(q.amount_vat)),
        fr(Number(q.amount_ttc)),
        q.notes ?? '',
      ]);
    }
    csv = buildCsv(rows);
    filename = `devis_${from}_${to}.csv`;
  } else {
    // expenses
    const { data, error } = await supabase
      .from('expenses')
      .select('expense_date, label, vendor, category, amount_ht, vat_rate, amount_ttc, notes')
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const headers = [
      'Date',
      'Libellé',
      'Fournisseur',
      'Catégorie',
      'Montant HT',
      'Taux TVA',
      'Montant TTC',
      'Notes',
    ];
    const rows: string[][] = [headers];
    for (const e of data ?? []) {
      rows.push([
        frDate(e.expense_date),
        e.label,
        e.vendor ?? '',
        e.category,
        e.amount_ht != null ? fr(Number(e.amount_ht)) : '',
        e.vat_rate != null ? `${e.vat_rate}%` : '',
        fr(Number(e.amount_ttc)),
        e.notes ?? '',
      ]);
    }
    csv = buildCsv(rows);
    filename = `depenses_${from}_${to}.csv`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
