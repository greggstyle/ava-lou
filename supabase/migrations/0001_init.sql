-- =============================================================
-- AVA-Lou · Schema initial (V0)
-- Source : Cahier des charges §5.1, simplifié pour V0 web
-- =============================================================

-- ----- profiles -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  siret text,
  activity_sector text,
  vat_default numeric default 20,
  is_drom boolean default false,
  tutoiement boolean default false,
  created_at timestamptz default now()
);

-- ----- clients ------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists clients_user_idx on public.clients(user_id);

-- ----- invoices -----------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  number text,
  status text default 'brouillon' check (status in ('brouillon','envoyée','payée','en_retard')),
  issue_date date default current_date,
  due_date date,
  vat_rate numeric default 20,
  amount_ht numeric not null default 0,
  amount_vat numeric not null default 0,
  amount_ttc numeric not null default 0,
  line_items jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now()
);
create index if not exists invoices_user_idx on public.invoices(user_id);

-- ----- quotes (devis) -----------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  number text,
  status text default 'brouillon' check (status in ('brouillon','envoyé','accepté','refusé','expiré')),
  issue_date date default current_date,
  expiry_date date,
  vat_rate numeric default 20,
  amount_ht numeric not null default 0,
  amount_vat numeric not null default 0,
  amount_ttc numeric not null default 0,
  line_items jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now()
);
create index if not exists quotes_user_idx on public.quotes(user_id);

-- ----- ava_actions (traces vocales) ---------------------------------------
create table if not exists public.ava_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_raw text,
  intent text,
  entities jsonb,
  confidence numeric,
  status text default 'pending' check (status in ('pending','confirmed','executed','cancelled')),
  ava_response text,
  target_table text,
  target_id uuid,
  processing_ms integer,
  created_at timestamptz default now()
);
create index if not exists ava_actions_user_idx on public.ava_actions(user_id);

-- =============================================================
-- Row-Level Security
-- =============================================================
alter table public.profiles    enable row level security;
alter table public.clients     enable row level security;
alter table public.invoices    enable row level security;
alter table public.quotes      enable row level security;
alter table public.ava_actions enable row level security;

drop policy if exists "own_profile" on public.profiles;
create policy "own_profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own_clients" on public.clients;
create policy "own_clients" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_invoices" on public.invoices;
create policy "own_invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_quotes" on public.quotes;
create policy "own_quotes" on public.quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_actions" on public.ava_actions;
create policy "own_actions" on public.ava_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================
-- Trigger : auto-create profile when a new auth.user signs up
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
