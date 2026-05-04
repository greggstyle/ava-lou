import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPriceFR } from '@/lib/format';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Weekly proactive scan — runs Monday 7:30 (CdC §6.3).
 * For each user, compute overdue invoices + pending quotes and create a
 * notification surfaced on the home page.
 *
 * Auth: Vercel cron sets `x-vercel-cron: 1` header. Optional CRON_SECRET
 * env can also be checked for manual triggers.
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

  // Get all users with at least one invoice
  const { data: usersData } = await supabase
    .from('invoices')
    .select('user_id')
    .neq('user_id', null);

  const userIds = Array.from(new Set((usersData ?? []).map((r) => r.user_id as string)));
  let createdCount = 0;

  for (const userId of userIds) {
    try {
      // Skip if a weekly recap was already created this week
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { count: existing } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'weekly_recap')
        .gte('created_at', oneWeekAgo.toISOString());
      if ((existing ?? 0) > 0) continue;

      // Fetch overdue invoices
      const { data: overdue } = await supabase
        .from('invoices')
        .select('amount_ttc, due_date, clients(name)')
        .eq('user_id', userId)
        .eq('status', 'en_retard');

      const overdueCount = overdue?.length ?? 0;
      const overdueTotal = (overdue ?? []).reduce((s, i) => s + Number(i.amount_ttc), 0);

      // Fetch open quotes > 14 days (CdC §6.3)
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const { data: openQuotes } = await supabase
        .from('quotes')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'envoyé')
        .lt('issue_date', fourteenDaysAgo.toISOString().slice(0, 10));
      const staleQuotesCount = openQuotes?.length ?? 0;

      // Skip notification if nothing actionable
      if (overdueCount === 0 && staleQuotesCount === 0) continue;

      const parts: string[] = [];
      if (overdueCount > 0) {
        parts.push(`${overdueCount} facture${overdueCount > 1 ? 's' : ''} en retard pour ${formatPriceFR(overdueTotal)}`);
      }
      if (staleQuotesCount > 0) {
        parts.push(`${staleQuotesCount} devis sans réponse depuis 14 jours`);
      }

      const title = 'Récap de la semaine';
      const body = parts.join(' · ') + '. Voulez-vous lancer les relances ?';

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'weekly_recap',
        title,
        body,
        payload: { overdue_total: overdueTotal, overdue_count: overdueCount, stale_quotes: staleQuotesCount },
        action_intent: 'send_reminder',
        action_url: '/factures',
      });
      createdCount += 1;
    } catch (err) {
      console.warn('[cron weekly] user error', userId, err);
    }
  }

  return NextResponse.json({ ok: true, users: userIds.length, notifications_created: createdCount });
}
