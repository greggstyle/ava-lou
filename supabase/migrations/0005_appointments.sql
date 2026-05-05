-- =============================================================
-- AVA-Lou · 0005 · Appointments (RDV chantier, CdC §3.2 V1)
-- =============================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  status text default 'planifié' check (status in ('planifié','effectué','annulé','reporté')),
  created_at timestamptz default now()
);

create index if not exists appointments_user_starts_idx
  on public.appointments(user_id, starts_at);

alter table public.appointments enable row level security;

drop policy if exists "own_appointments" on public.appointments;
create policy "own_appointments" on public.appointments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
