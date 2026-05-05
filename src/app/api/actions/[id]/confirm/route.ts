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
  const trimmed = name.trim();

  // 1. Exact (case-insensitive) match — most common for repeat clients
  const { data: exact } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle();
  if (exact?.id) return exact.id;

  // 2. Fuzzy match — handles "Payet" vs "M. Payet" (whisper transcript may
  // omit civility). Use the raw name as a substring to catch both directions.
  const { data: fuzzy } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', `%${trimmed}%`)
    .limit(5);
  if (fuzzy && fuzzy.length > 0) {
    // Prefer shortest name (closest to original) when multiple match
    const best = fuzzy.sort((a, b) => a.name.length - b.name.length)[0];
    return best.id;
  }

  // 3. Reverse fuzzy — client name in DB might be a substring of dictation
  // ("Mme Hoarau Marie-José" dictated, DB has "Mme Hoarau")
  const { data: rev } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', userId);
  if (rev) {
    const matched = rev.find((c) =>
      c.name && trimmed.toLowerCase().includes(c.name.toLowerCase()),
    );
    if (matched) return matched.id;
  }

  // 4. No match — create new client
  const { data: created, error } = await supabase
    .from('clients')
    .insert({ user_id: userId, name: trimmed, email })
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

  // Atomic claim: only one request can transition pending -> executing.
  // Prevents double-tap from creating duplicate invoices.
  const { data: action, error: claimErr } = await supabase
    .from('ava_actions')
    .update({ status: 'executing' })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (claimErr || !action) {
    return NextResponse.json(
      { error: 'Action déjà traitée ou introuvable.' },
      { status: 409 },
    );
  }

  const entities = (action.entities ?? {}) as Partial<IntentEntities>;

  const { data: profile } = await supabase
    .from('profiles')
    .select('vat_default, is_drom')
    .eq('id', user.id)
    .maybeSingle();
  const defaultVat = Number(
    profile?.vat_default ?? (profile?.is_drom ? 8.5 : 20),
  );

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
      // Roll back the claim so the user can retry
      await supabase
        .from('ava_actions')
        .update({ status: 'pending' })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('status', 'executing');
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

  // schedule_appointment: insert into appointments
  if (intent === 'schedule_appointment') {
    const apt = (entities as Partial<IntentEntities> & {
      appointment?: { title: string; starts_at: string; ends_at: string | null; location: string | null; client_id: string | null }
    }).appointment;
    if (!apt || !apt.starts_at) {
      await supabase.from('ava_actions').update({ status: 'pending' }).eq('id', id).eq('user_id', user.id).eq('status', 'executing');
      return NextResponse.json({ error: 'Date du RDV manquante.' }, { status: 400 });
    }
    const { data: inserted, error: insErr } = await supabase
      .from('appointments')
      .insert({
        user_id: user.id,
        client_id: apt.client_id,
        title: apt.title,
        starts_at: apt.starts_at,
        ends_at: apt.ends_at,
        location: apt.location,
        notes: action.input_raw,
        status: 'planifié',
      })
      .select('id')
      .single();
    if (insErr || !inserted) {
      await supabase.from('ava_actions').update({ status: 'pending' }).eq('id', id).eq('user_id', user.id).eq('status', 'executing');
      return NextResponse.json({ error: 'Impossible de créer le RDV.' }, { status: 500 });
    }
    await supabase
      .from('ava_actions')
      .update({ status: 'executed', target_table: 'appointments', target_id: inserted.id })
      .eq('id', id)
      .eq('user_id', user.id);
    return NextResponse.json({ target_table: 'appointments', target_id: inserted.id });
  }

  // mark_paid: update invoice status to 'payée'
  if (intent === 'mark_paid') {
    const candidateId = (entities as Partial<IntentEntities> & { candidate_invoice_id?: string }).candidate_invoice_id;
    if (!candidateId) {
      await supabase.from('ava_actions').update({ status: 'pending' }).eq('id', id).eq('user_id', user.id).eq('status', 'executing');
      return NextResponse.json(
        { error: 'Pas de facture identifiée à marquer. Précisez le client.' },
        { status: 400 },
      );
    }
    const { data: updated, error: upErr } = await supabase
      .from('invoices')
      .update({ status: 'payée' })
      .eq('id', candidateId)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();
    if (upErr || !updated) {
      await supabase.from('ava_actions').update({ status: 'pending' }).eq('id', id).eq('user_id', user.id).eq('status', 'executing');
      return NextResponse.json(
        { error: "Impossible de mettre à jour la facture." },
        { status: 500 },
      );
    }
    await supabase
      .from('ava_actions')
      .update({ status: 'executed', target_table: 'invoices', target_id: updated.id })
      .eq('id', id)
      .eq('user_id', user.id);
    return NextResponse.json({ target_table: 'invoices', target_id: updated.id, marked_paid: true });
  }

  // Unknown / not implemented — release claim
  await supabase
    .from('ava_actions')
    .update({ status: 'pending' })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'executing');

  return NextResponse.json(
    { error: 'Action non implémentée en V0.' },
    { status: 400 },
  );
}
