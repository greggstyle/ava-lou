-- 0009_iban.sql — IBAN + BIC on profile so factures display payment coordinates
--
-- Why: V13 send_payment_link references "vous y trouverez l'IBAN pour virement"
-- but no IBAN field existed. Without it the public invoice page is incomplete
-- and clients can't pay by virement (still the dominant B2B payment method
-- in France).

alter table public.profiles add column if not exists iban text;
alter table public.profiles add column if not exists bic text;
alter table public.profiles add column if not exists bank_name text;

-- Light validation: iban string is at most 34 chars (IBAN max length, FR is 27).
alter table public.profiles add constraint profiles_iban_len_chk
  check (iban is null or char_length(iban) <= 34);
alter table public.profiles add constraint profiles_bic_len_chk
  check (bic is null or char_length(bic) <= 11);
