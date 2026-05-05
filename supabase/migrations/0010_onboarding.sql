-- 0010_onboarding.sql — track when the artisan completed (or dismissed)
-- the first-launch setup wizard so we don't show it on every visit.

alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists onboarding_dismissed_at timestamptz;
