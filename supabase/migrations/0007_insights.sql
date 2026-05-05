-- =============================================================
-- AVA-Lou · 0007 · Insights (CdC §1.2 niveau 3 — AVA Conseillère)
-- =============================================================

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'cashflow','client_behavior','seasonality','growth',
    'overdue_pattern','tariff_drift','quote_conversion','expense_ratio','custom'
  )),
  title text not null,
  body text not null,
  metric_label text,
  metric_value text,
  severity text not null default 'info' check (severity in ('info','warn','opportunity')),
  payload jsonb default '{}'::jsonb,
  is_read boolean default false,
  is_dismissed boolean default false,
  generated_at timestamptz default now(),
  generated_for_period text
);

create index if not exists insights_user_unread_idx
  on public.insights(user_id, is_dismissed, generated_at desc)
  where is_dismissed = false;

create index if not exists insights_user_kind_idx
  on public.insights(user_id, kind, generated_at desc);

alter table public.insights enable row level security;

drop policy if exists "own_insights" on public.insights;
create policy "own_insights" on public.insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
