-- =============================================================
-- AVA-Lou · 0006 · Expenses (notes de frais, CdC §3.3 V2)
-- =============================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  vendor text,
  amount_ttc numeric not null default 0,
  amount_ht numeric,
  vat_rate numeric,
  category text default 'autre' check (category in ('matériel','déplacement','sous-traitance','restauration','téléphonie','outillage','formation','autre')),
  expense_date date default current_date,
  notes text,
  created_at timestamptz default now()
);

create index if not exists expenses_user_date_idx
  on public.expenses(user_id, expense_date desc);

alter table public.expenses enable row level security;

drop policy if exists "own_expenses" on public.expenses;
create policy "own_expenses" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
