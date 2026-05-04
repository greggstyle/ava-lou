-- =============================================================
-- AVA-Lou · 0003 · Idempotency + UNIQUE numbering + Legal fields
-- =============================================================

-- ----- 1. ava_actions: allow 'executing' transient status ----------------
alter table public.ava_actions drop constraint if exists ava_actions_status_check;
alter table public.ava_actions add constraint ava_actions_status_check
  check (status in ('pending','confirmed','executing','executed','cancelled'));

-- ----- 2. UNIQUE numbering per user --------------------------------------
create unique index if not exists invoices_user_number_unique
  on public.invoices(user_id, number) where number is not null;
create unique index if not exists quotes_user_number_unique
  on public.quotes(user_id, number) where number is not null;

-- ----- 3. profiles: legal mentions (art. L441-9 + R441-3) ----------------
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists postal_code text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists naf_code text;
alter table public.profiles add column if not exists naf_label text;
alter table public.profiles add column if not exists legal_form text;
alter table public.profiles add column if not exists capital_social numeric;
alter table public.profiles add column if not exists rcs text;
alter table public.profiles add column if not exists vat_intra text;
alter table public.profiles add column if not exists tva_franchise boolean default true;
alter table public.profiles add column if not exists late_penalty_rate numeric default 10.5;
alter table public.profiles add column if not exists late_penalty_indemnity numeric default 40;
alter table public.profiles add column if not exists payment_terms_days integer default 30;
alter table public.profiles add column if not exists b2c_mediator text;

-- ----- 4. clients: pro fields (acheteur facturable) -----------------------
alter table public.clients add column if not exists company_name text;
alter table public.clients add column if not exists siret text;
alter table public.clients add column if not exists vat_intra text;
alter table public.clients add column if not exists postal_code text;
alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists is_business boolean default false;
