-- =============================================================
-- AVA-Lou · 0004 · Notifications proactives (V2 CdC §1.2 niveau 2)
-- =============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('reminder','unpaid','quote_expired','cashflow_alert','weekly_recap','tip')),
  title text not null,
  body text,
  payload jsonb default '{}'::jsonb,
  is_read boolean default false,
  is_dismissed boolean default false,
  action_intent text,
  action_url text,
  created_at timestamptz default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_dismissed, created_at desc)
  where is_dismissed = false;

alter table public.notifications enable row level security;

drop policy if exists "own_notifications" on public.notifications;
create policy "own_notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
