import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeTotals, nextDocumentNumber } from '@/lib/format';
import type { IntentEntities, LineItem } from '@/lib/types';

export const runtime = 'nodejs';

function sanitizeLineItems(input: unknown, defaultVat: number): LineItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw): LineItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as Record<string, unknown>;
      const label = typeof r.label === 'string' ? r.label : '';
      const qty = typeof r.qty === 'number' ? r.qty : Number(r.qty);
      const unitPrice =
        typeof r.unit_price === 'number' ? r.unit_price : Number(r.unit_price);
      const vatRate =
        typeof r.vat_rate === 'number' ? r.vat_rate : Number(r.vat_rate);
      if (!label || !Number.isFinite(qty) || !Number.isFinite(unitPrice)) return null;
      return {
        label,
        qty,
        unit_price: unitPrice,
        vat_rate: Number.isFinite(vatRate) ? vatRate : defaultVat,
      };
    })
    .filter((x): x is LineItem => x !== null);
}

async function findOrCreateClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string | null,
  email: string | null,
): Promise<string | null> {
  if (!name) return null;
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from('clients')
    .insert({ user_id: userId, name, email })
    .select('id')
    .single();
  if (error || !created) return null;
  return created.id;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: action, error: loadErr } = await supabase
    .from('ava_actions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (loadErr || !action) {
    return NextResponse.json({ error: 'Action introuvable.' }, { status: 404 });
  }
  if (action.status !== 'pending') {
    return NextResponse.json(
      { error: 'Cette action a déjà été traitée.' },
      { status: 400 },
    );
  }

  const entities = (action.entities ?? {}) as Partial<IntentEntities>;

  const { data: profile } = await supabase
    .from('profiles')
    .select('vat_default')
    .eq('id', user.id)
    .maybeSingle();
  const defaultVat = Number(profile?.vat_default ?? 20);

  const intent = action.intent as string;

  if (intent === 'create_invoice' || intent === 'create_quote') {
    const lineItems = sanitizeLineItems(entities.line_items, defaultVat);
    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Aucune ligne valide à enregistrer.' },
        { status: 400 },
      );
    }
    const totals = computeTotals(lineItems);

    const clientId = await findOrCreateClient(
      supabase,
      user.id,
      entities.client_name ?? null,
      entities.client_email ?? null,
    );

    const isInvoice = intent === 'create_invoice';
    const table = isInvoice ? 'invoices' : 'quotes';
    const prefix = isInvoice ? 'FAC' : 'DEV';
    const year = new Date().getFullYear();

    // Count existing docs this year for numbering
    const yearStart = `${year}-01-01`;
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', yearStart);

    const number = nextDocumentNumber(prefix, year, count ?? 0);
    const vatRate = lineItems[0]?.vat_rate ?? defaultVat;

    const { data: inserted, error: insertErr } = await supabase
      .from(table)
      .insert({
        user_id: user.id,
        client_id: clientId,
        number,
        status: 'brouillon',
        vat_rate: vatRate,
        amount_ht: totals.amount_ht,
        amount_vat: totals.amount_vat,
        amount_ttc: totals.amount_ttc,
        line_items: lineItems,
        notes: entities.notes ?? null,
        ...(isInvoice
          ? { due_date: entities.due_date ?? null }
          : { expiry_date: entities.due_date ?? null }),
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      console.error('[confirm] insert error', insertErr);
      return NextResponse.json(
        { error: "Impossible de créer le document." },
        { status: 500 },
      );
    }

    await supabase
      .from('ava_actions')
      .update({
        status: 'executed',
        target_table: table,
        target_id: inserted.id,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    return NextResponse.json({ target_table: table, target_id: inserted.id });
  }

  return NextResponse.json(
    { error: 'Action non implémentée en V0.' },
    { status: 400 },
  );
}
