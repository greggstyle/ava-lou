import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAndPersistInsights } from '@/lib/insights';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — Claude calls take time

/**
 * Weekly insights generation. Runs Sunday 18:00 UTC (CdC §1.2 niveau 3).
 * For each active user with >= 3 invoices in the last 90 days, generates
 * 3-5 strategic insights via Claude and persists them.
 *
 * Auth: Vercel cron sets `x-vercel-cron: 1`. Optional CRON_SECRET fallback.
 */
export async function GET(req: NextRequest) {
  const isCron = req.headers.get('x-vercel-cron') === '1';
  const secret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const isAuthed = isCron || (secret && headerSecret === secret);

  if (!isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Find users who actually used the app recently (have invoices)
  const { data: usersData } = await supabase
    .from('invoices')
    .select('user_id')
    .gte('created_at', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString());

  const userIds = Array.from(new Set((usersData ?? []).map((r) => r.user_id as string)));
  let processed = 0;
  let generatedTotal = 0;
  const skipped: Record<string, number> = {};

  for (const userId of userIds) {
    try {
      // Skip if a run already exists this week
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { count: existing } = await supabase
        .from('insights')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('generated_at', sevenDaysAgo.toISOString());
      if ((existing ?? 0) > 0) {
        skipped['already_generated'] = (skipped['already_generated'] ?? 0) + 1;
        continue;
      }

      const result = await generateAndPersistInsights(supabase, userId);
      processed += 1;
      generatedTotal += result.generated;
      if (result.skipped_reason) {
        skipped[result.skipped_reason] = (skipped[result.skipped_reason] ?? 0) + 1;
      }
    } catch (err) {
      console.warn('[cron insights] user error', userId, err);
      skipped['exception'] = (skipped['exception'] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    ok: true,
    users_seen: userIds.length,
    processed,
    insights_generated: generatedTotal,
    skipped,
  });
}
