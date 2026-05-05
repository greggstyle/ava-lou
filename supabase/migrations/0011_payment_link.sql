-- 0011_payment_link.sql — payment link template on profile
--
-- L'artisan colle ici un lien de paiement (Stripe Payment Link, SumUp,
-- PayPal.me, Lydia, etc.) qu'il a créé une fois dans son outil. AVA
-- l'inclut dans les emails send_payment_link en plus de l'IBAN, pour
-- proposer un règlement par CB en 1 clic au client.

alter table public.profiles add column if not exists payment_link_url text;
alter table public.profiles add column if not exists payment_link_provider text;

-- Light validation: URL ≤ 500 chars, provider name ≤ 50
alter table public.profiles add constraint profiles_payment_link_url_len_chk
  check (payment_link_url is null or char_length(payment_link_url) <= 500);
alter table public.profiles add constraint profiles_payment_link_provider_len_chk
  check (payment_link_provider is null or char_length(payment_link_provider) <= 50);
