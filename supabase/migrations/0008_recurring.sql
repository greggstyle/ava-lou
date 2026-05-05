-- =============================================================
-- AVA-Lou · 0008 · Recurring invoices (CdC §3.4 V2)
-- =============================================================

create table if not exists public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  label text not null,
  cadence text not null check (cadence in (
    'monthly','bimonthly','quarterly','semiannual','annual','custom_days'
  )),
  custom_days integer,
  next_run_date date not null,
  end_date date,
  amount_ttc numeric not null,
  amount_ht numeric,
  vat_rate numeric default 20,
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  is_paused boolean default false,
  last_generated_at timestamptz,
  generated_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists recurring_user_next_idx
  on public.recurring_invoices(user_id, is_paused, next_run_date)
  where is_paused = false;

alter table public.recurring_invoices enable row level security;

drop policy if exists "own_recurring" on public.recurring_invoices;
create policy "own_recurring" on public.recurring_invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
