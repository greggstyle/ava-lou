/**
 * Atomic invoice / quote numbering with retry on race.
 *
 * Why: 5 different code paths compute `count(*)` then `count + 1` then insert.
 * Two concurrent requests can read the same count and try to insert the same
 * number. The UNIQUE (user_id, number) constraint catches it, but the user
 * sees a 500. We retry on `23505` (Postgres unique violation) up to 5 times
 * — under realistic concurrency that's plenty.
 *
 * Used by: /api/factures, /api/devis, /api/devis/[id]/convert,
 * /api/actions/[id]/confirm, /api/cron/recurring.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { nextDocumentNumber } from './format';

interface InsertResult<T> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

const MAX_ATTEMPTS = 5;

export async function insertWithNumbering<T>(opts: {
  supabase: SupabaseClient;
  table: 'invoices' | 'quotes';
  prefix: 'FAC' | 'DEV';
  userId: string;
  year: number;
  payloadWithoutNumber: Record<string, unknown>;
  selectColumns?: string;
}): Promise<InsertResult<T>> {
  const { supabase, table, prefix, userId, year, payloadWithoutNumber, selectColumns = '*' } = opts;

  let lastError: { code?: string; message: string } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Recompute count each time so retries pick up the latest state. The
    // `gte` on year-bucket prefix matches the existing nextDocumentNumber()
    // semantics: per-user, per-year sequence.
    const { count, error: countErr } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .like('number', `${prefix}-${year}-%`);

    if (countErr) {
      return { data: null, error: { message: countErr.message } };
    }

    // Bias by attempt to avoid thundering herd: if we collide on attempt 0,
    // the second tries N+2 instead of N+1.
    const number = nextDocumentNumber(prefix, year, (count ?? 0) + attempt);

    const { data, error } = await supabase
      .from(table)
      .insert({ ...payloadWithoutNumber, number })
      .select(selectColumns)
      .single();

    if (!error) {
      return { data: data as T, error: null };
    }

    // Unique violation on (user_id, number) — retry with next number
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      lastError = { code, message: error.message };
      continue;
    }

    // Other errors — bubble up immediately
    return { data: null, error: { code, message: error.message } };
  }

  return {
    data: null,
    error: lastError ?? { message: `Numbering retry exhausted after ${MAX_ATTEMPTS} attempts` },
  };
}
