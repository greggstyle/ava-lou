import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeNextRunDate, computeRecurringAmounts, type RecurringTemplate } from '@/lib/recurring';
import { insertWithNumbering } from '@/lib/numbering';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily recurring invoice generation. Runs every day at 06:00 UTC.
 * For each non-paused template where next_run_date <= today AND not past end_date,
 * insert a new invoice and advance next_run_date.
 *
 * Auth: Vercel cron sets `x-vercel-cron: 1`. Optional CRON_SECRET fallback.
 */
export async function GET(req: NextRequest) {
  // REQUIRE CRON_SECRET — see weekly/route.ts for rationale
  const secret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const todayIso = new Date().toISOString().slice(0, 10);
  const year = new Date().getUTCFullYear();

  // Fetch all templates due today across all users (RLS bypassed via admin client)
  const { data: templates, error: fetchErr } = await supabase
    .from('recurring_invoices')
    .select('*')
    .eq('is_paused', false)
    .lte('next_run_date', todayIso)
    .limit(500);
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of templates ?? []) {
    const template = raw as RecurringTemplate;
    try {
      // Past end_date → skip + pause
      if (template.end_date && template.end_date < todayIso) {
        await supabase
          .from('recurring_invoices')
          .update({ is_paused: true })
          .eq('id', template.id);
        skipped += 1;
        continue;
      }

      // Compute amounts; numbering is atomic via insertWithNumbering
      const { amount_ht, amount_vat, amount_ttc, line_items } = computeRecurringAmounts(template);

      const { error: insErr } = await insertWithNumbering({
        supabase,
        table: 'invoices',
        prefix: 'FAC',
        userId: template.user_id,
        year,
        payloadWithoutNumber: {
          user_id: template.user_id,
          client_id: template.client_id,
          status: 'brouillon',
          issue_date: todayIso,
          due_date: null,
          vat_rate: template.vat_rate ?? 20,
          amount_ht,
          amount_vat,
          amount_ttc,
          line_items,
          notes: template.notes ? `Récurrent (${template.label}) — ${template.notes}` : `Récurrent (${template.label})`,
        },
        selectColumns: 'id',
      });
      if (insErr) {
        errors.push(`template ${template.id}: ${insErr.message}`);
        continue;
      }

      // Advance next_run_date
      const next = computeNextRunDate(template.next_run_date, template.cadence, template.custom_days);
      await supabase
        .from('recurring_invoices')
        .update({
          next_run_date: next,
          last_generated_at: new Date().toISOString(),
          generated_count: (template.generated_count ?? 0) + 1,
        })
        .eq('id', template.id);

      generated += 1;
    } catch (err) {
      errors.push(`template ${template.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return NextResponse.json({
    ok: true,
    today: todayIso,
    templates_checked: templates?.length ?? 0,
    generated,
    skipped,
    errors,
  });
}
